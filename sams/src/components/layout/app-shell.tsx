'use client'

import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[85%]">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-6 rounded-lg p-1.5 text-white hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  )
}
