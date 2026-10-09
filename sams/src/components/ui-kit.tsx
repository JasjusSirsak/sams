import type { ReactNode } from 'react'
import { CircleCheck, CircleX, FileText, HeartPulse, Inbox, LoaderCircle, ShieldAlert } from 'lucide-react'
import type { Approval, AttendanceStatus } from '@/lib/data'
import { cn } from '@/lib/helpers'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface p-5 shadow-sm shadow-slate-900/[0.03]', className)}>
      {children}
    </section>
  )
}

export function CardLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink text-balance">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground',
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  )
}

export const STATUS_META: Record<AttendanceStatus, { label: string; hint: string; icon: typeof CircleCheck; className: string; color: string }> = {
  hadir: { label: 'Hadir', hint: "I'm at school", icon: CircleCheck, className: 'bg-success/15 text-success', color: 'var(--success)' },
  izin: { label: 'Izin', hint: 'Permission, letter required', icon: FileText, className: 'bg-info/15 text-info', color: 'var(--info)' },
  sakit: { label: 'Sakit', hint: 'Sick, evidence required', icon: HeartPulse, className: 'bg-warning/15 text-warning', color: 'var(--warning)' },
  alfa: { label: 'Alfa', hint: 'Absent without notice', icon: CircleX, className: 'bg-danger/15 text-danger', color: 'var(--danger)' },
}

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <Pill className={meta.className}>
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </Pill>
  )
}

export function ApprovalBadge({ approval }: { approval: Approval }) {
  if (approval === 'approved') return <Pill className="bg-success/15 text-success">Approved</Pill>
  if (approval === 'rejected') return <Pill className="bg-danger/15 text-danger">Rejected</Pill>
  return <Pill className="bg-warning/15 text-warning">Pending</Pill>
}

export function ProgressBar({ value, color = 'var(--primary)', label }: { value: number; color?: string; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
    >
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Inbox }) {
  return (
    <Card className="flex items-start gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-bold text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <Inbox className="size-8 text-muted" aria-hidden="true" />
      <p className="font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action}
    </div>
  )
}

export function Forbidden() {
  return (
    <Card className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 py-10 text-center">
      <ShieldAlert className="size-10 text-danger" aria-hidden="true" />
      <h1 className="text-lg font-bold text-ink">{"You don't have access to this page"}</h1>
      <p className="text-sm text-muted">Switch to a role that can open this page using the role menu at the top.</p>
    </Card>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-muted', className)} />
}

export function Spinner() {
  return <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
}

export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
export const buttonSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50'
export const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none'
