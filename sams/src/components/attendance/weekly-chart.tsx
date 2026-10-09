import { WEEKLY_ATTENDANCE, type AttendanceStatus } from '@/lib/data'
import { Card, CardLabel, STATUS_META } from '@/components/ui-kit'

const ORDER: AttendanceStatus[] = ['hadir', 'izin', 'sakit', 'alfa']

export function WeeklyChart({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardLabel action={<span className="text-xs text-muted">XI IPA 2 · this week</span>}>Class attendance</CardLabel>

      <div className="flex h-48 items-end gap-3 sm:gap-6" role="img" aria-label="Stacked weekly attendance chart for XI IPA 2">
        {WEEKLY_ATTENDANCE.map((d) => {
          const total = ORDER.reduce((sum, s) => sum + d[s], 0)
          return (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center gap-2">
              <div
                className="flex w-full max-w-12 flex-1 flex-col-reverse overflow-hidden rounded-lg bg-surface-muted"
                title={ORDER.map((s) => `${STATUS_META[s].label}: ${d[s]}`).join(' · ')}
              >
                {ORDER.map((s) => (
                  <div key={s} style={{ height: `${(d[s] / total) * 100}%`, background: STATUS_META[s].color }} />
                ))}
              </div>
              <span className="text-xs font-medium text-muted">{d.day}</span>
            </div>
          )
        })}
      </div>

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
