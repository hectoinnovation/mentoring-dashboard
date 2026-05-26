'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  IS_CONFIGURED,
  getPairByToken,
  getExpectations,
  saveExpectations,
  getActivities,
  getReceipts,
  upsertActivity,
  toggleProposalChecked,
  uploadActivityImage,
  uploadReceiptFile,
  insertReceipt,
  calcPayment,
  MOCK_PAIRS,
  type MentoringPair,
  type Activity,
  type Expectation,
  type MentoringReceipt,
} from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
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

function getEndDate(startDate: string): string {
  return getMonthRange(startDate, 3).end
}

function getCurrentMonthIdx(startDate: string): number {
  for (let i = 1; i <= 3; i++) {
    const { start, end } = getMonthRange(startDate, i)
    if (TODAY >= start && TODAY <= end) return i
  }
  return TODAY > getMonthRange(startDate, 3).end ? 4 : 0
}

function getMonthStatus(startDate: string, acts: Activity[], mi: number): string {
  const { start, end } = getMonthRange(startDate, mi)
  const cnt = acts.filter(a => a.month_no === mi && a.activity_date).length
  if (TODAY < start) return '대기'
  if (TODAY <= end) return cnt >= 3 ? '마감' : '진행중'
  if (cnt >= 3) return '마감'
  if (cnt >= 1) return '미달 마감'
  return '미진행 마감'
}

function getOperationStatus(startDate: string): string {
  const idx = getCurrentMonthIdx(startDate)
  if (idx === 0) return '대기'
  if (idx <= 3) return '운영 중'
  return '전체 종료'
}

function fmtAmount(n: number): string {
  return n === 0 ? '0원' : `${n.toLocaleString()}원`
}

/** 이번 달 남은 횟수 레이블 */
function getRemainingLabel(count: number): string {
  if (count >= 3) return '완료'
  const rem = 3 - count
  return `이번 달 ${rem}회 남음`
}

// ─────────────────────────────────────────────────────────────────────────────
// UI: Slots (9 total, 3 per month)
// ─────────────────────────────────────────────────────────────────────────────

interface Slot {
  monthNo: number
  roundNo: number
  globalRound: number
  act: Activity | null
}

