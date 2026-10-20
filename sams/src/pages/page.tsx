'use client'

import { useApp } from '@/lib/app-context'
import { ParentDashboard, StudentDashboard, TeacherDashboard } from '@/components/dashboard/dashboards'

export default function DashboardPage() {
  const { role } = useApp()
  if (role === 'parent') return <ParentDashboard />
  if (role === 'teacher') return <TeacherDashboard />
  return <StudentDashboard />
}
