'use client'

import { useState } from 'react'
import { Event } from '@/lib/supabase'
import EventSelector from './EventSelector'
import AddEventDialog from './AddEventDialog'
import AddParticipantDialog from './AddParticipantDialog'

interface Props {
  events: Event[]
  selectedEventId: string
  selectedEventInfo?: string
}

export default function DashboardHeader({ events, selectedEventId, selectedEventInfo }: Props) {
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false)

  return (
    <>
      {/* 행사 선택 + 등록 버튼 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">행사 선택</span>
        <EventSelector events={events} selectedEventId={selectedEventId} />
        {selectedEventInfo && (
          <span className="text-sm text-gray-400">{selectedEventInfo}</span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setParticipantDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 font-medium"
          >
            <span className="text-base leading-none">+</span> 참석자 등록
          </button>
          <button
            onClick={() => setEventDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <span className="text-base leading-none">+</span> 행사 등록
          </button>
        </div>
      </div>

      <AddEventDialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
      />
      <AddParticipantDialog
        open={participantDialogOpen}
        onClose={() => setParticipantDialogOpen(false)}
        selectedEventId={selectedEventId}
      />
    </>
  )
}
