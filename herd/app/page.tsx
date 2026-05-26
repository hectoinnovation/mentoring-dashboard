'use client'

import { useState } from 'react'
import {
  MentoringRecord,
  INITIAL_DATA,
  TODAY,

  getTotalActivities,
  getMonthActivities,
  getMonthlySupportAmount,
  getTotalSupportAmount,
  getCurrentMonthIndex,
  getMonthStatus,
  getOperationStatus,
  hasPhotoUploaded,
  hasReceiptUploaded,
  getInitialGuideStatus,
  getMonthlyProposalGuideStatus,
  getProposalSubmitStatus,
  fmtAmount,
  sendInitialGuideMail,
  sendMonthlyProposalMail,
  getMentoringPeriod,
  getEndMonth,
  getMonthStartDate,
  getMonthEndDate,
  createEmptyActivities,
  generateInitialGuideMailBody,
  generateProposalMailBody,
} from '@/lib/mentoring'

// ─────────────────────────────────────────────────────────────────────────────
// Common UI Components
// ─────────────────────────────────────────────────────────────────────────────

function OperationBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    '운영 중':       'bg-orange-100 text-orange-700 border-orange-200',
    '진행중':        'bg-orange-100 text-orange-700 border-orange-200',
    '월별 마감':     'bg-blue-100 text-blue-700 border-blue-200',
    '3회 이상 달성': 'bg-green-100 text-green-700 border-green-200',
    '활동 미달':     'bg-red-100 text-red-700 border-red-200',
    '전체 종료':     'bg-gray-100 text-gray-600 border-gray-200',
    '대기':          'bg-gray-100 text-gray-400 border-gray-200',
  }
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {status}
    </span>
  )
}

function MonthBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    '대기':       'bg-gray-100 text-gray-500 border-gray-200',
    '진행중':     'bg-orange-100 text-orange-700 border-orange-200',
    '마감':       'bg-green-100 text-green-700 border-green-200',
    '미달 마감':  'bg-red-100 text-red-700 border-red-200',
    '미진행 마감':'bg-red-100 text-red-600 border-red-200',
  }
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${cls[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {status}
    </span>
  )
}

function MailBadge({ status }: { status: 'pending' | 'sent' }) {
  return status === 'sent'
    ? <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">발송완료</span>
    : <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">미발송</span>
}

function PhotoBadge({ uploaded }: { uploaded: boolean }) {
  return uploaded
    ? <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">등록됨</span>
    : <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">미등록</span>
}

function ReceiptBadge({ uploaded }: { uploaded: boolean }) {
  return uploaded
    ? <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">등록됨</span>
    : <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap">미등록</span>
}

function SendMailBtn({ status, label, onSend, disabled }: {
  status: 'pending' | 'sent'; label: string; onSend: () => void; disabled?: boolean
}) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold whitespace-nowrap">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3 3 7-7" /></svg>
        발송완료
      </span>
    )
  }
  return (
    <button onClick={onSend} disabled={disabled}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${disabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 active:scale-95 text-white'}`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2 8l11-5-5 11-1.5-4.5L2 8z" /></svg>
      {label}
    </button>
  )
}

