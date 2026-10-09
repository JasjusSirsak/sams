import type { ReactNode } from 'react'
import { AppProvider } from '@/lib/app-context'
import { AppShell } from '@/components/layout/app-shell'

type LayoutProps = {
  children: ReactNode
}

export default function AppLayout({ children }: LayoutProps) {
  return (
    <div className="font-sans antialiased">
      <AppProvider>
        <AppShell>{children}</AppShell>
      </AppProvider>
    </div>
  )
}
