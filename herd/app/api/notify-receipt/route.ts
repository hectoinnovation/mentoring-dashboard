import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { mentorName, menteeName, monthIndex, round, fileName, supportAmount } = await req.json()

    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      return NextResponse.json({ error: 'ADMIN_EMAIL env not set' }, { status: 500 })
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

    const subject = `[멘토링 영수증] ${mentorName}/${menteeName} ${monthIndex}개월차 ${round}회차 증빙 등록`
    const text = `멘토링 영수증이 등록되었습니다.

멘토: ${mentorName}
멘티: ${menteeName}
개월차: ${monthIndex}개월차
회차: ${round}회차
파일명: ${fileName}
예상 지원금: ${Number(supportAmount).toLocaleString()}원

내부망 품의 등록 후 결재를 진행해주세요.`

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: adminEmail,
      subject,
      text,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify-receipt]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
