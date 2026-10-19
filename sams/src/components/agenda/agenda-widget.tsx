import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react'
import { getSharedAgenda } from '@/lib/api'
import type { AgendaCategory, AgendaItem } from '@/lib/data'
import { useApp } from '@/lib/app-context'
import { cn, formatShort, fromKey, shortDay, toKey } from '@/lib/helpers'
import { Card, CardLabel, Skeleton } from '@/components/ui-kit'
import { AgendaEvent } from './agenda-event'

function getAgendaCategory(label: string, source: 'agenda' | 'schedule'): AgendaCategory {
  if (source === 'schedule') return 'academic'

  switch (label) {
    case 'school':
    case 'academic':
    case 'assignment':
    case 'meeting':
    case 'exam':
      return label
    default:
      return 'school'
  }
}

export function AgendaWidget({ className }: { className?: string }) {
  const { role, childId } = useApp()
  // Real-time actual date as today anchor
  const [todayDate] = useState(() => new Date())
  // Currently focused date for 7-day strip
  const [baseDate, setBaseDate] = useState<Date>(() => new Date())
  const [selectedKey, setSelectedKey] = useState<string>(() => toKey(new Date()))

  const [agendas, setAgendas] = useState<(AgendaItem & { displayLabel?: string })[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)

  // Generate 7 days centered on baseDate (-3 to +3)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseDate)
    d.setDate(baseDate.getDate() + (i - 3))
    return d
  })

  const dateRangeKey = weekDays.map(toKey).join(',')

  useEffect(() => {
    let isActive = true

    if (role === 'parent' && !childId) {
      Promise.resolve().then(() => {
        if (!isActive) return
        setAgendas([])
        setLoading(false)
        setError(null)
      })
      return () => {
        isActive = false
      }
    }

    const dates = dateRangeKey.split(',')
    Promise.resolve()
      .then(() => {
        if (!isActive) return null
        setLoading(true)
        setError(null)
        return Promise.all(
          dates.map((date) =>
            getSharedAgenda({
              date,
              ...(role === 'parent' ? { studentId: childId } : {}),
            }),
          ),
        )
      })
      .then((results) => {
        if (!isActive || !results) return
        setAgendas(
          results.flatMap((items, index) =>
            items.map((item) => {
              return {
                id: item.id,
                date: dates[index],
                time: item.startTime
                  ? item.endTime
                    ? `${item.startTime} - ${item.endTime}`
                    : item.startTime
                  : 'All day',
                title: item.title,
                place: item.location ?? '',
                category: getAgendaCategory(item.label, item.source),
                displayLabel: item.label,
              }
            }),
          ),
        )
        setLoading(false)
      })
      .catch((err) => {
        if (!isActive) return
        setError(err?.message || 'Failed to load agendas.')
        setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [childId, dateRangeKey, requestVersion, role])

  // Filter events for selected date
  const eventsForSelected = agendas.filter((a) => a.date === selectedKey)
  const isActualToday = selectedKey === toKey(todayDate)

  // Navigation handlers
  function navigateDays(offset: number) {
    const next = new Date(baseDate)
    next.setDate(baseDate.getDate() + offset)
    setBaseDate(next)
    setSelectedKey(toKey(next))
  }

  function resetToToday() {
    const now = new Date()
    setBaseDate(now)
    setSelectedKey(toKey(now))
  }

  const currentMonthLabel = baseDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })

  return (
    <Card className={className}>
      <CardLabel
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigateDays(-7)}
              title="Previous week"
              aria-label="Previous week"
              className="p-1 rounded-lg text-muted hover:text-ink hover:bg-surface-muted transition"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={resetToToday}
              className="text-xs font-semibold px-2 py-0.5 rounded text-primary hover:bg-primary-soft transition"
              title="Jump to today"
            >
              {currentMonthLabel}
            </button>
            <button
              type="button"
              onClick={() => navigateDays(7)}
              title="Next week"
              aria-label="Next week"
              className="p-1 rounded-lg text-muted hover:text-ink hover:bg-surface-muted transition"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
      >
        Agenda
      </CardLabel>

      <div className="mb-5 grid grid-cols-7 gap-1.5" role="group" aria-label="Choose a day">
        {weekDays.map((d) => {
          const key = toKey(d)
          const active = key === selectedKey
          const isTodayPill = key === toKey(todayDate)
          const hasEvents = agendas.some((a) => a.date === key)

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              aria-pressed={active}
              aria-label={formatShort(d)}
              className={cn(
                'flex flex-col items-center rounded-2xl py-2 transition relative',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-surface-muted text-ink hover:bg-primary-soft',
                isTodayPill && !active && 'ring-2 ring-primary/40'
              )}
            >
              <span className={cn('text-[11px]', active ? 'opacity-90' : 'text-muted')}>{shortDay(d)}</span>
              <span className="text-base font-semibold leading-tight">{d.getDate()}</span>
              <span
                className={cn(
                  'mt-0.5 size-1 rounded-full',
                  hasEvents ? (active ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent'
                )}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-primary">
          {isActualToday ? 'Today · ' : ''}
          {formatShort(fromKey(selectedKey))}
        </p>
        {eventsForSelected.length > 0 && (
          <span className="text-xs text-muted font-medium">
            {eventsForSelected.length} {eventsForSelected.length === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs text-red-600 font-medium">
            <AlertCircle className="size-3.5" /> {error}
          </p>
          <button
            type="button"
            onClick={() => setRequestVersion((version) => version + 1)}
            className="mt-2 inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
          >
            <RefreshCw className="size-3" /> Retry
          </button>
        </div>
      ) : eventsForSelected.length === 0 ? (
        <p className="rounded-xl bg-surface-muted p-4 text-sm text-muted text-center">
          No activities scheduled on this day.
        </p>
      ) : (
        <ul className="space-y-3">
          {eventsForSelected.map((e) => (
            <AgendaEvent key={e.id} event={e} />
          ))}
        </ul>
      )}
    </Card>
  )
}
