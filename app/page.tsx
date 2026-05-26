'use client'

import { useState, useEffect } from 'react'
import {
  IS_CONFIGURED,
  getAllPairs,
  getAllActivities,
  getAllReceipts,
  getPaymentSummaries,
  updatePaymentStatus,
  calcPayment,
  MOCK_PAIRS,
  type MentoringPair,
  type Activity,
  type PaymentSummary,
  type MentoringReceipt,
} from '@/lib/supabase'
import {
  activityReminderTemplate,
  proposalReminderTemplate,
  completionNoticeTemplate,
  initialGuideTemplate,
} from '@/lib/mail-templates'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

function getMonthRange(startDate: string, mi: number): { start: string; end: string } {
  const [y, m] = startDate.split('-').map(Number)
  const total = m + mi - 1
  const ry = y + Math.floor((total - 1) / 12)
  const rm = ((total - 1) % 12) + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return { start: `${ry}-${pad(rm)}-01`, end: `${ry}-${pad(rm)}-${new Date(ry, rm, 0).getDate()}` }
}

function currentMonthIdx(startDate: string): number {
  for (let i = 1; i <= 3; i++) {
    const { start, end } = getMonthRange(startDate, i)
    if (TODAY >= start && TODAY <= end) return i
  }
  return TODAY > getMonthRange(startDate, 3).end ? 4 : 0
}

function pairActivities(acts: Activity[], pairId: string, monthNo: number): Activity[] {
  return acts.filter(a => a.pair_id === pairId && a.month_no === monthNo && a.activity_date)
}

function statusLabel(s: MentoringPair['status']): string {
  return { pending: '대기', active: '운영중', completed: '마감', finished: '종료' }[s] ?? s
}

function statusCls(s: MentoringPair['status']): string {
  return {
    pending:   'bg-gray-100 text-gray-500 border-gray-200',
    active:    'bg-orange-100 text-orange-700 border-orange-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    finished:  'bg-blue-100 text-blue-700 border-blue-200',
  }[s] ?? 'bg-gray-100 text-gray-500 border-gray-200'
}

function payStatusLabel(s: PaymentSummary['payment_status']): string {
  return { pending: '미정', approved: '승인', paid: '지급완료' }[s] ?? s
}

function payStatusCls(s: PaymentSummary['payment_status']): string {
  return {
    pending:  'bg-gray-100 text-gray-500 border-gray-200',
    approved: 'bg-blue-100 text-blue-700 border-blue-200',
    paid:     'bg-green-100 text-green-700 border-green-200',
  }[s] ?? 'bg-gray-100 text-gray-500 border-gray-200'
}

// ─────────────────────────────────────────────────────────────────────────────
// Mail send API helper
// ─────────────────────────────────────────────────────────────────────────────

