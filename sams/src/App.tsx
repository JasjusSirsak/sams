import { useEffect, type ReactNode } from 'react'
import { AuthProvider, useApp } from './lib/app-context'
import { NavProvider, usePathname, useRouter } from './lib/nav'
import { AppShell } from './components/layout/app-shell'
import { Spinner } from './components/ui-kit'
import { HomeroomDashboard, ParentDashboard, StudentDashboard, TeacherDashboard } from './components/dashboard/dashboards'
import LoginPage from './pages/login/login'
import AgendaPage from './pages/agenda/page'
import ApprovalsPage from './pages/approvals/page'
import AttendancePage from './pages/attendance/page'
import GradesPage from './pages/grades/page'
import StudentsPage from './pages/students/page'

/**
 * Wrapper component for routes that require authentication.
 * Redirects to /login via useEffect to avoid state updates during render.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-xs font-medium text-muted">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Render nothing while useEffect handles the redirect
    return null
  }

  return <>{children}</>
}

/**
 * Wrapper component for guest-only routes (e.g. /login).
 * Redirects to / via useEffect to avoid state updates during render.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    // Render nothing while useEffect handles the redirect
    return null
  }

  return <>{children}</>
}

function DashboardPage() {
  const { role } = useApp()
  if (role === 'parent') return <ParentDashboard />
  if (role === 'teacher') return <TeacherDashboard />
  if (role === 'homeroom') return <HomeroomDashboard />
  return <StudentDashboard />
}

function AppRoutes() {
  const pathname = usePathname()

  if (pathname === '/login') {
    return (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="font-sans antialiased">
        <AppShell>
          {pathname === '/approvals' && <ApprovalsPage />}
          {pathname === '/attendance' && <AttendancePage />}
          {pathname === '/grades' && <GradesPage />}
          {pathname === '/students' && <StudentsPage />}
          {pathname === '/agenda' && <AgendaPage />}
          {pathname === '/' && <DashboardPage />}
          {!['/approvals', '/attendance', '/grades', '/students', '/agenda', '/'].includes(pathname) && (
            <DashboardPage />
          )}
        </AppShell>
      </div>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <NavProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </NavProvider>
  )
}

export default App
