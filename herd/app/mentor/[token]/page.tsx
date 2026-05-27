'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  MentoringRecord, MonthData, ActivityEntry, MentoringGoals,
  INITIAL_DATA, TODAY,
  getMonthPeriod, getCurrentMonthIndex,
  countValidActivities, countAllActivities, getMonthlyPayment, fmtAmount, getTotalExpectedPayment,
} from '@/lib/mentoring'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function RemainingBadge({ valid }: { valid: number }) {
  if (valid >= 3) return <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">완료</span>
  if (valid === 2) return <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">1회 남음</span>
  if (valid === 1) return <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">2회 남음</span>
  return <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium">3회 남음</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal-setting screen
// ─────────────────────────────────────────────────────────────────────────────

interface GoalScreenProps {
  mentorName: string
  menteeName: string
  initial: MentoringGoals
  onSave: (goals: MentoringGoals) => void
}

function GoalScreen({ mentorName, menteeName, initial, onSave }: GoalScreenProps) {
  const [expectations, setExpectations] = useState<[string, string, string]>([...initial.expectations])
  const [cooperation, setCooperation]   = useState<[string, string, string]>([...initial.cooperation])

  function handleSave() {
    const hasAny = [...expectations, ...cooperation].some(v => v.trim() !== '')
    if (!hasAny) {
      alert('기대사항 또는 협력사항을 한 줄 이상 입력해주세요.')
      return
    }
    const goals: MentoringGoals = {
      expectations: expectations as [string, string, string],
      cooperation:  cooperation  as [string, string, string],
      savedAt: TODAY,
    }
    onSave(goals)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎯</div>
          <h1 className="text-xl font-bold text-gray-800">멘토링 목표 달성을 위한 기대사항 및 협력사항</h1>
          <p className="text-sm text-gray-500 mt-2">
            멘토링을 시작하기 전에 서로의 기대사항과 협력사항을 작성해주세요.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            멘토: <strong>{mentorName}</strong> &nbsp;|&nbsp; 멘티: <strong>{menteeName}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 기대사항 (멘티 관점) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">멘</span>
              <h2 className="text-sm font-semibold text-gray-700">기대사항 <span className="text-gray-400 font-normal">(멘티 관점)</span></h2>
            </div>
            <div className="space-y-2">
              {([0, 1, 2] as const).map(i => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 text-xs text-gray-400 font-medium w-4 flex-shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    value={expectations[i]}
                    onChange={e => {
                      const next = [...expectations] as [string, string, string]
                      next[i] = e.target.value
                      setExpectations(next)
                    }}
                    placeholder={
                      i === 0 ? '예: 업무 역할에 빠르게 적응하고 싶습니다.' :
                      i === 1 ? '예: 팀 문화를 이해하고 싶습니다.' :
                               '예: 성장을 위한 피드백을 받고 싶습니다.'
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 협력사항 (멘토 관점) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">토</span>
              <h2 className="text-sm font-semibold text-gray-700">협력사항 <span className="text-gray-400 font-normal">(멘토 관점)</span></h2>
            </div>
            <div className="space-y-2">
              {([0, 1, 2] as const).map(i => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 text-xs text-gray-400 font-medium w-4 flex-shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    value={cooperation[i]}
                    onChange={e => {
                      const next = [...cooperation] as [string, string, string]
                      next[i] = e.target.value
                      setCooperation(next)
                    }}
                    placeholder={
                      i === 0 ? '예: 정기적인 미팅을 통해 적극 지원하겠습니다.' :
                      i === 1 ? '예: 업무 노하우를 공유하겠습니다.' :
                               '예: 고민을 함께 해결해 나가겠습니다.'
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md"
          >
            목표 저장하고 시작하기
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          저장 후에는 활동 등록 화면으로 이동합니다. 목표는 관리자 화면에서도 확인할 수 있습니다.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity add form (inline, max 5 slots)
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityFormProps {
  onSave: (entry: Omit<ActivityEntry, 'id'>) => void
  onCancel: () => void
}

function ActivityForm({ onSave, onCancel }: ActivityFormProps) {
  const [activityDate, setActivityDate] = useState(TODAY)
  const [content, setContent]           = useState('')
  const [memo, setMemo]                 = useState('')
  const [hasCost, setHasCost]           = useState(false)
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [receiptFile, setReceiptFile]   = useState<File | null>(null)

  // When hasCost is unchecked, clear receipt
  function handleHasCostChange(checked: boolean) {
    setHasCost(checked)
    if (!checked) setReceiptFile(null)
  }

  function handleSave() {
    if (!activityDate || !content.trim()) {
      alert('활동일과 활동내용은 필수입니다.')
      return
    }
    if (!photoFile) {
      alert('활동 사진은 필수입니다.')
      return
    }
    onSave({
      activityDate,
      content,
      memo,
      hasCost,
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

      {/* 활동 사진 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          활동 사진 <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-1">(필수 — 사진 없으면 유효 활동 미인정)</span>
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

      {/* 비용 사용 체크박스 */}
      <div className="flex items-center gap-2 py-1">
        <input
          id="hasCost"
          type="checkbox"
          checked={hasCost}
          onChange={e => handleHasCostChange(e.target.checked)}
          className="w-4 h-4 accent-blue-600 cursor-pointer"
        />
        <label htmlFor="hasCost" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
          비용 사용 있음
        </label>
        <span className="text-xs text-gray-400">(체크 시 영수증 필수)</span>
      </div>

      {/* 영수증 — hasCost가 true일 때만 활성화 */}
      <div>
        <label className={`block text-xs font-medium mb-1 ${hasCost ? 'text-gray-600' : 'text-gray-300'}`}>
          영수증
          {hasCost && <span className="text-red-500 ml-0.5">*</span>}
          {!hasCost && <span className="ml-1 font-normal">(비용 사용 없음 선택 시 비활성화)</span>}
        </label>
        <input
          type="file"
          accept="image/*,application/pdf"
          disabled={!hasCost}
          onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
          className={`w-full text-xs ${hasCost ? 'text-gray-600' : 'text-gray-300 opacity-50 cursor-not-allowed'}
            file:mr-2 file:py-1 file:px-2 file:rounded file:border-0
            ${hasCost ? 'file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200' : 'file:bg-gray-50 file:text-gray-300'}
            file:text-xs`}
        />
        {receiptFile && hasCost && (
          <p className="text-xs text-green-600 mt-0.5">✓ {receiptFile.name}</p>
        )}
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
// Month card (max 5 activities)
// ─────────────────────────────────────────────────────────────────────────────

interface MonthCardProps {
  monthData:         MonthData
  monthIndex:        1 | 2 | 3
  startDate:         string
  currentMonthIndex: number
  uploadBlocked:     boolean
  onAddActivity:     (entry: Omit<ActivityEntry, 'id'>) => void
}

function MonthCard({
  monthData, monthIndex, startDate, currentMonthIndex, uploadBlocked, onAddActivity,
}: MonthCardProps) {
  const [showForm, setShowForm] = useState(false)
  const { start, end } = getMonthPeriod(startDate, monthIndex)
  const valid   = countValidActivities(monthData)
  const total   = countAllActivities(monthData)
  const amount  = getMonthlyPayment(monthData)
  const isPast    = currentMonthIndex > monthIndex
  const isCurrent = currentMonthIndex === monthIndex
  const isFuture  = currentMonthIndex < monthIndex
  const isFull    = total >= 5

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
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-base font-bold ${isCurrent ? 'text-blue-700' : 'text-gray-700'}`}>
                {monthIndex}개월차
              </span>
              {isCurrent && (
                <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 font-medium">진행중</span>
              )}
              {isPast && (
                <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">완료</span>
              )}
              {isFuture && (
                <span className="text-xs bg-gray-100 text-gray-400 rounded-full px-2 py-0.5">예정</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{start} ~ {end}</p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            {/* 등록 횟수 */}
            <div className="text-right">
              <div className="text-xs text-gray-400">활동 증빙 등록 횟수</div>
              <div className="font-bold text-base text-gray-800">
                {total}<span className="text-gray-400 font-normal text-sm">/5회</span>
              </div>
            </div>
            {/* 지급 인정 */}
            <div className="text-right border-l border-gray-200 pl-3">
              <div className="text-xs text-gray-400">지급 인정</div>
              <div className="flex items-center gap-1">
                <span className={`font-bold text-base ${valid >= 3 ? 'text-green-600' : valid === 0 ? 'text-gray-400' : 'text-amber-600'}`}>
                  {valid}회
                </span>
                <RemainingBadge valid={valid} />
              </div>
            </div>
            {/* 지급 예정 금액 */}
            <div className="text-right border-l border-gray-200 pl-3">
              <div className="text-xs text-gray-400">지급 예정 금액</div>
              <div className={`font-bold text-base ${amount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                {fmtAmount(amount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activities list */}
      <div className="px-5 py-4">
        {monthData.activities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">등록된 활동이 없습니다</p>
        ) : (
          <div className="space-y-2.5">
            {monthData.activities.map((a, idx) => {
              const hasPhoto = !!a.photoName
              const isValid  = hasPhoto && (!a.hasCost || !!a.receiptName)
              return (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    isValid ? 'border-green-200 bg-green-50' : 'border-orange-100 bg-orange-50'
                  }`}
                >
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isValid ? 'bg-green-600 text-white' : 'bg-orange-300 text-white'
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
                      {/* 사진 */}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        a.photoName ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                      }`}>
                        {a.photoName ? `📷 ${a.photoName}` : '📷 사진 없음'}
                      </span>
                      {/* 비용/영수증 */}
                      {a.hasCost ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          a.receiptName ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                        }`}>
                          {a.receiptName ? `🧾 ${a.receiptName}` : '🧾 영수증 없음 (미인정)'}
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          💰 비용 없음
                        </span>
                      )}
                      {isValid
                        ? <span className="text-xs text-green-600 font-medium">✓ 유효</span>
                        : <span className="text-xs text-orange-500 font-medium">✗ 미인정</span>
                      }
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Slot indicators */}
        {!isFuture && (
          <div className="flex gap-1.5 mt-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full ${
                  i < total ? (
                    countValidActivities({ ...monthData, activities: monthData.activities.slice(0, i + 1) }) > 0
                    ? 'bg-green-400'
                    : 'bg-orange-300'
                  ) : 'bg-gray-200'
                }`}
              />
            ))}
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
            ) : isFull ? (
              <p className="text-xs text-gray-400 text-center py-2">
                최대 5개 활동이 등록되었습니다
              </p>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 text-sm rounded-lg hover:bg-blue-50 transition-colors"
              >
                + 활동 추가 ({total}/5)
              </button>
            )}
          </div>
        )}
        {isFuture && (
          <p className="mt-3 text-xs text-gray-400 text-center">아직 시작되지 않은 기간입니다</p>
        )}
        {uploadBlocked && !isFuture && (
          <p className="mt-3 text-xs text-red-400 text-center">업로드가 제한되어 활동을 추가할 수 없습니다</p>
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

  // Goal screen state: null = loading, false = show goal screen, true = show main
  const [goalsDone, setGoalsDone] = useState<boolean | null>(null)

  useEffect(() => {
    if (!record) { setGoalsDone(true); return }
    const key = `mentor_goals_${record.token}`
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed: MentoringGoals = JSON.parse(stored)
        if (parsed.savedAt) {
          // sync into record
          setRecord(prev => prev ? { ...prev, goals: parsed } : prev)
          setGoalsDone(true)
          return
        }
      }
    } catch { /* ignore parse errors */ }
    // Check if goals were already saved in the record itself
    if (record.goals.savedAt) {
      setGoalsDone(true)
    } else {
      setGoalsDone(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Goal save handler
  function handleGoalSave(goals: MentoringGoals) {
    if (!record) return
    const key = `mentor_goals_${record.token}`
    try {
      localStorage.setItem(key, JSON.stringify(goals))
    } catch { /* ignore */ }
    setRecord(prev => prev ? { ...prev, goals } : prev)
    setGoalsDone(true)
  }

  // ── Add activity
  function addActivity(monthIndex: 1 | 2 | 3, entry: Omit<ActivityEntry, 'id'>) {
    const newActivity: ActivityEntry = { id: `act_${Date.now()}`, ...entry }
    setRecord(prev => {
      if (!prev) return prev
      return {
        ...prev,
        months: prev.months.map(m =>
          m.monthIndex === monthIndex
            ? { ...m, activities: m.activities.length < 5 ? [...m.activities, newActivity] : m.activities }
            : m,
        ),
      }
    })
  }

  // ── Loading guard (hydration)
  if (goalsDone === null) return null

  // ── Not found
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

  // ── Goal-setting screen (first visit)
  if (!goalsDone) {
    return (
      <GoalScreen
        mentorName={record.mentorName}
        menteeName={record.menteeName}
        initial={record.goals}
        onSave={handleGoalSave}
      />
    )
  }

  // ── Main mentor page
  const currentMI  = getCurrentMonthIndex(record)
  const isBlocked  = record.uploadStatus === 'blocked'
  const totalValid = record.months.reduce((s, m) => s + countValidActivities(m), 0)
  const totalAmount = getTotalExpectedPayment(record)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">멘토링 대시보드</h1>
            <p className="text-xs text-gray-400 mt-0.5">신규입사자 멘토링 프로그램</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{record.mentorName} 멘토</p>
            <p className="text-xs text-gray-400">멘티: {record.menteeName}</p>
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

        {/* ── Mentoring info card */}
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
            </div>
            <div>
              <span className="text-xs text-gray-400">멘토링 기간</span>
              <p className="text-gray-700">
                {record.joinMonth.slice(0, 7)} ~ {record.endDate.slice(0, 7)}
              </p>
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

        {/* ── Goals summary */}
        {record.goals.savedAt && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-indigo-800">🎯 설정된 멘토링 목표</h2>
              <span className="text-xs text-indigo-400">작성일: {record.goals.savedAt}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-indigo-600 mb-1.5">기대사항 (멘티)</p>
                <ul className="space-y-1">
                  {record.goals.expectations.filter(v => v.trim()).map((v, i) => (
                    <li key={i} className="text-xs text-indigo-700 flex gap-1.5">
                      <span className="text-indigo-400">{i + 1}.</span>{v}
                    </li>
                  ))}
                  {record.goals.expectations.every(v => !v.trim()) && (
                    <li className="text-xs text-indigo-300">내용 없음</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-green-600 mb-1.5">협력사항 (멘토)</p>
                <ul className="space-y-1">
                  {record.goals.cooperation.filter(v => v.trim()).map((v, i) => (
                    <li key={i} className="text-xs text-green-700 flex gap-1.5">
                      <span className="text-green-400">{i + 1}.</span>{v}
                    </li>
                  ))}
                  {record.goals.cooperation.every(v => !v.trim()) && (
                    <li className="text-xs text-green-300">내용 없음</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Summary bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
            <div className="text-xs text-gray-400">전체 유효 활동</div>
            <div className="font-bold text-lg mt-0.5 text-gray-800">{totalValid}회</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
            <div className="text-xs text-gray-400">지급 예상액 합산</div>
            <div className={`font-bold text-lg mt-0.5 ${totalAmount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
              {fmtAmount(totalAmount)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
            <div className="text-xs text-gray-400">진행 상태</div>
            <div className={`font-bold text-lg mt-0.5 ${
              record.status === 'active' ? 'text-green-600' :
              record.status === 'suspended' ? 'text-yellow-600' : 'text-gray-500'
            }`}>
              {record.status === 'active' ? '진행중' : record.status === 'suspended' ? '중단' : '완료'}
            </div>
          </div>
        </div>

        {/* ── Payment guide */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800">
          <p className="font-medium mb-1">💡 지급 기준</p>
          <ul className="text-xs space-y-0.5 text-amber-700">
            <li>• 활동 사진이 있으면 유효 활동으로 인정 (비용 없는 경우)</li>
            <li>• 비용이 발생한 경우, 사진 + 영수증이 <strong>모두</strong> 있어야 유효</li>
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

        {/* ── Footer */}
        <div className="text-center text-xs text-gray-400 pb-6">
          문의사항은 인재협업팀으로 연락주세요.
        </div>
      </main>
    </div>
  )
}
