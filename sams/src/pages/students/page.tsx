'use client'

import { StudentTable } from '@/components/students/student-table'
import { PageHeader } from '@/components/ui-kit'

export default function StudentsPage() {
  return (
    <>
      <PageHeader title="Students" subtitle="Class XI IPA 2 · 2026/2027" />
      <StudentTable />
    </>
  )
}
