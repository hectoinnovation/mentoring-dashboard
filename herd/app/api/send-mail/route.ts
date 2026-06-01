import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/mail'

// nodemailer는 Node.js 전용(net/tls) — Edge runtime에서 실행 시 500 발생
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { to, cc, subject, text, html } = await req.json()

    if (!to || !subject) {
      return NextResponse.json({ error: 'to, subject 필수' }, { status: 400 })
    }

    // to / cc: 쉼표 구분 string 또는 string[] 모두 허용
    const toArr: string[] = Array.isArray(to)
      ? to
      : String(to).split(',').map((s: string) => s.trim()).filter(Boolean)

    const ccArr: string[] | undefined = cc
      ? (Array.isArray(cc)
          ? cc
          : String(cc).split(',').map((s: string) => s.trim()).filter(Boolean))
      : undefined

    console.log('[api/send-mail] 수신 →', { to: toArr, cc: ccArr, subject })

    const err = await sendMail({ to: toArr, cc: ccArr, subject, html: html ?? '', text })
    if (err) {
      console.error('[api/send-mail] 발송 오류 →', err)
      return NextResponse.json({ error: err }, { status: 500 })
    }

    console.log('[api/send-mail] 발송 완료')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-mail] 예외 →', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
