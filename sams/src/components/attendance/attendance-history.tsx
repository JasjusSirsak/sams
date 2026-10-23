import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { getAttendance, type AttendanceHistoryRecord } from '@/lib/api'
import { ApprovalBadge, Card, CardLabel, EmptyState, Skeleton, StatusBadge } from '@/components/ui-kit'

export function AttendanceHistory({ studentId }: { studentId?: string }) {
  const [history, setHistory] = useState<AttendanceHistoryRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  function fetchHistory() {
    setLoading(true)
    setError(null)
    getAttendance(studentId)
      .then((res) => {
        setHistory(res?.history || [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'Failed to load attendance history.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchHistory()
  }, [studentId])

  return (
    <Card>
      <CardLabel>Recent history</CardLabel>

      {loading ? (
        <div className="space-y-3 py-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-600">
            <AlertCircle className="size-4" /> {error}
          </p>
          <button
            type="button"
            onClick={fetchHistory}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
          >
            <RefreshCw className="size-3.5" /> Try again
          </button>
        </div>
      ) : history.length === 0 ? (
        <EmptyState title="No attendance yet" text="Attendance records will appear here once submitted." />
      ) : (
        <ul className="divide-y divide-line">
          {history.map((h) => (
            <li key={h.id || h.date} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-24 text-sm font-medium text-ink">{h.date}</span>
              <StatusBadge status={h.status} />
              {h.status !== 'present' && <ApprovalBadge approval={h.approval} />}
              {h.note && <span className="text-sm text-muted">{h.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

