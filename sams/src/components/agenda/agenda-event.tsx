import { Clock, MapPin } from 'lucide-react'
import type { AgendaCategory, AgendaItem } from '@/lib/data'
import { Pill } from '@/components/ui-kit'

export const CATEGORY_COLOR: Record<AgendaCategory, string> = {
  school: 'var(--success)',
  academic: 'var(--primary)',
  assignment: 'var(--warning)',
  meeting: 'var(--info)',
  exam: 'var(--danger)',
}

export function AgendaEvent({ event }: { event: AgendaItem }) {
  return (
    <li className="flex gap-3 border-l-4 pl-3" style={{ borderColor: CATEGORY_COLOR[event.category] }}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{event.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" /> {event.time}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" /> {event.place}
          </span>
        </p>
      </div>
      <Pill className="h-fit bg-surface-muted text-muted">{event.category}</Pill>
    </li>
  )
}
