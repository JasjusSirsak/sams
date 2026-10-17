import { useEffect, useState } from 'react'
import { Link } from '@/lib/nav'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { getTeacherClasses, type TeacherClassItem } from '@/lib/api'
import { Card, CardLabel, EmptyState, ProgressBar, Skeleton } from '@/components/ui-kit'

export function MyClasses() {
  const [classes, setClasses] = useState<TeacherClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function fetchClasses() {
    setLoading(true)
    setError(null)
    getTeacherClasses()
      .then((data) => {
        setClasses(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load assigned classes.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchClasses()
  }, [])

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

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-line p-4 space-y-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2 w-full mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm text-red-600 font-medium">
            <AlertCircle className="size-4" /> {error}
          </p>
          <button
            type="button"
            onClick={fetchClasses}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
          >
            <RefreshCw className="size-3.5" /> Try again
          </button>
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          title="No classes assigned"
          text="You have not been assigned to teach any classes in the current academic period."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
{classes.map((c) => (
  <li key={c.assignment_id} className="rounded-xl border border-line p-4">
    <p className="text-lg font-bold text-ink">{c.name}</p>
    <p className="text-xs text-muted">
      {c.subject} · {c.academic_year} (Sem {c.semester})
    </p>
    <p className="text-xs text-muted mt-0.5">{c.students} students</p>
    <div className="mb-1 mt-4 flex justify-between text-xs">
      <span className="text-muted">Grading progress</span>
      <span className="font-semibold text-ink">{c.progress}%</span>
    </div>
    <ProgressBar value={c.progress} label={`${c.name} grading progress`} />
  </li>
))}
        </ul>
      )}
    </Card>
  )
}

