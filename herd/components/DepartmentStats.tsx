import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DepartmentStat } from '@/lib/supabase'

interface Props {
  stats: DepartmentStat[]
}

export default function DepartmentStats({ stats }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">부서별 참석 현황</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>부서</TableHead>
            <TableHead className="text-center">대상자</TableHead>
            <TableHead className="text-center text-green-600">참석</TableHead>
            <TableHead className="text-center text-red-500">미참석</TableHead>
            <TableHead className="text-center text-yellow-500">미응답</TableHead>
            <TableHead className="text-center text-blue-600">참석률</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((row) => {
            const rate = row.total > 0 ? Math.round((row.attending / row.total) * 100) : 0
            return (
              <TableRow key={row.department_name}>
                <TableCell className="font-medium">{row.department_name}</TableCell>
                <TableCell className="text-center">{row.total}</TableCell>
                <TableCell className="text-center text-green-600 font-medium">{row.attending}</TableCell>
                <TableCell className="text-center text-red-500 font-medium">{row.not_attending}</TableCell>
                <TableCell className="text-center text-yellow-500 font-medium">{row.pending}</TableCell>
                <TableCell className="text-center text-blue-600 font-medium">{rate}%</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
