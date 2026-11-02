'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/lib/nav'
import { Bell, Check, Menu, Moon, Search, Sun, UserRoundCog } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { NOTIFICATIONS, USERS } from '@/lib/data'
import { canAccess, cn, getInitials } from '@/lib/helpers'
import { Avatar } from '@/components/ui-kit'
import { getInAppNotifications, markInAppNotificationRead, type InAppNotification } from '@/lib/api'

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { role, dark, toggleDark, query, setQuery, user: authUser, logout } = useApp()
  const router = useRouter()
  
  // Open state for bell notifications or profile menu
  const [open, setOpen] = useState<'bell' | 'profile' | null>(null)
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [notificationsUserId, setNotificationsUserId] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0)
  
  const activeRole = authUser?.role ?? role
  const authUserId = authUser?.id
  const mockUser = USERS[activeRole]

  const displayName = authUser?.name || mockUser.name
  const displayInitials = authUser ? getInitials(authUser.name) : mockUser.initials
  const displaySubtitle = authUser
    ? (authUser.className ? `${mockUser.roleLabel} · ${authUser.className}` : mockUser.subtitle)
    : mockUser.subtitle
  const currentUserNotifications = authUserId === notificationsUserId ? notifications : []
  const currentUnreadCount = authUserId === notificationsUserId ? unreadCount : 0

  useEffect(() => {
    if (authUserId === undefined) return

    let active = true
    async function loadNotifications() {
      setIsLoadingNotifications(true)
      try {
        const result = await getInAppNotifications()
        if (!active) return
        setNotifications(result.data)
        setNotificationsUserId(authUserId)
        setUnreadCount(result.unread_count)
        setNotificationError(null)
      } catch (error) {
        if (!active) return
        console.error('Failed to load in-app notifications:', error)
        setNotificationError('Notifications could not be loaded. Please try again.')
      } finally {
        if (active) setIsLoadingNotifications(false)
      }
    }

    void loadNotifications()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadNotifications()
    }, 30_000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [authUserId, notificationRefreshKey])

  async function markAsRead(notification: InAppNotification) {
    if (notification.is_read) return
    try {
      await markInAppNotificationRead(notification.id)
      setNotifications((current) =>
        current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item),
      )
      setUnreadCount((current) => Math.max(0, current - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      setNotificationError('Notification could not be marked as read. Please try again.')
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(canAccess(activeRole, '/students') ? '/students' : '/agenda')
  }

  async function handleLogout() {
    try {
      await logout()
    } catch (error) {
      console.error('Logout request failed:', error)
      window.alert('SAMS could not confirm logout with the server. Please try again when the connection is available.')
    }
    router.replace('/login')
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
            onClick={() => {
              const isOpening = open !== 'bell'
              setOpen(isOpening ? 'bell' : null)
              if (isOpening && authUser) setNotificationRefreshKey((key) => key + 1)
            }}
            aria-label="Notifications"
            aria-expanded={open === 'bell'}
            className="relative rounded-xl p-2.5 text-ink hover:bg-surface"
          >
            <Bell className="size-4" />
            {currentUnreadCount > 0 && (
              <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white" aria-label={`${currentUnreadCount} unread notifications`}>
                {currentUnreadCount > 9 ? '9+' : currentUnreadCount}
              </span>
            )}
          </button>
          {open === 'bell' && (
            <Dropdown onClose={() => setOpen(null)}>
              <div className="flex items-center justify-between px-3 pb-1 pt-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Notifications</p>
                {authUser && currentUnreadCount > 0 && (
                  <span className="text-[11px] font-medium text-primary">{currentUnreadCount} unread</span>
                )}
              </div>
              {authUser ? (
                notificationError ? (
                  <div className="px-3 py-3">
                    <p role="alert" className="text-sm text-danger">{notificationError}</p>
                    <button
                      type="button"
                      onClick={() => setNotificationRefreshKey((key) => key + 1)}
                      className="mt-2 text-xs font-semibold text-primary hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : isLoadingNotifications && currentUserNotifications.length === 0 ? (
                  <p role="status" className="px-3 py-4 text-sm text-muted">Loading notifications...</p>
                ) : currentUserNotifications.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted">You are all caught up.</p>
                ) : (
                  <ul className="max-h-96 overflow-y-auto">
                    {currentUserNotifications.map((notification) => (
                      <li key={notification.id} className="border-t border-line first:border-0">
                        <button
                          type="button"
                          onClick={() => void markAsRead(notification)}
                          disabled={notification.is_read}
                          className="flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-surface-muted disabled:cursor-default"
                        >
                          <span className={cn(
                            'mt-1.5 size-2 shrink-0 rounded-full',
                            notification.is_read ? 'bg-transparent' : 'bg-primary',
                          )} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-sm text-ink', !notification.is_read && 'font-semibold')}>
                              {notification.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">{notification.message}</span>
                            <time className="mt-1 block text-[10px] text-muted" dateTime={notification.created_at}>
                              {new Date(notification.created_at).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </time>
                          </span>
                          {notification.is_read && <Check className="mt-1 size-3.5 shrink-0 text-muted" aria-label="Read" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <ul>
                  {NOTIFICATIONS[activeRole].map((n) => (
                    <li key={n} className="rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-muted">
                      {n}
                    </li>
                  ))}
                </ul>
              )}
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