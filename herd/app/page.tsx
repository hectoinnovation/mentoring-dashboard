'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  MentoringRecord, MentoringStatus, UploadStatus, MentoringGoals,
  INITIAL_DATA, createEmptyMonths, createEmptyGoals, generateToken,
  calcDatesFromJoinMonth, fmtPeriodMonthly, TODAY,
  getMonthYM, getCurrentMonthIndex, getMonthDataForYM,
  countValidActivities, countAllActivities,
  getMonthlyPayment, getMonthActualCost, getMonthPaymentLimit,
  getTotalExpectedPayment, fmtAmount,
  generateInitialGuideMailBody, generateEndMailBody,
  sendInitialGuideMail, sendEndMail,
  getMentoringProgress,
} from '@/lib/mentoring'

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'manage' | 'mail' | 'settlement'

const STATUS_LABEL: Record<MentoringStatus, string> = {
  active: '진행중', completed: '완료', suspended: '중단', deleted: '삭제',
}
const STATUS_COLOR: Record<MentoringStatus, string> = {
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  deleted:   'bg-red-100 text-red-700',
}

function Chip({ label, color }: { label: string; color: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────────────────────────────────────

const blankForm = () => ({
  mentorName: '', mentorEmail: '', menteeName: '',
  joinDate: '',
  joinMonth: '', startDate: '', endDate: '',
  status: 'active' as MentoringStatus,
  uploadStatus: 'enabled' as UploadStatus,
  uploadBlockReason: '', note: '',
})
type FormState = ReturnType<typeof blankForm>

// ─────────────────────────────────────────────────────────────────────────────
// Login screen
// ─────────────────────────────────────────────────────────────────────────────

function LoginScreen({ onAuth }: { onAuth: () => void }) {
  const [pwd, setPwd]       = useState('')
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const res  = await fetch('/api/admin-auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: pwd }),
      })
      const data = await res.json()
      if (data.ok) {
        sessionStorage.setItem('admin_authed', 'true')
        onAuth()
      } else {
        setErr(data.error || '비밀번호가 올바르지 않습니다.')
      }
    } catch {
      setErr('서버 연결 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-3xl mb-3">🔐</div>
          <h1 className="text-xl font-bold text-gray-800">멘토링 관리 시스템</h1>
          <p className="text-sm text-gray-400 mt-1">관리자 전용</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="관리자 비밀번호 입력"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button
            type="submit"
            disabled={loading || !pwd}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  // ── auth
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => {
    setAuthed(sessionStorage.getItem('admin_authed') === 'true')
  }, [])

  // ── data
  const [records, setRecords] = useState<MentoringRecord[]>(INITIAL_DATA)
  const [tab, setTab]         = useState<Tab>('overview')

  // ── add/edit modal
  const [showAddEdit, setShowAddEdit] = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<FormState>(blankForm())

  // ── delete modal
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  // ── block modal
  const [blockTargetId, setBlockTargetId]       = useState<string | null>(null)
  const [blockReasonPreset, setBlockReasonPreset] = useState('멘티 퇴사')
  const [blockReasonCustom, setBlockReasonCustom] = useState('')

  // ── goals modal
  const [goalsModalRecord, setGoalsModalRecord] = useState<MentoringRecord | null>(null)

  // ── mail
  const [mailPreviewRecord, setMailPreviewRecord] = useState<MentoringRecord | null>(null)
  const [mailPreviewType, setMailPreviewType]     = useState<'initial' | 'end'>('initial')
  const [mailSending, setMailSending]             = useState(false)
  const [selectedForMail, setSelectedForMail]     = useState<Set<string>>(new Set())
  const [bulkSending, setBulkSending]             = useState<'initial' | 'end' | null>(null)

  // ── settlement
  const [settlementYM, setSettlementYM] = useState(TODAY.slice(0, 7))

  // ─────────────────────────────────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────────────────────────────────

  const visible   = useMemo(() => records.filter(r => r.status !== 'deleted'), [records])
  const currentYM = TODAY.slice(0, 7)

  const thisMonthExpected = useMemo(() =>
    visible.filter(r => r.status === 'active').reduce((sum, r) => {
      const md = getMonthDataForYM(r, currentYM)
      return sum + (md ? getMonthlyPayment(md) : 0)
    }, 0),
  [visible, currentYM])

  const totalExpected = useMemo(() =>
    visible.reduce((s, r) => s + getTotalExpectedPayment(r), 0),
  [visible])

  const activeCount   = useMemo(() => visible.filter(r => r.status === 'active').length, [visible])
  const blockedCount  = useMemo(() => visible.filter(r => r.uploadStatus === 'blocked').length, [visible])
  const goalsSetCount = useMemo(() => visible.filter(r => r.goals.savedAt !== null).length, [visible])

  const settlementRows = useMemo(() => {
    const rows: {
      record:     MentoringRecord
      monthIndex: number
      actualCost: number
      limit:      number
      amount:     number
    }[] = []
    for (const r of visible) {
      for (const m of r.months) {
        if (getMonthYM(r.startDate, m.monthIndex) === settlementYM) {
          rows.push({
            record:     r,
            monthIndex: m.monthIndex,
            actualCost: getMonthActualCost(m),
            limit:      getMonthPaymentLimit(m),
            amount:     getMonthlyPayment(m),
          })
        }
      }
    }
    return rows
  }, [visible, settlementYM])

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(blankForm())
    setEditingId(null)
    setShowAddEdit(true)
  }

  function openEdit(r: MentoringRecord) {
    setForm({
      mentorName: r.mentorName, mentorEmail: r.mentorEmail,
      menteeName: r.menteeName,
      joinDate: r.joinDate,
      joinMonth: r.joinMonth, startDate: r.startDate, endDate: r.endDate,
      status: r.status, uploadStatus: r.uploadStatus,
      uploadBlockReason: r.uploadBlockReason, note: r.note,
    })
    setEditingId(r.id)
    setShowAddEdit(true)
  }

  function handleJoinDateChange(jd: string) {
    const jm = jd ? jd.slice(0, 7) : ''
    setForm(p => ({ ...p, joinDate: jd }))
    if (jm) {
      const dates = calcDatesFromJoinMonth(jm)
      setForm(p => ({ ...p, joinDate: jd, joinMonth: jm, ...dates }))
    } else {
      setForm(p => ({ ...p, joinDate: '', joinMonth: '', startDate: '', endDate: '' }))
    }
  }

  function handleJoinMonthChange(jm: string) {
    if (jm) {
      const dates = calcDatesFromJoinMonth(jm)
      setForm(p => ({ ...p, joinMonth: jm, ...dates }))
    } else {
      setForm(p => ({ ...p, joinMonth: '', startDate: '', endDate: '' }))
    }
  }

  function saveForm() {
    if (!form.mentorName || !form.mentorEmail || !form.menteeName || !form.joinDate || !form.joinMonth) {
      alert('멘토명, 멘토 이메일, 멘티명, 입사일, 입사월은 필수입니다.')
      return
    }
    if (editingId) {
      setRecords(prev => prev.map(r => r.id === editingId ? {
        ...r,
        mentorName: form.mentorName, mentorEmail: form.mentorEmail,
        menteeName: form.menteeName,
        joinDate: form.joinDate,
        joinMonth: form.joinMonth, startDate: form.startDate, endDate: form.endDate,
        status: form.status, uploadStatus: form.uploadStatus,
        uploadBlockReason: form.uploadBlockReason, note: form.note,
      } : r))
    } else {
      const newRecord: MentoringRecord = {
        id: Date.now().toString(),
        mentorName: form.mentorName, mentorEmail: form.mentorEmail,
        menteeName: form.menteeName,
        joinDate: form.joinDate,
        joinMonth: form.joinMonth, startDate: form.startDate, endDate: form.endDate,
        status: form.status, uploadStatus: form.uploadStatus,
        uploadBlockReason: form.uploadBlockReason, note: form.note,
        token: generateToken(),
        months: createEmptyMonths(),
        goals: createEmptyGoals(),
        initialMailSent: false, initialMailSentAt: null,
        endMailSent: false, endMailSentAt: null,
        linkCopied: false, lastAccessAt: null,
        createdAt: TODAY, deletedAt: null,
      }
      setRecords(prev => [...prev, newRecord])
    }
    setShowAddEdit(false)
  }

  function confirmDelete() {
    if (!deleteTargetId) return
    setRecords(prev => prev.map(r =>
      r.id === deleteTargetId
        ? { ...r, status: 'deleted' as MentoringStatus, deletedAt: TODAY }
        : r,
    ))
    setDeleteTargetId(null)
  }

  function toggleBlock(r: MentoringRecord) {
    if (r.uploadStatus === 'blocked') {
      setRecords(prev => prev.map(x =>
        x.id === r.id ? { ...x, uploadStatus: 'enabled' as UploadStatus, uploadBlockReason: '' } : x,
      ))
    } else {
      setBlockReasonPreset('멘티 퇴사')
      setBlockReasonCustom('')
      setBlockTargetId(r.id)
    }
  }

  function confirmBlock() {
    if (!blockTargetId) return
    const reason = blockReasonPreset === '기타' ? blockReasonCustom : blockReasonPreset
    setRecords(prev => prev.map(r =>
      r.id === blockTargetId
        ? { ...r, uploadStatus: 'blocked' as UploadStatus, uploadBlockReason: reason }
        : r,
    ))
    setBlockTargetId(null)
  }

  function copyLink(r: MentoringRecord) {
    const link = `${window.location.origin}/mentor/${r.token}`
    navigator.clipboard.writeText(link).then(() => {
      setRecords(prev => prev.map(x => x.id === r.id ? { ...x, linkCopied: true } : x))
      alert('링크가 복사되었습니다.\n\n' + link)
    })
  }

  function openGoalsModal(r: MentoringRecord) {
    try {
      const saved = localStorage.getItem(`mentor_goals_${r.token}`)
      if (saved) {
        const goals: MentoringGoals = JSON.parse(saved)
        setGoalsModalRecord({ ...r, goals })
        return
      }
    } catch { /* ignore */ }
    setGoalsModalRecord(r)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mail
  // ─────────────────────────────────────────────────────────────────────────

  const mailPreviewBody = useMemo(() => {
    if (!mailPreviewRecord) return ''
    const link = typeof window !== 'undefined'
      ? `${window.location.origin}/mentor/${mailPreviewRecord.token}`
      : '[링크]'
    return mailPreviewType === 'initial'
      ? generateInitialGuideMailBody(mailPreviewRecord, link)
      : generateEndMailBody(mailPreviewRecord)
  }, [mailPreviewRecord, mailPreviewType])

  async function handleSendMail() {
    if (!mailPreviewRecord) return
    setMailSending(true)
    try {
      if (mailPreviewType === 'initial') {
        await sendInitialGuideMail(mailPreviewRecord)
        setRecords(prev => prev.map(r => r.id === mailPreviewRecord.id
          ? { ...r, initialMailSent: true, initialMailSentAt: TODAY } : r))
      } else {
        await sendEndMail(mailPreviewRecord)
        setRecords(prev => prev.map(r => r.id === mailPreviewRecord.id
          ? { ...r, endMailSent: true, endMailSentAt: TODAY } : r))
      }
      alert('메일이 발송되었습니다.')
    } catch { alert('메일 발송에 실패했습니다.') }
    finally { setMailSending(false); setMailPreviewRecord(null) }
  }

  function toggleMailSelect(id: string) {
    setSelectedForMail(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleAllMailSelect() {
    if (selectedForMail.size === visible.length) {
      setSelectedForMail(new Set())
    } else {
      setSelectedForMail(new Set(visible.map(r => r.id)))
    }
  }

  async function bulkSendInitial() {
    const targets = visible.filter(r => selectedForMail.has(r.id))
    if (!targets.length) { alert('선택된 멘토가 없습니다.'); return }
    if (!confirm(`${targets.length}명에게 초기 안내 메일을 발송하시겠습니까?`)) return
    setBulkSending('initial')
    try {
      await Promise.allSettled(targets.map(r => sendInitialGuideMail(r)))
      setRecords(prev => prev.map(r =>
        selectedForMail.has(r.id)
          ? { ...r, initialMailSent: true, initialMailSentAt: TODAY }
          : r,
      ))
      setSelectedForMail(new Set())
      alert(`${targets.length}건 발송 완료`)
    } finally { setBulkSending(null) }
  }

  async function bulkSendEnd() {
    const targets = visible.filter(r => selectedForMail.has(r.id))
    if (!targets.length) { alert('선택된 멘토가 없습니다.'); return }
    if (!confirm(`${targets.length}명에게 종료 안내 메일을 발송하시겠습니까?`)) return
    setBulkSending('end')
    try {
      await Promise.allSettled(targets.map(r => sendEndMail(r)))
      setRecords(prev => prev.map(r =>
        selectedForMail.has(r.id)
          ? { ...r, endMailSent: true, endMailSentAt: TODAY }
          : r,
      ))
      setSelectedForMail(new Set())
      alert(`${targets.length}건 발송 완료`)
    } finally { setBulkSending(null) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settlement / download
  // ─────────────────────────────────────────────────────────────────────────

  async function downloadExcel() {
    const XLSX = await import('xlsx')
    const data = settlementRows.map(row => ({
      멘토명:        row.record.mentorName,
      멘토이메일:    row.record.mentorEmail,
      멘티명:        row.record.menteeName,
      입사일:        row.record.joinDate,
      활동월:        settlementYM,
      개월차:        `${row.monthIndex}개월차`,
      실제사용금액:        row.actualCost,
      최대지급가능금액:    row.limit,
      최종지급금액:        row.amount,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '정산')
    XLSX.writeFile(wb, `멘토링정산_${settlementYM}.xlsx`)
  }

  function downloadReceiptZip() {
    alert('영수증 ZIP 다운로드는 Supabase Storage 연동 후 제공됩니다.\n엑셀에서 영수증 파일명을 확인하세요.')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auth guard
  // ─────────────────────────────────────────────────────────────────────────

  if (authed === null) return null
  if (!authed) return <LoginScreen onAuth={() => setAuthed(true)} />

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">멘토링 관리 시스템</h1>
            <p className="text-xs text-gray-400 mt-0.5">신규입사자 멘토링 프로그램 · 관리자</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{TODAY}</span>
            <button
              onClick={() => { sessionStorage.removeItem('admin_authed'); setAuthed(false) }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-[1400px] mx-auto">
          <nav className="flex">
            {([
              ['overview',    '전체현황'],
              ['manage',      '멘토/멘티관리'],
              ['mail',        '안내메일'],
              ['settlement',  '최종정산'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="p-6 max-w-[1400px] mx-auto space-y-6">

        {/* ═══════════════════════════════════════════════════════════════
            Tab: 전체현황
        ═══════════════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: '이번달 지급예정',  value: fmtAmount(thisMonthExpected), color: 'text-blue-600' },
                { label: '전체 예상 지급액', value: fmtAmount(totalExpected),    color: 'text-green-600' },
                { label: '진행중',           value: `${activeCount}건`,           color: 'text-indigo-600' },
                { label: '업로드 차단',      value: `${blockedCount}건`,          color: 'text-red-600' },
                { label: '목표 설정 완료',   value: `${goalsSetCount}건`,         color: 'text-amber-600' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">{c.label}</div>
                  <div className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-700">전체 현황</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      {['멘토', '멘티', '입사일', '활동기간', '진행월', '이번달 활동', '이번달 지급인정', '이번달 지급예상', '상태', '업로드', '진행현황'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.length === 0 && (
                      <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">데이터 없음</td></tr>
                    )}
                    {visible.map(r => {
                      const ci = getCurrentMonthIndex(r)
                      const curMd = (ci >= 1 && ci <= 3) ? r.months.find(m => m.monthIndex === ci) ?? null : null
                      const curTotal   = curMd ? countAllActivities(curMd)   : null
                      const curValid   = curMd ? countValidActivities(curMd) : null
                      const curPayment = curMd ? getMonthlyPayment(curMd)    : null
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium whitespace-nowrap">{r.mentorName}</td>
                          <td className="px-4 py-2.5 text-gray-600">{r.menteeName}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{r.joinDate}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                            {fmtPeriodMonthly(r.startDate, r.endDate)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {ci === 0 ? '대기' : ci === 4 ? '종료' : `${ci}개월차`}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {curTotal !== null ? curTotal : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {curValid !== null ? curValid : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                            {curPayment !== null ? fmtAmount(curPayment) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <Chip label={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} />
                          </td>
                          <td className="px-4 py-2.5">
                            {r.uploadStatus === 'blocked'
                              ? <Chip label="차단" color="bg-red-100 text-red-600" />
                              : <Chip label="정상" color="bg-green-100 text-green-600" />}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {getMentoringProgress(r).map((b, i) => (
                                <Chip key={i} label={b.text} color={b.color} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            Tab: 멘토/멘티관리
        ═══════════════════════════════════════════════════════════════ */}
        {tab === 'manage' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">
                멘토/멘티 목록 <span className="text-gray-400 font-normal">({visible.length}건)</span>
              </h2>
              <button onClick={openAdd}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                + 멘토링 추가
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      {['멘토', '멘토 이메일', '멘티', '입사일', '활동기간', '상태', '업로드', '목표', '메모', '관리'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">등록된 멘토링이 없습니다</td></tr>
                    )}
                    {visible.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{r.mentorName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.mentorEmail}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{r.menteeName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{r.joinDate}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {fmtPeriodMonthly(r.startDate, r.endDate)}
                        </td>
                        <td className="px-4 py-3">
                          <Chip label={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} />
                        </td>
                        <td className="px-4 py-3">
                          {r.uploadStatus === 'blocked' ? (
                            <div>
                              <Chip label="차단" color="bg-red-100 text-red-600" />
                              {r.uploadBlockReason && <p className="text-xs text-gray-400 mt-0.5">{r.uploadBlockReason}</p>}
                            </div>
                          ) : (
                            <Chip label="정상" color="bg-green-100 text-green-600" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.goals.savedAt
                            ? <Chip label="완료" color="bg-blue-100 text-blue-600" />
                            : <Chip label="미작성" color="bg-gray-100 text-gray-400" />}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[80px] truncate">{r.note || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <a href={`/mentor/${r.token}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 whitespace-nowrap">
                              멘토화면
                            </a>
                            <button onClick={() => copyLink(r)}
                              className="text-xs px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 whitespace-nowrap">
                              링크복사{r.linkCopied ? ' ✓' : ''}
                            </button>
                            <button onClick={() => openGoalsModal(r)}
                              className="text-xs px-2.5 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 whitespace-nowrap">
                              목표
                            </button>
                            <button onClick={() => openEdit(r)}
                              className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">
                              편집
                            </button>
                            <button onClick={() => toggleBlock(r)}
                              className={`text-xs px-2.5 py-1 rounded whitespace-nowrap ${
                                r.uploadStatus === 'blocked'
                                  ? 'bg-green-50 hover:bg-green-100 text-green-700'
                                  : 'bg-orange-50 hover:bg-orange-100 text-orange-700'
                              }`}>
                              {r.uploadStatus === 'blocked' ? '차단해제' : '업로드차단'}
                            </button>
                            <button onClick={() => setDeleteTargetId(r.id)}
                              className="text-xs px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600">
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            Tab: 안내메일
        ═══════════════════════════════════════════════════════════════ */}
        {tab === 'mail' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-gray-700">안내 메일 발송</h2>
              <div className="flex gap-2">
                <button onClick={bulkSendInitial} disabled={bulkSending !== null || selectedForMail.size === 0}
                  className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                  {bulkSending === 'initial' ? '발송 중...' : `초기안내 일괄발송 (${selectedForMail.size})`}
                </button>
                <button onClick={bulkSendEnd} disabled={bulkSending !== null || selectedForMail.size === 0}
                  className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                  {bulkSending === 'end' ? '발송 중...' : `종료안내 일괄발송 (${selectedForMail.size})`}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
              체크박스로 선택 후 일괄 발송하거나, 개별 발송 버튼을 클릭하세요.
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-2.5 w-10">
                        <input type="checkbox"
                          checked={visible.length > 0 && selectedForMail.size === visible.length}
                          onChange={toggleAllMailSelect}
                          className="accent-blue-600" />
                      </th>
                      {['멘토', '멘티', '멘토 이메일', '초기안내메일', '종료안내메일'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">데이터 없음</td></tr>
                    )}
                    {visible.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input type="checkbox"
                            checked={selectedForMail.has(r.id)}
                            onChange={() => toggleMailSelect(r.id)}
                            className="accent-blue-600" />
                        </td>
                        <td className="px-4 py-3 font-medium">{r.mentorName}</td>
                        <td className="px-4 py-3">{r.menteeName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.mentorEmail}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.initialMailSent && (
                              <span className="text-xs text-green-600 whitespace-nowrap">✓ {r.initialMailSentAt}</span>
                            )}
                            <button onClick={() => { setMailPreviewRecord(r); setMailPreviewType('initial') }}
                              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
                              {r.initialMailSent ? '재발송' : '발송'}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.endMailSent && (
                              <span className="text-xs text-green-600 whitespace-nowrap">✓ {r.endMailSentAt}</span>
                            )}
                            <button onClick={() => { setMailPreviewRecord(r); setMailPreviewType('end') }}
                              className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 whitespace-nowrap">
                              {r.endMailSent ? '재발송' : '발송'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            Tab: 최종정산
        ═══════════════════════════════════════════════════════════════ */}
        {tab === 'settlement' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-gray-700">최종 정산</h2>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 whitespace-nowrap">정산월:</label>
                <input type="month" value={settlementYM}
                  onChange={e => setSettlementYM(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button onClick={downloadExcel}
                  className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap">
                  엑셀 다운로드
                </button>
                <button onClick={downloadReceiptZip}
                  className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-300 whitespace-nowrap">
                  영수증 ZIP
                </button>
              </div>
            </div>

            {/* 정산 요약 카드 (유효활동 있는 건 제거) */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: `${settlementYM} 정산 대상`, value: `${settlementRows.length}건`, color: 'text-blue-600' },
                { label: `${settlementYM} 예상 지급액`, value: fmtAmount(settlementRows.reduce((s, r) => s + r.amount, 0)), color: 'text-green-600' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">{c.label}</div>
                  <div className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      {['멘토', '멘티', '차수', '활동수', '지급인정', '실사용금액', '최대한도', '지급예상'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {settlementRows.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                        {settlementYM}에 해당하는 정산 데이터가 없습니다
                      </td></tr>
                    )}
                    {settlementRows.map(row => {
                      const md = row.record.months.find(m => m.monthIndex === row.monthIndex)
                      const allActs   = md ? countAllActivities(md)   : 0
                      const validActs = md ? countValidActivities(md) : 0
                      return (
                        <tr key={`${row.record.id}-${row.monthIndex}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium whitespace-nowrap">{row.record.mentorName}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.record.menteeName}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{row.monthIndex}개월차</td>
                          <td className="px-4 py-3 text-center">{allActs}</td>
                          <td className="px-4 py-3 text-center font-medium">{validActs}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtAmount(row.actualCost)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtAmount(row.limit)}</td>
                          <td className="px-4 py-3 font-medium whitespace-nowrap text-blue-700">{fmtAmount(row.amount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          Modals
      ═══════════════════════════════════════════════════════════════════ */}

      {/* Add/Edit */}
      {showAddEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{editingId ? '멘토링 편집' : '멘토링 추가'}</h3>
              <button onClick={() => setShowAddEdit(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* 멘토명 / 멘토 이메일 / 멘티명 */}
              {([
                { key: 'mentorName'  as const, label: '멘토명',      req: true, type: 'text',  placeholder: '홍길동' },
                { key: 'mentorEmail' as const, label: '멘토 이메일', req: true, type: 'email', placeholder: 'mentor@company.co.kr' },
                { key: 'menteeName'  as const, label: '멘티명',      req: true, type: 'text',  placeholder: '신입사원' },
              ]).map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {f.label}{f.req && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input type={f.type} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              ))}

              {/* 입사일 (YYYY-MM-DD) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  입사일 <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">(일 단위 — 에스코트 안내 기준)</span>
                </label>
                <input type="date" value={form.joinDate}
                  onChange={e => handleJoinDateChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>

              {/* 입사월 + 자동 계산 기간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  입사월 <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">(입사일 입력 시 자동 설정 · 수동 조정 가능)</span>
                </label>
                <input type="month" value={form.joinMonth}
                  onChange={e => handleJoinMonthChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                {form.startDate && (
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    멘토링 활동 기간: {fmtPeriodMonthly(form.startDate, form.endDate)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">진행 상태</label>
                  <select value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value as MentoringStatus }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="active">진행중</option>
                    <option value="completed">완료</option>
                    <option value="suspended">중단</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">업로드 상태</label>
                  <select value={form.uploadStatus}
                    onChange={e => setForm(p => ({ ...p, uploadStatus: e.target.value as UploadStatus }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="enabled">정상</option>
                    <option value="blocked">차단</option>
                  </select>
                </div>
              </div>

              {form.uploadStatus === 'blocked' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">차단 사유</label>
                  <input type="text" value={form.uploadBlockReason}
                    onChange={e => setForm(p => ({ ...p, uploadBlockReason: e.target.value }))}
                    placeholder="예: 멘티 퇴사"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  rows={2} placeholder="내부 참고용 메모"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowAddEdit(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={saveForm} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-gray-800 mb-3">멘토링 삭제</h3>
            {(() => {
              const t = records.find(r => r.id === deleteTargetId)
              return t ? (
                <p className="text-sm font-medium text-gray-800 bg-gray-50 rounded-lg px-3 py-2 mb-3">
                  {t.mentorName} → {t.menteeName}
                </p>
              ) : null
            })()}
            <p className="text-xs text-gray-400 mb-5">삭제 후 전체현황·정산 화면에서 제외됩니다. (소프트 삭제)</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTargetId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {blockTargetId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-gray-800 mb-4">업로드 차단</h3>
            <div className="space-y-2 mb-3">
              {['멘티 퇴사', '멘티 전배', '기타'].map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="blockReason" value={r}
                    checked={blockReasonPreset === r} onChange={e => setBlockReasonPreset(e.target.value)}
                    className="accent-blue-600" />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
            </div>
            {blockReasonPreset === '기타' && (
              <input type="text" placeholder="직접 입력" value={blockReasonCustom}
                onChange={e => setBlockReasonCustom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 mt-2" />
            )}
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setBlockTargetId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={confirmBlock} className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700">차단</button>
            </div>
          </div>
        </div>
      )}

      {/* Goals Modal */}
      {goalsModalRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">멘토링 목표</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {goalsModalRecord.mentorName} → {goalsModalRecord.menteeName}
                  {goalsModalRecord.goals.savedAt && ` · 작성일: ${goalsModalRecord.goals.savedAt}`}
                </p>
              </div>
              <button onClick={() => setGoalsModalRecord(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            {goalsModalRecord.goals.savedAt ? (
              <div className="px-6 py-5 grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-blue-700 mb-3">기대사항 (멘티)</h4>
                  <ol className="space-y-2">
                    {goalsModalRecord.goals.expectations.map((e, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-gray-400 font-medium flex-shrink-0">{i + 1}.</span>
                        <span className="text-gray-700">{e || <span className="text-gray-300">미입력</span>}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-3">협력사항 (멘토)</h4>
                  <ol className="space-y-2">
                    {goalsModalRecord.goals.cooperation.map((e, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-gray-400 font-medium flex-shrink-0">{i + 1}.</span>
                        <span className="text-gray-700">{e || <span className="text-gray-300">미입력</span>}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-gray-400">
                <div className="text-3xl mb-2">📝</div>
                <p>아직 목표를 작성하지 않았습니다.</p>
              </div>
            )}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setGoalsModalRecord(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* Mail Preview */}
      {mailPreviewRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">
                  {mailPreviewType === 'initial' ? '초기 안내 메일' : '종료 안내 메일'} 미리보기
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">수신: {mailPreviewRecord.mentorEmail}</p>
              </div>
              <button onClick={() => setMailPreviewRecord(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4">
              <pre className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto leading-relaxed">
                {mailPreviewBody}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setMailPreviewRecord(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">닫기</button>
              <button onClick={handleSendMail} disabled={mailSending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {mailSending ? '발송 중...' : '발송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
