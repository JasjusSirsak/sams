'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { getSharedAgenda, type DatedSharedAgendaItems } from '@/lib/api'
import type { AgendaCategory, AgendaItem } from '@/lib/data'
import { cn, formatLong, fromKey } from '@/lib/helpers'
import { Card, EmptyState, Skeleton } from '@/components/ui-kit'
import { AgendaEvent, CATEGORY_COLOR } from './agenda-event'

const CATEGORIES = Object.keys(CATEGORY_COLOR) as AgendaCategory[]

function jakartaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function agendaCategory(label: string, source: 'agenda' | 'schedule'): AgendaCategory {
  if (source === 'schedule') return 'academic'
  switch (label.toLowerCase()) {
    case 'academic':
      return 'academic'
    case 'assignment':
      return 'assignment'
    case 'meeting':
      return 'meeting'
    case 'exam':
      return 'exam'
    default:
      return 'school'
  }
}

function toAgendaItems(groups: DatedSharedAgendaItems[]): (AgendaItem & { displayLabel?: string })[] {
  return groups.flatMap(({ date, items }) =>
    items.map((item) => ({
      id: item.id,
      date,
      time: item.startTime
        ? item.endTime
          ? `${item.startTime} - ${item.endTime}`
          : item.startTime
        : 'All day',
      title: item.title,
      place: item.location ?? item.className ?? '',
      category: agendaCategory(item.label, item.source),
      displayLabel: item.label,
    })),
  )
}

export function AgendaTimeline() {
  const { query, role, childId } = useApp()
  const [category, setCategory] = useState<AgendaCategory | 'all'>('all')
  const [todayKey] = useState(() => jakartaDateKey(new Date()))
  const [items, setItems] = useState<(AgendaItem & { displayLabel?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    let active = true
    if (role === 'parent' && !childId) {
      Promise.resolve().then(() => {
        if (!active) return
        setItems([])
        setLoading(false)
        setError(null)
      })
      return () => { active = false }
    }

    Promise.resolve()
      .then(() => {
        if (!active) return
        setLoading(true)
        setError(null)
        return getSharedAgenda({
          from: todayKey,
          to: addDays(todayKey, 30),
          ...(role === 'parent' ? { studentId: childId } : {}),
        })
      })
      .then((result) => {
        if (!active || !result) return
        if (!Array.isArray(result) || !result.every((group) => Array.isArray(group.items))) {
          throw new Error('The agenda response has an unexpected format.')
        }
        setItems(toAgendaItems(result))
        setLoading(false)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setError(requestError instanceof Error ? requestError.message : 'Failed to load agenda.')
        setLoading(false)
      })

    return () => { active = false }
  }, [childId, requestVersion, role, todayKey])

  const filteredItems = items.filter((a) => a.date >= todayKey)
    .filter((a) => category === 'all' || a.category === category)
    .filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))

  const dates = [...new Set(filteredItems.map((a) => a.date))]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {(['all', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition',
              category === c ? 'border-primary bg-primary text-primary-foreground' : 'border-line bg-surface text-ink hover:bg-surface-muted',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4" aria-label="Loading agenda">
          {[1, 2, 3].map((item) => (
            <Card key={item}>
              <Skeleton className="mb-4 h-5 w-48" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-600">
            <AlertCircle className="size-4" /> {error}
          </p>
          <button
            type="button"
            onClick={() => setRequestVersion((version) => version + 1)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
          >
            <RefreshCw className="size-3.5" /> Try again
          </button>
        </div>
      ) : dates.length === 0 ? (
        <EmptyState title="No activities found" text="Try another category or clear the search box." />
      ) : (
        dates.map((date) => (
          <Card key={date}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              {date === todayKey && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Today</span>}
              {formatLong(fromKey(date))}
            </h2>
            <ul className="space-y-4">
              {filteredItems
                .filter((a) => a.date === date)
                .map((a) => (
                  <AgendaEvent key={a.id} event={a} />
                ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}
