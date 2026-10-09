import { Link } from '@/lib/nav'
import { TEACHER_CLASSES } from '@/lib/data'
import { Card, CardLabel, ProgressBar } from '@/components/ui-kit'

export function MyClasses() {
  return (
    <Card>
      <CardLabel
        action={
          <Link href="/grades" className="text-sm font-medium text-primary hover:underline">
            Enter grades
          </Link>
        }
      >
        My classes
      </CardLabel>
      <ul className="grid gap-3 sm:grid-cols-3">
        {TEACHER_CLASSES.map((c) => (
          <li key={c.id} className="rounded-xl border border-line p-4">
            <p className="text-lg font-bold text-ink">{c.name}</p>
            <p className="text-xs text-muted">
              {c.subject} · {c.schedule}
            </p>
            <p className="text-xs text-muted">{c.students} students</p>
            <div className="mb-1 mt-4 flex justify-between text-xs">
              <span className="text-muted">Grading progress</span>
              <span className="font-semibold text-ink">{c.progress}%</span>
            </div>
            <ProgressBar value={c.progress} label={`${c.name} grading progress`} />
          </li>
        ))}
      </ul>
    </Card>
  )
}
