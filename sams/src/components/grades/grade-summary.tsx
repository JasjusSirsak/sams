import { Link } from '@/lib/nav'
import { SUBJECT_GRADES } from '@/lib/data'
import { average, finalScore } from '@/lib/helpers'
import { Card, CardLabel, Pill, ProgressBar } from '@/components/ui-kit'

export function GradeSummary({ studentId }: { studentId: string }) {
  const subjects = SUBJECT_GRADES[studentId].map((s) => ({ ...s, score: finalScore(s) ?? 0 }))
  const avg = average(subjects.map((s) => s.score))

  return (
    <Card>
      <CardLabel action={<Pill className="bg-primary-soft text-primary">Avg {avg}</Pill>}>Grade summary · Semester 1</CardLabel>
      <ul className="space-y-3">
        {subjects.slice(0, 4).map((s) => (
          <li key={s.subject}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-ink">{s.subject}</span>
              <span className="font-semibold text-ink">{s.score}</span>
            </div>
            <ProgressBar value={s.score} label={`${s.subject} score`} />
          </li>
        ))}
      </ul>
      <Link href="/grades" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        See all subjects
      </Link>
    </Card>
  )
}
