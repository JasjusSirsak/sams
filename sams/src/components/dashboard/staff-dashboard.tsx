import { ArrowRight, CalendarDays, CalendarRange, ClipboardCheck } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui-kit'
import { Link } from '@/lib/nav'
import { useApp } from '@/lib/app-context'

const STAFF_ACTIONS = [
  {
    title: 'Classes Attendance',
    description: 'Take and review attendance for each class.',
    href: '/staff/classes-attendance',
    icon: ClipboardCheck,
  },
  {
    title: 'Class Schedules',
    description: 'View and manage weekly class timetables.',
    href: '/staff/class-schedules',
    icon: CalendarRange,
  },
  {
    title: 'Global Agenda',
    description: 'View upcoming school-wide activities.',
    href: '/agenda',
    icon: CalendarDays,
  },
]

export function StaffDashboard() {
  const { user } = useApp()
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'Staff'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Your staff dashboard for daily school operations."
      />
      <section aria-label="Staff tools" className="grid gap-4 sm:grid-cols-2">
        {STAFF_ACTIONS.map(({ title, description, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Card className="flex h-full items-center gap-4 transition hover:border-primary/40 hover:shadow-md">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{title}</span>
                <span className="mt-1 block text-sm text-muted">{description}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
            </Card>
          </Link>
        ))}
      </section>
    </div>
  )
}
