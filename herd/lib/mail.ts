/**
 * lib/mail.ts — nodemailer SMTP 발송 (hr-notification-dashboard와 동일한 방식)
 *
 * 포트별 TLS 자동 선택:
 *   465 → secure: true  (SSL/TLS 직접 연결)
 *   587 → secure: false + requireTLS: true  (STARTTLS)
 *
 * tls.servername: 네이버웍스 등 SNI 필수 서버 대응
 */
import { createTransport } from 'nodemailer'

export interface MailPayload {
  to:       string[]
  cc?:      string[]
  subject:  string
  html:     string
  text?:    string
}

export async function sendMail({ to, cc, subject, html, text }: MailPayload): Promise<string | null> {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  // MAIL_FROM 우선, 구 SMTP_FROM 하위호환, 없으면 SMTP_USER
  const from = process.env.MAIL_FROM ?? process.env.SMTP_FROM ?? user

  if (!host || !user || !pass) {
    return 'SMTP 환경변수가 설정되지 않았습니다. (SMTP_HOST, SMTP_USER, SMTP_PASS)'
  }

  const useSSL = port === 465

  try {
    const transporter = createTransport({
      host,
      port,
      secure: useSSL,
      ...(useSSL ? {} : { requireTLS: true }),
      auth: { user, pass },
      tls: {
        // SNI 명시 — 네이버웍스(smtp.worksmobile.com) 등 일부 서버 필수
        servername: host,
      },
    })
    await transporter.sendMail({
      from,
      to,
      ...(cc && cc.length > 0 ? { cc } : {}),
      subject,
      html,
      ...(text ? { text } : {}),
    })
    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sendMail] 오류 →', msg)
    return msg
  }
}
