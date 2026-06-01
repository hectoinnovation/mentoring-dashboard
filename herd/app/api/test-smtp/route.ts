/**
 * GET /api/test-smtp
 *
 * SMTP 환경변수 확인 + 실제 연결/인증 테스트 (hr-notification-dashboard 방식 동일)
 *
 * 사용법:
 *   로컬:      http://localhost:3000/api/test-smtp
 *   배포:      https://<vercel-url>/api/test-smtp
 *
 * 주의: 민감 정보(비밀번호 길이만 표시)는 노출하지 않지만,
 *       프로덕션에서는 필요 시 삭제하거나 ADMIN_PASSWORD 헤더 체크를 추가하세요.
 */
import { NextResponse } from 'next/server'
import { createTransport } from 'nodemailer'

export const runtime = 'nodejs'

export async function GET() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.MAIL_FROM ?? process.env.SMTP_FROM

  const envStatus = {
    SMTP_HOST:  host ?? '⚠️ 미설정',
    SMTP_PORT:  isNaN(port) ? '⚠️ 미설정' : port,
    SMTP_USER:  user ?? '⚠️ 미설정',
    SMTP_PASS:  pass ? `설정됨 (${pass.length}자)` : '⚠️ 미설정',
    MAIL_FROM:  from ?? '⚠️ 미설정 (SMTP_USER로 대체)',
  }

  if (!host || !user || !pass) {
    return NextResponse.json({
      ok:    false,
      env:   envStatus,
      error: 'SMTP env 누락 — Vercel 환경변수를 확인하세요.',
    })
  }

  const useSSL = port === 465

  try {
    const transporter = createTransport({
      host,
      port,
      secure: useSSL,
      ...(useSSL ? {} : { requireTLS: true }),
      auth: { user, pass },
      tls:  { servername: host },
    })
    await transporter.verify()

    return NextResponse.json({
      ok:      true,
      env:     envStatus,
      tlsMode: useSSL ? 'SSL (port 465)' : 'STARTTLS (port 587)',
      message: '✅ SMTP 연결 및 인증 성공',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[test-smtp] verify 실패 →', msg)
    return NextResponse.json({
      ok:      false,
      env:     envStatus,
      tlsMode: useSSL ? 'SSL (port 465)' : 'STARTTLS (port 587)',
      error:   msg,
    })
  }
}
