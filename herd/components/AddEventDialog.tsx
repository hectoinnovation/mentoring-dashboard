'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Modal from './Modal'

interface Props {
  open: boolean
  onClose: () => void
}

const EVENT_TYPES = [
  { value: 'workshop', label: '워크샵' },
  { value: 'townhall', label: '타운홀 미팅' },
  { value: 'anniversary', label: '기념행사' },
  { value: 'training', label: '교육/연수' },
  { value: 'dinner', label: '회식/만찬' },
  { value: 'other', label: '기타' },
]

export default function AddEventDialog({ open, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    event_type: 'workshop',
    event_date: '',
    description: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.event_date) {
      setError('행사명과 날짜는 필수입니다.')
      return
    }
    setLoading(true)
    setError('')
    const { error: dbError } = await supabase.from('events').insert({
      title: form.title,
      event_type: form.event_type,
      event_date: form.event_date,
      description: form.description || null,
    })
    setLoading(false)
    if (dbError) {
      setError('등록 중 오류가 발생했습니다.')
      return
    }
    setForm({ title: '', event_type: 'workshop', event_date: '', description: '' })
    onClose()
    router.refresh()
  }

  return (
    <Modal open={open} onClose={onClose} title="행사 등록">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">행사명 *</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="예: 2026 하반기 워크샵"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">행사 유형 *</label>
          <select
            name="event_type"
            value={form.event_type}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">행사 날짜 *</label>
          <input
            type="date"
            name="event_date"
            value={form.event_date}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="행사에 대한 간단한 설명을 입력하세요"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
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
            {loading ? '등록 중...' : '행사 등록'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
