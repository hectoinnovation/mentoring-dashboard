'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  MentoringRecord, MonthData, ActivityEntry,
  INITIAL_DATA, TODAY,
  getMonthPeriod, getCurrentMonthIndex,
  countValidActivities, getMonthlyPayment, fmtAmount,
} from '@/lib/mentoring'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const APPROVAL_LABEL = { pending: '미승인', approved: '승인', rejected: '반려' } as const
const PAYMENT_LABEL  = { pending: '미지급', paid: '지급완료', not_paid: '미지급처리' } as const

function RemainingBadge({ valid }: { valid: number }) {
  if (valid >= 3) return <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">완료</span>
  if (valid === 2) return <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">1회 남음</span>
  if (valid === 1) return <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">2회 남음</span>
  return <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium">3회 남음</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity add form (inline)
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityFormProps {
  onSave: (entry: Omit<ActivityEntry, 'id'>) => void
  onCancel: () => void
}

function ActivityForm({ onSave, onCancel }: ActivityFormProps) {
  const [activityDate, setActivityDate] = useState(TODAY)
  const [content, setContent] = useState('')
  const [memo, setMemo] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  function handleSave() {
    if (!activityDate || !content) {
      alert('활동일과 활동내용은 필수입니다.')
      return
    }
    onSave({
      activityDate,
      content,
      memo,
      photoName:   photoFile?.name   ?? '',
      photoUrl:    photoFile ? URL.createObjectURL(photoFile) : '',
      receiptName: receiptFile?.name ?? '',
      receiptUrl:  receiptFile ? URL.createObjectURL(receiptFile) : '',
    })
  }

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mt-3 space-y-3">
      <h4 className="text-sm font-semibold text-blue-800">활동 추가</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            활동일 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={activityDate}
            onChange={e => setActivityDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="선택 사항"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          활동내용 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={2}
          placeholder="예: 입사 적응 현황 점검 및 상담"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            활동 사진{' '}
            <span className="text-gray-400 font-normal">(사진 + 영수증 모두 있어야 유효)</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 file:text-xs hover:file:bg-gray-200"
          />
          {photoFile && (
            <p className="text-xs text-green-600 mt-0.5">✓ {photoFile.name}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">영수증</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 file:text-xs hover:file:bg-gray-200"
          />
          {receiptFile && (
            <p className="text-xs text-green-600 mt-0.5">✓ {receiptFile.name}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          저장
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Month card
// ─────────────────────────────────────────────────────────────────────────────

interface MonthCardProps {
  monthData: MonthData
  monthIndex: 1 | 2 | 3
  startDate: string
  currentMonthIndex: number
  uploadBlocked: boolean
  onAddActivity: (entry: Omit<ActivityEntry, 'id'>) => void
}

function MonthCard({
  monthData, monthIndex, startDate, currentMonthIndex, uploadBlocked, onAddActivity,
}: MonthCardProps) {
  const [showForm, setShowForm] = useState(false)
  const { start, end } = getMonthPeriod(startDate, monthIndex)
  const valid   = countValidActivities(monthData)
  const amount  = getMonthlyPayment(monthData)
  const isPast  = currentMonthIndex > monthIndex
  const isCurrent = currentMonthIndex === monthIndex
  const isFuture  = currentMonthIndex < monthIndex

  function handleSave(entry: Omit<ActivityEntry, 'id'>) {
    onAddActivity(entry)
    setShowForm(false)
  }

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm ${
      isCurrent ? 'border-blue-300' : isPast ? 'border-gray-200' : 'border-gray-100 opacity-70'
    }`}>
      {/* Card header */}
      <div className={`px-5 py-4 rounded-t-xl ${isCurrent ? 'bg-blue-50' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold ${isCurrent ? 'text-blue-700' : 'text-gray-700'}`}>
                {monthIndex}개월차
              </span>
              {isCurrent && (
                <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 font-medium">
                  진행중
                </span>
              )}
              {isPast && (
                <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                  완료
                </span>
              )}
              {isFuture && (
                <span className="text-xs bg-gray-100 text-gray-400 rounded-full px-2 py-0.5">
                  예정
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{start} ~ {end}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">유효 활동</div>
              <div className="flex items-center gap-1.5">
                <span className={`font-bold text-lg ${valid >= 3 ? 'text-green-600' : 'text-gray-800'}`}>
                  {valid}
                </span>
                <span className="text-gray-400 text-sm">/ 3회</span>
                <RemainingBadge valid={valid} />
              </div>
            </div>
            <div className="text-right border-l border-gray-200 pl-3">
              <div className="text-xs text-gray-500">지급 예상</div>
              <div className={`font-bold text-lg ${amount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                {fmtAmount(amount)}
              </div>
            </div>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            monthData.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' :
            monthData.approvalStatus === 'rejected' ? 'bg-red-100 text-red-600' :
            'bg-gray-100 text-gray-500'
          }`}>
            승인: {APPROVAL_LABEL[monthData.approvalStatus]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            monthData.paymentStatus === 'paid' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            지급: {PAYMENT_LABEL[monthData.paymentStatus]}
          </span>
        </div>
      </div>

      {/* Activities list */}
      <div className="px-5 py-4">
        {monthData.activities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">등록된 활동이 없습니다</p>
        ) : (
          <div className="space-y-2.5">
            {monthData.activities.map((a, idx) => {
              const hasPhoto   = !!a.photoName
              const hasReceipt = !!a.receiptName
              const isValid    = hasPhoto && hasReceipt
              return (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    isValid ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isValid ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400">{a.activityDate}</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{a.content}</span>
                    </div>
                    {a.memo && <p className="text-xs text-gray-500 mt-0.5">{a.memo}</p>}
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        hasPhoto ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                      }`}>
                        {hasPhoto ? `📷 ${a.photoName}` : '📷 사진 없음'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        hasReceipt ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                      }`}>
                        {hasReceipt ? `🧾 ${a.receiptName}` : '🧾 영수증 없음'}
                      </span>
                      {isValid && (
                        <span className="text-xs text-green-600 font-medium">✓ 유효</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add activity button / form */}
        {!isFuture && !uploadBlocked && (
          <div className="mt-3">
            {showForm ? (
              <ActivityForm
                onSave={handleSave}
                onCancel={() => setShowForm(false)}
              />
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 text-sm rounded-lg hover:bg-blue-50 transition-colors"
              >
                + 활동 추가
              </button>
            )}
          </div>
        )}
        {isFuture && (
          <p className="mt-3 text-xs text-gray-400 text-center">아직 시작되지 않은 기간입니다</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function MentorPage() {
  const params = useParams()
  const token  = typeof params.token === 'string' ? params.token : ''

  const [record, setRecord] = useState<MentoringRecord | null>(() => {
    const found = INITIAL_DATA.find(r => r.token === token)
    return found ?? null
  })

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-700 mb-2">페이지를 찾을 수 없습니다</h1>
          <p className="text-sm text-gray-500">올바른 멘토링 링크인지 확인해주세요.</p>
        </div>
      </div>
    )
  }

  const currentMI = getCurrentMonthIndex(record)
  const isBlocked = record.uploadStatus === 'blocked'

  function addActivity(monthIndex: 1 | 2 | 3, entry: Omit<ActivityEntry, 'id'>) {
    const newActivity: ActivityEntry = {
      id: `act_${Date.now()}`,
      ...entry,
    }
    setRecord(prev => {
      if (!prev) return prev
      return {
        ...prev,
        months: prev.months.map(m =>
          m.monthIndex === monthIndex
            ? { ...m, activities: [...m.activities, newActivity] }
            : m,
        ),
      }
    })
  }

  // Summary numbers
  const totalValid = record.months.reduce((s, m) => s + countValidActivities(m), 0)
  const totalAmount = record.months.reduce((s, m) => s + getMonthlyPayment(m), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">멘토링 대시보드</h1>
            <p className="text-xs text-gray-400 mt-0.5">신규입사자 멘토링 프로그램</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ── Upload blocked banner */}
        {isBlocked && (
          <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">🚫</span>
              <div>
                <p className="font-semibold text-red-700 text-sm">업로드가 제한되어 있습니다</p>
                <p className="text-sm text-red-600 mt-0.5">
                  해당 멘토링은 관리자에 의해 업로드가 제한되었습니다.
                </p>
                {record.uploadBlockReason && (
                  <p className="text-xs text-red-500 mt-1">사유: {record.uploadBlockReason}</p>
                )}
                <p className="text-xs text-red-400 mt-1">문의사항은 담당자에게 연락하세요.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Mentor / Mentee info card */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">멘토링 정보</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-400">멘토</span>
              <p className="font-medium text-gray-800">{record.mentorName}</p>
              {record.mentorEmail && (
                <p className="text-xs text-gray-500">{record.mentorEmail}</p>
              )}
            </div>
            <div>
              <span className="text-xs text-gray-400">멘티</span>
              <p className="font-medium text-gray-800">{record.menteeName}</p>
              {record.menteeEmail && (
                <p className="text-xs text-gray-500">{record.menteeEmail}</p>
              )}
            </div>
            <div>
              <span className="text-xs text-gray-400">멘토링 기간</span>
              <p className="text-gray-700">{record.startDate} ~ {record.endDate}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">현재</span>
              <p className="text-gray-700">
                {currentMI === 0 ? '대기 중'
                  : currentMI === 4 ? '기간 종료'
                  : `${currentMI}개월차 진행중`}
              </p>
            </div>
          </div>
        </div>

        {/* ── Summary bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '전체 유효 활동', value: `${totalValid}회`, color: 'text-gray-800' },
            { label: '지급 예상액 (합산)', value: fmtAmount(totalAmount), color: 'text-blue-600' },
            { label: '진행 상태', value: record.status === 'active' ? '진행중' : record.status === 'suspended' ? '중단' : '완료', color: record.status === 'active' ? 'text-green-600' : 'text-yellow-600' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-xs text-gray-400">{c.label}</div>
              <div className={`font-bold text-lg mt-0.5 ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* ── Payment guide */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800">
          <p className="font-medium mb-1">💡 지급 기준</p>
          <ul className="text-xs space-y-0.5 text-amber-700">
            <li>• 활동 사진과 영수증이 <strong>모두</strong> 등록된 건만 유효 활동으로 인정</li>
            <li>• 유효 활동 2회: 50,000원 / 3회 이상: 100,000원 (월 최대)</li>
            <li>• 총 최대 지급액: 300,000원 (3개월 합산)</li>
          </ul>
        </div>

        {/* ── Month cards */}
        {([1, 2, 3] as const).map(mi => {
          const md = record.months.find(m => m.monthIndex === mi)
          if (!md) return null
          return (
            <MonthCard
              key={mi}
              monthData={md}
              monthIndex={mi}
              startDate={record.startDate}
              currentMonthIndex={currentMI}
              uploadBlocked={isBlocked}
              onAddActivity={entry => addActivity(mi, entry)}
            />
          )
        })}

        {/* ── Footer note */}
        <div className="text-center text-xs text-gray-400 pb-6">
          문의사항은 인재협업팀으로 연락주세요.
        </div>
      </main>
    </div>
  )
}
