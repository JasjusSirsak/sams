import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { getAttendance, type AttendanceRecapData } from '@/lib/api'
import type { AttendanceStatus } from '@/lib/data'
import { Card, CardLabel, Skeleton, STATUS_META } from '@/components/ui-kit'

const ORDER: AttendanceStatus[] = ['present', 'permitted', 'sick', 'absent']

export function AttendanceRecap({ studentId }: { studentId?: string }) {
  const [recap, setRecap] = useState<AttendanceRecapData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  function fetchRecap() {
    setLoading(true)
    setError(null)
    getAttendance(studentId)
      .then((res) => {
        setRecap(res?.recap || { present: 0, permitted: 0, sick: 0, absent: 0 })
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'Failed to load attendance recap.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchRecap()
  }, [studentId])

  const total = recap ? ORDER.reduce((sum, s) => sum + (recap[s] || 0), 0) : 0
  const rate = total > 0 && recap ? Math.round(((recap.present || 0) / total) * 100) : 0

  let start = 0
  const stops = recap && total > 0
    ? ORDER.map((s) => {
        const end = start + ((recap[s] || 0) / total) * 100
        const stop = `${STATUS_META[s].color} ${start}% ${end}%`
        start = end
        return stop
      }).join(', ')
    : 'var(--line) 0% 100%'

  return (
    <Card>
      <CardLabel>Attendance recap</CardLabel>

      {loading ? (
        <div className="flex items-center gap-5">
          <Skeleton className="size-28 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-600">
            <AlertCircle className="size-4" /> {error}
          </p>
          <button
            type="button"
            onClick={fetchRecap}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
          >
            <RefreshCw className="size-3.5" /> Try again
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-5">
            <div
              className="relative size-28 shrink-0 rounded-full"
              style={{ background: `conic-gradient(${stops})` }}
              role="img"
              aria-label={`Attendance rate ${rate} percent`}
            >
              <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-surface">
                <span className="text-xl font-bold text-ink">{rate}%</span>
                <span className="text-xs text-muted">present</span>
              </div>
            </div>
            <ul className="flex-1 space-y-2">
              {ORDER.map((s) => (
                <li key={s} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink">
                    <span className="size-2.5 rounded-full" style={{ background: STATUS_META[s].color }} aria-hidden="true" />
                    {STATUS_META[s].label}
                  </span>
                  <span className="font-semibold text-ink">{recap ? recap[s] || 0 : 0}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs text-muted">Semester 1 · {total} school days recorded</p>
        </>
      )}
    </Card>
  )
}

