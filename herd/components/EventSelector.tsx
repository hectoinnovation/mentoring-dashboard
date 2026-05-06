'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Event } from '@/lib/supabase'

interface Props {
  events: Event[]
  selectedEventId: string
}

export default function EventSelector({ events, selectedEventId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('event', e.target.value)
    router.push(`?${params.toString()}`)
  }

  return (
    <select
      value={selectedEventId}
      onChange={handleChange}
      className="h-9 rounded-lg border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring w-[320px]"
    >
      {events.map((event) => (
        <option key={event.id} value={event.id}>
          {event.title} ({event.event_date})
        </option>
      ))}
    </select>
  )
}
