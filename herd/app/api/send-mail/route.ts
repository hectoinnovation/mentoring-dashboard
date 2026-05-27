import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { to, subject, text, html } = await req.json()
    if (!to || !subject) {
      return NextResponse.json({ error: 'to, subject 필수' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      ...(html ? { html, text: text ?? '' } : { text: text ?? '' }),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-mail]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
