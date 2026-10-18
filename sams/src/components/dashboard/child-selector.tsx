'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { getParentChildren, type ParentChild } from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'
import { useApp } from '@/lib/app-context'
import { cn } from '@/lib/helpers'
import { Avatar, Card, CardLabel, EmptyState, Skeleton, buttonSecondary } from '@/components/ui-kit'

export function ChildSelector() {
  const { childId, setChildId } = useApp()
  const [children, setChildren] = useState<ParentChild[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let isActive = true

    getParentChildren()
      .then((result) => {
        if (!isActive) return
        setChildren(result)
        setError(null)
        setChildId((currentId) =>
          result.some((child) => child.id === currentId) ? currentId : result[0]?.id ?? '',
        )
      })
      .catch((requestError: unknown) => {
        if (isActive) setError(parseApiError(requestError).message || 'Failed to load children.')
      })
      .finally(() => {
        if (isActive) setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [revision, setChildId])

  return (
    <Card className="mb-6">
      <CardLabel>Select child</CardLabel>

      {loading ? (
        <div role="status" aria-label="Loading children..." className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-600">
            <AlertCircle className="size-4" aria-hidden="true" /> {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setRevision((value) => value + 1)
            }}
            className={`${buttonSecondary} mt-3 py-1.5`}
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Try again
          </button>
        </div>
      ) : children.length === 0 ? (
        <EmptyState title="No children found" text="No students are linked to this parent account." />
      ) : (
        <div role="radiogroup" aria-label="Select child" className="grid gap-3 sm:grid-cols-2">
          {children.map((child) => {
            const active = child.id === childId
            return (
              <button
                key={child.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChildId(child.id)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border-2 bg-surface p-4 text-left transition',
                  active ? 'border-primary shadow-sm' : 'border-line hover:border-primary/40',
                )}
              >
                <Avatar initials={child.avatar || child.initials} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{child.name}</span>
                  <span className="block text-xs text-muted">
                    {child.className} · NIS {child.nis}
                  </span>
                </span>
                {active && (
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                    Viewing
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}
