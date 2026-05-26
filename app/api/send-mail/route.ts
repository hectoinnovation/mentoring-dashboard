import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/mail'

// nodemailer는 Node.js 전용 (net/tls 모듈 사용) — Edge runtime에서 실행 시 오류 발생
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    to: string | string[]
    cc?: string[]
    subject: string
    html: string
  }

  console.log('[api/send-mail] 수신 →', {
    to: body.to,
    subject: body.subject,
  })

  const err = await sendMail({
    to: body.to,
    cc: body.cc,
    subject: body.subject,
    html: body.html,
  })

  if (err) {
    console.error('[api/send-mail] 오류 →', err)
    return NextResponse.json({ error: err }, { status: 500 })
  }

  console.log('[api/send-mail] 발송 완료')
  return NextResponse.json({ ok: true })
}
