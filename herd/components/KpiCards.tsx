import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ParticipantResponse } from '@/lib/supabase'

interface Props {
  responses: ParticipantResponse[]
}

export default function KpiCards({ responses }: Props) {
  const total = responses.length
  const attending = responses.filter((r) => r.response_status === 'attending').length
  const notAttending = responses.filter((r) => r.response_status === 'not_attending').length
  const pending = responses.filter((r) => r.response_status === 'pending').length
  const attendanceRate = total > 0 ? Math.round((attending / total) * 100) : 0

  const cards = [
    { title: '총 대상자', value: total, unit: '명', color: 'text-gray-800' },
    { title: '참석 확정', value: attending, unit: '명', color: 'text-green-600' },
    { title: '미참석', value: notAttending, unit: '명', color: 'text-red-500' },
    { title: '미응답', value: pending, unit: '명', color: 'text-yellow-500' },
    { title: '참석률', value: attendanceRate, unit: '%', color: 'text-blue-600' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-gray-500">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={`text-3xl font-bold ${card.color}`}>{card.value}</span>
            <span className="text-sm text-gray-500 ml-1">{card.unit}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
