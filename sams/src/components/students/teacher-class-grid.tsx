'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Users } from 'lucide-react'
import { Card, EmptyState, Pill, Spinner } from '@/components/ui-kit'
import { Link } from '@/lib/nav'
import { getTeacherDashboardSummary, type TeacherDashboardSummary } from '@/lib/api'

type TeacherClass = {
  id: string
  name: string
  grade: number
  studentsCount: number
}

function ClassCards({ classes }: { classes: TeacherClass[] }) {
  if (classes.length === 0) {
    return <EmptyState title="No classes available" text="There are no classes assigned to you yet." />
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {classes.map((classItem) => (
        <Link
          key={classItem.id}
          href="/attendance"
          className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`View ${classItem.name}`}
        >
          <Card className="flex h-full flex-col gap-5 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-md">
            <div>
              <Pill className="border border-primary/20 bg-primary/10 font-semibold text-primary">
                Grade {classItem.grade}
              </Pill>
              <h3 className="mt-3 text-lg font-bold tracking-tight text-ink transition-colors group-hover:text-primary">
                {classItem.name}
              </h3>
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <Users className="size-4 text-primary" aria-hidden="true" />
                {classItem.studentsCount} students
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                View Class
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}

export function TeacherClassGrid() {
  const [summary, setSummary] = useState<TeacherDashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    getTeacherDashboardSummary()
      .then((result) => {
        if (!active) return
        setSummary(result)
        setIsLoading(false)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setError(requestError instanceof Error ? requestError.message : 'Failed to load your classes.')
        setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [revision])

  if (isLoading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
        <Spinner /> Loading your classes...
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 p-5 text-center">
        <p className="text-sm font-medium text-danger">{error}</p>
        <button
          type="button"
          onClick={() => {
            setIsLoading(true)
            setError(null)
            setRevision((value) => value + 1)
          }}
          className="mt-3 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/15"
        >
          Try again
        </button>
      </div>
    )
  }

  const homeroomClass = summary?.homeroom_class
  const homeroomClasses: TeacherClass[] = homeroomClass
    ? [{
        id: homeroomClass.class_id,
        name: homeroomClass.name,
        grade: homeroomClass.grade_level,
        studentsCount: homeroomClass.student_count,
      }]
    : []
  const teachingClasses: TeacherClass[] = (summary?.classes ?? [])
    .filter((classItem) => classItem.class_id !== homeroomClass?.class_id)
    .map((classItem) => ({
      id: classItem.class_id,
      name: classItem.name,
      grade: classItem.grade_level,
      studentsCount: classItem.student_count,
    }))

  return (
    <div className="space-y-8">
      <section aria-labelledby="homeroom-classes-heading" className="space-y-4">
        <h2 id="homeroom-classes-heading" className="text-lg font-bold tracking-tight text-ink">
          Your Class
        </h2>
        <ClassCards classes={homeroomClasses} />
      </section>

      <section aria-labelledby="teaching-classes-heading" className="space-y-4">
        <h2 id="teaching-classes-heading" className="text-lg font-bold tracking-tight text-ink">
          Classes You Teach
        </h2>
        <ClassCards classes={teachingClasses} />
      </section>
    </div>
  )
}
