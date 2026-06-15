/**
 * /api/cron/auto-mail
 *
 * Vercel Cron Job (매일 01:00 UTC = KST 10:00):
 *  1. 자동 발송 — join_date 기준 D-7, D-1, D-Day, 입사 후 7일, 30일
 *  2. 예약 발송 — scheduled_mails 테이블에서 scheduled_at <= now() 인 건 발송
 *
 * 인증: Vercel이 Authorization: Bearer <CRON_SECRET> 헤더를 자동으로 추가함.
 * 수동 테스트: GET /api/cron/auto-mail?secret=<CRON_SECRET>&debug=1
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMail } from '@/lib/mail'
import {
  generateAutoMailHtml, getAutoMailSubject,
  AUTO_MAIL_DAYS, type AutoMailType,
} from '@/lib/auto-mail'

export const runtime    = 'nodejs'
export const dynamic    = 'force-dynamic'
export const maxDuration = 60

/** YYYY-MM-DD 기준 ±daysOffset 날짜 반환 */
function addDays(base: string, offset: number): string {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

/** KST 기준 오늘 날짜 (UTC+9) */
function todayKST(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get('debug') === '1'

  // ── 환경변수 진단 정보 (debug=1 시 응답에 포함) ──────────────────────────
  const diagnostics: Record<string, unknown> = {}
  if (debug) {
    diagnostics.supabaseUrl   = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').slice(0, 50) + '...'
    diagnostics.hasAnonKey    = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    diagnostics.hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    diagnostics.hasCronSecret = !!process.env.CRON_SECRET
    diagnostics.smtpHost      = process.env.SMTP_HOST ?? null
    diagnostics.smtpPort      = process.env.SMTP_PORT ?? null
    diagnostics.smtpUser      = process.env.SMTP_USER ?? null
    diagnostics.hasSmtpPass   = !!process.env.SMTP_PASS
    diagnostics.smtpPassLen   = (process.env.SMTP_PASS ?? '').length
    diagnostics.mailFrom      = process.env.MAIL_FROM ?? null
  }

  // ── 인증 확인 ────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth        = req.headers.get('authorization')
    const querySecret = req.nextUrl.searchParams.get('secret')
    const passed      = auth === `Bearer ${secret}` || querySecret === secret
    if (debug) diagnostics.authPassed = passed
    if (!passed) {
      return NextResponse.json(
        { error: 'Unauthorized', ...(debug ? { diagnostics } : {}) },
        { status: 401 },
      )
    }
  } else {
    if (debug) diagnostics.authPassed = 'no-secret-bypass'
  }

  // ── Supabase 클라이언트 ───────────────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const today  = todayKST()
  const nowIso = new Date().toISOString()
  if (debug) {
    diagnostics.today  = today
    diagnostics.nowIso = nowIso
  }

  const results: {
    category: string
    target:   string
    type:     string
    status:   string
  }[] = []

  try {
    // ── 1. 예약 메일 발송 ────────────────────────────────────────────────────
    const { data: scheduled, error: schErr } = await supabase
      .from('scheduled_mails')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', nowIso)

    if (debug) {
      diagnostics.scheduledCount = scheduled?.length ?? 0
      diagnostics.scheduledError = schErr ? `${schErr.code}: ${schErr.message}` : null
      diagnostics.scheduledRows  = (scheduled ?? []).map(r => ({
        id: r.id, to: r.to_email, scheduled_at: r.scheduled_at,
      }))
    }

    if (schErr) console.error('[cron] scheduled_mails 조회 오류:', schErr)

    for (const mail of (scheduled ?? [])) {
      try {
        const toArr = String(mail.to_email).split(',').map((s: string) => s.trim()).filter(Boolean)
        const ccArr = mail.cc_email
          ? String(mail.cc_email).split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined

        const sendErr = await sendMail({
          to:      toArr,
          cc:      ccArr,
          subject: mail.subject,
          html:    mail.html,
          text:    mail.body_text ?? undefined,
        })

        if (!sendErr) {
          await supabase
            .from('scheduled_mails')
            .update({ status: 'sent', sent_at: nowIso, updated_at: nowIso })
            .eq('id', mail.id)
          results.push({ category: '예약', target: mail.to_email, type: mail.subject, status: 'sent' })
        } else {
          // 발송 실패 시 status는 pending 유지 (다음 cron에서 재시도)
          results.push({ category: '예약', target: mail.to_email, type: mail.subject, status: `error: ${sendErr}` })
        }
      } catch (e) {
        results.push({ category: '예약', target: mail.to_email, type: mail.subject, status: `exception: ${String(e)}` })
      }
    }

    // ── 2. 자동 메일 발송 (D-7, D-1, D-Day, +7, +30) ──────────────────────
    const { data: mentors, error: mErr } = await supabase
      .from('mentoring_pairs')
      .select('id, mentor_name, mentor_email, mentee_name, join_date, status')
      .eq('status', 'active')

    if (debug) {
      diagnostics.mentorCount = mentors?.length ?? 0
      diagnostics.mentorError = mErr ? `${mErr.code}: ${mErr.message}` : null
    }

    if (mErr) {
      console.error('[cron/auto-mail] mentoring_pairs 조회 오류:', mErr)
      return NextResponse.json({
        ok:    true,
        date:  today,
        total: results.length,
        results,
        warn:  `mentoring_pairs 조회 실패: ${mErr.code} ${mErr.message}`,
        ...(debug ? { diagnostics } : {}),
      })
    }

    if (mentors && mentors.length > 0) {
      const mentorIds = mentors.map((m: { id: string }) => m.id)
      const { data: logs } = await supabase
        .from('auto_mail_log')
        .select('mentor_id, mail_type')
        .in('mentor_id', mentorIds)

      const sent = new Set(
        ((logs ?? []) as { mentor_id: string; mail_type: string }[]).map(l => `${l.mentor_id}:${l.mail_type}`)
      )

      const TYPES = Object.keys(AUTO_MAIL_DAYS) as AutoMailType[]

      for (const mentor of mentors) {
        if (!mentor.join_date || !mentor.mentor_email) continue

        for (const type of TYPES) {
          const targetDate = addDays(mentor.join_date, AUTO_MAIL_DAYS[type])
          if (debug) {
            if (!diagnostics.autoMailChecks) diagnostics.autoMailChecks = []
            ;(diagnostics.autoMailChecks as unknown[]).push({
              mentor: mentor.mentor_name, type, targetDate, today, match: targetDate === today,
            })
          }
          if (targetDate !== today) continue

          const key = `${mentor.id}:${type}`
          if (sent.has(key)) continue

          try {
            const subject = getAutoMailSubject(type, mentor.mentor_name, mentor.join_date)
            const html    = generateAutoMailHtml(type, mentor.mentor_name, mentor.mentee_name ?? '', mentor.join_date)

            const sendErr = await sendMail({
              to: [mentor.mentor_email],
              subject,
              html,
            })

            if (!sendErr) {
              await supabase.from('auto_mail_log').insert({
                mentor_id: mentor.id,
                mail_type: type,
                recipient: mentor.mentor_email,
                subject,
              })
              sent.add(key)
              results.push({ category: '자동', target: mentor.mentor_name, type, status: 'sent' })
            } else {
              results.push({ category: '자동', target: mentor.mentor_name, type, status: `error: ${sendErr}` })
            }
          } catch (e) {
            results.push({ category: '자동', target: mentor.mentor_name, type, status: `exception: ${String(e)}` })
          }
        }
      }
    }

    console.log(`[cron/auto-mail] ${today} 완료 — ${results.length}건 처리`, results)

    return NextResponse.json({
      ok:    true,
      date:  today,
      total: results.length,
      results,
      ...(debug ? { diagnostics } : {}),
    })

  } catch (err) {
    console.error('[cron/auto-mail] 오류:', err)
    return NextResponse.json(
      { error: String(err), ...(debug ? { diagnostics } : {}) },
      { status: 500 },
    )
  }
}
