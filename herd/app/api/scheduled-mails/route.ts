/**
 * /api/scheduled-mails — 예약 메일 CRUD
 *
 * GET    — 목록 조회
 * POST   — 예약 메일 생성
 * PATCH  — 날짜/시간 수정
 * DELETE — 취소
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ── GET: 목록 ────────────────────────────────────────────────────────────────
export async function GET() {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('scheduled_mails')
    .select('id, mentor_id, to_email, cc_email, subject, scheduled_at, status, sent_at, created_at')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mails: data ?? [] })
}

// ── POST: 생성 ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mentor_id, to_email, cc_email, subject, html, body_text, scheduled_at } = body

  if (!to_email || !subject || !html || !scheduled_at) {
    return NextResponse.json({ error: 'to_email, subject, html, scheduled_at 필수' }, { status: 400 })
  }

  const supabase = getClient()
  const { data, error } = await supabase
    .from('scheduled_mails')
    .insert({
      mentor_id:   mentor_id ?? null,
      to_email,
      cc_email:    cc_email ?? null,
      subject,
      html,
      body_text:   body_text ?? null,
      scheduled_at,
      status:      'pending',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}

// ── PATCH: 수정 ──────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { id, scheduled_at } = await req.json()
  if (!id || !scheduled_at) {
    return NextResponse.json({ error: 'id, scheduled_at 필수' }, { status: 400 })
  }

  const supabase = getClient()
  const { error } = await supabase
    .from('scheduled_mails')
    .update({ scheduled_at, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')  // 예약 상태인 것만 수정 가능

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ── DELETE: 취소 ─────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const supabase = getClient()
  const { error } = await supabase
    .from('scheduled_mails')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
