import { ATTENDANCE_RECAP, type AttendanceStatus } from '@/lib/data'
import { Card, CardLabel, STATUS_META } from '@/components/ui-kit'

const ORDER: AttendanceStatus[] = ['hadir', 'izin', 'sakit', 'alfa']

export function AttendanceRecap({ studentId }: { studentId: string }) {
  const recap = ATTENDANCE_RECAP[studentId]
  const total = ORDER.reduce((sum, s) => sum + recap[s], 0)
  const rate = Math.round((recap.hadir / total) * 100)

  let start = 0
  const stops = ORDER.map((s) => {
    const end = start + (recap[s] / total) * 100
    const stop = `${STATUS_META[s].color} ${start}% ${end}%`
    start = end
    return stop
  }).join(', ')

  return (
    <Card>
      <CardLabel>Attendance recap</CardLabel>
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
              <span className="font-semibold text-ink">{recap[s]}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-muted">Semester 1 · {total} school days so far</p>
    </Card>
  )
}
