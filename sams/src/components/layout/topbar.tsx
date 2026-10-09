'use client'

import { useState } from 'react'
import { useRouter } from '@/lib/nav'
import { Bell, Check, Menu, Moon, Search, Sun, UserRoundCog } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { NOTIFICATIONS, USERS, type Role } from '@/lib/data'
import { canAccess, cn } from '@/lib/helpers'
import { Avatar } from '@/components/ui-kit'

const ROLES: Role[] = ['student', 'parent', 'teacher', 'homeroom']

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { role, setRole, dark, toggleDark, query, setQuery } = useApp()
  const router = useRouter()
  const [open, setOpen] = useState<'role' | 'bell' | null>(null)
  const user = USERS[role]

  function changeRole(r: Role) {
    setRole(r)
    setOpen(null)
    router.push('/')
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(canAccess(role, '/students') ? '/students' : '/agenda')
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-background/80 px-4 py-3 backdrop-blur md:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-xl p-2 text-ink hover:bg-surface lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <form onSubmit={submitSearch} role="search" className="relative hidden max-w-md flex-1 sm:block">
        <label htmlFor="global-search" className="sr-only">
          Search
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="global-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students, classes, agenda..."
          className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </form>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === 'role' ? null : 'role')}
            aria-haspopup="menu"
            aria-expanded={open === 'role'}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink shadow-sm hover:bg-surface-muted"
          >
            <UserRoundCog className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{user.roleLabel}</span>
            <span className="sr-only sm:hidden">Switch role</span>
          </button>
          {open === 'role' && (
            <Dropdown onClose={() => setOpen(null)}>
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted">View as</p>
              <ul role="menu">
                {ROLES.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => changeRole(r)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted"
                    >
                      <Avatar initials={USERS[r].initials} className="size-8 text-xs" />
                      <span className="flex-1">
                        <span className="block font-medium">{USERS[r].roleLabel}</span>
                        <span className="block text-xs text-muted">{USERS[r].name}</span>
                      </span>
                      {r === role && <Check className="size-4 text-primary" aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            </Dropdown>
          )}
        </div>

        <button
          type="button"
          onClick={toggleDark}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-xl p-2.5 text-ink hover:bg-surface"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === 'bell' ? null : 'bell')}
            aria-label="Notifications"
            aria-expanded={open === 'bell'}
            className="relative rounded-xl p-2.5 text-ink hover:bg-surface"
          >
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-danger" aria-hidden="true" />
          </button>
          {open === 'bell' && (
            <Dropdown onClose={() => setOpen(null)}>
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted">Notifications</p>
              <ul>
                {NOTIFICATIONS[role].map((n) => (
                  <li key={n} className="rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-muted">
                    {n}
                  </li>
                ))}
              </ul>
            </Dropdown>
          )}
        </div>

        <div className="ml-1 flex items-center gap-3">
          <Avatar initials={user.initials} />
          <div className="hidden leading-tight md:block">
            <p className="text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-xs text-muted">{user.subtitle}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

function Dropdown({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
      <div className={cn('absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-lg')}>{children}</div>
    </>
  )
}
