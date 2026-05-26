import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const IS_CONFIGURED = url.startsWith('http') && key.length > 10

// IS_CONFIGURED 가 false면 placeholder URL/key 사용 (빌드 에러 방지)
export const supabase = createClient(
  IS_CONFIGURED ? url : 'https://placeholder.supabase.co',
  IS_CONFIGURED ? key : 'placeholder-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
)

// ─────────────────────────────────────────────────────────────────────────────
// DB Types (matches Supabase tables)
// ─────────────────────────────────────────────────────────────────────────────

export interface MentoringPair {
  id: string
  mentor_name: string
  mentor_email: string
  mentee_name: string
  start_date: string   // 'YYYY-MM-DD'
  end_date: string     // 'YYYY-MM-DD' (3개월 후)
  current_month: number
  status: 'pending' | 'active' | 'completed' | 'finished'
  token: string
  created_at: string
}

export interface Expectation {
  id: string
  pair_id: string
  type: 'mentor' | 'mentee'
  content: string
  created_at: string
}

export interface Activity {
  id: string
  pair_id: string
  month_no: number      // 1, 2, 3
  round_no: number      // 1, 2, 3 (within month)
  activity_date: string
  activity_text: string
  image_url: string | null
  proposal_checked: boolean
  created_at: string
}

export interface PaymentSummary {
  id: string
  pair_id: string
  month_no: number
  activity_count: number
  proposal_count: number
  payment_amount: number
  payment_status: 'pending' | 'approved' | 'paid'
}

export interface MentoringReceipt {
  id: string
  pair_id: string
  activity_id: string | null
  month_no: number
  receipt_url: string
  file_name: string | null
  mail_sent: boolean
  created_at: string
}

