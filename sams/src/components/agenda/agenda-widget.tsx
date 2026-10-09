'use client'

import { useState } from 'react'
import { AGENDA, TODAY } from '@/lib/data'
import { addDays, cn, formatShort, fromKey, shortDay, toKey } from '@/lib/helpers'
import { Card, CardLabel } from '@/components/ui-kit'
import { AgendaEvent } from './agenda-event'

const WEEK = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i - 1))

export function AgendaWidget({ className }: { className?: string }) {
  const [selected, setSelected] = useState(toKey(TODAY))
  const events = AGENDA.filter((a) => a.date === selected)
  const isToday = selected === toKey(TODAY)

  return (
    <Card className={className}>
      <CardLabel>Agenda</CardLabel>
      <div className="mb-5 grid grid-cols-7 gap-1.5" role="group" aria-label="Choose a day">
        {WEEK.map((d) => {
          const key = toKey(d)
          const active = key === selected
          const hasEvents = AGENDA.some((a) => a.date === key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              aria-pressed={active}
              aria-label={formatShort(d)}
              className={cn(
                'flex flex-col items-center rounded-2xl py-2 transition',
                active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-surface-muted text-ink hover:bg-primary-soft',
              )}
            >
              <span className={cn('text-xs', active ? 'opacity-90' : 'text-muted')}>{shortDay(d)}</span>
              <span className="text-lg font-semibold">{d.getDate()}</span>
              <span
                className={cn('mt-0.5 size-1 rounded-full', hasEvents ? (active ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent')}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      <p className="mb-3 text-sm font-medium text-primary">{isToday ? 'Today' : formatShort(fromKey(selected))}</p>
      {events.length === 0 ? (
        <p className="rounded-xl bg-surface-muted p-4 text-sm text-muted">No activities on this day.</p>
      ) : (
        <ul className="space-y-4">
          {events.map((e) => (
            <AgendaEvent key={e.id} event={e} />
          ))}
        </ul>
      )}
    </Card>
  )
}
