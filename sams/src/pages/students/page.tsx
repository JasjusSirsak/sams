'use client'

import { StudentTable } from '@/components/students/student-table'
import { PageHeader } from '@/components/ui-kit'
import { useSearchParams } from '@/lib/nav'

export default function StudentsPage() {
  const classId = useSearchParams().get('classId')

  return (
    <>
      <PageHeader title="Students" subtitle="Class XI IPA 2 · 2026/2027" />
      <StudentTable classId={classId} />
    </>
  )
}
