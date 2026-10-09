'use client'

import { useApp } from '@/lib/app-context'
import { canAccess } from '@/lib/helpers'
import { StudentTable } from '@/components/students/student-table'
import { Forbidden, PageHeader } from '@/components/ui-kit'

export default function StudentsPage() {
  const { role } = useApp()
  if (!canAccess(role, '/students')) return <Forbidden />

  return (
    <>
      <PageHeader title="Students" subtitle="Class XI IPA 2 · 2026/2027" />
      <StudentTable />
    </>
  )
}
