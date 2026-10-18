import { useEffect, useState } from 'react'
import { BookOpen, ClipboardCheck, ListChecks, Users } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { TEACHER_CLASSES, USERS } from '@/lib/data'
import { getTeacherDashboardSummary, type TeacherDashboardSummary } from '@/lib/api'
import { AgendaWidget } from '@/components/agenda/agenda-widget'
import { ApprovalList } from '@/components/attendance/approval-list'
import { AttendanceRecap } from '@/components/attendance/attendance-recap'
import { TodayAttendance } from '@/components/attendance/today-attendance'
import { WeeklyChart } from '@/components/attendance/weekly-chart'
import { GradeSummary } from '@/components/grades/grade-summary'
import { ParentAttendance } from './parent-attendance'
import { ParentGrades } from './parent-grades'
import { MyClasses } from '@/components/grades/my-classes'
import { StatCard } from '@/components/ui-kit'
import { ChildSelector } from './child-selector'
import { Hero } from './hero'
import { ReportCard } from './report-card'

export function StudentDashboard() {
  const { user: authUser } = useApp()
  const mockUser = USERS.student
  const name = authUser?.name || mockUser.name
  const subtitle = authUser?.className ? `Student · Class ${authUser.className}` : `Student · ${mockUser.subtitle}`

  return (
    <>
      <Hero name={name} subtitle={subtitle} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TodayAttendance />
          <div className="grid gap-6 md:grid-cols-2">
            <AttendanceRecap studentId="raka" />
            <GradeSummary studentId="raka" />
          </div>
        </div>
        <AgendaWidget className="h-fit" />
      </div>
    </>
  )
}

export function ParentDashboard() {
  const { user: authUser } = useApp()
  const mockUser = USERS.parent
  const name = authUser?.name || mockUser.name

  return (
    <>
      <Hero name={name} subtitle="Parent · Monitor your child's attendance and grades" />
      <ChildSelector />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <ParentAttendance />
            <ParentGrades />
          </div>
        </div>
        <AgendaWidget className="h-fit" />
      </div>
    </>
  )
}

export function TeacherDashboard() {
  const { user: authUser, role, isAuthenticated } = useApp()
  const mockUser = USERS.teacher
  const name = authUser?.name || mockUser.name

  const [summary, setSummary] = useState<TeacherDashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Only query the private teacher endpoint if user is authenticated and effective role is teacher
  const isRealTeacher = isAuthenticated && authUser?.role === 'teacher' && role === 'teacher'

  useEffect(() => {
    let isMounted = true

    if (!isRealTeacher) {
      // In preview/mock mode or unauthenticated, do not call private teacher API
      setIsLoading(false)
      setSummary(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    getTeacherDashboardSummary()
      .then((data) => {
        if (isMounted) {
          setSummary(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load teacher summary.')
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isRealTeacher])

  // Build subject subtitle
  let subtitle = 'Subject Teacher · Mathematics'
  if (isRealTeacher) {
    if (isLoading) {
      subtitle = 'Subject Teacher · Loading subjects...'
    } else if (summary && summary.subjects.length > 0) {
      subtitle = `Subject Teacher · ${summary.subjects.join(', ')}`
    } else if (summary && summary.subjects.length === 0) {
      subtitle = 'Subject Teacher · No subjects assigned'
    } else if (error) {
      subtitle = 'Subject Teacher · Unavailable'
    }
  }

  // Determine card values
  const classesValue = !isRealTeacher
    ? String(TEACHER_CLASSES.length)
    : isLoading
      ? '...'
      : error
        ? 'Error'
        : String(summary?.classes_taught ?? 0)

  const classesHint = !isRealTeacher
    ? 'This semester'
    : isLoading
      ? 'Checking active period...'
      : error
        ? 'Failed to load'
        : summary?.active_period
          ? `${summary.active_period.academic_year} · Semester ${summary.active_period.semester}`
          : 'No active period'

  const totalStudentsValue = !isRealTeacher
    ? String(TEACHER_CLASSES.reduce((s, c) => s + c.students, 0))
    : isLoading
      ? '...'
      : error
        ? 'Error'
        : String(summary?.total_students ?? 0)

  const totalStudentsHint = !isRealTeacher
    ? 'Across all classes'
    : isLoading
      ? 'Counting enrolled students...'
      : error
        ? 'Failed to load'
        : 'Across taught classes'

  const attendanceValue = !isRealTeacher
    ? '94%'
    : isLoading
      ? '...'
      : error
        ? 'Error'
        : `${summary?.attendance_today?.rate ?? 0}%`

  const attendanceHint = !isRealTeacher
    ? 'XI IPA 2 · 31 of 32'
    : isLoading
      ? 'Calculating attendance...'
      : error
        ? 'Failed to load'
        : summary?.attendance_today?.hint || 'No sessions today'

  return (
    <>
      <Hero name={name} subtitle={subtitle} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Classes taught" value={classesValue} hint={classesHint} icon={BookOpen} />
        <StatCard label="Total students" value={totalStudentsValue} hint={totalStudentsHint} icon={Users} />
        <StatCard label="Attendance today" value={attendanceValue} hint={attendanceHint} icon={ClipboardCheck} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <MyClasses />
          <WeeklyChart />
        </div>
        <AgendaWidget className="h-fit" />
      </div>
    </>
  )
}



export function HomeroomDashboard() {
  const { pending, user: authUser } = useApp()
  const mockUser = USERS.homeroom
  const name = authUser?.name || mockUser.name
  const subtitle = authUser?.className
    ? `Homeroom Teacher · Class ${authUser.className}`
    : `Homeroom Teacher · ${mockUser.subtitle}`

  return (
    <>
      <Hero name={name} subtitle={subtitle} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Students" value="32" hint="XI IPA 2" icon={Users} />
        <StatCard label="Present today" value="29" hint="2 sick · 1 permission" icon={ClipboardCheck} />
        <StatCard label="Pending approvals" value={String(pending.length)} hint="Need your review" icon={ListChecks} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ApprovalList limit={2} />
          <WeeklyChart />
        </div>
        <div className="space-y-6">
          <ReportCard />
          <AgendaWidget />
        </div>
      </div>
    </>
  )
}
