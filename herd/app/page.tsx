'use client'

import { useState, useMemo } from 'react'
import {
  MentoringRecord, MentoringStatus, UploadStatus, ApprovalStatus, PaymentStatus,
  INITIAL_DATA, createEmptyMonths, generateToken, TODAY,
  getMonthYM, getCurrentMonthIndex, getMonthDataForYM,
  countValidActivities, getMonthlyPayment,
  getTotalExpectedPayment, getPaidAmount, fmtAmount,
  generateInitialGuideMailBody, generateEndMailBody,
  sendInitialGuideMail, sendEndMail,
} from '@/lib/mentoring'

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'manage' | 'mail' | 'settlement'

const STATUS_LABEL: Record<MentoringStatus, string> = {
  active: '진행중', completed: '완료', suspended: '중단', deleted: '삭제',
}
const STATUS_COLOR: Record<MentoringStatus, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  deleted: 'bg-red-100 text-red-700',
}
const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  pending: '미승인', approved: '승인', rejected: '반려',
}
const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: '미지급', paid: '지급완료', not_paid: '미지급처리',
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────────────────────────────────────

const blankForm = () => ({
  mentorName: '', mentorEmail: '', menteeName: '', menteeEmail: '',
  startDate: '', endDate: '',
  status: 'active' as MentoringStatus,
  uploadStatus: 'enabled' as UploadStatus,
  uploadBlockReason: '', note: '',
})
type FormState = ReturnType<typeof blankForm>

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [records, setRecords] = useState<MentoringRecord[]>(INITIAL_DATA)
  const [tab, setTab] = useState<Tab>('overview')

  // ── add/edit modal
  const [showAddEdit, setShowAddEdit] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm())

  // ── delete modal
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  // ── block modal
  const [blockTargetId, setBlockTargetId] = useState<string | null>(null)
  const [blockReasonPreset, setBlockReasonPreset] = useState('멘티 퇴사')
  const [blockReasonCustom, setBlockReasonCustom] = useState('')

  // ── mail preview
  const [mailPreviewRecord, setMailPreviewRecord] = useState<MentoringRecord | null>(null)
  const [mailPreviewType, setMailPreviewType] = useState<'initial' | 'end'>('initial')
  const [mailSending, setMailSending] = useState(false)

  // ── settlement
  const [settlementYM, setSettlementYM] = useState(TODAY.slice(0, 7))

  // ─────────────────────────────────────────────────────────────────────────
  // Derived data
  // ─────────────────────────────────────────────────────────────────────────

  const visible = useMemo(
    () => records.filter(r => r.status !== 'deleted'),
    [records],
  )

  const currentYM = TODAY.slice(0, 7)

  const thisMonthExpected = useMemo(
    () =>
      visible
        .filter(r => r.status === 'active')
        .reduce((sum, r) => {
          const md = getMonthDataForYM(r, currentYM)
          return sum + (md ? getMonthlyPayment(md) : 0)
        }, 0),
    [visible, currentYM],
  )

  const totalPaid = useMemo(
    () => visible.reduce((s, r) => s + getPaidAmount(r), 0),
    [visible],
  )

  const activeCount = useMemo(
    () => visible.filter(r => r.status === 'active').length,
    [visible],
  )

  const blockedCount = useMemo(
    () => visible.filter(r => r.uploadStatus === 'blocked').length,
    [visible],
  )

  const settlementTargetCount = useMemo(() => {
    let cnt = 0
    for (const r of visible) {
      for (const m of r.months) {
        if (m.paymentStatus === 'pending' && countValidActivities(m) > 0) cnt++
      }
    }
    return cnt
  }, [visible])

  const settlementRows = useMemo(() => {
    const rows: {
      record: MentoringRecord
      monthIndex: number
      validCount: number
      amount: number
      md: MentoringRecord['months'][0]
    }[] = []
    for (const r of visible) {
      for (const m of r.months) {
        if (getMonthYM(r.startDate, m.monthIndex) === settlementYM) {
          rows.push({
            record: r,
            monthIndex: m.monthIndex,
            validCount: countValidActivities(m),
            amount: getMonthlyPayment(m),
            md: m,
          })
        }
      }
    }
    return rows
  }, [visible, settlementYM])

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD helpers
  // ─────────────────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(blankForm())
    setEditingId(null)
    setShowAddEdit(true)
  }

  function openEdit(r: MentoringRecord) {
    setForm({
      mentorName: r.mentorName, mentorEmail: r.mentorEmail,
      menteeName: r.menteeName, menteeEmail: r.menteeEmail,
      startDate: r.startDate, endDate: r.endDate,
      status: r.status, uploadStatus: r.uploadStatus,
      uploadBlockReason: r.uploadBlockReason, note: r.note,
    })
    setEditingId(r.id)
    setShowAddEdit(true)
  }

  function saveForm() {
    if (!form.mentorName || !form.mentorEmail || !form.menteeName || !form.startDate || !form.endDate) {
      alert('멘토명, 멘토 이메일, 멘티명, 시작일, 종료 예정일은 필수입니다.')
      return
    }
    if (editingId) {
      setRecords(prev =>
        prev.map(r =>
          r.id === editingId
            ? {
                ...r,
                mentorName: form.mentorName, mentorEmail: form.mentorEmail,
                menteeName: form.menteeName, menteeEmail: form.menteeEmail,
                startDate: form.startDate, endDate: form.endDate,
                status: form.status, uploadStatus: form.uploadStatus,
                uploadBlockReason: form.uploadBlockReason, note: form.note,
              }
            : r,
        ),
      )
    } else {
      const newRecord: MentoringRecord = {
        id: Date.now().toString(),
        mentorName: form.mentorName, mentorEmail: form.mentorEmail,
        menteeName: form.menteeName, menteeEmail: form.menteeEmail,
        startDate: form.startDate, endDate: form.endDate,
        status: form.status, uploadStatus: form.uploadStatus,
        uploadBlockReason: form.uploadBlockReason, note: form.note,
        token: generateToken(),
        months: createEmptyMonths(),
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
    setRecords(prev =>
      prev.map(r =>
        r.id === deleteTargetId
          ? { ...r, status: 'deleted' as MentoringStatus, deletedAt: TODAY }
          : r,
      ),
    )
    setDeleteTargetId(null)
  }

  function toggleBlock(r: MentoringRecord) {
    if (r.uploadStatus === 'blocked') {
      setRecords(prev =>
        prev.map(x =>
          x.id === r.id ? { ...x, uploadStatus: 'enabled' as UploadStatus, uploadBlockReason: '' } : x,
        ),
      )
    } else {
      setBlockReasonPreset('멘티 퇴사')
      setBlockReasonCustom('')
      setBlockTargetId(r.id)
    }
  }

  function confirmBlock() {
    if (!blockTargetId) return
    const reason = blockReasonPreset === '기타' ? blockReasonCustom : blockReasonPreset
    setRecords(prev =>
      prev.map(r =>
        r.id === blockTargetId
          ? { ...r, uploadStatus: 'blocked' as UploadStatus, uploadBlockReason: reason }
          : r,
      ),
    )
    setBlockTargetId(null)
  }

  function copyLink(r: MentoringRecord) {
    const link = `${window.location.origin}/mentor/${r.token}`
    navigator.clipboard.writeText(link).then(() => {
      setRecords(prev => prev.map(x => (x.id === r.id ? { ...x, linkCopied: true } : x)))
      alert('링크가 복사되었습니다.\n\n' + link)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mail
  // ─────────────────────────────────────────────────────────────────────────

  const mailPreviewBody = useMemo(() => {
    if (!mailPreviewRecord) return ''
    const link =
      typeof window !== 'undefined'
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
        setRecords(prev =>
          prev.map(r =>
            r.id === mailPreviewRecord.id
              ? { ...r, initialMailSent: true, initialMailSentAt: TODAY }
              : r,
          ),
        )
      } else {
        await sendEndMail(mailPreviewRecord)
        setRecords(prev =>
          prev.map(r =>
            r.id === mailPreviewRecord.id
              ? { ...r, endMailSent: true, endMailSentAt: TODAY }
              : r,
          ),
        )
      }
      alert('메일이 발송되었습니다.')
    } catch {
      alert('메일 발송에 실패했습니다.')
    } finally {
      setMailSending(false)
      setMailPreviewRecord(null)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settlement
  // ─────────────────────────────────────────────────────────────────────────

  function updateApproval(recordId: string, monthIndex: number, status: ApprovalStatus) {
    setRecords(prev =>
      prev.map(r =>
        r.id === recordId
          ? {
              ...r,
              months: r.months.map(m =>
                m.monthIndex === monthIndex
                  ? { ...m, approvalStatus: status, approvedAt: status === 'approved' ? TODAY : null }
                  : m,
              ),
            }
          : r,
      ),
    )
  }

  function updatePayment(recordId: string, monthIndex: number, status: PaymentStatus) {
    setRecords(prev =>
      prev.map(r =>
        r.id === recordId
          ? {
              ...r,
              months: r.months.map(m =>
                m.monthIndex === monthIndex ? { ...m, paymentStatus: status } : m,
              ),
            }
          : r,
      ),
    )
  }

  async function downloadExcel() {
    const XLSX = await import('xlsx')
    const data = settlementRows.map(row => ({
      멘토명: row.record.mentorName,
      멘토이메일: row.record.mentorEmail,
      멘티명: row.record.menteeName,
      활동월: settlementYM,
      개월차: `${row.monthIndex}개월차`,
      유효활동수: row.validCount,
      지급금액: row.amount,
      승인상태: APPROVAL_LABEL[row.md.approvalStatus],
      지급상태: PAYMENT_LABEL[row.md.paymentStatus],
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '정산')
    XLSX.writeFile(wb, `멘토링정산_${settlementYM}.xlsx`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">멘토링 관리 시스템</h1>
            <p className="text-xs text-gray-400 mt-0.5">신규입사자 멘토링 프로그램 · 관리자</p>
          </div>
          <span className="text-xs text-gray-400">{TODAY}</span>
        </div>
      </header>

      {/* ── Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-[1400px] mx-auto">
          <nav className="flex">
            {(
              [
                ['overview', '전체현황'],
                ['manage', '멘토/멘티관리'],
                ['mail', '안내메일'],
                ['settlement', '최종정산'],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="p-6 max-w-[1400px] mx-auto space-y-6">

        {/* ════════════════════════════════════════════════════════════════
            Tab: 전체현황
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: '이번달 지급예정', value: fmtAmount(thisMonthExpected), color: 'text-blue-600' },
                { label: '누적 지급액', value: fmtAmount(totalPaid), color: 'text-green-600' },
                { label: '진행중', value: `${activeCount}건`, color: 'text-indigo-600' },
                { label: '업로드 차단', value: `${blockedCount}건`, color: 'text-red-600' },
                { label: '정산 대상', value: `${settlementTargetCount}건`, color: 'text-amber-600' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">{card.label}</div>
                  <div className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* Overview table */}
            <SectionCard>
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-700">전체 현황</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      {[
                        '멘토', '멘티', '기간', '진행월', '전체활동', '유효활동',
                        '지급금액(예상)', '상태', '업로드',
                      ].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                          데이터 없음
                        </td>
                      </tr>
                    )}
                    {visible.map(r => {
                      const ci = getCurrentMonthIndex(r)
                      const total = r.months.reduce((s, m) => s + m.activities.length, 0)
                      const valid = r.months.reduce((s, m) => s + countValidActivities(m), 0)
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium">{r.mentorName}</td>
                          <td className="px-4 py-2.5 text-gray-600">{r.menteeName}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                            {r.startDate}<br />{r.endDate}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {ci === 0 ? '대기' : ci === 4 ? '종료' : `${ci}개월차`}
                          </td>
                          <td className="px-4 py-2.5 text-center">{total}회</td>
                          <td className="px-4 py-2.5 text-center">{valid}회</td>
                          <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                            {fmtAmount(getTotalExpectedPayment(r))}
                          </td>
                          <td className="px-4 py-2.5">
                            <Chip label={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} />
                          </td>
                          <td className="px-4 py-2.5">
                            {r.uploadStatus === 'blocked' ? (
                              <Chip label="차단" color="bg-red-100 text-red-600" />
                            ) : (
                              <Chip label="정상" color="bg-green-100 text-green-600" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            Tab: 멘토/멘티관리
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'manage' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">
                멘토/멘티 목록{' '}
                <span className="text-gray-400 font-normal">({visible.length}건)</span>
              </h2>
              <button
                onClick={openAdd}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + 멘토링 추가
              </button>
            </div>

            <SectionCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      {[
                        '멘토', '멘토 이메일', '멘티', '기간', '상태', '업로드', '메모', '관리',
                      ].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                          등록된 멘토링이 없습니다
                        </td>
                      </tr>
                    )}
                    {visible.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{r.mentorName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.mentorEmail}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{r.menteeName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {r.startDate}<br />{r.endDate}
                        </td>
                        <td className="px-4 py-3">
                          <Chip label={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} />
                        </td>
                        <td className="px-4 py-3">
                          {r.uploadStatus === 'blocked' ? (
                            <div>
                              <Chip label="차단" color="bg-red-100 text-red-600" />
                              {r.uploadBlockReason && (
                                <p className="text-xs text-gray-400 mt-0.5">{r.uploadBlockReason}</p>
                              )}
                            </div>
                          ) : (
                            <Chip label="정상" color="bg-green-100 text-green-600" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[100px] truncate">
                          {r.note || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <a
                              href={`/mentor/${r.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 whitespace-nowrap"
                            >
                              멘토화면
                            </a>
                            <button
                              onClick={() => copyLink(r)}
                              className="text-xs px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 whitespace-nowrap"
                            >
                              링크복사{r.linkCopied ? ' ✓' : ''}
                            </button>
                            <button
                              onClick={() => openEdit(r)}
                              className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                            >
                              편집
                            </button>
                            <button
                              onClick={() => toggleBlock(r)}
                              className={`text-xs px-2.5 py-1 rounded whitespace-nowrap ${
                                r.uploadStatus === 'blocked'
                                  ? 'bg-green-50 hover:bg-green-100 text-green-700'
                                  : 'bg-orange-50 hover:bg-orange-100 text-orange-700'
                              }`}
                            >
                              {r.uploadStatus === 'blocked' ? '차단해제' : '업로드차단'}
                            </button>
                            <button
                              onClick={() => setDeleteTargetId(r.id)}
                              className="text-xs px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            Tab: 안내메일
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'mail' && (
          <>
            <h2 className="font-semibold text-gray-700">안내 메일 발송</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
              메일 발송 전 미리보기를 확인하세요. 발송 버튼을 클릭하면 실제 이메일이 전송됩니다.
            </div>

            <SectionCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      {['멘토', '멘티', '멘토 이메일', '초기안내메일', '종료안내메일'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                          데이터 없음
                        </td>
                      </tr>
                    )}
                    {visible.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{r.mentorName}</td>
                        <td className="px-4 py-3">{r.menteeName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.mentorEmail}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.initialMailSent && (
                              <span className="text-xs text-green-600 whitespace-nowrap">
                                ✓ {r.initialMailSentAt}
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setMailPreviewRecord(r)
                                setMailPreviewType('initial')
                              }}
                              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                            >
                              {r.initialMailSent ? '재발송' : '발송'}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.endMailSent && (
                              <span className="text-xs text-green-600 whitespace-nowrap">
                                ✓ {r.endMailSentAt}
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setMailPreviewRecord(r)
                                setMailPreviewType('end')
                              }}
                              className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 whitespace-nowrap"
                            >
                              {r.endMailSent ? '재발송' : '발송'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            Tab: 최종정산
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'settlement' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-gray-700">최종 정산</h2>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 whitespace-nowrap">정산월:</label>
                <input
                  type="month"
                  value={settlementYM}
                  onChange={e => setSettlementYM(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={downloadExcel}
                  className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
                >
                  엑셀 다운로드
                </button>
              </div>
            </div>

            {/* Settlement summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: `${settlementYM} 정산 대상`,
                  value: `${settlementRows.length}건`,
                  color: 'text-blue-600',
                },
                {
                  label: `${settlementYM} 예상 지급액`,
                  value: fmtAmount(settlementRows.reduce((s, r) => s + r.amount, 0)),
                  color: 'text-green-600',
                },
                {
                  label: '지급 완료',
                  value: `${settlementRows.filter(r => r.md.paymentStatus === 'paid').length}건`,
                  color: 'text-indigo-600',
                },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">{card.label}</div>
                  <div className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>

            <SectionCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      {[
                        '멘토', '멘티', '개월차', '유효활동', '지급금액',
                        '승인상태', '지급상태', '처리',
                      ].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {settlementRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                          {settlementYM}에 해당하는 정산 데이터가 없습니다
                        </td>
                      </tr>
                    )}
                    {settlementRows.map(row => (
                      <tr key={`${row.record.id}-${row.monthIndex}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{row.record.mentorName}</td>
                        <td className="px-4 py-3">{row.record.menteeName}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.monthIndex}개월차</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={row.validCount >= 3 ? 'text-green-600 font-medium' : ''}>
                            {row.validCount}
                          </span>
                          <span className="text-gray-400"> / 3회</span>
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {fmtAmount(row.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={row.md.approvalStatus}
                            onChange={e =>
                              updateApproval(
                                row.record.id,
                                row.monthIndex,
                                e.target.value as ApprovalStatus,
                              )
                            }
                            className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                          >
                            <option value="pending">미승인</option>
                            <option value="approved">승인</option>
                            <option value="rejected">반려</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={row.md.paymentStatus}
                            onChange={e =>
                              updatePayment(
                                row.record.id,
                                row.monthIndex,
                                e.target.value as PaymentStatus,
                              )
                            }
                            className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                          >
                            <option value="pending">미지급</option>
                            <option value="paid">지급완료</option>
                            <option value="not_paid">미지급처리</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() =>
                                updateApproval(row.record.id, row.monthIndex, 'approved')
                              }
                              className="text-xs px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 whitespace-nowrap"
                            >
                              승인
                            </button>
                            <button
                              onClick={() =>
                                updatePayment(row.record.id, row.monthIndex, 'paid')
                              }
                              className="text-xs px-2.5 py-1 rounded bg-green-50 hover:bg-green-100 text-green-700 whitespace-nowrap"
                            >
                              지급완료
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          Modals
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ── Add / Edit Modal */}
      {showAddEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">
                {editingId ? '멘토링 편집' : '멘토링 추가'}
              </h3>
              <button
                onClick={() => setShowAddEdit(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {(
                [
                  { key: 'mentorName' as const, label: '멘토명', req: true, type: 'text', placeholder: '홍길동' },
                  { key: 'mentorEmail' as const, label: '멘토 이메일', req: true, type: 'email', placeholder: 'mentor@company.co.kr' },
                  { key: 'menteeName' as const, label: '멘티명', req: true, type: 'text', placeholder: '신입사원' },
                  { key: 'menteeEmail' as const, label: '멘티 이메일', req: false, type: 'email', placeholder: 'mentee@company.co.kr' },
                ]
              ).map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {f.label}
                    {f.req && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시작일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종료 예정일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">진행 상태</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value as MentoringStatus }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="active">진행중</option>
                    <option value="completed">완료</option>
                    <option value="suspended">중단</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">업로드 상태</label>
                  <select
                    value={form.uploadStatus}
                    onChange={e =>
                      setForm(p => ({ ...p, uploadStatus: e.target.value as UploadStatus }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="enabled">정상</option>
                    <option value="blocked">차단</option>
                  </select>
                </div>
              </div>

              {form.uploadStatus === 'blocked' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">차단 사유</label>
                  <input
                    type="text"
                    value={form.uploadBlockReason}
                    onChange={e => setForm(p => ({ ...p, uploadBlockReason: e.target.value }))}
                    placeholder="예: 멘티 퇴사"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea
                  value={form.note}
                  onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  rows={2}
                  placeholder="내부 참고용 메모"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowAddEdit(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={saveForm}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-gray-800 mb-3">멘토링 삭제</h3>
            {(() => {
              const target = records.find(r => r.id === deleteTargetId)
              return target ? (
                <p className="text-sm font-medium text-gray-800 bg-gray-50 rounded-lg px-3 py-2 mb-3">
                  {target.mentorName} → {target.menteeName}
                </p>
              ) : null
            })()}
            <p className="text-sm text-gray-600 mb-1">이 멘토링을 삭제하시겠습니까?</p>
            <p className="text-xs text-gray-400 mb-5">
              삭제 후 전체현황·정산 화면에서 제외됩니다. (소프트 삭제)
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Block Modal */}
      {blockTargetId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-gray-800 mb-2">업로드 차단</h3>
            <p className="text-sm text-gray-600 mb-4">차단 사유를 선택하세요.</p>
            <div className="space-y-2 mb-3">
              {['멘티 퇴사', '멘티 전배', '기타'].map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="blockReason"
                    value={r}
                    checked={blockReasonPreset === r}
                    onChange={e => setBlockReasonPreset(e.target.value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
            </div>
            {blockReasonPreset === '기타' && (
              <input
                type="text"
                placeholder="직접 입력"
                value={blockReasonCustom}
                onChange={e => setBlockReasonCustom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 mt-2"
              />
            )}
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setBlockTargetId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={confirmBlock}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                차단
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mail Preview Modal */}
      {mailPreviewRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">
                  {mailPreviewType === 'initial' ? '초기 안내 메일' : '종료 안내 메일'} 미리보기
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  수신: {mailPreviewRecord.mentorEmail}
                </p>
              </div>
              <button
                onClick={() => setMailPreviewRecord(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <pre className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto leading-relaxed">
                {mailPreviewBody}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setMailPreviewRecord(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                닫기
              </button>
              <button
                onClick={handleSendMail}
                disabled={mailSending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mailSending ? '발송 중...' : '발송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
