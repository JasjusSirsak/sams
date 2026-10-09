'use client'

import { useState } from 'react'
import { Link } from '@/lib/nav'
import { Eye, Paperclip } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { reviewRequest } from '@/lib/api'
import type { PendingRequest } from '@/lib/data'
import { cn } from '@/lib/helpers'
import { Avatar, Card, CardLabel, EmptyState, Pill, Spinner, StatusBadge, buttonPrimary, buttonSecondary } from '@/components/ui-kit'

type Action = { item: PendingRequest; decision: 'approved' | 'rejected' }

const initials = (name: string) => name.split(' ').map((p) => p[0]).join('').slice(0, 2)

export function ApprovalList({ limit, showReviewed = false }: { limit?: number; showReviewed?: boolean }) {
  const { pending, reviewed, decide } = useApp()
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)

  const items = limit ? pending.slice(0, limit) : pending

  async function confirm() {
    if (!action) return
    setBusy(true)
    await reviewRequest(action.item.id, action.decision)
    decide(action.item.id, action.decision)
    setBusy(false)
    setAction(null)
  }

  return (
    <>
      <Card>
        <CardLabel
          action={
            limit && pending.length > 0 ? (
              <Link href="/approvals" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            ) : (
              <Pill className="bg-warning/15 text-warning">{pending.length} pending</Pill>
            )
          }
        >
          Pending attendance approval
        </CardLabel>

        {items.length === 0 ? (
          <EmptyState title="All caught up" text="There are no sick or permission requests waiting for review." />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <Avatar initials={initials(item.student)} className="size-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{item.student}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-muted">
                      NIS {item.nis} · {item.date}
                    </p>
                    <p className="mt-2 text-sm text-ink">{item.note}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <Paperclip className="size-3.5" aria-hidden="true" /> {item.evidence || 'No file'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAction({ item, decision: 'rejected' })} className={cn(buttonSecondary, 'px-3 py-2 text-danger')}>
                      Reject
                    </button>
                    <button type="button" onClick={() => setAction({ item, decision: 'approved' })} className={cn(buttonPrimary, 'px-3 py-2')}>
                      Approve
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showReviewed && (
        <Card className="mt-6">
          <CardLabel>Recently reviewed</CardLabel>
          {reviewed.length === 0 ? (
            <p className="text-sm text-muted">Nothing reviewed in this session yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {reviewed.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="font-medium text-ink">{r.student}</span>
                  <StatusBadge status={r.status} />
                  <span className="text-muted">→</span>
                  {r.decision === 'approved' ? (
                    <Pill className="bg-success/15 text-success">Approved</Pill>
                  ) : (
                    <>
                      <Pill className="bg-danger/15 text-danger">Rejected</Pill>
                      <StatusBadge status="alfa" />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <button type="button" aria-label="Cancel" className="absolute inset-0 bg-slate-900/50" onClick={() => !busy && setAction(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h2 id="confirm-title" className="text-lg font-bold text-ink">
              {action.decision === 'approved' ? 'Approve this request?' : 'Reject this request?'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {action.item.student} · {action.item.date}
            </p>

            <div className="mt-4 rounded-xl bg-surface-muted p-4">
              <div className="mb-2 flex items-center gap-2">
                <StatusBadge status={action.item.status} />
              </div>
              <p className="text-sm text-ink">{action.item.note}</p>
              <p className="mt-3 flex items-center gap-2 text-sm text-ink">
                <Eye className="size-4 text-muted" aria-hidden="true" /> Evidence: {action.item.evidence || 'No file'}
              </p>
            </div>

            {action.decision === 'rejected' && (
              <p className="mt-4 text-sm text-danger">This attendance will be recorded as Alfa (absent).</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setAction(null)} className={buttonSecondary}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirm}
                className={cn(buttonPrimary, action.decision === 'rejected' && 'bg-danger text-white')}
              >
                {busy && <Spinner />}
                {action.decision === 'approved' ? 'Approve' : 'Reject as Alfa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