function buildSlots(acts: Activity[]): Slot[] {
  const slots: Slot[] = []
  for (let mi = 1; mi <= 3; mi++) {
    for (let ri = 1; ri <= 3; ri++) {
      const act = acts.find(a => a.month_no === mi && a.round_no === ri) ?? null
      slots.push({ monthNo: mi, roundNo: ri, globalRound: (mi - 1) * 3 + ri, act })
    }
  }
  return slots
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

function OperationBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    '운영 중':   'bg-orange-100 text-orange-700 border-orange-200',
    '전체 종료': 'bg-gray-100 text-gray-500 border-gray-200',
    '대기':      'bg-blue-50 text-blue-500 border-blue-100',
  }
  return (
    <span className={`inline-flex text-xs font-bold px-3 py-1 rounded-full border ${map[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {status}
    </span>
  )
}

function MonthBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    '대기':        'bg-gray-100 text-gray-400 border-gray-200',
    '진행중':      'bg-orange-100 text-orange-600 border-orange-200',
    '마감':        'bg-green-100 text-green-700 border-green-200',
    '미달 마감':   'bg-red-100 text-red-600 border-red-200',
    '미진행 마감': 'bg-red-50 text-red-400 border-red-100',
  }
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${map[status] ?? 'bg-gray-100 text-gray-400 border-gray-200'}`}>
      {status}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoCard
// ─────────────────────────────────────────────────────────────────────────────

function InfoCard({ pair, acts }: { pair: MentoringPair; acts: Activity[] }) {
  const opStatus = getOperationStatus(pair.start_date)
  const curIdx   = getCurrentMonthIdx(pair.start_date)
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-gray-900">{pair.mentor_name}</span>
            <span className="text-sm text-gray-400">멘토</span>
            <svg className="w-4 h-4 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-lg font-bold text-gray-900">{pair.mentee_name}</span>
            <span className="text-sm text-gray-400">멘티</span>
          </div>
          {pair.mentor_email && <p className="text-xs text-gray-400 mt-1">{pair.mentor_email}</p>}
        </div>
        <OperationBadge status={opStatus} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-orange-50 rounded-xl p-3.5 border border-orange-100">
          <p className="text-xs font-semibold text-orange-600 mb-1">운영 기간</p>
          <p className="text-sm font-bold text-gray-800">{pair.start_date} ~ {getEndDate(pair.start_date)}</p>
          <p className="text-xs text-gray-500 mt-1">지급 종료월: <span className="font-semibold text-gray-700">{getMonthRange(pair.start_date, 3).end.slice(0, 7)}</span></p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-2">개월차별 기간</p>
          <div className="space-y-1">
            {([1, 2, 3] as const).map(mi => {
              const { start, end } = getMonthRange(pair.start_date, mi)
              const cnt = acts.filter(a => a.month_no === mi && a.activity_date).length
              const isCurrent = curIdx === mi
              return (
                <div key={mi} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-0.5 ${isCurrent ? 'bg-orange-100 text-orange-700 font-bold' : 'text-gray-500'}`}>
                  <span className="w-14 flex-shrink-0">{mi}개월차{isCurrent && ' ◀'}</span>
                  <span>{start} ~ {end}</span>
                  <span className={`ml-auto font-semibold ${cnt >= 3 ? 'text-green-600' : isCurrent ? 'text-orange-500' : 'text-gray-400'}`}>{cnt}/3</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GoalForm
// ─────────────────────────────────────────────────────────────────────────────

function GoalForm({ onSave, saving }: { onSave: (exp: string, coop: string) => Promise<void>; saving: boolean }) {
  const [expItems,  setExpItems]  = useState(['', '', ''])
  const [coopItems, setCoopItems] = useState(['', '', ''])

  const setExp  = (i: number, v: string) => setExpItems(prev  => prev.map((x, j) => j === i ? v : x))
  const setCoop = (i: number, v: string) => setCoopItems(prev => prev.map((x, j) => j === i ? v : x))
  const canSave = expItems.some(s => s.trim()) && coopItems.some(s => s.trim())

  const handleSave = async () => {
    const exp  = expItems.filter(s => s.trim()).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')
    const coop = coopItems.filter(s => s.trim()).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')
    await onSave(exp, coop)
  }

  return (
    <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-4">
        <h2 className="text-base font-bold text-white">멘토링 목표 달성을 위한 기대사항 및 협력사항</h2>
        <p className="text-xs text-orange-100 mt-0.5">작성 후 저장하면 활동 등록 화면이 나타납니다.</p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <p className="text-sm font-bold text-gray-800">기대사항(멘티) <span className="text-xs font-normal text-gray-400">멘티 작성</span></p>
            </div>
            {expItems.map((val, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-xs font-bold text-orange-400 mt-2.5 w-4 flex-shrink-0">{i + 1}</span>
                <textarea value={val} onChange={e => setExp(i, e.target.value)} rows={2}
                  placeholder={`기대사항 ${i + 1}번 항목`}
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <p className="text-sm font-bold text-gray-800">협력사항(멘토) <span className="text-xs font-normal text-gray-400">멘토 작성</span></p>
            </div>
            {coopItems.map((val, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-xs font-bold text-blue-400 mt-2.5 w-4 flex-shrink-0">{i + 1}</span>
                <textarea value={val} onChange={e => setCoop(i, e.target.value)} rows={2}
                  placeholder={`협력사항 ${i + 1}번 항목`}
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
              </div>
            ))}
          </div>
        </div>
        <button onClick={handleSave} disabled={!canSave || saving}
          className="mt-5 w-full py-3 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
          {saving ? '저장 중...' : '저장 후 활동 등록 화면으로 이동 →'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GoalDisplay
// ─────────────────────────────────────────────────────────────────────────────

function GoalDisplay({ exps }: { exps: Expectation[] }) {
  const menteeContent = exps.find(e => e.type === 'mentee')?.content ?? ''
  const mentorContent = exps.find(e => e.type === 'mentor')?.content ?? ''
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
        <p className="text-xs font-bold text-orange-700 mb-2">기대사항 (멘티)</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{menteeContent}</p>
      </div>
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <p className="text-xs font-bold text-blue-700 mb-2">협력사항 (멘토)</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{mentorContent}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityCard
// ─────────────────────────────────────────────────────────────────────────────

function ActivityCard({
  slot, pairId, pair, receipts, onSaved, onToggleProposal, onReceiptUploaded,
}: {
  slot: Slot
  pairId: string
  pair: MentoringPair
  receipts: MentoringReceipt[]
  onSaved: (act: Activity) => void
  onToggleProposal: (id: string, checked: boolean) => void
  onReceiptUploaded: (receipt: MentoringReceipt) => void
}) {
  const fileRef    = useRef<HTMLInputElement>(null)
  const receiptRef = useRef<HTMLInputElement>(null)

  const [date, setDate]               = useState(slot.act?.activity_date ?? '')
  const [content, setContent]         = useState(slot.act?.activity_text ?? '')
  const [photoName, setPhotoName]     = useState('')
  const [photoUrl, setPhotoUrl]       = useState(slot.act?.image_url ?? '')
  const [saving, setSaving]           = useState(false)
  const [uploadingImg, setUploadingImg]         = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptMsg, setReceiptMsg]             = useState('')
  const [pendingFile, setPendingFile]           = useState<File | null>(null)

  const act     = slot.act
  const isSaved = !!(act?.activity_date)

  // 이 슬롯에 연결된 영수증
  const slotReceipt = receipts.find(r => r.activity_id === act?.id) ?? null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setPhotoName(file.name)
    setPhotoUrl(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!date || !content) return
    setSaving(true)
    try {
      let imageUrl = photoUrl.startsWith('blob:') ? '' : photoUrl
      if (pendingFile && IS_CONFIGURED) {
        setUploadingImg(true)
        try { imageUrl = await uploadActivityImage(pairId, pendingFile) } catch { imageUrl = '' }
        setUploadingImg(false)
      }
      let saved: Activity | null = null
      if (IS_CONFIGURED) {
        saved = await upsertActivity(pairId, slot.monthNo, slot.roundNo, date, content, imageUrl)
      } else {
        saved = {
          id: `local-${pairId}-${slot.monthNo}-${slot.roundNo}`,
          pair_id: pairId, month_no: slot.monthNo, round_no: slot.roundNo,
          activity_date: date, activity_text: content, image_url: imageUrl || null,
          proposal_checked: false, created_at: new Date().toISOString(),
        }
      }
      if (saved) { setPhotoUrl(saved.image_url ?? ''); onSaved(saved) }
    } finally {
      setSaving(false)
    }
  }

  const handleReceiptSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !act) return
    setUploadingReceipt(true)
    setReceiptMsg('')
    try {
      let receiptUrl = ''
      if (IS_CONFIGURED) {
        receiptUrl = await uploadReceiptFile(pairId, file)
        const inserted = await insertReceipt(pairId, act.id, slot.monthNo, receiptUrl, file.name, false)
        if (inserted) {
          onReceiptUploaded(inserted)
          // 관리자 메일 알림
          try {
            await fetch('/api/notify-receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pair, monthNo: slot.monthNo, fileName: file.name }),
            })
            setReceiptMsg('✓ 업로드 완료 · 품의 안내 메일 발송됨')
          } catch {
            setReceiptMsg('✓ 업로드 완료 (메일 발송 실패)')
          }
        }
      } else {
        // Mock
        const mockReceipt: MentoringReceipt = {
          id: `local-receipt-${Date.now()}`, pair_id: pairId,
          activity_id: act.id, month_no: slot.monthNo,
          receipt_url: URL.createObjectURL(file), file_name: file.name,
          mail_sent: false, created_at: new Date().toISOString(),
        }
        onReceiptUploaded(mockReceipt)
        setReceiptMsg('✓ 업로드 완료 (Supabase 미연결 — 로컬 미리보기)')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '업로드 오류'
      setReceiptMsg(`❌ ${msg}`)
    } finally {
      setUploadingReceipt(false)
      if (receiptRef.current) receiptRef.current.value = ''
    }
  }

  // ── Saved state ──────────────────────────────────────────────────────────
  if (isSaved && act) {
    return (
      <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-100">
          <span className="text-sm font-bold text-gray-700">{slot.globalRound}회차</span>
          <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">✓ 저장완료</span>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex gap-2 text-xs">
            <span className="text-gray-400 w-8 flex-shrink-0">날짜</span>
            <span className="text-gray-700 font-medium">{act.activity_date}</span>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="text-gray-400 w-8 flex-shrink-0">내용</span>
            <span className="text-gray-700 leading-relaxed">{act.activity_text}</span>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="text-gray-400 w-8 flex-shrink-0">사진</span>
            {act.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={act.image_url} alt="활동" className="w-20 h-14 object-cover rounded-lg border border-gray-200" />
              : <span className="text-gray-300">미등록</span>}
          </div>

          {/* 영수증 업로드 */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">영수증</p>
            {slotReceipt ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-green-600 font-semibold">✓ 업로드됨</span>
                {slotReceipt.file_name && (
                  <span className="text-xs text-gray-400 truncate max-w-[120px]">{slotReceipt.file_name}</span>
                )}
                <a href={slotReceipt.receipt_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 underline underline-offset-2">보기</a>
              </div>
            ) : (
              <div className="space-y-1">
                <input ref={receiptRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={handleReceiptSelect} />
                <button type="button" onClick={() => receiptRef.current?.click()}
                  disabled={uploadingReceipt}
                  className="text-xs px-3 py-1.5 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50">
                  {uploadingReceipt ? '업로드 중...' : '📎 영수증 업로드'}
                </button>
                {receiptMsg && (
                  <p className={`text-xs ${receiptMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                    {receiptMsg}
                  </p>
                )}
                <p className="text-xs text-blue-500">업로드 시 관리자에게 품의 안내 메일이 발송됩니다.</p>
              </div>
            )}
          </div>

          {/* 품의 체크 */}
          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={act.proposal_checked}
                onChange={e => onToggleProposal(act.id, e.target.checked)}
                className="w-4 h-4 accent-orange-500 cursor-pointer" />
              <span className={`text-xs font-semibold ${act.proposal_checked ? 'text-orange-600' : 'text-gray-400'}`}>
                내부망 품의 등록 완료{act.proposal_checked && ' ✓'}
              </span>
            </label>
          </div>
        </div>
      </div>
    )
  }

  // ── Unsaved state ────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-sm font-bold text-gray-700">{slot.globalRound}회차</span>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">미저장</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">활동일 <span className="text-red-400">*</span></label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">활동 내용 <span className="text-red-400">*</span></label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={2}
            placeholder="활동 내용을 입력해주세요"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">활동 사진</label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            {uploadingImg ? '업로드 중...' : '📷 사진 선택'}
          </button>
          {photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photoUrl} alt={photoName} className="mt-2 w-full max-h-28 object-cover rounded-lg border border-gray-200" />
            : photoName ? <span className="ml-2 text-xs text-green-600 truncate inline-block max-w-[120px] align-middle">{photoName}</span> : null}
        </div>
        <p className="text-xs text-amber-600">⚠️ 영수증은 저장 후 업로드해주세요.</p>
        <button type="button" onClick={handleSave} disabled={!date || !content || saving}
          className="w-full text-sm font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg transition-colors">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SupportSummary
