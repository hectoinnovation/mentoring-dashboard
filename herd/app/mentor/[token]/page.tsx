'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  MentoringRecord, MonthData, ActivityEntry, MentoringGoals,
  TODAY,
  getMonthPeriod, getCurrentMonthIndex, fmtPeriodMonthly,
  countValidActivities, countAllActivities,
  getMonthActualCost, getMonthPaymentLimit, getMonthlyPayment,
  getTotalExpectedPayment, fmtAmount,
  isMonthManuallyClosed,
} from '@/lib/mentoring'
import {
  fetchMentorByToken, dbInsertActivity, dbUpdateActivity, dbDeleteActivity,
  saveGoals, updateLastAccess,
} from '@/lib/mentoring-db'

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────

interface ToastState { message: string; type: 'success' | 'error' }

function Toast({ message, type, onClose }: ToastState & { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-xl text-sm font-medium pointer-events-auto transition-all ${
      type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
    }`}>
      <span>{type === 'error' ? '❌' : '✅'}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100 text-base leading-none">✕</button>
    </div>
  )
}

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
// FileUploadCard — 카드형 파일 첨부 박스
// ─────────────────────────────────────────────────────────────────────────────

interface FileUploadCardProps {
  label:             string
  hint:              string
  accept:            string
  file:              File | null
  existingFileName?: string   // 수정 폼: 기존 파일명
  disabled?:         boolean
  onChange:          (file: File | null) => void
}

function FileUploadCard({ label, hint, accept, file, existingFileName, disabled, onChange }: FileUploadCardProps) {
  const isPhoto   = label.includes('사진')
  const emptyIcon = isPhoto ? '📷' : '📋'
  const doneIcon  = isPhoto ? '📸' : '🧾'

  const cardClass = [
    'w-full rounded-xl border-2 p-4 text-center transition-all',
    disabled
      ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
      : file
        ? 'border-green-400 bg-green-50'
        : 'border-dashed border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50',
  ].join(' ')

  return (
    <div>
      <label className={disabled ? 'block cursor-not-allowed' : 'block cursor-pointer'}>
        <div className={cardClass}>
          <div className="text-3xl mb-2">{file ? doneIcon : emptyIcon}</div>
          {file ? (
            <>
              <p className="text-sm font-semibold text-green-700 break-all leading-relaxed">{file.name}</p>
              <p className="text-xs text-green-500 mt-1">클릭하여 파일 변경</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700">{label}</p>
              <p className="text-xs text-orange-600 mt-1.5 leading-relaxed">{hint}</p>
              <p className="text-xs text-blue-500 mt-2 font-medium">클릭하여 파일 선택</p>
            </>
          )}
        </div>
        <input
          type="file" accept={accept} disabled={disabled} className="hidden"
          onChange={e => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {existingFileName && !file && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 mt-1.5">
          📎 현재 파일: <span className="font-medium">{existingFileName}</span>
          <span className="text-green-500 ml-1">(새 파일 선택 시 교체됩니다)</span>
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal-setting screen (first visit)
// ─────────────────────────────────────────────────────────────────────────────

interface GoalScreenProps {
  mentorName: string
  menteeName: string
  initial:    MentoringGoals
  onSave:     (goals: MentoringGoals) => void
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
    onSave({
      expectations: expectations as [string, string, string],
      cooperation:  cooperation  as [string, string, string],
      savedAt: TODAY,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎯</div>
          <h1 className="text-xl font-bold text-gray-800">멘토링 목표 달성을 위한 기대사항 및 협력사항</h1>
          <p className="text-sm text-gray-500 mt-2">멘토링을 시작하기 전에 서로의 기대사항과 협력사항을 작성해주세요.</p>
          <p className="text-xs text-gray-400 mt-1">
            멘토: <strong>{mentorName}</strong> &nbsp;|&nbsp; 멘티: <strong>{menteeName}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">멘</span>
              <h2 className="text-sm font-semibold text-gray-700">기대사항 <span className="text-gray-400 font-normal">(멘티 관점)</span></h2>
            </div>
            <div className="space-y-2">
              {([0, 1, 2] as const).map(i => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 text-xs text-gray-400 font-medium w-4 flex-shrink-0">{i + 1}.</span>
                  <input type="text" value={expectations[i]}
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

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">토</span>
              <h2 className="text-sm font-semibold text-gray-700">협력사항 <span className="text-gray-400 font-normal">(멘토 관점)</span></h2>
            </div>
            <div className="space-y-2">
              {([0, 1, 2] as const).map(i => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 text-xs text-gray-400 font-medium w-4 flex-shrink-0">{i + 1}.</span>
                  <input type="text" value={cooperation[i]}
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
          <button onClick={handleSave}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md">
            목표 저장하고 시작하기
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          저장 후 활동 등록 화면으로 이동합니다. 목표는 관리자 화면에서도 확인할 수 있습니다.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity add form
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityFormProps {
  onSave:   (entry: Omit<ActivityEntry, 'id'>, photoFile: File, receiptFile?: File) => Promise<void>
  onCancel: () => void
}

function ActivityForm({ onSave, onCancel }: ActivityFormProps) {
  const [activityDate, setActivityDate] = useState(TODAY)
  const [content, setContent]           = useState('')
  const [memo, setMemo]                 = useState('')
  const [hasCost, setHasCost]           = useState(false)
  const [costAmountRaw, setCostAmountRaw] = useState('')
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [receiptFile, setReceiptFile]   = useState<File | null>(null)
  const [saving, setSaving]             = useState(false)

  function handleHasCostChange(checked: boolean) {
    setHasCost(checked)
    if (!checked) { setCostAmountRaw(''); setReceiptFile(null) }
  }

  async function handleSave() {
    if (!activityDate || !content.trim()) { alert('활동일과 활동내용은 필수입니다.'); return }
    if (!photoFile) { alert('활동 사진은 필수입니다.'); return }
    if (hasCost) {
      if (!costAmountRaw || costAmountRaw === '0') { alert('비용 사용 있음 체크 시 사용 금액을 입력해야 합니다. (0원 불가)'); return }
      if (!receiptFile) { alert('비용 사용 있음 체크 시 영수증을 업로드해야 합니다.'); return }
    }
    const costAmount = hasCost ? parseInt(costAmountRaw.replace(/,/g, ''), 10) || 0 : 0
    setSaving(true)
    try {
      await onSave(
        { activityDate, content, memo, hasCost, costAmount, photoName: '', photoUrl: '', receiptName: '', receiptUrl: '' },
        photoFile,
        receiptFile ?? undefined,
      )
    } catch {
      alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mt-3 space-y-3">
      <h4 className="text-sm font-semibold text-blue-800">활동 추가</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">활동일 <span className="text-red-500">*</span></label>
          <input type="date" value={activityDate} onChange={e => setActivityDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
          <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="선택 사항"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">활동내용 <span className="text-red-500">*</span></label>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          rows={2} placeholder="예: 입사 적응 현황 점검 및 상담"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none" />
      </div>

      {/* 활동 사진 */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          활동 사진 <span className="text-red-500">*</span>
        </label>
        <FileUploadCard
          label="활동 사진 첨부"
          hint="활동 사진이 없으면 유효 활동으로 인정되지 않습니다."
          accept="image/*"
          file={photoFile}
          onChange={setPhotoFile}
        />
      </div>

      {/* 비용 / 영수증 */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <input id="hasCost" type="checkbox" checked={hasCost} onChange={e => handleHasCostChange(e.target.checked)}
            className="w-4 h-4 accent-blue-600 cursor-pointer" />
          <label htmlFor="hasCost" className="text-sm font-medium text-gray-700 cursor-pointer select-none">비용 사용 있음</label>
          <span className="text-xs text-gray-400">(체크 시 사용 금액 + 영수증 필수)</span>
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${hasCost ? 'text-gray-600' : 'text-gray-300'}`}>
            사용 금액{hasCost && <span className="text-red-500 ml-0.5">*</span>}
            {!hasCost && <span className="ml-1 font-normal">(비활성화)</span>}
          </label>
          <div className="flex items-center gap-2">
            <input type="number" min="1" value={costAmountRaw} disabled={!hasCost}
              onChange={e => setCostAmountRaw(e.target.value)} placeholder="금액 입력 (숫자만)"
              className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white ${
                hasCost ? 'border-gray-300' : 'border-gray-100 text-gray-300 cursor-not-allowed opacity-50'
              }`}
            />
            <span className={`text-sm ${hasCost ? 'text-gray-600' : 'text-gray-300'}`}>원</span>
          </div>
          {hasCost && costAmountRaw && Number(costAmountRaw) > 0 && (
            <p className="text-xs text-blue-600 mt-0.5">입력 금액: {Number(costAmountRaw).toLocaleString()}원</p>
          )}
        </div>

        <div>
          <label className={`block text-xs font-semibold mb-1.5 ${hasCost ? 'text-gray-700' : 'text-gray-400'}`}>
            영수증{hasCost && <span className="text-red-500 ml-0.5">*</span>}
            {!hasCost && <span className="ml-1 text-xs font-normal">(비용 사용 있음 체크 시 활성화)</span>}
          </label>
          <FileUploadCard
            label="영수증 첨부"
            hint="비용 사용 시 사용 금액과 영수증 첨부가 필요합니다."
            accept="image/*,application/pdf"
            file={receiptFile}
            onChange={setReceiptFile}
            disabled={!hasCost}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">취소</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? '저장 중...' : '저장'}</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity edit form
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityEditFormProps {
  initial:  ActivityEntry
  onSave:   (updated: ActivityEntry, photoFile?: File, receiptFile?: File) => Promise<void>
  onCancel: () => void
}

function ActivityEditForm({ initial, onSave, onCancel }: ActivityEditFormProps) {
  const [activityDate, setActivityDate]   = useState(initial.activityDate)
  const [content, setContent]             = useState(initial.content)
  const [memo, setMemo]                   = useState(initial.memo)
  const [hasCost, setHasCost]             = useState(initial.hasCost)
  const [costAmountRaw, setCostAmountRaw] = useState(initial.costAmount > 0 ? String(initial.costAmount) : '')
  const [photoFile, setPhotoFile]         = useState<File | null>(null)
  const [receiptFile, setReceiptFile]     = useState<File | null>(null)
  const [saving, setSaving]               = useState(false)

  function handleHasCostChange(checked: boolean) {
    setHasCost(checked)
    if (!checked) { setCostAmountRaw(''); setReceiptFile(null) }
  }

  async function handleSave() {
    if (!activityDate || !content.trim()) { alert('활동일과 활동내용은 필수입니다.'); return }
    if (!photoFile && !initial.photoName) { alert('활동 사진은 필수입니다.'); return }
    if (hasCost) {
      if (!costAmountRaw || costAmountRaw === '0') { alert('비용 사용 있음 체크 시 사용 금액을 입력해야 합니다. (0원 불가)'); return }
      const receiptCheck = receiptFile ? receiptFile.name : initial.receiptName
      if (!receiptCheck) { alert('비용 사용 있음 체크 시 영수증을 업로드해야 합니다.'); return }
    }
    const costAmount = hasCost ? (parseInt(costAmountRaw.replace(/,/g, ''), 10) || 0) : 0
    const updatedEntry: ActivityEntry = {
      id: initial.id,
      activityDate,
      content,
      memo,
      hasCost,
      costAmount,
      photoName:   photoFile ? photoFile.name : initial.photoName,
      photoUrl:    initial.photoUrl,
      receiptName: !hasCost ? '' : (receiptFile ? receiptFile.name : initial.receiptName),
      receiptUrl:  !hasCost ? '' : initial.receiptUrl,
    }
    setSaving(true)
    try {
      await onSave(updatedEntry, photoFile ?? undefined, receiptFile ?? undefined)
    } catch {
      alert('수정 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 mt-1 space-y-3">
      <h4 className="text-sm font-semibold text-amber-800">✏️ 활동 수정</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">활동일 <span className="text-red-500">*</span></label>
          <input type="date" value={activityDate} onChange={e => setActivityDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
          <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="선택 사항"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">활동내용 <span className="text-red-500">*</span></label>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          rows={2} placeholder="예: 입사 적응 현황 점검 및 상담"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white resize-none" />
      </div>

      {/* 활동 사진 */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          활동 사진 <span className="text-red-500">*</span>
        </label>
        <FileUploadCard
          label="활동 사진 첨부"
          hint="활동 사진이 없으면 유효 활동으로 인정되지 않습니다."
          accept="image/*"
          file={photoFile}
          existingFileName={initial.photoName || undefined}
          onChange={setPhotoFile}
        />
      </div>

      {/* 비용 / 영수증 */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <input id={`hasCost-edit-${initial.id}`} type="checkbox" checked={hasCost}
            onChange={e => handleHasCostChange(e.target.checked)}
            className="w-4 h-4 accent-amber-600 cursor-pointer" />
          <label htmlFor={`hasCost-edit-${initial.id}`} className="text-sm font-medium text-gray-700 cursor-pointer select-none">비용 사용 있음</label>
          <span className="text-xs text-gray-400">(체크 시 사용 금액 + 영수증 필수)</span>
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${hasCost ? 'text-gray-600' : 'text-gray-300'}`}>
            사용 금액{hasCost && <span className="text-red-500 ml-0.5">*</span>}
            {!hasCost && <span className="ml-1 font-normal">(비활성화)</span>}
          </label>
          <div className="flex items-center gap-2">
            <input type="number" min="1" value={costAmountRaw} disabled={!hasCost}
              onChange={e => setCostAmountRaw(e.target.value)} placeholder="금액 입력 (숫자만)"
              className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white ${
                hasCost ? 'border-gray-300' : 'border-gray-100 text-gray-300 cursor-not-allowed opacity-50'
              }`}
            />
            <span className={`text-sm ${hasCost ? 'text-gray-600' : 'text-gray-300'}`}>원</span>
          </div>
          {hasCost && costAmountRaw && Number(costAmountRaw) > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">입력 금액: {Number(costAmountRaw).toLocaleString()}원</p>
          )}
        </div>

        <div>
          <label className={`block text-xs font-semibold mb-1.5 ${hasCost ? 'text-gray-700' : 'text-gray-400'}`}>
            영수증{hasCost && <span className="text-red-500 ml-0.5">*</span>}
            {!hasCost && <span className="ml-1 text-xs font-normal">(비용 사용 있음 체크 시 활성화)</span>}
          </label>
          <FileUploadCard
            label="영수증 첨부"
            hint="비용 사용 시 사용 금액과 영수증 첨부가 필요합니다."
            accept="image/*,application/pdf"
            file={receiptFile}
            existingFileName={hasCost && initial.receiptName ? initial.receiptName : undefined}
            onChange={setReceiptFile}
            disabled={!hasCost}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} disabled={saving}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">취소</button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50">
          {saving ? '저장 중...' : '수정 저장'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Month card
// ─────────────────────────────────────────────────────────────────────────────

interface MonthCardProps {
  monthData:          MonthData
  monthIndex:         1 | 2 | 3
  startDate:          string
  currentMonthIndex:  number
  uploadBlocked:      boolean
  isManualClosed:     boolean
  onAddActivity:      (entry: Omit<ActivityEntry, 'id'>, photoFile: File, receiptFile?: File) => Promise<void>
  onUpdateActivity:   (updated: ActivityEntry, photoFile?: File, receiptFile?: File) => Promise<void>
  onDeleteActivity:   (activity: ActivityEntry) => void
}

function MonthCard({
  monthData, monthIndex, startDate, currentMonthIndex,
  uploadBlocked, isManualClosed, onAddActivity, onUpdateActivity, onDeleteActivity,
}: MonthCardProps) {
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { start, end } = getMonthPeriod(startDate, monthIndex)
  const valid      = countValidActivities(monthData)
  const total      = countAllActivities(monthData)
  const actualCost = getMonthActualCost(monthData)
  const limit      = getMonthPaymentLimit(monthData)
  const amount     = getMonthlyPayment(monthData)
  const isPast       = currentMonthIndex > monthIndex
  const isCurrent    = currentMonthIndex === monthIndex
  const isFuture     = currentMonthIndex < monthIndex
  const isEffClosed  = isPast || isManualClosed  // 날짜 자동마감 OR 관리자 수동마감
  const isFull       = total >= 5

  async function handleSave(entry: Omit<ActivityEntry, 'id'>, photoFile: File, receiptFile?: File) {
    await onAddActivity(entry, photoFile, receiptFile)
    setShowForm(false)
  }

  async function handleUpdate(updated: ActivityEntry, photoFile?: File, receiptFile?: File) {
    await onUpdateActivity(updated, photoFile, receiptFile)
    setEditingId(null)
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
              {isCurrent && <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 font-medium">진행중</span>}
              {isPast   && <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">완료</span>}
              {isFuture && <span className="text-xs bg-gray-100 text-gray-400 rounded-full px-2 py-0.5">예정</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{start} ~ {end}</p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-right">
              <div className="text-xs text-gray-400">활동 증빙</div>
              <div className="font-bold text-base text-gray-800">
                {total}<span className="text-gray-400 font-normal text-sm">/5회</span>
              </div>
            </div>
            <div className="text-right border-l border-gray-200 pl-3">
              <div className="text-xs text-gray-400">지급 인정</div>
              <div className="flex items-center gap-1">
                <span className={`font-bold text-base ${valid >= 3 ? 'text-green-600' : valid === 0 ? 'text-gray-400' : 'text-amber-600'}`}>
                  {valid >= 3 ? '3회 이상' : `${valid}회`}
                </span>
                <RemainingBadge valid={valid} />
              </div>
            </div>
            <div className="text-right border-l border-gray-200 pl-3">
              <div className="text-xs text-gray-400">실제 사용금액</div>
              <div className={`font-bold text-base ${actualCost > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                {fmtAmount(actualCost)}
              </div>
            </div>
            <div className="text-right border-l border-gray-200 pl-3">
              <div className="text-xs text-gray-400">최대 지급 가능 금액</div>
              <div className={`font-bold text-base ${limit > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                {fmtAmount(limit)}
              </div>
            </div>
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
              const isValid  = hasPhoto && (!a.hasCost || (!!a.receiptName && a.costAmount > 0))
              const isEditing = editingId === a.id
              return (
                <div key={a.id}>
                  <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    isEditing
                      ? 'border-amber-300 bg-amber-50'
                      : isValid
                        ? 'border-green-200 bg-green-50'
                        : 'border-orange-100 bg-orange-50'
                  }`}>
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
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
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          a.photoName ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                        }`}>
                          {a.photoName ? `📷 ${a.photoName}` : '📷 사진 없음'}
                        </span>
                        {a.hasCost ? (
                          <>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              a.receiptName ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                            }`}>
                              {a.receiptName ? `🧾 ${a.receiptName}` : '🧾 영수증 없음'}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              a.costAmount > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-100 text-red-500'
                            }`}>
                              💰 {a.costAmount > 0 ? `${a.costAmount.toLocaleString()}원` : '금액 미입력'}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">💰 비용 없음</span>
                        )}
                        {isValid
                          ? <span className="text-xs text-green-600 font-medium">✓ 유효</span>
                          : <span className="text-xs text-orange-500 font-medium">✗ 미인정</span>
                        }
                      </div>
                    </div>

                    {/* 수정 / 삭제 버튼 */}
                    {isEffClosed ? (
                      <span className="flex-shrink-0 text-xs text-gray-400 bg-gray-100 rounded-lg px-2 py-1 whitespace-nowrap">
                        {isPast ? '기간 종료' : '마감됨'}
                      </span>
                    ) : !uploadBlocked && !isFuture && (
                      <div className="flex-shrink-0 flex gap-1">
                        <button
                          onClick={() => setEditingId(isEditing ? null : a.id)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                            isEditing
                              ? 'border-amber-400 bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400'
                          }`}
                        >
                          {isEditing ? '닫기' : '수정'}
                        </button>
                        {!isEditing && (
                          <button
                            onClick={() => onDeleteActivity(a)}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-400 transition-colors"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 인라인 수정 폼 */}
                  {isEditing && (
                    <ActivityEditForm
                      initial={a}
                      onSave={handleUpdate}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Slot progress bar */}
        {!isFuture && (
          <div className="flex gap-1.5 mt-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i < total ? 'bg-blue-400' : 'bg-gray-200'}`} />
            ))}
          </div>
        )}

        {/* Add button / form */}
        {isEffClosed && (
          <p className="mt-3 text-xs text-gray-500 text-center bg-gray-100 rounded-lg px-3 py-2.5 border border-gray-200 font-medium">
            🔒 해당 월 활동 기간이 마감되어 업로드할 수 없습니다.
          </p>
        )}
        {!isEffClosed && !isFuture && !uploadBlocked && (
          <div className="mt-3">
            {showForm ? (
              <ActivityForm onSave={handleSave} onCancel={() => setShowForm(false)} />
            ) : isFull ? (
              <p className="text-xs text-gray-400 text-center py-2">최대 5개 활동이 등록되었습니다</p>
            ) : (
              <button onClick={() => setShowForm(true)}
                className="w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 text-sm rounded-lg hover:bg-blue-50 transition-colors">
                + 활동 추가 ({total}/5)
              </button>
            )}
          </div>
        )}
        {isFuture && (
          <p className="mt-3 text-xs text-gray-400 text-center">아직 시작되지 않은 기간입니다</p>
        )}
        {uploadBlocked && !isFuture && !isEffClosed && (
          <p className="mt-3 text-xs text-red-500 text-center bg-red-50 rounded-lg px-3 py-2 border border-red-100">
            현재 업로드가 차단되어 활동 등록 및 수정이 불가합니다. 인재협업팀에 문의해주세요.
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirm modal
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  activity: ActivityEntry
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmModal({ activity, deleting, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={!deleting ? onCancel : undefined} />
      {/* modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
        <div className="text-center mb-5">
          <div className="text-4xl mb-3">🗑️</div>
          <h3 className="text-base font-bold text-gray-800">활동을 삭제하시겠습니까?</h3>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            <span className="font-medium text-gray-700">{activity.activityDate}</span> · {activity.content}
          </p>
          <p className="text-xs text-red-500 mt-2">삭제 후에는 복구할 수 없으며, 첨부 파일도 함께 삭제됩니다.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
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

  const [record, setRecord]         = useState<MentoringRecord | null>(null)
  const [goalsDone, setGoalsDone]   = useState<boolean | null>(null)
  const [toast, setToast]           = useState<ToastState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    activity: ActivityEntry
    monthIndex: 1 | 2 | 3
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── 목표 수정 상태
  const [goalsEditing, setGoalsEditing]             = useState(false)
  const [editExpectations, setEditExpectations]     = useState<[string,string,string]>(['','',''])
  const [editCooperation, setEditCooperation]       = useState<[string,string,string]>(['','',''])
  const [goalsSaving, setGoalsSaving]               = useState(false)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  // Fetch record from Supabase on mount
  useEffect(() => {
    if (!token) { setGoalsDone(true); return }
    fetchMentorByToken(token)
      .then(r => {
        setRecord(r)
        if (r) {
          updateLastAccess(r.id, TODAY).catch(console.error)
          setGoalsDone(r.goals.savedAt ? true : false)
        } else {
          setGoalsDone(true)
        }
      })
      .catch(err => {
        console.error('[fetchMentorByToken]', err)
        setGoalsDone(true)
      })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGoalSave(goals: MentoringGoals) {
    if (!record) return
    setRecord(prev => prev ? { ...prev, goals } : prev)
    setGoalsDone(true)
    saveGoals(record.id, goals).catch(console.error)
  }

  async function addActivity(monthIndex: 1 | 2 | 3, entry: Omit<ActivityEntry, 'id'>, photoFile: File, receiptFile?: File) {
    if (!record) return
    const tempId = crypto.randomUUID()
    const fullEntry: ActivityEntry = { id: tempId, ...entry }
    const saved = await dbInsertActivity(record.id, monthIndex, fullEntry, photoFile, receiptFile)
    setRecord(prev => {
      if (!prev) return prev
      return {
        ...prev,
        months: prev.months.map(m =>
          m.monthIndex === monthIndex
            ? { ...m, activities: m.activities.length < 5 ? [...m.activities, saved] : m.activities }
            : m,
        ),
      }
    })
  }

  async function updateActivity(monthIndex: 1 | 2 | 3, updated: ActivityEntry, photoFile?: File, receiptFile?: File) {
    if (!record) return
    const saved = await dbUpdateActivity(record.id, updated, photoFile, receiptFile)
    setRecord(prev => {
      if (!prev) return prev
      return {
        ...prev,
        months: prev.months.map(m =>
          m.monthIndex === monthIndex
            ? { ...m, activities: m.activities.map(a => a.id === saved.id ? saved : a) }
            : m,
        ),
      }
    })
  }

  function startGoalsEdit() {
    if (!record) return
    setEditExpectations([...record.goals.expectations] as [string,string,string])
    setEditCooperation([...record.goals.cooperation]   as [string,string,string])
    setGoalsEditing(true)
  }

  async function saveGoalsEdit() {
    if (!record) return
    const newGoals: MentoringGoals = {
      expectations: editExpectations,
      cooperation:  editCooperation,
      savedAt:      record.goals.savedAt ?? TODAY,
    }
    setGoalsSaving(true)
    try {
      await saveGoals(record.id, newGoals)
      setRecord(prev => prev ? { ...prev, goals: newGoals } : prev)
      setGoalsEditing(false)
      showToast('목표가 저장되었습니다.', 'success')
    } catch (err) {
      console.error('[saveGoalsEdit]', err)
      showToast('저장 중 오류가 발생했습니다. 다시 시도해주세요.', 'error')
    } finally {
      setGoalsSaving(false)
    }
  }

  function triggerDelete(monthIndex: 1 | 2 | 3, activity: ActivityEntry) {
    setDeleteConfirm({ activity, monthIndex })
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    const { activity, monthIndex } = deleteConfirm
    setDeleteConfirm(null)
    setDeleting(true)
    try {
      await dbDeleteActivity(activity)
      setRecord(prev => {
        if (!prev) return prev
        return {
          ...prev,
          months: prev.months.map(m =>
            m.monthIndex === monthIndex
              ? { ...m, activities: m.activities.filter(a => a.id !== activity.id) }
              : m,
          ),
        }
      })
      showToast('활동이 삭제되었습니다.', 'success')
    } catch (err) {
      console.error('[confirmDelete]', err)
      showToast('삭제 중 오류가 발생했습니다. 다시 시도해주세요.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (goalsDone === null) return null

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

  const currentMI   = getCurrentMonthIndex(record)
  const isBlocked   = record.uploadStatus === 'blocked'
  const totalAmount = getTotalExpectedPayment(record)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <DeleteConfirmModal
          activity={deleteConfirm.activity}
          deleting={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}

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

        {/* 업로드 차단 배너 */}
        {isBlocked && (
          <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">🚫</span>
              <div>
                <p className="font-semibold text-red-700 text-sm">업로드가 제한되어 있습니다</p>
                <p className="text-sm text-red-600 mt-0.5">해당 멘토링은 관리자에 의해 업로드가 제한되었습니다.</p>
                {record.uploadBlockReason && (
                  <p className="text-xs text-red-500 mt-1">사유: {record.uploadBlockReason}</p>
                )}
                <p className="text-xs text-red-400 mt-1">문의사항은 담당자에게 연락하세요.</p>
              </div>
            </div>
          </div>
        )}

        {/* 멘토링 정보 */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">멘토링 정보</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-400">멘토</span>
              <p className="font-medium text-gray-800">{record.mentorName}</p>
              {record.mentorEmail && <p className="text-xs text-gray-500">{record.mentorEmail}</p>}
            </div>
            <div>
              <span className="text-xs text-gray-400">멘티</span>
              <p className="font-medium text-gray-800">{record.menteeName}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">입사일</span>
              <p className="text-gray-700 font-medium">{record.joinDate}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">멘토링 활동 기간</span>
              <p className="text-gray-700">{fmtPeriodMonthly(record.startDate, record.endDate)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">현재</span>
              <p className="text-gray-700">
                {currentMI === 0 ? '대기 중' : currentMI === 4 ? '기간 종료' : `${currentMI}개월차 진행중`}
              </p>
            </div>
          </div>
        </div>

        {/* 목표 요약 */}
        {record.goals.savedAt && (
          goalsEditing ? (
            /* ── 수정 모드 ── */
            <div className="bg-indigo-50 border-2 border-indigo-400 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-indigo-800">✏️ 멘토링 목표 수정</h2>
                <span className="text-xs text-indigo-400">작성일: {record.goals.savedAt}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-indigo-600 mb-2">기대사항 (멘티)</p>
                  <div className="space-y-2">
                    {([0,1,2] as const).map(i => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-2 text-xs text-indigo-400 w-4 flex-shrink-0">{i+1}.</span>
                        <input
                          type="text"
                          value={editExpectations[i]}
                          onChange={e => {
                            const next = [...editExpectations] as [string,string,string]
                            next[i] = e.target.value
                            setEditExpectations(next)
                          }}
                          className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-green-600 mb-2">협력사항 (멘토)</p>
                  <div className="space-y-2">
                    {([0,1,2] as const).map(i => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-2 text-xs text-green-400 w-4 flex-shrink-0">{i+1}.</span>
                        <input
                          type="text"
                          value={editCooperation[i]}
                          onChange={e => {
                            const next = [...editCooperation] as [string,string,string]
                            next[i] = e.target.value
                            setEditCooperation(next)
                          }}
                          className="flex-1 border border-green-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-indigo-200">
                <button
                  onClick={() => setGoalsEditing(false)}
                  disabled={goalsSaving}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-indigo-100 rounded-lg disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={saveGoalsEdit}
                  disabled={goalsSaving}
                  className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                >
                  {goalsSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            /* ── 보기 모드 ── */
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-indigo-800">🎯 설정된 멘토링 목표</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-400">작성일: {record.goals.savedAt}</span>
                  {!isBlocked && (
                    <button
                      onClick={startGoalsEdit}
                      className="text-xs px-2.5 py-1 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-100 transition-colors"
                    >
                      수정
                    </button>
                  )}
                </div>
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
                  </ul>
                </div>
              </div>
            </div>
          )
        )}

        {/* 요약 바 */}
        <div className="grid grid-cols-2 gap-3">
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

        {/* 지급 기준 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800">
          <p className="font-medium mb-2">💡 지급 기준</p>
          <ul className="text-xs space-y-1 text-amber-700">
            <li>• 활동 사진이 있으면 지급 인정 활동으로 인정됩니다.</li>
            <li>• 비용 없는 활동도 유효 활동으로 인정되지만, 실제 사용금액이 없으면 지급액은 0원입니다.</li>
            <li>• 비용이 있는 활동은 사진 + 영수증 + 사용 금액이 <strong>모두</strong> 있어야 인정됩니다.</li>
            <li>• 지급 한도는 인정 활동 횟수 기준으로 산정됩니다.
              <span className="block ml-2 mt-0.5">0~1회: 지급 없음 &nbsp;|&nbsp; 2회: 최대 50,000원 &nbsp;|&nbsp; 3회 이상: 최대 100,000원</span>
            </li>
            <li>• 최종 지급액은 지급 한도와 실제 사용금액 중 더 낮은 금액으로 지급됩니다.</li>
          </ul>
          <div className="text-xs text-amber-600 mt-2 space-y-0.5 border-t border-amber-200 pt-2">
            <p className="font-medium">예)</p>
            <p>· 인정 3회 + 실사용 30,000원 → 30,000원 지급</p>
            <p>· 인정 3회 + 실사용 120,000원 → 100,000원 지급 (한도 적용)</p>
            <p>· 인정 3회 + 비용 사용 없음 → 지급 없음</p>
          </div>
        </div>

        {/* 월별 카드 */}
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
              isManualClosed={isMonthManuallyClosed(record, mi)}
              onAddActivity={(entry, photoFile, receiptFile) => addActivity(mi, entry, photoFile, receiptFile)}
              onUpdateActivity={(updated, photoFile, receiptFile) => updateActivity(mi, updated, photoFile, receiptFile)}
              onDeleteActivity={(activity) => triggerDelete(mi, activity)}
            />
          )
        })}

        <div className="text-center text-xs text-gray-400 pb-6">
          문의사항은 인재협업팀으로 연락주세요.
        </div>
      </main>
    </div>
  )
}
