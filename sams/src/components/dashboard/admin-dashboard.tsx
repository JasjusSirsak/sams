'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  GraduationCap,
  RefreshCw,
  School,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react'
import { Card, CardLabel, PageHeader, Pill, Spinner, buttonPrimary } from '@/components/ui-kit'
import { getAdminDashboardSummary, type AdminDashboardSummary } from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'
import { Link } from '@/lib/nav'
import { useApp } from '@/lib/app-context'

const STAT_CARDS = [
  { key: 'students', label: 'Total Students', icon: GraduationCap, accent: 'bg-primary-soft text-primary' },
  { key: 'teachers', label: 'Total Teachers', icon: UsersRound, accent: 'bg-info/10 text-info' },
  { key: 'classes', label: 'Total Classes', icon: School, accent: 'bg-warning/15 text-warning' },
  { key: 'parents', label: 'Total Parents', icon: UserRoundPlus, accent: 'bg-success/15 text-success' },
] as const

const QUICK_ACTIONS = [
  {
    label: 'Add Student',
    description: 'Enroll a student in a class',
    href: '/admin/students',
    icon: GraduationCap,
  },
  {
    label: 'Add Teacher',
    description: 'Manage teacher records',
    href: '/admin/teachers',
    icon: UserRoundPlus,
  },
  {
    label: 'Create Class',
    description: 'Set up a class and roster',
    href: '/admin/classes',
    icon: School,
  },
]

function formatAgendaDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function AdminDashboard() {
  const { user } = useApp()
  const displayName = user?.name?.trim().split(/\s+/)[0] || 'Administrator'
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let isActive = true
    setIsLoading(true)
    setError(null)

    getAdminDashboardSummary()
      .then((data) => {
        if (isActive) setSummary(data)
      })
      .catch((loadError: unknown) => {
        if (isActive) setError(parseApiError(loadError).message)
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [revision])

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${displayName}`}
        subtitle="Here's an overview of your school."
        action={
          <Pill className="border border-line bg-surface text-muted">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            Admin dashboard
          </Pill>
        }
      />

      <section aria-label="School statistics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, accent }) => (
          <Card key={label} className="flex items-center gap-4">
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
                {isLoading ? '...' : summary?.stats[key]?.toLocaleString() ?? '—'}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {error ? 'Unable to load count' : 'School-wide overview'}
              </p>
            </div>
          </Card>
        ))}
      </section>

      <section aria-label="Agendas and quick actions" className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardLabel>Recent Agendas</CardLabel>

          {isLoading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
              <Spinner /> Loading agendas...
            </div>
          ) : summary?.recent_agendas.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="px-3 py-3 font-medium">Title</th>
                    <th scope="col" className="px-3 py-3 font-medium">Date</th>
                    <th scope="col" className="px-3 py-3 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {summary.recent_agendas.map((agenda) => (
                    <tr key={agenda.id} className="transition-colors hover:bg-surface-muted/50">
                      <td className="px-3 py-3.5 font-medium text-ink">{agenda.title}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-muted">
                        {formatAgendaDate(agenda.date)}
                      </td>
                      <td className="px-3 py-3.5">
                        <Pill className="bg-primary/10 text-primary">{agenda.type}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted">
              {error ? 'Recent agendas could not be loaded.' : 'No agendas have been created yet.'}
            </p>
          )}
        </Card>

        <Card>
          <CardLabel>Quick Actions</CardLabel>
          <div className="space-y-3">
            {QUICK_ACTIONS.map(({ label, description, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{description}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <CardLabel
          action={
            <Link
              href="/admin/students"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View All <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          Recent Students
        </CardLabel>

        {isLoading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
            <Spinner /> Loading students...
          </div>
        ) : summary?.recent_students.length ? (
          <ul className="divide-y divide-line">
            {summary.recent_students.map((student) => (
              <li key={student.nis} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {student.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{student.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">NIS {student.nis}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted">
            {error ? 'Recent students could not be loaded.' : 'No students have been added yet.'}
          </p>
        )}
      </Card>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-danger/20 bg-danger/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
          <button type="button" onClick={() => setRevision((value) => value + 1)} className={`${buttonPrimary} py-2`}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