export interface MailLog {
  id: string
  pair_id: string | null
  mail_type: string
  to_email: string
  subject: string
  success: boolean
  error_msg: string | null
  sent_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers — Pairs
// ─────────────────────────────────────────────────────────────────────────────

export async function getPairByToken(token: string): Promise<MentoringPair | null> {
  const { data, error } = await supabase
    .from('mentoring_pairs')
    .select('*')
    .eq('token', token)
    .single()
  if (error || !data) return null
  return data as MentoringPair
}

export async function getAllPairs(): Promise<MentoringPair[]> {
  const { data } = await supabase
    .from('mentoring_pairs')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as MentoringPair[]
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers — Expectations
// ─────────────────────────────────────────────────────────────────────────────

export async function getExpectations(pairId: string): Promise<Expectation[]> {
  const { data } = await supabase
    .from('mentor_expectations')
    .select('*')
    .eq('pair_id', pairId)
    .order('created_at')
  return (data ?? []) as Expectation[]
}

export async function saveExpectations(
  pairId: string,
  menteeContent: string,
  mentorContent: string,
): Promise<void> {
  await supabase.from('mentor_expectations').delete().eq('pair_id', pairId)
  const rows = [
    { pair_id: pairId, type: 'mentee', content: menteeContent },
    { pair_id: pairId, type: 'mentor', content: mentorContent },
  ]
  await supabase.from('mentor_expectations').insert(rows)
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers — Activities
// ─────────────────────────────────────────────────────────────────────────────

export async function getActivities(pairId: string): Promise<Activity[]> {
  const { data } = await supabase
    .from('mentor_activities')
    .select('*')
    .eq('pair_id', pairId)
    .order('month_no')
    .order('round_no')
  return (data ?? []) as Activity[]
}

export async function getAllActivities(): Promise<Activity[]> {
  const { data } = await supabase.from('mentor_activities').select('*')
  return (data ?? []) as Activity[]
}

export async function upsertActivity(
  pairId: string,
  monthNo: number,
  roundNo: number,
  date: string,
  text: string,
  imageUrl: string,
): Promise<Activity | null> {
  const { data } = await supabase
    .from('mentor_activities')
    .upsert(
      { pair_id: pairId, month_no: monthNo, round_no: roundNo, activity_date: date, activity_text: text, image_url: imageUrl || null, proposal_checked: false },
      { onConflict: 'pair_id,month_no,round_no' },
    )
    .select()
    .single()
  return (data ?? null) as Activity | null
}

export async function toggleProposalChecked(id: string, checked: boolean): Promise<void> {
  await supabase.from('mentor_activities').update({ proposal_checked: checked }).eq('id', id)
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers — Receipts
// ─────────────────────────────────────────────────────────────────────────────

export async function getReceipts(pairId: string): Promise<MentoringReceipt[]> {
  const { data } = await supabase
    .from('mentoring_receipts')
    .select('*')
    .eq('pair_id', pairId)
    .order('created_at')
  return (data ?? []) as MentoringReceipt[]
}

export async function getAllReceipts(): Promise<MentoringReceipt[]> {
  const { data } = await supabase.from('mentoring_receipts').select('*')
  return (data ?? []) as MentoringReceipt[]
}

export async function insertReceipt(
  pairId: string,
  activityId: string | null,
  monthNo: number,
  receiptUrl: string,
  fileName: string | null,
  mailSent: boolean,
): Promise<MentoringReceipt | null> {
  const { data } = await supabase
    .from('mentoring_receipts')
    .insert({
      pair_id: pairId,
      activity_id: activityId,
      month_no: monthNo,
      receipt_url: receiptUrl,
      file_name: fileName,
      mail_sent: mailSent,
    })
    .select()
    .single()
  return (data ?? null) as MentoringReceipt | null
}

export async function markReceiptMailSent(id: string): Promise<void> {
  await supabase.from('mentoring_receipts').update({ mail_sent: true }).eq('id', id)
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers — Mail Logs
// ─────────────────────────────────────────────────────────────────────────────

export async function insertMailLog(
  pairId: string | null,
  mailType: string,
  toEmail: string,
  subject: string,
  success: boolean,
  errorMsg?: string,
): Promise<void> {
  await supabase.from('mentoring_mail_logs').insert({
    pair_id: pairId,
    mail_type: mailType,
    to_email: toEmail,
    subject,
    success,
    error_msg: errorMsg ?? null,
  })
}

export async function getMailLogs(pairId: string): Promise<MailLog[]> {
  const { data } = await supabase
    .from('mentoring_mail_logs')
    .select('*')
    .eq('pair_id', pairId)
    .order('sent_at', { ascending: false })
    .limit(20)
  return (data ?? []) as MailLog[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadActivityImage(pairId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${pairId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('mentor-activity-images').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('mentor-activity-images').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadReceiptFile(pairId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'bin'
  const path = `${pairId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('mentor-receipt-files').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('mentor-receipt-files').getPublicUrl(path)
  return data.publicUrl
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function getPaymentSummaries(): Promise<PaymentSummary[]> {
  const { data } = await supabase.from('payment_summary').select('*')
  return (data ?? []) as PaymentSummary[]
}

export async function upsertPaymentSummary(
  pairId: string,
  monthNo: number,
  activityCount: number,
  proposalCount: number,
  paymentAmount: number,
): Promise<void> {
  await supabase.from('payment_summary').upsert(
    { pair_id: pairId, month_no: monthNo, activity_count: activityCount, proposal_count: proposalCount, payment_amount: paymentAmount, payment_status: 'pending' },
    { onConflict: 'pair_id,month_no' },
  )
}

export async function updatePaymentStatus(
  pairId: string,
  monthNo: number,
  status: 'pending' | 'approved' | 'paid',
): Promise<void> {
  await supabase.from('payment_summary').update({ payment_status: status }).eq('pair_id', pairId).eq('month_no', monthNo)
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment calculation
// ─────────────────────────────────────────────────────────────────────────────

export function calcPayment(activityCount: number): number {
  if (activityCount >= 3) return 100000
  if (activityCount === 2) return 50000
  return 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data (used when Supabase is not configured)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_PAIRS: MentoringPair[] = [
  {
    id: 'mock-1', mentor_name: '김멘토', mentor_email: 'kim@hecto.co.kr',
    mentee_name: '이멘티', start_date: '2026-05-01', end_date: '2026-07-31',
    current_month: 1, status: 'active', token: 'mentor_a1', created_at: '2026-05-01',
  },
  {
    id: 'mock-2', mentor_name: '박멘토', mentor_email: 'park@hecto.co.kr',
    mentee_name: '최멘티', start_date: '2026-04-01', end_date: '2026-06-30',
    current_month: 2, status: 'active', token: 'mentor_b2', created_at: '2026-04-01',
  },
  {
    id: 'test', mentor_name: '테스트멘토', mentor_email: 'test@hecto.co.kr',
    mentee_name: '테스트멘티', start_date: '2026-05-01', end_date: '2026-07-31',
    current_month: 1, status: 'active', token: 'test', created_at: '2026-05-01',
  },
]
