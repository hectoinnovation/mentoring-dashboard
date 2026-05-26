'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  MentoringRecord,
  Activity,
  INITIAL_DATA,
  createEmptyActivities,
  getMonthRange,
  getMonthActivities,
  getMonthlySupportAmount,
  getTotalSupportAmount,
  getCurrentMonthIndex,
  getMonthStatus,
  getOperationStatus,
  getMentoringPeriod,
  getEndMonth,
  getMonthStartDate,
  getMonthEndDate,
  fmtAmount,
  sendReceiptNotification,
} from '@/lib/mentoring'
import { uploadActivityImage, uploadReceipt } from '@/lib/storage'

// Mock record for /mentor/test
const TEST_RECORD: MentoringRecord = {
  id: 'test',
  mentorName: '테스트멘토',
  menteeName: '테스트멘티',
  mentorEmail: 'test@hecto.co.kr',
  joinMonth: '2026-05',
  token: 'test',
  expectation: '',
  cooperation: '',
  activities: createEmptyActivities('2026-05'),
  initialGuideMailStatus: 'pending',
  monthlyProposalMailStatus: 'pending',
  proposalSubmitted: false,
}

function findRecord(token: string): MentoringRecord | undefined {
  if (token === 'test') return { ...TEST_RECORD, activities: createEmptyActivities('2026-05') }
  return INITIAL_DATA.find(r => r.token === token)
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

function OperationBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    '운영 중':   'bg-orange-100 text-orange-700 border-orange-200',
    '전체 종료': 'bg-gray-100 text-gray-500 border-gray-200',
    '대기':      'bg-blue-50 text-blue-400 border-blue-100',
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

function RemainingBadge({ count, isActive }: { count: number; isActive: boolean }) {
  if (count >= 3) {
    return (
      <span className="inline-flex text-xs font-bold px-2 py-0.5 rounded-full border bg-green-100 text-green-700 border-green-200 whitespace-nowrap">
        완료
      </span>
    )
  }
  const remaining = 3 - count
  if (!isActive || remaining === 3) return null
  const cls = remaining === 1
    ? 'bg-red-100 text-red-600 border-red-200'
    : 'bg-amber-100 text-amber-700 border-amber-200'
  return (
    <span className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {remaining}회 남음
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoCard
// ─────────────────────────────────────────────────────────────────────────────

function InfoCard({ record }: { record: MentoringRecord }) {
  const opStatus = getOperationStatus(record)
  const curIdx   = getCurrentMonthIndex(record.joinMonth)
  const period   = getMentoringPeriod(record.joinMonth)
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-gray-900">{record.mentorName}</span>
            <span className="text-sm text-gray-400">멘토</span>
            <svg className="w-4 h-4 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-lg font-bold text-gray-900">{record.menteeName}</span>
            <span className="text-sm text-gray-400">멘티</span>
          </div>
          {record.mentorEmail && (
            <p className="text-xs text-gray-400 mt-1">{record.mentorEmail}</p>
          )}
        </div>
        <OperationBadge status={opStatus} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-orange-50 rounded-xl p-3.5 border border-orange-100">
          <p className="text-xs font-semibold text-orange-600 mb-2">운영 기간</p>
          <p className="text-sm font-bold text-gray-800">{period.start} ~ {period.end}</p>
          <p className="text-xs text-gray-500 mt-1">지급 종료월: <span className="font-semibold text-gray-700">{getEndMonth(record.joinMonth)}</span></p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-2">개월차별 기간</p>
          <div className="space-y-1">
            {([1, 2, 3] as const).map(mi => {
              const isCurrent = curIdx === mi
              return (
                <div key={mi} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-0.5 ${isCurrent ? 'bg-orange-100 text-orange-700 font-bold' : 'text-gray-500'}`}>
                  <span className="w-12 flex-shrink-0">{mi}개월차{isCurrent && ' ◀'}</span>
                  <span>{getMonthStartDate(record.joinMonth, mi)} ~ {getMonthEndDate(record.joinMonth, mi)}</span>
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
// Goal Form / Display
// ─────────────────────────────────────────────────────────────────────────────

function GoalForm({ onSave }: { onSave: (exp: string, coop: string) => void }) {
  const [expItems,  setExpItems]  = useState(['', '', ''])
  const [coopItems, setCoopItems] = useState(['', '', ''])
  const setExpItem  = (i: number, v: string) => setExpItems(prev  => prev.map((x, j) => j === i ? v : x))
  const setCoopItem = (i: number, v: string) => setCoopItems(prev => prev.map((x, j) => j === i ? v : x))
  const canSave = expItems.some(s => s.trim()) && coopItems.some(s => s.trim())
  const handleSave = () => {
    const exp  = expItems.filter(s => s.trim()).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')
    const coop = coopItems.filter(s => s.trim()).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')
    onSave(exp, coop)
  }
  return (
    <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-4">
        <h2 className="text-base font-bold text-white">멘토링 목표 달성을 위한 기대사항 및 협력사항</h2>
        <p className="text-xs text-orange-100 mt-0.5">멘토링 시작 전 작성해주세요. 작성 후 활동 등록이 가능합니다.</p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <p className="text-sm font-bold text-gray-800">기대사항(멘티) <span className="text-xs font-normal text-gray-400">멘티 작성</span></p>
            </div>
            {expItems.map((val, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-xs font-bold text-orange-400 mt-2.5 w-4 flex-shrink-0">{i + 1}</span>
                <textarea value={val} onChange={e => setExpItem(i, e.target.value)} rows={2}
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
                <textarea value={val} onChange={e => setCoopItem(i, e.target.value)} rows={2}
                  placeholder={`협력사항 ${i + 1}번 항목`}
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
              </div>
            ))}
          </div>
        </div>
        <button onClick={handleSave} disabled={!canSave}
          className="mt-5 w-full py-3 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
          저장 후 활동 등록 화면으로 이동 →
        </button>
      </div>
    </div>
  )
}

function GoalDisplay({ expectation, cooperation }: { expectation: string; cooperation: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
        <p className="text-xs font-bold text-orange-700 mb-2">기대사항 (멘티)</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{expectation}</p>
      </div>
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <p className="text-xs font-bold text-blue-700 mb-2">협력사항 (멘토)</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{cooperation}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Card
// ─────────────────────────────────────────────────────────────────────────────

function ActivityCard({ activity, onSave, onToggleProposal }: {
  activity: Activity
  onSave: (date: string, content: string, photoFile: File | null, receiptFile: File | null) => void
  onToggleProposal: (checked: boolean) => void
}) {
  const photoRef   = useRef<HTMLInputElement>(null)
  const receiptRef = useRef<HTMLInputElement>(null)

  const [date, setDate]             = useState(activity.date)
  const [content, setContent]       = useState(activity.content)
  const [photoFile, setPhotoFile]   = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState(activity.photoUrl)
  const [photoName, setPhotoName]   = useState(activity.photoName)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptName, setReceiptName] = useState(activity.receiptName)

  if (activity.saved) {
    return (
      <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-100">
          <span className="text-sm font-bold text-gray-700">{activity.round}회차</span>
          <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">✓ 저장완료</span>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex gap-2 text-xs">
            <span className="text-gray-400 w-12 flex-shrink-0">날짜</span>
            <span className="text-gray-700 font-medium">{activity.date}</span>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="text-gray-400 w-12 flex-shrink-0">내용</span>
            <span className="text-gray-700 leading-relaxed">{activity.content}</span>
          </div>
          <div className="flex gap-2 text-xs items-start">
            <span className="text-gray-400 w-12 flex-shrink-0">사진</span>
            {activity.photoUrl ? (
              <img src={activity.photoUrl} alt={activity.photoName} className="w-20 h-14 object-cover rounded-lg border border-gray-200" />
            ) : (
              <span className={activity.photoName ? 'text-green-600 font-medium' : 'text-gray-300'}>
                {activity.photoName || '미등록'}
              </span>
            )}
          </div>
          <div className="flex gap-2 text-xs items-center">
            <span className="text-gray-400 w-12 flex-shrink-0">영수증</span>
            {activity.receiptName ? (
              activity.receiptUrl ? (
                <a href={activity.receiptUrl} target="_blank" rel="noreferrer"
                  className="text-blue-600 underline font-medium truncate max-w-[160px]">
                  {activity.receiptName}
                </a>
              ) : (
                <span className="text-green-600 font-medium truncate max-w-[160px]">{activity.receiptName}</span>
              )
            ) : (
              <span className="text-gray-300">미등록</span>
            )}
          </div>
          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={activity.proposalChecked}
                onChange={e => onToggleProposal(e.target.checked)}
                className="w-4 h-4 accent-orange-500 cursor-pointer rounded" />
              <span className={`text-xs font-semibold ${activity.proposalChecked ? 'text-orange-600' : 'text-gray-400'}`}>
                내부망 품의 등록 완료{activity.proposalChecked && ' ✓'}
              </span>
            </label>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-sm font-bold text-gray-700">{activity.round}회차</span>
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

        {/* 활동 사진 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">활동 사진</label>
          <input ref={photoRef} type="file" accept="image/*" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) {
                setPhotoFile(file)
                setPhotoName(file.name)
                setPhotoPreview(URL.createObjectURL(file))
              }
            }} />
          <button type="button" onClick={() => photoRef.current?.click()}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            📷 사진 선택
          </button>
          {photoPreview
            ? <img src={photoPreview} alt={photoName} className="mt-2 w-full max-h-28 object-cover rounded-lg border border-gray-200" />
            : photoName ? <span className="ml-2 text-xs text-green-600 truncate inline-block max-w-[120px] align-middle">{photoName}</span> : null}
        </div>

        {/* 영수증 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">영수증 파일</label>
          <input ref={receiptRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) {
                setReceiptFile(file)
                setReceiptName(file.name)
              }
            }} />
          <button type="button" onClick={() => receiptRef.current?.click()}
            className="text-xs px-3 py-1.5 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors">
            🧾 영수증 선택
          </button>
          {receiptName && (
            <span className="ml-2 text-xs text-blue-600 truncate inline-block max-w-[120px] align-middle">{receiptName}</span>
          )}
          <p className="text-xs text-amber-600 mt-1 leading-relaxed">
            영수증 등록 시 관리자에게 품의 메일이 자동 발송됩니다.
          </p>
        </div>

        <button type="button"
          onClick={() => { if (date && content) onSave(date, content, photoFile, receiptFile) }}
          disabled={!date || !content}
          className="w-full text-sm font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg transition-colors">
          저장
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Support Summary
// ─────────────────────────────────────────────────────────────────────────────

function SupportSummary({ record }: { record: MentoringRecord }) {
  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 space-y-4">
      <h3 className="font-bold text-orange-800 text-sm">월별 지원금 현황</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([1, 2, 3] as const).map(mi => {
          const cnt = getMonthActivities(record, mi)
          const amt = getMonthlySupportAmount(record, mi)
          const st  = getMonthStatus(record, mi)
          return (
            <div key={mi} className="bg-white rounded-xl border border-orange-100 p-3 text-center shadow-sm">
              <p className="text-xs text-gray-500 mb-0.5">{mi}개월차</p>
              <p className="text-xs text-gray-400 mb-1">{cnt}회 활동</p>
              <p className={`text-lg font-black ${amt > 0 ? 'text-orange-600' : 'text-gray-300'}`}>{fmtAmount(amt)}</p>
              <div className="mt-1.5"><MonthBadge status={st} /></div>
            </div>
          )
        })}
        <div className="bg-orange-500 rounded-xl border border-orange-400 p-3 text-center shadow-sm">
          <p className="text-xs text-orange-100 mb-0.5">최종 예상 지급</p>
          <p className="text-xs text-orange-200 mb-1">3개월 합산</p>
          <p className="text-lg font-black text-white">{fmtAmount(getTotalSupportAmount(record))}</p>
          <p className="text-xs text-orange-200 mt-1.5">최대 300,000원</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([1, 2, 3] as const).map(mi => {
          const cnt = getMonthActivities(record, mi)
          return (
            <div key={mi} className="bg-white rounded-xl border border-gray-100 p-2.5">
              <p className="text-xs font-bold text-gray-500 text-center mb-1.5">{mi}개월차 기준</p>
              <div className="space-y-1">
                {[
                  { label: '0~1회', amt: '0원',      match: cnt <= 1 },
                  { label: '2회',   amt: '50,000원',  match: cnt === 2 },
                  { label: '3회+',  amt: '100,000원', match: cnt >= 3 },
                ].map(b => (
                  <div key={b.label} className={`text-xs rounded px-1.5 py-1 flex justify-between ${b.match ? 'bg-orange-100 text-orange-800 font-bold' : 'text-gray-300'}`}>
                    <span>{b.label}</span><span>{b.amt}</span>
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
          내부망에서 <strong>&quot;멘토링 활동/정산 신청서&quot;</strong>를 검색하여 등록해주세요.<br />
          <span className="font-semibold text-amber-600">영수증은 대시보드 또는 내부망 품의에 첨부 가능합니다.</span>
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mentor View
// ─────────────────────────────────────────────────────────────────────────────

function MentorView({ record, onUpdate }: { record: MentoringRecord; onUpdate: (r: MentoringRecord) => void }) {
  const hasGoals = record.expectation.trim() !== '' || record.cooperation.trim() !== ''
  const curIdx   = getCurrentMonthIndex(record.joinMonth)
  const initTab: 1 | 2 | 3 = (curIdx >= 1 && curIdx <= 3) ? (curIdx as 1 | 2 | 3) : 1
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(initTab)
  const [saving, setSaving] = useState(false)

  const saveGoals = (expectation: string, cooperation: string) =>
    onUpdate({ ...record, expectation, cooperation })

  const saveActivity = async (
    round: number,
    date: string,
    content: string,
    photoFile: File | null,
    receiptFile: File | null,
  ) => {
    setSaving(true)
    try {
      let photoName = ''
      let photoUrl  = ''
      let receiptName = ''
      let receiptUrl  = ''

      const act = record.activities.find(a => a.round === round)!

      if (photoFile) {
        photoName = photoFile.name
        try {
          photoUrl = await uploadActivityImage(photoFile, record.token, round)
        } catch {
          photoUrl = URL.createObjectURL(photoFile)
        }
      }

      if (receiptFile) {
        receiptName = receiptFile.name
        try {
          receiptUrl = await uploadReceipt(receiptFile, record.token, act.monthIndex, round)
        } catch {
          receiptUrl = URL.createObjectURL(receiptFile)
        }
        // 관리자에게 품의 메일 자동 발송
        const updatedActs = record.activities.map(a =>
          a.round === round ? { ...a, saved: true } : a
        )
        const amt = getMonthlySupportAmount({ ...record, activities: updatedActs }, act.monthIndex)
        sendReceiptNotification(record, act.monthIndex, round, receiptName, amt).catch(console.warn)
      }

      onUpdate({
        ...record,
        activities: record.activities.map(a =>
          a.round === round
            ? { ...a, date, content, photoName, photoUrl, receiptName, receiptUrl, saved: true }
            : a
        ),
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleProposal = (round: number, checked: boolean) =>
    onUpdate({ ...record, activities: record.activities.map(a => a.round === round ? { ...a, proposalChecked: checked } : a) })

  const mi = activeTab
  const mStatus   = getMonthStatus(record, mi)
  const mCount    = getMonthActivities(record, mi)
  const { start, end } = getMonthRange(record.joinMonth, mi)
  const monthActs = record.activities.filter(a => a.monthIndex === mi)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <InfoCard record={record} />

      {!hasGoals ? (
        <GoalForm onSave={saveGoals} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-orange-400" />
            <h3 className="text-sm font-bold text-gray-800">기대사항 및 협력사항</h3>
          </div>
          <GoalDisplay expectation={record.expectation} cooperation={record.cooperation} />
        </div>
      )}

      {hasGoals && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Month tabs */}
          <div className="flex border-b border-gray-100">
            {([1, 2, 3] as const).map(m => {
              const isActive  = m === activeTab
              const isCurrent = curIdx === m
              const st  = getMonthStatus(record, m)
              const cnt = getMonthActivities(record, m)
              return (
                <button key={m} type="button" onClick={() => setActiveTab(m)}
                  className={`flex-1 pt-3 pb-2.5 px-1 transition-colors ${isActive ? 'bg-orange-50 border-b-2 border-orange-500 text-orange-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                  <div className="text-sm font-bold flex items-center justify-center gap-1">
                    {m}개월차
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                    <span className={`text-xs ${isActive ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>{cnt}/3회</span>
                    <MonthBadge status={st} />
                    <RemainingBadge count={cnt} isActive={isCurrent} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Month header */}
          <div className={`px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2 ${curIdx === mi ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`text-sm font-bold ${curIdx === mi ? 'text-orange-700' : 'text-gray-700'}`}>{mi}개월차 활동 등록</span>
              <MonthBadge status={mStatus} />
              <span className="text-xs text-gray-400">{start} ~ {end}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>활동 <strong className="text-gray-800">{mCount}</strong>/3회</span>
              {mCount < 3 && (
                <span>남은 회차: <strong className={curIdx === mi ? 'text-orange-500' : 'text-gray-600'}>{3 - mCount}회</strong></span>
              )}
              {mCount >= 3 && <span className="text-green-600 font-bold">✓ 마감</span>}
            </div>
          </div>

          {/* Activity cards */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {saving && (
              <div className="col-span-full text-center text-xs text-orange-500 font-semibold py-2">저장 중...</div>
            )}
            {monthActs.map(act => (
              <ActivityCard key={act.round} activity={act}
                onSave={(d, c, pf, rf) => saveActivity(act.round, d, c, pf, rf)}
                onToggleProposal={checked => toggleProposal(act.round, checked)} />
            ))}
          </div>

          <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 leading-relaxed">
              <span className="font-bold">영수증 파일을 업로드하면</span> 관리자에게 품의 메일이 자동 발송됩니다.<br />
              활동 사진과 영수증을 함께 등록하면 정산이 원활하게 진행됩니다.
            </p>
          </div>
        </div>
      )}

      {hasGoals && <SupportSummary record={record} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function MentorPage() {
  const params   = useParams()
  const router   = useRouter()
  const rawToken = params?.token
  const token    = Array.isArray(rawToken) ? rawToken[0] : (rawToken ?? '')

  const initial = findRecord(token)
  const [record, setRecord] = useState<MentoringRecord | null>(initial ?? null)

  if (!record) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            올바른 멘토 전용 링크로 접속해주세요.<br />링크가 없으시면 인사팀에 문의해주세요.
          </p>
          <p className="text-xs text-gray-400 mt-4 font-mono bg-gray-100 px-3 py-1.5 rounded-lg inline-block">
            token: &quot;{token || '(없음)'}&quot;
          </p>
        </div>
      </main>
    )
  }

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
              {record.mentorName} 멘토 전용
            </span>
            <button type="button" onClick={() => router.push('/')}
              className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
              관리자 화면
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <MentorView record={record} onUpdate={setRecord} />
      </div>
    </main>
  )
}
