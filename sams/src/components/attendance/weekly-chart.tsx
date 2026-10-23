import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { getTeacherWeeklyAttendance, type TeacherWeeklyAttendanceDay } from '@/lib/api'
import type { AttendanceStatus } from '@/lib/data'
import { Card, CardLabel, Skeleton, STATUS_META } from '@/components/ui-kit'

const ORDER: AttendanceStatus[] = ['present', 'permitted', 'sick', 'absent']

export function WeeklyChart({
  className,
  classLabel,
  weeklyData,
  isLoading,
}: {
  className?: string
  classLabel?: string
  weeklyData?: TeacherWeeklyAttendanceDay[]
  isLoading?: boolean
}) {
  const [weekly, setWeekly] = useState<TeacherWeeklyAttendanceDay[]>([])
  const [classNameLabel, setClassNameLabel] = useState<string>('Classes')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  function fetchWeekly() {
    setLoading(true)
    setError(null)
    getTeacherWeeklyAttendance()
      .then((res) => {
        setWeekly(res.weekly)
        setClassNameLabel(res.class_name)
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load weekly attendance.')
        setLoading(false)
      })
  }

  useEffect(() => {
    if (weeklyData !== undefined) return
    void Promise.resolve().then(fetchWeekly)
  }, [weeklyData])

  const displayedWeekly = weeklyData ?? weekly
  const displayedClassName = classLabel ?? classNameLabel
  const displayedLoading = weeklyData === undefined ? loading : (isLoading ?? false)
  const totalAllWeek = displayedWeekly.reduce((acc, d) => acc + d.present + d.permitted + d.sick + d.absent, 0)

  return (
    <Card className={className}>
      <CardLabel action={<span className="text-xs text-muted">{displayedClassName} · this week</span>}>
        Class attendance
      </CardLabel>

      {displayedLoading ? (
        <div className="flex h-48 items-end gap-3 sm:gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center gap-2">
              <Skeleton className="w-full max-w-12 flex-1 rounded-lg" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="flex items-center justify-center gap-2 text-sm text-red-600 font-medium">
            <AlertCircle className="size-4" /> {error}
          </p>
          <button
            type="button"
            onClick={fetchWeekly}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
          >
            <RefreshCw className="size-3.5" /> Try again
          </button>
        </div>
      ) : totalAllWeek === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center bg-surface-muted rounded-xl p-4">
          <p className="text-sm font-semibold text-ink">No attendance logged this week</p>
          <p className="text-xs text-muted mt-1 max-w-xs">
            Attendance entries recorded for your classes will appear in this stacked chart.
          </p>
        </div>
      ) : (
        <div className="flex h-48 items-end gap-3 sm:gap-6" role="img" aria-label={`Stacked weekly attendance chart for ${displayedClassName}`}>
          {displayedWeekly.map((d) => {
            const total = ORDER.reduce((sum, s) => sum + (d[s] || 0), 0)
            return (
              <div key={d.day} className="flex h-full flex-1 flex-col items-center gap-2">
                <div
                  className="flex w-full max-w-12 flex-1 flex-col-reverse overflow-hidden rounded-lg bg-surface-muted"
                  title={ORDER.map((s) => `${STATUS_META[s].label}: ${d[s] || 0}`).join(' · ')}
                >
                  {ORDER.map((s) => {
                    const count = d[s] || 0
                    const heightPercent = total > 0 ? (count / total) * 100 : 0
                    return (
                      <div key={s} style={{ height: `${heightPercent}%`, background: STATUS_META[s].color }} />
                    )
                  })}
                </div>
                <span className="text-xs font-medium text-muted">{d.day}</span>
              </div>
            )
          })}
        </div>
      )}

      <ul className="mt-4 flex flex-wrap gap-4">
        {ORDER.map((s) => (
          <li key={s} className="flex items-center gap-2 text-xs text-muted">
            <span className="size-2.5 rounded-full" style={{ background: STATUS_META[s].color }} aria-hidden="true" />
            {STATUS_META[s].label}
          </li>
        ))}
      </ul>
    </Card>
  )
}
