import { ATTENDANCE_HISTORY } from '@/lib/data'
import { ApprovalBadge, Card, CardLabel, EmptyState, StatusBadge } from '@/components/ui-kit'

export function AttendanceHistory({ studentId }: { studentId: string }) {
  const history = ATTENDANCE_HISTORY[studentId] ?? []

  return (
    <Card>
      <CardLabel>Recent history</CardLabel>
      {history.length === 0 ? (
        <EmptyState title="No attendance yet" text="Attendance records will appear here once submitted." />
      ) : (
        <ul className="divide-y divide-line">
          {history.map((h) => (
            <li key={h.date} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-24 text-sm font-medium text-ink">{h.date}</span>
              <StatusBadge status={h.status} />
              {h.status !== 'hadir' && <ApprovalBadge approval={h.approval} />}
              {h.note && <span className="text-sm text-muted">{h.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
