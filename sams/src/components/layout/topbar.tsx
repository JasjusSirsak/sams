'use client'

import { useState } from 'react'
import { useRouter } from '@/lib/nav'
import { Bell, Menu, Moon, Search, Sun, UserRoundCog } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { NOTIFICATIONS, USERS } from '@/lib/data'
import { canAccess, cn, getInitials } from '@/lib/helpers'
import { Avatar } from '@/components/ui-kit'

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { role, dark, toggleDark, query, setQuery, user: authUser } = useApp()
  const router = useRouter()
  
  // Open state for bell notifications or profile menu
  const [open, setOpen] = useState<'bell' | 'profile' | null>(null)
  
  const activeRole = authUser?.role ?? role
  const mockUser = USERS[activeRole]

  const displayName = authUser?.name || mockUser.name
  const displayInitials = authUser ? getInitials(authUser.name) : mockUser.initials
  const displaySubtitle = authUser
    ? (authUser.className ? `${mockUser.roleLabel} · ${authUser.className}` : mockUser.subtitle)
    : mockUser.subtitle

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(canAccess(activeRole, '/students') ? '/students' : '/agenda')
  }

//this paragraft for log out handler
function handleLogout() {
// 1. Clear all storage to ensure no residual tokens remain, regardless of key names
localStorage.clear()
sessionStorage.clear()

// 2. Remove any client-side cookies
document.cookie.split(";").forEach((c) => {
document.cookie = c
.replace(/^ +/, "")
.replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
}); 

// 3. Force a full page reload to the login page using window.location
window.location.href = '/login'

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
        {/* Role badge */}
        <span className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink sm:flex">
          <UserRoundCog className="size-4" aria-hidden="true" />
          {mockUser.roleLabel}
        </span>

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
                {NOTIFICATIONS[activeRole].map((n) => (
                  <li key={n} className="rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-muted">
                    {n}
                  </li>
                ))}
              </ul>
            </Dropdown>
          )}
        </div>

        {/* 3. Profile dropdown in the top-right corner */}
        <div className="relative ml-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(open === 'profile' ? null : 'profile')}
            aria-haspopup="menu"
            aria-expanded={open === 'profile'}
            className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-surface transition text-left focus:outline-none"
          >
            <Avatar initials={displayInitials} />
            <div className="hidden leading-tight md:block">
              <p className="text-sm font-semibold text-ink">{displayName}</p>
              <p className="text-xs text-muted">{displaySubtitle}</p>
            </div>
          </button>

          {open === 'profile' && (
            <Dropdown onClose={() => setOpen(null)}>
              <div className="px-3 pb-2 pt-2 border-b border-line mb-1">
                <p className="text-xs font-medium text-muted">Signed in as</p>
                <p className="text-sm font-semibold text-ink truncate">{displayName}</p>
              </div>
              <ul role="menu">
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-danger hover:bg-surface-muted transition"
                  >
                    <span>🚪</span> Log out
                  </button>
                </li>
              </ul>
            </Dropdown>
          )}
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