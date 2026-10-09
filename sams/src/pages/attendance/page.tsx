'use client'

import { useActiveStudentId, useApp } from '@/lib/app-context'
import { AttendanceHistory } from '@/components/attendance/attendance-history'
import { AttendanceRecap } from '@/components/attendance/attendance-recap'
import { TodayAttendance } from '@/components/attendance/today-attendance'
import { WeeklyChart } from '@/components/attendance/weekly-chart'
import { ChildSelector } from '@/components/dashboard/child-selector'
import { StudentTable } from '@/components/students/student-table'
import { PageHeader } from '@/components/ui-kit'

export default function AttendancePage() {
  const { role } = useApp()
  const studentId = useActiveStudentId()

  if (role === 'teacher' || role === 'homeroom') {
    return (
      <>
        <PageHeader title="Attendance" subtitle="Class XI IPA 2 · Semester 1" />
        <div className="space-y-6">
          <WeeklyChart />
          <StudentTable showRateOnly />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Attendance" subtitle={role === 'student' ? 'Check in daily and track your record' : "Monitor your child's attendance"} />
      {role === 'parent' && <ChildSelector />}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {role === 'student' && <TodayAttendance />}
          <AttendanceHistory studentId={studentId} />
        </div>
        <AttendanceRecap studentId={studentId} />
      </div>
    </>
  )
}
