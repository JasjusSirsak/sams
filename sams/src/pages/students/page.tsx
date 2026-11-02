'use client'

import { TeacherClassGrid } from '@/components/students/teacher-class-grid'
import { PageHeader } from '@/components/ui-kit'

export default function StudentsPage() {
  return (
    <>
      <PageHeader title="Students" subtitle="Choose a class to view its students and attendance." />
      <TeacherClassGrid />
    </>
  )
}
