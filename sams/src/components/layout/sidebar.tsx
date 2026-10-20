'use client'

import { Link, usePathname } from '@/lib/nav'
import { BookOpenCheck, CalendarDays, ClipboardCheck, GraduationCap, LayoutDashboard, ListChecks, Users, BookOpen, CalendarClock, UserRoundCog } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { USERS } from '@/lib/data'
import { canAccess, cn, getInitials } from '@/lib/helpers'

const NAV = [
  { group: 'Overview', items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    group: 'Academic',
    items: [
      { href: '/approvals', label: 'Approvals', icon: ListChecks },
      { href: '/attendance', label: 'Attendance', icon: ClipboardCheck },
      { href: '/grades', label: 'Grades', icon: BookOpenCheck },
      { href: '/students', label: 'Students', icon: Users },
      { href: '/agenda', label: 'Agenda', icon: CalendarDays },
    ],
  },
  {
    group: 'Manage',
    items: [
      { href: '/admin/classes', label: 'Manage Classes', icon: Users },
      { href: '/admin/subjects', label: 'Manage Subjects', icon: BookOpen },
      { href: '/admin/academic-periods', label: 'Manage Academic Periods', icon: CalendarClock },
      { href: '/admin/teachers', label: 'Manage Teachers', icon: UserRoundCog },
      { href: '/admin/students', label: 'Manage Students', icon: GraduationCap },
    ],
  },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { role, pending, user: authUser, isHomeroom } = useApp()
  const pathname = usePathname()
  const mockUser = USERS[role]

  const displayName = authUser?.name || mockUser.name
  const displayInitials = authUser ? getInitials(authUser.name) : mockUser.initials
  const displayRoleLabel = authUser
    ? (authUser.className ? `${mockUser.roleLabel} (${authUser.className})` : mockUser.roleLabel)
    : mockUser.roleLabel

  return (
    <div className="flex h-full flex-col bg-sidebar px-3 py-5 text-sidebar-foreground">
      <div className="mb-6 flex items-center gap-3 px-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-white text-[#2b52d6] dark:bg-primary dark:text-primary-foreground">
          <GraduationCap className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-bold leading-tight">SAMS</p>
          <p className="text-xs text-sidebar-muted">School Administration</p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-sidebar-card p-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#2b52d6] dark:bg-primary dark:text-primary-foreground">
          {displayInitials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-sidebar-muted">{displayRoleLabel}</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto">
        {NAV.map((section) => {
          const items = section.items.filter((item) => canAccess(role, item.href, isHomeroom))
          if (items.length === 0) return null
          return (
            <div key={section.group}>
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-muted">{section.group}</p>
              <ul className="space-y-1">
                {items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          active
                            ? 'bg-sidebar-active text-sidebar-active-foreground shadow-sm'
                            : 'text-sidebar-foreground hover:bg-sidebar-card',
                        )}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                        <span className="flex-1">{label}</span>
                        {href === '/approvals' && pending.length > 0 && (
                          <span className="rounded-full bg-warning px-2 text-xs font-semibold text-slate-900">{pending.length}</span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <p className="px-2 pt-4 text-xs text-sidebar-muted">Bintang™</p>
    </div>
  )
}