async function callSendMail(to: string, subject: string, html: string): Promise<string | null> {
  try {
    const res = await fetch('/api/send-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: [to], subject, html }),
    })
    const data = await res.json()
    if (data.ok) return null
    return data.error ?? '발송 실패'
  } catch {
    return '네트워크 오류'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mail Preview + Send Modal
// ─────────────────────────────────────────────────────────────────────────────

function MailModal({
  subject, body, html, to, onClose,
}: {
  subject: string
  body: string
  html: string
  to: string
  onClose: () => void
}) {
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const handleSend = async () => {
    setSending(true)
    setError('')
    const err = await callSendMail(to, subject, html)
    setSending(false)
    if (err) {
      setError(err)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900">메일 미리보기 / 발송</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <div className="bg-gray-50 rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="text-xs text-gray-400 flex-shrink-0">수신</span>
            <span className="text-sm font-semibold text-gray-800">{to}</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="text-xs text-gray-400 flex-shrink-0">제목</span>
            <span className="text-sm font-semibold text-gray-800">{subject}</span>
          </div>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg px-4 py-3">{body}</pre>
        </div>
        <div className="px-5 py-4 border-t flex items-center justify-between gap-3">
          {sent ? (
            <span className="text-sm font-bold text-green-600">✓ 발송 완료</span>
          ) : error ? (
            <span className="text-sm text-red-500 truncate">{error}</span>
          ) : (
            <span className="text-xs text-gray-400">미리보기 확인 후 발송하세요.</span>
          )}
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              닫기
            </button>
            {!sent && (
              <button onClick={handleSend} disabled={sending}
                className="px-4 py-2 text-sm font-bold bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {sending ? '발송 중...' : '📧 메일 발송'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Table View
// ─────────────────────────────────────────────────────────────────────────────

function SummaryTable({
  pairs, acts, receipts, summaries, onPayStatusChange, onMailOpen,
}: {
  pairs: MentoringPair[]
  acts: Activity[]
  receipts: MentoringReceipt[]
  summaries: PaymentSummary[]
  onPayStatusChange: (pair: MentoringPair, monthNo: number, status: PaymentSummary['payment_status']) => void
  onMailOpen: (tpl: { subject: string; body: string; html: string; to: string }) => void
}) {
  const rows: {
    pair: MentoringPair
    mi: number
    actCnt: number
    propCnt: number
    hasReceipt: boolean
    amount: number
    payStatus: PaymentSummary['payment_status']
    summary: PaymentSummary | undefined
  }[] = []

  pairs.forEach(pair => {
    ;([1, 2, 3] as const).forEach(mi => {
      const monthActs  = pairActivities(acts, pair.id, mi)
      const actCnt     = monthActs.length
      const propCnt    = monthActs.filter(a => a.proposal_checked).length
      const hasReceipt = receipts.some(r => r.pair_id === pair.id && r.month_no === mi)
      const amount     = calcPayment(actCnt)
      const summary    = summaries.find(s => s.pair_id === pair.id && s.month_no === mi)
      const payStatus  = summary?.payment_status ?? 'pending'
      rows.push({ pair, mi, actCnt, propCnt, hasReceipt, amount, payStatus, summary })
    })
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">멘토</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">멘티</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">월</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">활동횟수</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">증빙</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">지급금액</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">상태</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">알림</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ pair, mi, actCnt, propCnt, hasReceipt, amount, payStatus }, idx) => {
              const curIdx = currentMonthIdx(pair.start_date)
              const isCurMonth = curIdx === mi
              const isFirstRow = mi === 1
              const isLastRow  = mi === 3

              // 증빙: 영수증 업로드 OR 품의 전체 완료
              const proofOk = hasReceipt || (actCnt > 0 && propCnt === actCnt)

              return (
                <tr key={`${pair.id}-${mi}`}
                  className={`border-b border-gray-100 transition-colors hover:bg-gray-50
                    ${isCurMonth ? 'bg-orange-50/40' : ''}
                    ${isLastRow ? 'border-b-2 border-gray-200' : ''}`}>
                  {/* 멘토 (rowspan 효과: 첫 행만 표시) */}
                  <td className={`px-4 py-2.5 ${isFirstRow ? '' : 'text-gray-300'}`}>
                    {isFirstRow ? (
                      <div>
                        <p className="font-bold text-gray-800">{pair.mentor_name}</p>
                        <p className="text-xs text-gray-400">{pair.mentor_email}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-200">↑</span>
                    )}
                  </td>
                  {/* 멘티 */}
                  <td className="px-4 py-2.5">
                    {isFirstRow ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-800">{pair.mentee_name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-semibold ${statusCls(pair.status)}`}>
                          {statusLabel(pair.status)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-200">↑</span>
                    )}
                  </td>
                  {/* 월 */}
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                      ${isCurMonth ? 'bg-orange-100 text-orange-700' : 'text-gray-500'}`}>
                      {mi}개월차
                      {isCurMonth && <span className="ml-1">◀</span>}
                    </span>
                  </td>
                  {/* 활동횟수 */}
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-sm font-bold
                      ${actCnt >= 3 ? 'text-green-600' : actCnt >= 2 ? 'text-orange-500' : 'text-red-400'}`}>
                      {actCnt}
                    </span>
                    <span className="text-xs text-gray-400">/3회</span>
                    {actCnt > 0 && propCnt > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">품의 {propCnt}/{actCnt}</div>
                    )}
                  </td>
                  {/* 증빙 */}
                  <td className="px-4 py-2.5 text-center">
                    {actCnt === 0 ? (
                      <span className="text-xs text-gray-300">-</span>
                    ) : proofOk ? (
                      <span className="text-green-600 font-bold text-sm">O</span>
                    ) : (
                      <span className="text-red-400 font-bold text-sm">X</span>
                    )}
                    {hasReceipt && (
                      <div className="text-xs text-blue-400 mt-0.5">영수증 ✓</div>
                    )}
                  </td>
                  {/* 지급금액 */}
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-sm font-bold ${amount > 0 ? 'text-orange-600' : 'text-gray-300'}`}>
                      {amount > 0 ? `${amount.toLocaleString()}원` : '0원'}
                    </span>
                  </td>
                  {/* 상태 */}
                  <td className="px-4 py-2.5 text-center">
                    <select
                      value={payStatus}
                      onChange={e => onPayStatusChange(pair, mi, e.target.value as PaymentSummary['payment_status'])}
                      className={`text-xs py-1 px-2 rounded-full border font-semibold focus:outline-none cursor-pointer ${payStatusCls(payStatus)}`}>
                      <option value="pending">미정</option>
                      <option value="approved">승인</option>
                      <option value="paid">지급완료</option>
                    </select>
                  </td>
                  {/* 알림 버튼 */}
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {actCnt < 3 && actCnt >= 0 && (
                        <button
                          onClick={() => {
                            const t = activityReminderTemplate(pair, mi, actCnt)
                            onMailOpen({ subject: t.subject, body: t.body, html: t.html, to: t.to })
                          }}
                          className="text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 transition-colors whitespace-nowrap"
                          title="활동 부족 알림">
                          📧
                        </button>
                      )}
                      {actCnt > 0 && propCnt < actCnt && (
                        <button
                          onClick={() => {
                            const t = proposalReminderTemplate(pair, mi)
                            onMailOpen({ subject: t.subject, body: t.body, html: t.html, to: t.to })
                          }}
                          className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition-colors whitespace-nowrap"
                          title="품의 미등록 알림">
                          📋
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">등록된 멘토링 페어가 없습니다.</div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Settlement Card (per pair) — 카드 뷰
// ─────────────────────────────────────────────────────────────────────────────

function SettlementCard({
  pair, acts, receipts, summaries, onPayStatusChange, onMailOpen,
}: {
  pair: MentoringPair
  acts: Activity[]
  receipts: MentoringReceipt[]
  summaries: PaymentSummary[]
  onPayStatusChange: (monthNo: number, status: PaymentSummary['payment_status']) => void
  onMailOpen: (tpl: { subject: string; body: string; html: string; to: string }) => void
}) {
  const curIdx = currentMonthIdx(pair.start_date)

  const months = [1, 2, 3] as const
  const totalAmt = months.reduce((sum, mi) => {
    const cnt = pairActivities(acts, pair.id, mi).length
    return sum + calcPayment(cnt)
  }, 0)

  const getSummary = (mi: number) => summaries.find(s => s.pair_id === pair.id && s.month_no === mi)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className={`px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2 ${pair.status === 'active' ? 'bg-orange-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{pair.mentor_name}</span>
              <span className="text-gray-400 text-sm">→</span>
              <span className="font-bold text-gray-900">{pair.mentee_name}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{pair.mentor_email}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusCls(pair.status)}`}>
            {statusLabel(pair.status)}
          </span>
          {curIdx >= 1 && curIdx <= 3 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
              현재 {curIdx}개월차
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const t = initialGuideTemplate(pair, `https://mentoring-dashboard.vercel.app/mentor/${pair.token}`)
              onMailOpen({ subject: t.subject, body: t.body, html: t.html, to: t.to })
            }}
            className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200">
            최초 안내 메일
          </button>
          <button
            onClick={() => {
              const t = completionNoticeTemplate(pair, totalAmt)
              onMailOpen({ subject: t.subject, body: t.body, html: t.html, to: t.to })
            }}
            className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-200">
            종료 안내 메일
          </button>
        </div>
      </div>

      {/* 월별 정산 */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {months.map(mi => {
            const monthActs      = pairActivities(acts, pair.id, mi)
            const actCnt         = monthActs.length
            const propCnt        = monthActs.filter(a => a.proposal_checked).length
            const hasReceipt     = receipts.some(r => r.pair_id === pair.id && r.month_no === mi)
            const amt            = calcPayment(actCnt)
            const summary        = getSummary(mi)
            const payStatus      = summary?.payment_status ?? 'pending'
            const { start, end } = getMonthRange(pair.start_date, mi)
            const isCurrentMonth = curIdx === mi

            return (
              <div key={mi} className={`rounded-xl border p-4 ${isCurrentMonth ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-bold ${isCurrentMonth ? 'text-orange-700' : 'text-gray-700'}`}>{mi}개월차</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${payStatusCls(payStatus)}`}>
                    {payStatusLabel(payStatus)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{start} ~ {end}</p>

                {/* 활동 횟수 */}
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-500">활동 횟수</span>
                  <span className={`font-bold ${actCnt >= 3 ? 'text-green-600' : actCnt >= 2 ? 'text-orange-600' : 'text-red-500'}`}>
                    {actCnt}/3회
                  </span>
                </div>

                {/* 품의 체크 */}
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-500">품의 체크</span>
                  <span className={`font-bold ${propCnt === actCnt && actCnt > 0 ? 'text-green-600' : actCnt > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                    {actCnt > 0 ? `${propCnt}/${actCnt}건` : '-'}
                  </span>
                </div>

                {/* 영수증 */}
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-gray-500">영수증</span>
                  <span className={`font-bold ${hasReceipt ? 'text-blue-600' : 'text-gray-300'}`}>
                    {hasReceipt ? '업로드됨' : '없음'}
                  </span>
                </div>

                {/* 지급금액 */}
                <div className={`text-center rounded-lg py-2 mb-3 ${amt > 0 ? 'bg-orange-100' : 'bg-gray-100'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">지급 금액</p>
                  <p className={`text-lg font-black ${amt > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {amt.toLocaleString()}원
                  </p>
                </div>

                {/* 메일 / 상태 변경 */}
                <div className="space-y-1.5">
                  {actCnt < 3 && (
                    <button
                      onClick={() => {
                        const t = activityReminderTemplate(pair, mi, actCnt)
                        onMailOpen({ subject: t.subject, body: t.body, html: t.html, to: t.to })
                      }}
                      className="w-full text-xs py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition-colors">
                      📧 활동 부족 알림
                    </button>
                  )}
                  {actCnt > 0 && propCnt < actCnt && (
                    <button
                      onClick={() => {
                        const t = proposalReminderTemplate(pair, mi)
                        onMailOpen({ subject: t.subject, body: t.body, html: t.html, to: t.to })
                      }}
                      className="w-full text-xs py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-colors">
                      📧 품의 미등록 알림
                    </button>
                  )}
                  <select
                    value={payStatus}
                    onChange={e => onPayStatusChange(mi, e.target.value as PaymentSummary['payment_status'])}
                    className="w-full text-xs py-1.5 px-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-orange-400">
                    <option value="pending">미정</option>
                    <option value="approved">승인</option>
                    <option value="paid">지급완료</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>

        {/* 합계 */}
        <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-400 rounded-xl px-5 py-3">
          <span className="text-sm font-bold text-white">3개월 합산 지급 예정</span>
          <span className="text-xl font-black text-white">{totalAmt.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [pairs,     setPairs]     = useState<MentoringPair[]>([])
  const [acts,      setActs]      = useState<Activity[]>([])
  const [receipts,  setReceipts]  = useState<MentoringReceipt[]>([])
  const [summaries, setSummaries] = useState<PaymentSummary[]>([])
  const [loading,   setLoading]   = useState(true)
  const [viewMode,  setViewMode]  = useState<'card' | 'table'>('table')
  const [mail, setMail] = useState<{ subject: string; body: string; html: string; to: string } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      if (IS_CONFIGURED) {
        const [p, a, r, s] = await Promise.all([
          getAllPairs(),
          getAllActivities(),
          getAllReceipts(),
          getPaymentSummaries(),
        ])
        setPairs(p); setActs(a); setReceipts(r); setSummaries(s)
      } else {
        setPairs(MOCK_PAIRS); setActs([]); setReceipts([]); setSummaries([])
      }
      setLoading(false)
    }
    load()
  }, [])

  const handlePayStatusChange = async (pair: MentoringPair, monthNo: number, status: PaymentSummary['payment_status']) => {
    if (IS_CONFIGURED) await updatePaymentStatus(pair.id, monthNo, status)
    setSummaries(prev => {
      const exists = prev.find(s => s.pair_id === pair.id && s.month_no === monthNo)
      if (exists) return prev.map(s => s.pair_id === pair.id && s.month_no === monthNo ? { ...s, payment_status: status } : s)
      return [...prev, { id: `${pair.id}-${monthNo}`, pair_id: pair.id, month_no: monthNo, activity_count: 0, proposal_count: 0, payment_amount: 0, payment_status: status }]
    })
  }

  // Stats
  const totalPairs   = pairs.length
  const activePairs  = pairs.filter(p => p.status === 'active').length
  const totalAmount  = pairs.reduce((sum, p) => {
    return sum + [1, 2, 3].reduce((s, mi) => s + calcPayment(pairActivities(acts, p.id, mi).length), 0)
  }, 0)
  const paidAmount = summaries
    .filter(s => s.payment_status === 'paid')
    .reduce((sum, s) => sum + calcPayment(s.activity_count), 0)

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">멘토링 운영 관리자</span>
            {!IS_CONFIGURED && (
              <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">
                Supabase 미연결 (mock)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* 뷰 토글 */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`text-xs px-3 py-1.5 font-semibold transition-colors ${viewMode === 'table' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                요약 표
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`text-xs px-3 py-1.5 font-semibold transition-colors ${viewMode === 'card' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                카드 보기
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <span>총 {totalPairs}쌍</span>
              <span className="text-gray-300">|</span>
              <span>운영중 {activePairs}쌍</span>
              <span className="text-gray-300">|</span>
              <span className="font-bold text-orange-600">예상 {totalAmount.toLocaleString()}원</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '전체 페어', value: totalPairs, cls: 'text-gray-800' },
            { label: '운영중', value: activePairs, cls: 'text-orange-600' },
            { label: '마감', value: pairs.filter(p => p.status === 'completed').length, cls: 'text-green-600' },
            { label: '지급완료 합계', value: paidAmount > 0 ? `${paidAmount.toLocaleString()}원` : '-', cls: 'text-green-600' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">{card.label}</p>
              <p className={`text-xl font-black ${card.cls}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Supabase 미연결 안내 */}
        {!IS_CONFIGURED && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm font-bold text-yellow-800 mb-1">⚙️ Supabase 연결이 필요합니다</p>
            <p className="text-xs text-yellow-700 leading-relaxed">
              1. Supabase 프로젝트 생성 후 <code className="bg-yellow-100 px-1 rounded">.env.local</code>에 URL과 ANON KEY를 입력하세요.<br />
              2. <code className="bg-yellow-100 px-1 rounded">supabase/schema.sql</code>을 Supabase SQL Editor에서 실행하세요.<br />
              3. Storage에서 <code className="bg-yellow-100 px-1 rounded">mentor-activity-images</code>, <code className="bg-yellow-100 px-1 rounded">mentor-receipt-files</code> 버킷을 Public으로 생성하세요.
            </p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : pairs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">등록된 멘토링 페어가 없습니다.</div>
        ) : viewMode === 'table' ? (
          <SummaryTable
            pairs={pairs}
            acts={acts}
            receipts={receipts}
            summaries={summaries}
            onPayStatusChange={handlePayStatusChange}
            onMailOpen={setMail}
          />
        ) : (
          <div className="space-y-4">
            {pairs.map(pair => (
              <SettlementCard
                key={pair.id}
                pair={pair}
                acts={acts}
                receipts={receipts}
                summaries={summaries}
                onPayStatusChange={(mi, status) => handlePayStatusChange(pair, mi, status)}
                onMailOpen={setMail}
              />
            ))}
          </div>
        )}
      </div>

      {mail && (
        <MailModal
          subject={mail.subject}
          body={mail.body}
          html={mail.html}
          to={mail.to}
          onClose={() => setMail(null)}
        />
      )}
    </main>
  )
}
