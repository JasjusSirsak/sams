import { useEffect, useState } from 'react'
import { BookOpen, Users } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { TEACHER_CLASSES, USERS } from '@/lib/data'
import { getTeacherDashboardSummary, type TeacherDashboardSummary } from '@/lib/api'
import { Link } from '@/lib/nav'
import { AgendaWidget } from '@/components/agenda/agenda-widget'
import { ApprovalList } from '@/components/attendance/approval-list'
import { AttendanceRecap } from '@/components/attendance/attendance-recap'
import { TodayAttendance } from '@/components/attendance/today-attendance'
import { WeeklyChart } from '@/components/attendance/weekly-chart'
import { GradeSummary } from '@/components/grades/grade-summary'
import { ParentAttendance } from './parent-attendance'
import { ParentGrades } from './parent-grades'
import { MyClasses } from '@/components/grades/my-classes'
import { Card, CardLabel, EmptyState, StatCard } from '@/components/ui-kit'
import { ChildSelector } from './child-selector'
import { Hero } from './hero'

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
  const [classesExpanded, setClassesExpanded] = useState(false)

  // Only query the private teacher endpoint if user is authenticated and effective role is teacher
  const isRealTeacher = isAuthenticated && authUser?.role === 'teacher' && role === 'teacher'

  useEffect(() => {
    let isMounted = true

    if (!isRealTeacher) {
      return
    }

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
      subtitle = 'Teacher · Loading dashboard...'
    } else if (summary?.active_period) {
      subtitle = `Teacher · ${summary.active_period.year} · Semester ${summary.active_period.semester}`
    } else if (error) {
      subtitle = 'Teacher · Unavailable'
    } else {
      subtitle = 'Teacher'
    }
  }

  const classesValue = !isRealTeacher
    ? String(TEACHER_CLASSES.length)
    : isLoading
      ? '...'
      : error
        ? 'Error'
        : String(summary?.classes_taught_count ?? 0)

  const classesHint = !isRealTeacher
    ? 'This semester'
    : isLoading
      ? 'Checking active period...'
      : error
        ? 'Failed to load'
        : summary?.active_period
          ? `${summary.active_period.year} · Semester ${summary.active_period.semester}`
          : 'No active academic period'

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

  const classes = isRealTeacher
    ? summary?.classes ?? []
    : TEACHER_CLASSES.map((item) => ({
        class_id: item.id,
        name: item.name,
        student_count: item.students,
      }))
  const attendance = summary?.attendance_today
  const attendanceCounts = attendance
    ? [
        ['Present', attendance.present],
        ['Sick', attendance.sick],
        ['Permitted', attendance.permitted],
        ['Absent', attendance.absent],
        ['Pending', attendance.pending],
        ['Not recorded', attendance.not_recorded],
      ]
    : []
  const showApprovals = isRealTeacher && summary?.is_homeroom === true

  return (
    <>
      <Hero name={name} subtitle={subtitle} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-0">
          <button
            type="button"
            className="flex w-full items-start gap-4 p-5 text-left"
            aria-expanded={classesExpanded}
            onClick={() => setClassesExpanded((expanded) => !expanded)}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <BookOpen className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-muted">Classes taught</span>
              <span className="block text-2xl font-bold text-ink">{classesValue}</span>
              <span className="mt-0.5 block text-xs text-muted">{classesHint}</span>
            </span>
          </button>
          {classesExpanded && (
            <ul className="mt-4 space-y-2 border-t border-line pt-3">
              {classes.map((item) => (
                <li key={item.class_id}>
                  <Link
                    href={`/students?classId=${encodeURIComponent(item.class_id)}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm text-primary hover:bg-primary-soft"
                  >
                    <span>{item.name}</span>
                    <span className="text-xs text-muted">{item.student_count} students</span>
                  </Link>
                </li>
              ))}
              {classes.length === 0 && (
                <li className="px-2 py-2 text-sm text-muted">No classes assigned.</li>
              )}
            </ul>
          )}
        </Card>
        <Link href="/students" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
          <StatCard label="Total students" value={totalStudentsValue} hint={totalStudentsHint} icon={Users} />
        </Link>
        <Link href="/attendance" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
          <Card>
            <CardLabel>Attendance today</CardLabel>
            {isLoading ? (
              <p className="text-sm text-muted">Loading attendance...</p>
            ) : error ? (
              <p className="text-sm text-danger">Failed to load attendance.</p>
            ) : !attendance ? (
              <p className="text-sm text-muted">No attendance recorded yet today</p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {attendanceCounts.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </Link>
      </div>
      {isRealTeacher && !isLoading && !error && summary?.active_period === null && (
        <div className="mb-6">
          <EmptyState
            title="No active academic period"
            text="Dashboard class and attendance data will appear when an academic period is active."
          />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <MyClasses />
          {showApprovals && (
            <>
              <ApprovalList limit={2} />
              <WeeklyChart />
            </>
          )}
        </div>
        <AgendaWidget className="h-fit" />
      </div>
    </>
  )
}
