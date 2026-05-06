import { Suspense } from 'react'
import { supabase, Event, ParticipantResponse, DepartmentStat } from '@/lib/supabase'
import DashboardHeader from '@/components/DashboardHeader'
import KpiCards from '@/components/KpiCards'
import DepartmentStats from '@/components/DepartmentStats'
import ParticipantList from '@/components/ParticipantList'

async function getEvents(): Promise<Event[]> {
  const { data } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true })
  return data ?? []
}

async function getResponses(eventId: string): Promise<ParticipantResponse[]> {
  const { data } = await supabase
    .from('responses')
    .select(`
      id,
      response_status,
      responded_at,
      participants (
        name,
        email,
        priority,
        departments ( name )
      )
    `)
    .eq('event_id', eventId)

  if (!data) return []

  return data.map((r: any) => ({
    id: r.id,
    name: r.participants.name,
    email: r.participants.email,
    priority: r.participants.priority,
    department_name: r.participants.departments.name,
    response_status: r.response_status,
    responded_at: r.responded_at,
  }))
}

function buildDepartmentStats(responses: ParticipantResponse[]): DepartmentStat[] {
  const map = new Map<string, DepartmentStat>()
  for (const r of responses) {
    if (!map.has(r.department_name)) {
      map.set(r.department_name, {
        department_name: r.department_name,
        total: 0,
        attending: 0,
        not_attending: 0,
        pending: 0,
      })
    }
    const stat = map.get(r.department_name)!
    stat.total++
    if (r.response_status === 'attending') stat.attending++
    else if (r.response_status === 'not_attending') stat.not_attending++
    else stat.pending++
  }
  return Array.from(map.values()).sort((a, b) =>
    a.department_name.localeCompare(b.department_name, 'ko')
  )
}

interface PageProps {
  searchParams: Promise<{ event?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const events = await getEvents()
  const selectedEventId = params.event ?? events[0]?.id ?? ''
  const selectedEvent = events.find((e) => e.id === selectedEventId)

  const responses = selectedEventId ? await getResponses(selectedEventId) : []
  const departmentStats = buildDepartmentStats(responses)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* 헤더 */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900">행사 참석 현황 대시보드</h1>
          <p className="text-gray-500 text-sm">HR 행사별 참석 응답 현황을 확인합니다</p>
        </div>

        {/* 행사 선택 + 등록 버튼 */}
        <Suspense>
          <DashboardHeader
            events={events}
            selectedEventId={selectedEventId}
            selectedEventInfo={selectedEvent ? `${selectedEvent.event_date} · ${selectedEvent.event_type}` : undefined}
          />
        </Suspense>

        {selectedEventId ? (
          <>
            {/* KPI 카드 */}
            <KpiCards responses={responses} />

            {/* 부서별 현황 */}
            <div className="bg-white rounded-lg border p-6">
              <DepartmentStats stats={departmentStats} />
            </div>

            {/* 참석자 목록 */}
            <div className="bg-white rounded-lg border p-6">
              <ParticipantList responses={responses} />
            </div>
          </>
        ) : (
          <div className="text-center text-gray-400 py-20">행사를 선택해주세요</div>
        )}
      </div>
    </main>
  )
}
