'use client'

import { useActiveStudentId, useApp } from '@/lib/app-context'
import { ChildSelector } from '@/components/dashboard/child-selector'
import { ParentGrades } from '@/components/dashboard/parent-grades'
import { GradeEntry } from '@/components/grades/grade-entry'
import { GradeTable } from '@/components/grades/grade-table'
import { PageHeader } from '@/components/ui-kit'

export default function GradesPage() {
  const { role } = useApp()
  const studentId = useActiveStudentId()

  if (role === 'teacher' || role === 'homeroom') {
    return (
      <>
        <PageHeader title="Grade entry" subtitle="Enter daily, midterm and final scores. Final score is calculated automatically." />
        <GradeEntry />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Grades" subtitle={role === 'student' ? 'Your scores for this semester' : "Your child's academic performance"} />
      {role === 'parent' ? (
        <div className="space-y-6">
          <ChildSelector />
          <ParentGrades />
        </div>
      ) : (
        <GradeTable studentId={studentId} />
      )}
    </>
  )
}