function CopyLinkBtn({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    navigator.clipboard?.writeText(`${base}/mentor/${token}`).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy}
      className={`text-xs px-2 py-1 rounded-lg border font-medium transition-all whitespace-nowrap ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
      {copied ? '✓ 복사됨' : '링크 복사'}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mail Preview  (바디 생성을 lib/mentoring.ts 함수로 통합)
// ─────────────────────────────────────────────────────────────────────────────

function MailPreview({ record, type }: { record: MentoringRecord; type: 'initial' | 'proposal' }) {
  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/mentor/${record.token}`
    : `/mentor/${record.token}`

  const subject = type === 'initial'
    ? '신규입사자 멘토링 안내'
    : '멘토링 활동 지원금 품의 안내'

  const body = type === 'initial'
    ? generateInitialGuideMailBody(record, link)
    : generateProposalMailBody(record)

  return (
    <div className="mt-3 bg-gray-50 rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-500 mb-2">메일 미리보기</p>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="mb-3 pb-3 border-b border-gray-100">
          <p className="text-xs text-gray-400">제목</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">{subject}</p>
        </div>
        <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">{body}</pre>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Detail Modal
// ─────────────────────────────────────────────────────────────────────────────

function ActivityDetailModal({ record, onClose }: { record: MentoringRecord; onClose: () => void }) {
  const period = getMentoringPeriod(record.joinMonth)
  const total  = getTotalActivities(record)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-900 text-base">
              {record.mentorName} <span className="text-gray-400 font-normal">멘토</span>
              <span className="mx-2 text-gray-300">→</span>
              {record.menteeName} <span className="text-gray-400 font-normal">멘티</span>
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
              <span>입사월: {record.joinMonth}</span>
              <span>운영기간: {period.start} ~ {period.end}</span>
              <span>총 <strong className="text-gray-800">{total}회</strong> 활동</span>
              <span>총 지급 예정: <strong className="text-orange-600">{fmtAmount(getTotalSupportAmount(record))}</strong></span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none flex-shrink-0">×</button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {([1, 2, 3] as const).map(mi => {
            const acts = record.activities.filter(a => a.monthIndex === mi)
            return (
              <div key={mi}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{mi}개월차</span>
                  <span className="text-xs text-gray-400">
                    {getMonthStartDate(record.joinMonth, mi)} ~ {getMonthEndDate(record.joinMonth, mi)}
                  </span>
                </div>
                <div className="space-y-2">
                  {acts.map(act => (
                    <div key={act.round}
                      className={`rounded-xl border p-4 ${act.saved ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-gray-700">{mi}개월차 / {act.round}회차</span>
                        {act.saved
                          ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200">저장완료</span>
                          : <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full border border-gray-200">미저장</span>
                        }
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 text-xs">
                          <div className="flex gap-2">
                            <span className="text-gray-400 w-14 flex-shrink-0">활동일</span>
                            <span className="text-gray-700">{act.date || '-'}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-400 w-14 flex-shrink-0">활동 내용</span>
                            <span className={`leading-relaxed ${act.content ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                              {act.content || '활동 내용 미입력'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-400 w-14 flex-shrink-0">사진</span>
                            <span className={act.photoName ? 'text-gray-600' : 'text-gray-400 italic'}>
                              {act.photoName || '없음'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-400 w-14 flex-shrink-0">영수증</span>
                            {act.receiptName ? (
                              act.receiptUrl
                                ? <a href={act.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline truncate max-w-[120px]">{act.receiptName}</a>
                                : <span className="text-blue-600 truncate max-w-[120px]">{act.receiptName}</span>
                            ) : (
                              <span className="text-gray-400 italic">없음</span>
                            )}
                          </div>
                        </div>
                        <div>
                          {act.photoUrl
                            ? <img src={act.photoUrl} alt={act.photoName}
                                className="w-full max-h-36 object-cover rounded-lg border border-gray-200" />
                            : <div className={`text-xs rounded-lg p-3 text-center flex items-center justify-center h-20 ${act.saved ? 'bg-amber-50 border border-amber-200 text-amber-600' : 'bg-gray-100 border border-gray-200 text-gray-400 italic'}`}>
                                {act.saved ? '📷 사진 미등록' : '사진 미등록'}
                              </div>
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Summary Table  (기본 요약 표: 멘토|멘티|월|활동횟수|증빙|지급금액|상태)
// ─────────────────────────────────────────────────────────────────────────────

function AdminSummaryTable({ records }: { records: MentoringRecord[] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse" style={{ minWidth: 640 }}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['멘토', '멘티', '월', '활동횟수', '영수증 증빙', '지급금액', '상태'].map(h => (
              <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.flatMap((r, ri) =>
            ([1, 2, 3] as const).map((mi, miIdx) => {
              const cnt = getMonthActivities(r, mi)
              const amt = getMonthlySupportAmount(r, mi)
              const st  = getMonthStatus(r, mi)
              const receipt = hasReceiptUploaded(r, mi)
              const isFirst = miIdx === 0
              const rowBg = ri % 2 === 0 ? '' : 'bg-gray-50/40'
              return (
                <tr key={`${r.id}-${mi}`} className={`border-b border-gray-100 hover:bg-orange-50/20 transition-colors ${rowBg}`}>
                  {isFirst && (
                    <>
                      <td rowSpan={3} className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap align-top border-r border-gray-100 pt-3">
                        {r.mentorName}
                      </td>
                      <td rowSpan={3} className="px-3 py-2 text-gray-600 whitespace-nowrap align-top border-r border-gray-100 pt-3">
                        {r.menteeName}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                    <span className="font-semibold text-gray-700">{mi}개월차</span>
                    <span className="text-gray-400 ml-1 text-xs">
                      {getMonthStartDate(r.joinMonth, mi).slice(5)} ~ {getMonthEndDate(r.joinMonth, mi).slice(5)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-sm font-bold ${cnt >= 3 ? 'text-green-600' : cnt >= 2 ? 'text-orange-500' : 'text-gray-400'}`}>
                      {cnt}<span className="text-xs font-normal text-gray-400">/3회</span>
                    </span>
                  </td>
                  <td className="px-3 py-2"><ReceiptBadge uploaded={receipt} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className={`text-xs font-bold ${amt > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                      {fmtAmount(amt)}
                    </span>
                  </td>
                  <td className="px-3 py-2"><MonthBadge status={st} /></td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Tab: Overview
// ─────────────────────────────────────────────────────────────────────────────

function AdminOverviewTab({ records, onUpdate }: {
  records: MentoringRecord[]
  onUpdate: (id: string, fn: (r: MentoringRecord) => MentoringRecord) => void
}) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(true)
  const detailRecord = detailId ? records.find(r => r.id === detailId) ?? null : null

  const headers = [
    '멘토명', '멘티명', '멘토 이메일', '입사월', '운영 기간', '지급 종료월', '운영 상태', '현재 개월차',
    '총 활동', '1개월 예정금액', '2개월 예정금액', '3개월 예정금액', '총 지급 예정',
    '사진 등록', '영수증', '활동 상세', '최초 안내', '월말 품의 안내', '내부망 품의', '멘토 링크',
  ]

  return (
    <>
      {/* 기본 요약 표 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="w-1 h-4 bg-orange-400 rounded-full inline-block" />
            기본 요약 표
          </h3>
          <button onClick={() => setShowSummary(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            {showSummary ? '접기 ▲' : '펼치기 ▼'}
          </button>
        </div>
        {showSummary && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            <AdminSummaryTable records={records} />
          </div>
        )}
      </div>

      {/* 상세 전체 현황 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
          <span className="w-1 h-4 bg-blue-400 rounded-full inline-block" />
          상세 전체 현황
        </h3>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-collapse" style={{ minWidth: 1300 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {headers.map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map(r => {
                const opStatus = getOperationStatus(r)
                const idx = getCurrentMonthIndex(r.joinMonth)
                const total = getTotalActivities(r)
                return (
                  <tr key={r.id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="px-3 py-3 font-semibold text-gray-800 whitespace-nowrap">{r.mentorName}</td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{r.menteeName}</td>
                    <td className="px-3 py-3">
                      <input
                        type="email"
                        value={r.mentorEmail}
                        onChange={e => onUpdate(r.id, rec => ({ ...rec, mentorEmail: e.target.value }))}
                        placeholder="이메일 입력"
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-44 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{r.joinMonth}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-700 font-medium">
                          {getMentoringPeriod(r.joinMonth).start} ~ {getMentoringPeriod(r.joinMonth).end}
                        </span>
                        <div className="space-y-0.5">
                          {([1, 2, 3] as const).map(mi => (
                            <div key={mi} className="text-xs text-gray-400">
                              {mi}개월차: {getMonthStartDate(r.joinMonth, mi)} ~ {getMonthEndDate(r.joinMonth, mi)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap">{getEndMonth(r.joinMonth)}</td>
                    <td className="px-3 py-3"><OperationBadge status={opStatus} /></td>
                    <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap">
                      {idx >= 1 && idx <= 3 ? `${idx}개월차` : idx === 4 ? '종료' : '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-gray-800">{total}회</td>
                    {([1, 2, 3] as const).map(mi => (
                      <td key={mi} className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-xs font-bold ${getMonthlySupportAmount(r, mi) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {fmtAmount(getMonthlySupportAmount(r, mi))}
                          </span>
                          <span className="text-xs text-gray-400">{getMonthActivities(r, mi)}회</span>
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-bold text-gray-800 whitespace-nowrap">
                      {fmtAmount(getTotalSupportAmount(r))}
                    </td>
                    <td className="px-3 py-3"><PhotoBadge uploaded={hasPhotoUploaded(r)} /></td>
                    <td className="px-3 py-3"><ReceiptBadge uploaded={hasReceiptUploaded(r)} /></td>
                    <td className="px-3 py-3">
                      <button onClick={() => setDetailId(r.id)}
                        className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
                        활동 상세
                      </button>
                    </td>
                    <td className="px-3 py-3"><MailBadge status={getInitialGuideStatus(r)} /></td>
                    <td className="px-3 py-3"><MailBadge status={getMonthlyProposalGuideStatus(r)} /></td>
                    <td className="px-3 py-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={getProposalSubmitStatus(r)}
                          onChange={e => onUpdate(r.id, rec => ({ ...rec, proposalSubmitted: e.target.checked }))}
                          className="w-4 h-4 accent-orange-500 cursor-pointer" />
                        <span className={`text-xs font-medium ${r.proposalSubmitted ? 'text-green-600' : 'text-gray-400'}`}>
                          {r.proposalSubmitted ? '완료' : '미등록'}
                        </span>
                      </label>
                    </td>
                    <td className="px-3 py-3"><CopyLinkBtn token={r.token} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailRecord && <ActivityDetailModal record={detailRecord} onClose={() => setDetailId(null)} />}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Tab: Initial Mail
// ─────────────────────────────────────────────────────────────────────────────

function AdminInitialMailTab({ records, onUpdate }: {
  records: MentoringRecord[]
  onUpdate: (id: string, fn: (r: MentoringRecord) => MentoringRecord) => void
}) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  const handleSend = async (r: MentoringRecord) => {
    setSending(r.id)
    try {
      await sendInitialGuideMail(r)
    } finally {
      setSending(null)
    }
    onUpdate(r.id, rec => ({ ...rec, initialGuideMailStatus: 'sent' }))
  }

  return (
    <div className="space-y-3">
      {records.map(r => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-4 flex-wrap gap-y-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {r.mentorName[0]}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-sm">
                  {r.mentorName} <span className="text-gray-400 font-normal">멘토</span>
                  <span className="mx-1.5 text-gray-300">→</span>
                  {r.menteeName} <span className="text-gray-400 font-normal">멘티</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  입사월: {r.joinMonth} · /mentor/{r.token}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap gap-y-2">
              {r.mentorEmail
                ? <span className="text-xs px-2 py-0.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 font-mono truncate max-w-[180px]">{r.mentorEmail}</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 border border-red-200 text-red-600 font-semibold whitespace-nowrap">이메일 미등록</span>
              }
              <CopyLinkBtn token={r.token} />
              <MailBadge status={r.initialGuideMailStatus} />
              <button
                onClick={() => setPreviewId(previewId === r.id ? null : r.id)}
                className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                {previewId === r.id ? '미리보기 닫기' : '메일 미리보기'}
              </button>
              {sending === r.id
                ? <span className="text-xs text-orange-500 font-semibold whitespace-nowrap">발송 중...</span>
                : (
                  <SendMailBtn
                    status={r.initialGuideMailStatus}
                    label="최초 안내 메일 발송"
                    onSend={() => handleSend(r)}
                    disabled={!r.mentorEmail || sending !== null}
                  />
                )
              }
            </div>
          </div>
          {previewId === r.id && (
            <div className="px-5 pb-5">
              <MailPreview record={r} type="initial" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Tab: Proposal Guide
// ─────────────────────────────────────────────────────────────────────────────

function AdminProposalTab({ records, onUpdate }: {
  records: MentoringRecord[]
  onUpdate: (id: string, fn: (r: MentoringRecord) => MentoringRecord) => void
}) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const targets = records.filter(r => getTotalSupportAmount(r) > 0)

  const handleSend = async (r: MentoringRecord) => {
    setSending(r.id)
    try {
      await sendMonthlyProposalMail(r)
    } finally {
      setSending(null)
    }
    onUpdate(r.id, rec => ({ ...rec, monthlyProposalMailStatus: 'sent' }))
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-amber-800">품의 안내 대상 기준</p>
        <p className="text-xs text-amber-700 mt-0.5">
          월별 활동 2회 이상으로 지원금이 발생한 멘토만 표시됩니다.
          영수증 증빙은 본 대시보드에서 업로드하거나 내부망 품의 등록 시 첨부해주세요.
        </p>
      </div>

      {targets.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-10 flex items-center justify-center">
          <p className="text-sm text-gray-400">품의 안내 대상이 없습니다</p>
        </div>
      )}

      {targets.map(r => {
        const photo   = hasPhotoUploaded(r)
        const receipt = hasReceiptUploaded(r)
        const total   = getTotalSupportAmount(r)
        return (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 flex-wrap gap-y-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {r.mentorName[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{r.mentorName} / {r.menteeName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    입사월: {r.joinMonth} · 총 지급 예정: <span className="font-semibold text-orange-600">{fmtAmount(total)}</span>
                    {' '}(1개월: {fmtAmount(getMonthlySupportAmount(r, 1))} / 2개월: {fmtAmount(getMonthlySupportAmount(r, 2))} / 3개월: {fmtAmount(getMonthlySupportAmount(r, 3))})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap gap-y-2">
                {photo
                  ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 whitespace-nowrap">사진 등록됨</span>
                  : <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 whitespace-nowrap">활동 사진 미등록</span>
                }
                {receipt
                  ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 whitespace-nowrap">영수증 등록됨</span>
                  : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">영수증 미등록</span>
                }
                <MailBadge status={r.monthlyProposalMailStatus} />
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-100 transition-colors">
                  <input type="checkbox" checked={r.proposalSubmitted}
                    onChange={e => onUpdate(r.id, rec => ({ ...rec, proposalSubmitted: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-orange-500" />
                  <span className={r.proposalSubmitted ? 'text-green-600 font-semibold' : ''}>
                    {r.proposalSubmitted ? '품의 등록 완료' : '품의 등록 완료 체크'}
                  </span>
                </label>
                <button
                  onClick={() => setPreviewId(previewId === r.id ? null : r.id)}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  {previewId === r.id ? '미리보기 닫기' : '메일 미리보기'}
                </button>
                {sending === r.id
                  ? <span className="text-xs text-orange-500 font-semibold whitespace-nowrap">발송 중...</span>
                  : (
                    <SendMailBtn
                      status={r.monthlyProposalMailStatus}
                      label="월말 품의 안내 메일 발송"
                      onSend={() => handleSend(r)}
                      disabled={sending !== null}
                    />
                  )
                }
              </div>
            </div>
            {previewId === r.id && (
              <div className="px-5 pb-5">
                <MailPreview record={r} type="proposal" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Tab: Final Settlement
// ─────────────────────────────────────────────────────────────────────────────

function AdminSettlementTab({ records }: { records: MentoringRecord[] }) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const detailRecord = detailId ? records.find(r => r.id === detailId) ?? null : null
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-800 font-semibold">안내사항</p>
        <p className="text-xs text-blue-700 mt-0.5">
          영수증 증빙은 멘토 전용 화면에서 업로드하거나, 내부망 품의 등록 시 첨부할 수 있습니다.
          지원금은 월별 독립 계산이며 이월되지 않습니다.
        </p>
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 1600 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {[
                '멘토명', '멘티명', '입사월', '운영 기간', '지급 종료월',
                '1개월 활동', '1개월 상태', '1개월 지급',
                '2개월 활동', '2개월 상태', '2개월 지급',
                '3개월 활동', '3개월 상태', '3개월 지급',
                '총 활동', '사진', '영수증', '활동 상세',
                '최종 총 지급', '최초 안내', '품의 안내', '내부망 품의', '운영 상태',
              ].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map(r => {
              const allDone = getCurrentMonthIndex(r.joinMonth) === 4
              const total = getTotalActivities(r)
              const opStatus = getOperationStatus(r)
              return (
                <tr key={r.id} className="hover:bg-orange-50/30 transition-colors">
                  <td className="px-3 py-3 font-semibold text-gray-800 whitespace-nowrap">{r.mentorName}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{r.menteeName}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{r.joinMonth}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-gray-700 font-medium">
                        {getMentoringPeriod(r.joinMonth).start} ~ {getMentoringPeriod(r.joinMonth).end}
                      </span>
                      <div className="space-y-0.5">
                        {([1, 2, 3] as const).map(mi => (
                          <div key={mi} className="text-xs text-gray-400">
                            {mi}개월차: {getMonthStartDate(r.joinMonth, mi)} ~ {getMonthEndDate(r.joinMonth, mi)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap">{getEndMonth(r.joinMonth)}</td>
                  {([1, 2, 3] as const).flatMap(mi => [
                    <td key={`act-${mi}`} className="px-3 py-3 text-center text-gray-700 font-medium">
                      {getMonthActivities(r, mi)}회
                    </td>,
                    <td key={`st-${mi}`} className="px-3 py-3">
                      <MonthBadge status={getMonthStatus(r, mi)} />
                    </td>,
                    <td key={`amt-${mi}`} className="px-3 py-3 text-right whitespace-nowrap">
                      <span className={`text-xs font-bold ${getMonthlySupportAmount(r, mi) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {fmtAmount(getMonthlySupportAmount(r, mi))}
                      </span>
                    </td>,
                  ])}
                  <td className="px-3 py-3 text-center font-bold text-gray-800">{total}회</td>
                  <td className="px-3 py-3"><PhotoBadge uploaded={hasPhotoUploaded(r)} /></td>
                  <td className="px-3 py-3"><ReceiptBadge uploaded={hasReceiptUploaded(r)} /></td>
                  <td className="px-3 py-3">
                    <button onClick={() => setDetailId(r.id)}
                      className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
                      활동 상세
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-gray-800 whitespace-nowrap">
                    {fmtAmount(getTotalSupportAmount(r))}
                  </td>
                  <td className="px-3 py-3"><MailBadge status={r.initialGuideMailStatus} /></td>
                  <td className="px-3 py-3"><MailBadge status={r.monthlyProposalMailStatus} /></td>
                  <td className="px-3 py-3">
                    {r.proposalSubmitted
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 whitespace-nowrap">등록완료</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 whitespace-nowrap">미등록</span>
                    }
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <OperationBadge status={opStatus} />
                      {allDone && (
                        <span className={`text-xs font-semibold ${total >= 3 ? 'text-green-600' : 'text-red-600'}`}>
                          {total >= 3 ? '달성 완료' : '활동 미달'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detailRecord && <ActivityDetailModal record={detailRecord} onClose={() => setDetailId(null)} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// New Mentoring Modal
// ─────────────────────────────────────────────────────────────────────────────

function NewMentoringModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (r: MentoringRecord) => void
}) {
  const [mentorName, setMentorName]   = useState('')
  const [menteeName, setMenteeName]   = useState('')
  const [mentorEmail, setMentorEmail] = useState('')
  const [joinMonth, setJoinMonth]     = useState('')

  const period = joinMonth ? getMentoringPeriod(joinMonth) : null
  const endMon = joinMonth ? getEndMonth(joinMonth) : null
  const canSave = mentorName.trim() && menteeName.trim() && joinMonth

  function handleSave() {
    if (!canSave) return
    const token = `mentor_${Math.random().toString(36).slice(2, 8)}`
    const newRecord: MentoringRecord = {
      id: Date.now().toString(),
      mentorName: mentorName.trim(),
      menteeName: menteeName.trim(),
      mentorEmail: mentorEmail.trim(),
      joinMonth,
      token,
      expectation: '',
      cooperation: '',
      activities: createEmptyActivities(joinMonth),
      initialGuideMailStatus: 'pending',
      monthlyProposalMailStatus: 'pending',
      proposalSubmitted: false,
    }
    onSave(newRecord)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">신규 멘토링 생성</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">멘토명 <span className="text-red-400">*</span></label>
            <input value={mentorName} onChange={e => setMentorName(e.target.value)} placeholder="예: 김멘토"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">멘티명 <span className="text-red-400">*</span></label>
            <input value={menteeName} onChange={e => setMenteeName(e.target.value)} placeholder="예: 이멘티"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">멘토 이메일</label>
            <input type="email" value={mentorEmail} onChange={e => setMentorEmail(e.target.value)} placeholder="예: mentor@company.com"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">입사월 <span className="text-red-400">*</span></label>
            <input type="month" value={joinMonth} onChange={e => setJoinMonth(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
        </div>

        {period && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 text-xs space-y-1">
            <p className="font-semibold text-orange-700 mb-1.5">자동 생성 정보</p>
            <div className="flex gap-2"><span className="text-orange-400 w-20">운영 기간</span><span className="font-medium text-orange-800">{period.start} ~ {period.end}</span></div>
            <div className="flex gap-2"><span className="text-orange-400 w-20">지급 종료월</span><span className="font-medium text-orange-800">{endMon}</span></div>
            <div className="flex gap-2"><span className="text-orange-400 w-20">활동 회차</span><span className="font-medium text-orange-800">1~9회차 초기 생성</span></div>
            <div className="flex gap-2"><span className="text-orange-400 w-20">토큰</span><span className="text-gray-500">자동 생성</span></div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 text-sm font-semibold border border-gray-200 text-gray-600 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={handleSave} disabled={!canSave}
            className="flex-1 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl transition-colors">
            생성하기
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────

type AdminSubTab = 'overview' | 'mail' | 'proposal' | 'settlement'

export default function AdminDashboard() {
  const [records, setRecords] = useState<MentoringRecord[]>(INITIAL_DATA)
  const [adminTab, setAdminTab] = useState<AdminSubTab>('overview')
  const [showNewModal, setShowNewModal] = useState(false)

  function updateRecord(id: string, fn: (r: MentoringRecord) => MentoringRecord) {
    setRecords(prev => prev.map(r => r.id === id ? fn(r) : r))
  }

  function addRecord(r: MentoringRecord) {
    setRecords(prev => [...prev, r])
  }

  const stats = {
    total:          records.length,
    achieved:       records.filter(r => getTotalActivities(r) >= 3).length,
    initialSent:    records.filter(r => r.initialGuideMailStatus === 'sent').length,
    proposalNeeded: records.filter(r => getTotalSupportAmount(r) > 0).length,
    proposalSent:   records.filter(r => r.monthlyProposalMailStatus === 'sent').length,
    proposalDone:   records.filter(r => r.proposalSubmitted).length,
    underactive:    records.filter(r => getOperationStatus(r) === '활동 미달').length,
  }

  const summaryCards = [
    { label: '전체 멘토링',          value: stats.total,          color: 'bg-orange-500', light: 'bg-orange-50',  text: 'text-orange-600',  ring: 'ring-orange-200'  },
    { label: '3회 이상 달성',         value: stats.achieved,        color: 'bg-green-500',  light: 'bg-green-50',   text: 'text-green-600',   ring: 'ring-green-200'   },
    { label: '최초 안내 발송완료',    value: stats.initialSent,     color: 'bg-blue-500',   light: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-200'    },
    { label: '품의 안내 필요',        value: stats.proposalNeeded,  color: 'bg-purple-500', light: 'bg-purple-50',  text: 'text-purple-600',  ring: 'ring-purple-200'  },
    { label: '품의 안내 발송완료',    value: stats.proposalSent,    color: 'bg-teal-500',   light: 'bg-teal-50',    text: 'text-teal-600',    ring: 'ring-teal-200'    },
    { label: '내부망 품의 등록 완료', value: stats.proposalDone,    color: 'bg-indigo-500', light: 'bg-indigo-50',  text: 'text-indigo-600',  ring: 'ring-indigo-200'  },
    { label: '활동 미달 대상',        value: stats.underactive,     color: 'bg-red-500',    light: 'bg-red-50',     text: 'text-red-600',     ring: 'ring-red-200'     },
  ]

  const subTabs: { id: AdminSubTab; label: string }[] = [
    { id: 'overview',   label: '전체 현황' },
    { id: 'mail',       label: '안내 메일' },
    { id: 'proposal',   label: '품의 안내' },
    { id: 'settlement', label: '최종 정산' },
  ]

  return (
    <main className="min-h-screen bg-slate-50">

      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-bold text-gray-900">멘토링 운영 대시보드</span>
              <span className="hidden sm:inline text-xs text-gray-400 ml-2">관리자</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-gray-400">
              멘토 전용: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">/mentor/[token]</code>
            </span>
            <span className="text-xs text-gray-400 font-mono">{TODAY}</span>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-3 py-1.5 rounded-lg transition-all whitespace-nowrap">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              신규 멘토링
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {summaryCards.map(c => (
            <div key={c.label} className={`bg-white rounded-xl ring-1 ${c.ring} p-4 shadow-sm flex flex-col gap-2`}>
              <div className={`${c.light} w-9 h-9 rounded-xl flex items-center justify-center`}>
                <span className={`${c.text} font-black text-lg leading-none`}>{c.value}</span>
              </div>
              <p className="text-xs text-gray-500 leading-snug">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Sub-tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-5 pt-4 flex gap-0.5 overflow-x-auto">
            {subTabs.map(t => (
              <button key={t.id} onClick={() => setAdminTab(t.id)}
                className={`text-sm font-semibold px-4 py-2.5 rounded-t-lg whitespace-nowrap border-b-2 transition-colors ${adminTab === t.id ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {adminTab === 'overview'   && <AdminOverviewTab   records={records} onUpdate={updateRecord} />}
            {adminTab === 'mail'       && <AdminInitialMailTab records={records} onUpdate={updateRecord} />}
            {adminTab === 'proposal'   && <AdminProposalTab   records={records} onUpdate={updateRecord} />}
            {adminTab === 'settlement' && <AdminSettlementTab records={records} />}
          </div>
        </div>

      </div>

      {showNewModal && (
        <NewMentoringModal
          onClose={() => setShowNewModal(false)}
          onSave={addRecord}
        />
      )}
    </main>
  )
}
