'use client'

import { useApp } from '@/lib/app-context'
import { CHILDREN } from '@/lib/data'
import { cn } from '@/lib/helpers'
import { Avatar } from '@/components/ui-kit'

export function ChildSelector() {
  const { childId, setChildId } = useApp()

  return (
    <div role="radiogroup" aria-label="Select child" className="mb-6 grid gap-3 sm:grid-cols-2">
      {CHILDREN.map((c) => {
        const active = c.id === childId
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setChildId(c.id)}
            className={cn(
              'flex items-center gap-3 rounded-2xl border-2 bg-surface p-4 text-left transition',
              active ? 'border-primary shadow-sm' : 'border-line hover:border-primary/40',
            )}
          >
            <Avatar initials={c.initials} />
            <div className="flex-1">
              <p className="font-semibold text-ink">{c.name}</p>
              <p className="text-xs text-muted">
                {c.cls} · NIS {c.nis}
              </p>
            </div>
            {active && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">Viewing</span>}
          </button>
        )
      })}
    </div>
  )
}
