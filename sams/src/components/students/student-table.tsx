'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { getStudents, type Student } from '@/lib/api'
import { cn } from '@/lib/helpers'
import { Avatar, Card, EmptyState, Pill, Spinner, buttonSecondary, inputClass } from '@/components/ui-kit'

const PAGE_SIZE = 6

function rateColor(rate: number) {
  if (rate >= 95) return 'bg-success/15 text-success'
  if (rate >= 85) return 'bg-info/15 text-info'
  return 'bg-warning/15 text-warning'
}

type StudentItem = Student & {
  gender?: string | null
  attendance?: number | null
}

export function StudentTable({ showRateOnly = false }: { showRateOnly?: boolean }) {
  const { query, setQuery } = useApp()
  const [students, setStudents] = useState<StudentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gender, setGender] = useState('all')
  const [page, setPage] = useState(0)

  const handleRetry = () => {
    setIsLoading(true)
    setError(null)
    getStudents()
      .then((data) => {
        setStudents(Array.isArray(data) ? (data as StudentItem[]) : [])
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err?.message || 'Failed to fetch student data')
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true

    getStudents()
      .then((data) => {
        if (isMounted) {
          setStudents(Array.isArray(data) ? (data as StudentItem[]) : [])
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch student data')
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = students.filter((s) => {
    const nameMatch = !q || (s.name ? s.name.toLowerCase().includes(q) : false)
    const nisMatch = !q || (s.nis ? s.nis.includes(query) : false)
    const searchMatch = nameMatch || nisMatch

    // Safely check gender filter without misrepresenting missing data
    const genderMatch = gender === 'all' || (Boolean(s.gender) && s.gender === gender)

    return searchMatch && genderMatch
  })

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  const emptyText =
    gender !== 'all' && students.length > 0 && students.every((s) => !s.gender)
      ? 'Gender data is not available in the database yet.'
      : 'Try a different name, NIS, or filter.'

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="student-search" className="sr-only">
          Search students
        </label>
        <input
          id="student-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="Search by name or NIS"
          className={cn(inputClass, 'sm:max-w-xs')}
        />
        {!showRateOnly && (
          <>
            <label htmlFor="gender" className="sr-only">
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => {
                setGender(e.target.value)
                setPage(0)
              }}
              className={cn(inputClass, 'sm:w-40')}
            >
              <option value="all">All genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted">
          <Spinner />
          <p className="mt-2 text-sm">Loading students...</p>
        </div>
      ) : error ? (
        <EmptyState
          title="Failed to load students"
          text={error}
          action={
            <button type="button" onClick={handleRetry} className={buttonSecondary}>
              Try again
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No students found" text={emptyText} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-3 font-medium">Student</th>
                <th className="py-3 font-medium">NIS</th>
                {!showRateOnly && <th className="py-3 font-medium">Class</th>}
                {!showRateOnly && <th className="py-3 font-medium">Gender</th>}
                <th className="py-3 text-right font-medium">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => {
                const name = s.name?.trim() || 'Unnamed'
                const initials = s.name?.trim()
                  ? s.name
                      .trim()
                      .split(/\s+/)
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : '—'
                const nis = s.nis || '—'
                const className = s.enrollments?.[0]?.class_name || '—'
                const studentGender = s.gender || '—'

                return (
                  <tr key={s.student_id || s.nis || name}>
                    <td className="py-3">
                      <span className="flex items-center gap-3">
                        <Avatar initials={initials} className="size-8 text-xs" />
                        <span className="font-medium text-ink">{name}</span>
                      </span>
                    </td>
                    <td className="py-3 text-muted">{nis}</td>
                    {!showRateOnly && <td className="py-3 text-ink">{className}</td>}
                    {!showRateOnly && <td className="py-3 text-ink">{studentGender}</td>}
                    <td className="py-3 text-right">
                      {s.attendance != null ? (
                        <Pill className={rateColor(s.attendance)}>{s.attendance}%</Pill>
                      ) : (
                        <span className="font-medium text-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>
          {filtered.length} student{filtered.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0 || isLoading}
            aria-label="Previous page"
            className="rounded-lg border border-line p-1.5 text-ink disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pages - 1 || isLoading}
            aria-label="Next page"
            className="rounded-lg border border-line p-1.5 text-ink disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </nav>
    </Card>
  )
}
