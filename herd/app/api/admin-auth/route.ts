import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      return NextResponse.json(
        { ok: false, error: 'ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.' },
        { status: 500 },
      )
    }

    if (password === adminPassword) {
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json(
      { ok: false, error: '비밀번호가 올바르지 않습니다.' },
      { status: 401 },
    )
  } catch {
    return NextResponse.json({ ok: false, error: '요청 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
