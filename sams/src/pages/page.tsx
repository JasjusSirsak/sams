'use client'

import { useApp } from '@/lib/app-context'
import { HomeroomDashboard, ParentDashboard, StudentDashboard, TeacherDashboard } from '@/components/dashboard/dashboards'

export default function DashboardPage() {
  const { role } = useApp()
  if (role === 'parent') return <ParentDashboard />
  if (role === 'teacher') return <TeacherDashboard />
  if (role === 'homeroom') return <HomeroomDashboard />
  return <StudentDashboard />
}
