/**
 * 영수증 업로드 시 관리자에게 품의 필요 메일 알림
 * POST /api/notify-receipt
 *
 * Body: { pair, monthNo, fileName }
 * → ADMIN_EMAIL 환경변수로 알림 메일 발송
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/mail'
import { receiptUploadTemplate } from '@/lib/mail-templates'
import type { MentoringPair } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { pair, monthNo, fileName } = await req.json() as {
    pair: MentoringPair
    monthNo: number
    fileName: string | null
  }

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    console.warn('[notify-receipt] ADMIN_EMAIL 환경변수 미설정 — 메일 발송 생략')
    return NextResponse.json({ ok: true, skipped: true, reason: 'ADMIN_EMAIL 미설정' })
  }

  const tpl = receiptUploadTemplate(pair, monthNo, fileName)

  console.log('[notify-receipt] 발송 →', { to: adminEmail, subject: tpl.subject })

  const err = await sendMail({
    to: [adminEmail],
    subject: tpl.subject,
    html: tpl.html,
  })

  if (err) {
    console.error('[notify-receipt] 오류 →', err)
    return NextResponse.json({ error: err }, { status: 500 })
  }

  console.log('[notify-receipt] 발송 완료')
  return NextResponse.json({ ok: true })
}
