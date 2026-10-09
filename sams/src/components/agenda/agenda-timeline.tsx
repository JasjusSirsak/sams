'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-context'
import { AGENDA, TODAY, type AgendaCategory } from '@/lib/data'
import { cn, formatLong, fromKey, toKey } from '@/lib/helpers'
import { Card, EmptyState } from '@/components/ui-kit'
import { AgendaEvent, CATEGORY_COLOR } from './agenda-event'

const CATEGORIES = Object.keys(CATEGORY_COLOR) as AgendaCategory[]

export function AgendaTimeline() {
  const { query } = useApp()
  const [category, setCategory] = useState<AgendaCategory | 'all'>('all')
  const todayKey = toKey(TODAY)

  const items = AGENDA.filter((a) => a.date >= todayKey)
    .filter((a) => category === 'all' || a.category === category)
    .filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))

  const dates = [...new Set(items.map((a) => a.date))]

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

      {dates.length === 0 ? (
        <EmptyState title="No activities found" text="Try another category or clear the search box." />
      ) : (
        dates.map((date) => (
          <Card key={date}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              {date === todayKey && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Today</span>}
              {formatLong(fromKey(date))}
            </h2>
            <ul className="space-y-4">
              {items
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
