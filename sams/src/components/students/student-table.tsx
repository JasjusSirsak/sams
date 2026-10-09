'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { STUDENTS } from '@/lib/data'
import { cn } from '@/lib/helpers'
import { Avatar, Card, EmptyState, Pill, inputClass } from '@/components/ui-kit'

const PAGE_SIZE = 6

function rateColor(rate: number) {
  if (rate >= 95) return 'bg-success/15 text-success'
  if (rate >= 85) return 'bg-info/15 text-info'
  return 'bg-warning/15 text-warning'
}

export function StudentTable({ showRateOnly = false }: { showRateOnly?: boolean }) {
  const { query, setQuery } = useApp()
  const [gender, setGender] = useState('all')
  const [page, setPage] = useState(0)

  const filtered = STUDENTS.filter(
    (s) => (gender === 'all' || s.gender === gender) && (s.name.toLowerCase().includes(query.toLowerCase()) || s.nis.includes(query)),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

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

      {rows.length === 0 ? (
        <EmptyState title="No students found" text="Try a different name, NIS, or filter." />
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
              {rows.map((s) => (
                <tr key={s.nis}>
                  <td className="py-3">
                    <span className="flex items-center gap-3">
                      <Avatar initials={s.name.split(' ').map((p) => p[0]).join('')} className="size-8 text-xs" />
                      <span className="font-medium text-ink">{s.name}</span>
                    </span>
                  </td>
                  <td className="py-3 text-muted">{s.nis}</td>
                  {!showRateOnly && <td className="py-3 text-ink">{s.cls}</td>}
                  {!showRateOnly && <td className="py-3 text-ink">{s.gender}</td>}
                  <td className="py-3 text-right">
                    <Pill className={rateColor(s.attendance)}>{s.attendance}%</Pill>
                  </td>
                </tr>
              ))}
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
            disabled={current === 0}
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
            disabled={current >= pages - 1}
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
