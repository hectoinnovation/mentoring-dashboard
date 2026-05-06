import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ParticipantResponse, ResponseStatus, Priority } from '@/lib/supabase'

interface Props {
  responses: ParticipantResponse[]
}

function StatusBadge({ status }: { status: ResponseStatus }) {
  const map = {
    attending: { label: '참석', variant: 'default' as const, className: 'bg-green-100 text-green-700 hover:bg-green-100' },
    not_attending: { label: '미참석', variant: 'destructive' as const, className: '' },
    pending: { label: '미응답', variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  }
  const { label, variant, className } = map[status]
  return <Badge variant={variant} className={className}>{label}</Badge>
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const map = {
    high: { label: '필수', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
    normal: { label: '일반', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
    low: { label: '참고', className: 'bg-blue-100 text-blue-600 hover:bg-blue-100' },
  }
  const { label, className } = map[priority]
  return <Badge variant="secondary" className={className}>{label}</Badge>
}

export default function ParticipantList({ responses }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">참석 대상자 목록</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>부서</TableHead>
            <TableHead>이메일</TableHead>
            <TableHead className="text-center">우선순위</TableHead>
            <TableHead className="text-center">응답 상태</TableHead>
            <TableHead className="text-center">응답 시각</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {responses.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>{r.department_name}</TableCell>
              <TableCell className="text-gray-500">{r.email}</TableCell>
              <TableCell className="text-center">
                <PriorityBadge priority={r.priority} />
              </TableCell>
              <TableCell className="text-center">
                <StatusBadge status={r.response_status} />
              </TableCell>
              <TableCell className="text-center text-gray-400 text-sm">
                {r.responded_at
                  ? new Date(r.responded_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
