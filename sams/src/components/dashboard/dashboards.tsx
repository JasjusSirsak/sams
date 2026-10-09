'use client'

import { BookOpen, ClipboardCheck, ListChecks, Users } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { CHILDREN, TEACHER_CLASSES, USERS } from '@/lib/data'
import { AgendaWidget } from '@/components/agenda/agenda-widget'
import { ApprovalList } from '@/components/attendance/approval-list'
import { AttendanceHistory } from '@/components/attendance/attendance-history'
import { AttendanceRecap } from '@/components/attendance/attendance-recap'
import { TodayAttendance } from '@/components/attendance/today-attendance'
import { WeeklyChart } from '@/components/attendance/weekly-chart'
import { GradeSummary } from '@/components/grades/grade-summary'
import { MyClasses } from '@/components/grades/my-classes'
import { StatCard } from '@/components/ui-kit'
import { ChildSelector } from './child-selector'
import { Hero } from './hero'
import { ReportCard } from './report-card'

export function StudentDashboard() {
  const user = USERS.student
  return (
    <>
      <Hero name={user.name} subtitle={`Student · ${user.subtitle}`} />
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
  const { childId } = useApp()
  const child = CHILDREN.find((c) => c.id === childId) ?? CHILDREN[0]
  return (
    <>
      <Hero name={USERS.parent.name} subtitle={`Parent · Viewing ${child.name}, ${child.cls}`} />
      <ChildSelector />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <AttendanceRecap studentId={child.id} />
            <GradeSummary studentId={child.id} />
          </div>
          <AttendanceHistory studentId={child.id} />
        </div>
        <AgendaWidget className="h-fit" />
      </div>
    </>
  )
}

export function TeacherDashboard() {
  const total = TEACHER_CLASSES.reduce((s, c) => s + c.students, 0)
  return (
    <>
      <Hero name={USERS.teacher.name} subtitle="Subject Teacher · Mathematics" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Classes taught" value={String(TEACHER_CLASSES.length)} hint="This semester" icon={BookOpen} />
        <StatCard label="Total students" value={String(total)} hint="Across all classes" icon={Users} />
        <StatCard label="Attendance today" value="94%" hint="XI IPA 2 · 31 of 32" icon={ClipboardCheck} />
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
  const { pending } = useApp()
  return (
    <>
      <Hero name={USERS.homeroom.name} subtitle="Homeroom Teacher · Class XI IPA 2" />
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
