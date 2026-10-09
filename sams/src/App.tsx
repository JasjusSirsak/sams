import { AppProvider, useApp } from './lib/app-context'
import { NavProvider, usePathname } from './lib/nav'
import { AppShell } from './components/layout/app-shell'
import { HomeroomDashboard, ParentDashboard, StudentDashboard, TeacherDashboard } from './components/dashboard/dashboards'
import AgendaPage from './pages/agenda/page'
import ApprovalsPage from './pages/approvals/page'
import AttendancePage from './pages/attendance/page'
import GradesPage from './pages/grades/page'
import StudentsPage from './pages/students/page'

function DashboardPage() {
  const { role } = useApp()
  if (role === 'parent') return <ParentDashboard />
  if (role === 'teacher') return <TeacherDashboard />
  if (role === 'homeroom') return <HomeroomDashboard />
  return <StudentDashboard />
}

function AppRoutes() {
  const pathname = usePathname()

  if (pathname === '/approvals') return <ApprovalsPage />
  if (pathname === '/attendance') return <AttendancePage />
  if (pathname === '/grades') return <GradesPage />
  if (pathname === '/students') return <StudentsPage />
  if (pathname === '/agenda') return <AgendaPage />
  return <DashboardPage />
}

function App() {
  return (
    <NavProvider>
      <AppProvider>
        <div className="font-sans antialiased">
          <AppShell>
            <AppRoutes />
          </AppShell>
        </div>
      </AppProvider>
    </NavProvider>
  )
}

export default App
