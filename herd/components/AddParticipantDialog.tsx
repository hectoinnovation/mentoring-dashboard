'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Modal from './Modal'

interface Department {
  id: string
  name: string
}

interface Props {
  open: boolean
  onClose: () => void
  selectedEventId: string
}

const PRIORITY_OPTIONS = [
  { value: 'high', label: '필수 (high)' },
  { value: 'normal', label: '일반 (normal)' },
  { value: 'low', label: '참고 (low)' },
]

export default function AddParticipantDialog({ open, onClose, selectedEventId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [form, setForm] = useState({
    name: '',
    email: '',
    department_id: '',
    priority: 'normal',
    addToCurrentEvent: true,
  })

  useEffect(() => {
    if (!open) return
    supabase
      .from('departments')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setDepartments(data)
          if (data.length > 0) setForm((prev) => ({ ...prev, department_id: data[0].id }))
        }
      })
  }, [open])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const value = e.target.type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : e.target.value
    setForm((prev) => ({ ...prev, [e.target.name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.department_id) {
      setError('이름, 이메일, 부서는 필수입니다.')
      return
    }
    setLoading(true)
    setError('')

    const { data: participant, error: insertError } = await supabase
      .from('participants')
      .insert({
        name: form.name,
        email: form.email,
        department_id: form.department_id,
        priority: form.priority,
      })
      .select('id')
      .single()

    if (insertError) {
      setLoading(false)
      setError(insertError.message.includes('unique') ? '이미 등록된 이메일입니다.' : '등록 중 오류가 발생했습니다.')
      return
    }

    if (form.addToCurrentEvent && selectedEventId && participant) {
      await supabase.from('responses').insert({
        event_id: selectedEventId,
        participant_id: participant.id,
        response_status: 'pending',
      })
    }

    setLoading(false)
    setForm({ name: '', email: '', department_id: departments[0]?.id ?? '', priority: 'normal', addToCurrentEvent: true })
    onClose()
    router.refresh()
  }

  return (
    <Modal open={open} onClose={onClose} title="참석자 등록">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="홍길동"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="example@company.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">부서 *</label>
          <select
            name="department_id"
            value={form.department_id}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">우선순위 *</label>
          <select
            name="priority"
            value={form.priority}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {selectedEventId && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              name="addToCurrentEvent"
              checked={form.addToCurrentEvent}
              onChange={handleChange}
              className="rounded"
            />
            현재 선택된 행사에 바로 추가 (미응답 상태)
          </label>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '등록 중...' : '참석자 등록'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