// ─────────────────────────────────────────────────────────────────────────────

function SupportSummary({ startDate, acts }: { startDate: string; acts: Activity[] }) {
  const months = [1, 2, 3] as const
  const total  = months.reduce((sum, mi) => sum + calcPayment(acts.filter(a => a.month_no === mi && a.activity_date).length), 0)

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 space-y-4">
      <h3 className="font-bold text-orange-800">월별 지원금 현황</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {months.map(mi => {
          const cnt = acts.filter(a => a.month_no === mi && a.activity_date).length
          const amt = calcPayment(cnt)
          const st  = getMonthStatus(startDate, acts, mi)
          return (
            <div key={mi} className="bg-white rounded-xl border border-orange-100 p-3 text-center shadow-sm">
              <p className="text-xs text-gray-500 mb-0.5">{mi}개월차</p>
              <p className="text-xs text-gray-400 mb-1">{cnt}회 활동</p>
              <p className={`text-lg font-black ${amt > 0 ? 'text-orange-600' : 'text-gray-300'}`}>{fmtAmount(amt)}</p>
              <div className="mt-1.5"><MonthBadge status={st} /></div>
            </div>
          )
        })}
        <div className="bg-orange-500 rounded-xl p-3 text-center shadow-sm">
          <p className="text-xs text-orange-100 mb-0.5">최종 예상 지급</p>
          <p className="text-xs text-orange-200 mb-1">3개월 합산</p>
          <p className="text-lg font-black text-white">{fmtAmount(total)}</p>
          <p className="text-xs text-orange-200 mt-1.5">최대 300,000원</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {months.map(mi => {
          const cnt = acts.filter(a => a.month_no === mi && a.activity_date).length
          return (
            <div key={mi} className="bg-white rounded-xl border border-gray-100 p-2.5">
              <p className="text-xs font-bold text-gray-500 text-center mb-1.5">{mi}개월차 기준</p>
              <div className="space-y-1">
                {[{ l: '0~1회', a: '0원', m: cnt <= 1 }, { l: '2회', a: '50,000원', m: cnt === 2 }, { l: '3회+', a: '100,000원', m: cnt >= 3 }].map(b => (
                  <div key={b.l} className={`text-xs rounded px-1.5 py-1 flex justify-between ${b.m ? 'bg-orange-100 text-orange-800 font-bold' : 'text-gray-300'}`}>
                    <span>{b.l}</span><span>{b.a}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="bg-white border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-bold text-amber-800 mb-1">⚠️ 내부망 품의 등록 필수 안내</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          지원금 지급을 위해 <strong>내부망 품의 등록</strong>이 반드시 필요합니다.<br />
          영수증 업로드 후 내부망에서 <strong>&quot;멘토링 활동/정산 신청서&quot;</strong>를 검색하여 등록해주세요.<br />
          <span className="font-semibold text-amber-600">영수증 업로드 시 관리자에게 품의 안내 메일이 자동 발송됩니다.</span>
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MentorView
// ─────────────────────────────────────────────────────────────────────────────

function MentorView({
  pair, exps, acts, receipts, onSaveGoals, onActivitySaved, onToggleProposal, onReceiptUploaded, savingGoals,
}: {
  pair: MentoringPair
  exps: Expectation[]
  acts: Activity[]
  receipts: MentoringReceipt[]
  onSaveGoals: (exp: string, coop: string) => Promise<void>
  onActivitySaved: (act: Activity) => void
  onToggleProposal: (id: string, checked: boolean) => void
  onReceiptUploaded: (receipt: MentoringReceipt) => void
  savingGoals: boolean
}) {
  const hasGoals = exps.length > 0
  const curIdx   = getCurrentMonthIdx(pair.start_date)
  const initTab: 1 | 2 | 3 = (curIdx >= 1 && curIdx <= 3) ? (curIdx as 1 | 2 | 3) : 1
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(initTab)

  const allSlots   = buildSlots(acts)
  const tabSlots   = allSlots.filter(s => s.monthNo === activeTab)
  const mi         = activeTab
  const mStatus    = getMonthStatus(pair.start_date, acts, mi)
  const mCount     = acts.filter(a => a.month_no === mi && a.activity_date).length
  const { start, end } = getMonthRange(pair.start_date, mi)

  // 이번 달 남은 횟수 레이블 (현재 진행중인 월만 표시)
  const isCurrentTab = curIdx === mi
  const remainingLabel = isCurrentTab ? getRemainingLabel(mCount) : null

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <InfoCard pair={pair} acts={acts} />

      {!hasGoals ? (
        <GoalForm onSave={onSaveGoals} saving={savingGoals} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-orange-400" />
            <h3 className="text-sm font-bold text-gray-800">기대사항 및 협력사항</h3>
          </div>
          <GoalDisplay exps={exps} />
        </div>
      )}

      {hasGoals && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* 탭 */}
          <div className="flex border-b border-gray-100">
            {([1, 2, 3] as const).map(m => {
              const isActive  = m === activeTab
              const isCurrent = curIdx === m
              const st  = getMonthStatus(pair.start_date, acts, m)
              const cnt = acts.filter(a => a.month_no === m && a.activity_date).length
              return (
                <button key={m} type="button" onClick={() => setActiveTab(m)}
                  className={`flex-1 pt-3 pb-2.5 px-1 transition-colors ${isActive ? 'bg-orange-50 border-b-2 border-orange-500 text-orange-700' : 'text-gray-400 hover:bg-gray-50'}`}>
                  <div className="text-sm font-bold flex items-center justify-center gap-1">
                    {m}개월차
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className={`text-xs ${isActive ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>{cnt}/3회</span>
                    <MonthBadge status={st} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* 서브헤더 */}
          <div className={`px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2 ${curIdx === mi ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`text-sm font-bold ${curIdx === mi ? 'text-orange-700' : 'text-gray-700'}`}>{mi}개월차 활동 등록</span>
              <MonthBadge status={mStatus} />
              <span className="text-xs text-gray-400">{start} ~ {end}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <span>활동 <strong className="text-gray-800">{mCount}</strong>/3회</span>
              {remainingLabel && (
                <span className={`font-bold px-2.5 py-0.5 rounded-full border text-xs
                  ${remainingLabel === '완료'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-orange-100 text-orange-700 border-orange-200'
                  }`}>
                  {remainingLabel}
                </span>
              )}
            </div>
          </div>

          {/* 활동 카드 */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {tabSlots.map(slot => (
              <ActivityCard
                key={`${slot.monthNo}-${slot.roundNo}`}
                slot={slot}
                pairId={pair.id}
                pair={pair}
                receipts={receipts}
                onSaved={onActivitySaved}
                onToggleProposal={onToggleProposal}
                onReceiptUploaded={onReceiptUploaded}
              />
            ))}
          </div>
          <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700">
              <span className="font-bold">📎 영수증 업로드:</span>{' '}
              활동 저장 후 각 회차 카드의 &quot;영수증 업로드&quot; 버튼을 이용하세요.
              업로드 시 관리자에게 품의 안내 메일이 자동 발송됩니다.
            </p>
          </div>
        </div>
      )}

      {hasGoals && <SupportSummary startDate={pair.start_date} acts={acts} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page entry
// ─────────────────────────────────────────────────────────────────────────────

export default function MentorPage() {
  const params = useParams()
  const raw    = params?.token
  const token  = Array.isArray(raw) ? raw[0] : (raw ?? '')

  const [pair,        setPair]        = useState<MentoringPair | null>(null)
  const [exps,        setExps]        = useState<Expectation[]>([])
  const [acts,        setActs]        = useState<Activity[]>([])
  const [receipts,    setReceipts]    = useState<MentoringReceipt[]>([])
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)
  const [savingGoals, setSavingGoals] = useState(false)

  useEffect(() => {
    if (!token) return
    async function load() {
      setLoading(true)
      let found: MentoringPair | null = null
      if (IS_CONFIGURED) {
        found = await getPairByToken(token)
      } else {
        found = MOCK_PAIRS.find(p => p.token === token) ?? null
      }
      if (!found) { setNotFound(true); setLoading(false); return }
      setPair(found)

      if (IS_CONFIGURED) {
        const [e, a, r] = await Promise.all([
          getExpectations(found.id),
          getActivities(found.id),
          getReceipts(found.id),
        ])
        setExps(e); setActs(a); setReceipts(r)
      }
      setLoading(false)
    }
    load()
  }, [token])

  const handleSaveGoals = async (exp: string, coop: string) => {
    if (!pair) return
    setSavingGoals(true)
    if (IS_CONFIGURED) {
      await saveExpectations(pair.id, exp, coop)
      const fresh = await getExpectations(pair.id)
      setExps(fresh)
    } else {
      setExps([
        { id: 'local-1', pair_id: pair.id, type: 'mentee', content: exp, created_at: '' },
        { id: 'local-2', pair_id: pair.id, type: 'mentor', content: coop, created_at: '' },
      ])
    }
    setSavingGoals(false)
  }

  const handleActivitySaved = (act: Activity) => {
    setActs(prev => {
      const exists = prev.find(a => a.month_no === act.month_no && a.round_no === act.round_no)
      return exists ? prev.map(a => a.month_no === act.month_no && a.round_no === act.round_no ? act : a) : [...prev, act]
    })
  }

  const handleToggleProposal = async (id: string, checked: boolean) => {
    if (IS_CONFIGURED) await toggleProposalChecked(id, checked)
    setActs(prev => prev.map(a => a.id === id ? { ...a, proposal_checked: checked } : a))
  }

  const handleReceiptUploaded = (receipt: MentoringReceipt) => {
    setReceipts(prev => [...prev.filter(r => r.id !== receipt.id), receipt])
  }

  // ── Loading ──
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </div>
      </main>
    )
  }

  // ── Not found ──
  if (notFound || !pair) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h1>
          <p className="text-sm text-gray-500">올바른 멘토 전용 링크로 접속해주세요.</p>
          <p className="text-xs text-gray-400 mt-4 font-mono bg-gray-100 px-3 py-1.5 rounded-lg inline-block">
            token: &quot;{token}&quot;
          </p>
        </div>
      </main>
    )
  }

  // ── Main ──
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900 truncate">멘토링 운영 대시보드</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline-flex text-xs text-gray-500 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">
              {pair.mentor_name} 멘토 전용
            </span>
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <MentorView
          pair={pair} exps={exps} acts={acts} receipts={receipts}
          onSaveGoals={handleSaveGoals}
          onActivitySaved={handleActivitySaved}
          onToggleProposal={handleToggleProposal}
          onReceiptUploaded={handleReceiptUploaded}
          savingGoals={savingGoals}
        />
      </div>
    </main>
  )
}
