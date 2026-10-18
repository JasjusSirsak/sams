'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { getParentChildGrades, type ParentChildGrades } from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'
import { useApp } from '@/lib/app-context'
import { Card, CardLabel, EmptyState, Pill, Spinner, buttonSecondary } from '@/components/ui-kit'

function scoreStyle(score: number): string {
  if (score >= 85) return 'bg-success/15 text-success'
  if (score >= 75) return 'bg-info/15 text-info'
  return 'bg-warning/15 text-warning'
}

export function ParentGrades() {
  const { childId } = useApp()
  const [result, setResult] = useState<ParentChildGrades | null>(null)
  const [resultStudentId, setResultStudentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorStudentId, setErrorStudentId] = useState('')
  const [revision, setRevision] = useState(0)
  const grades = resultStudentId === childId ? result?.grades ?? null : null
  const gradesError = errorStudentId === childId ? error : null
  const loading = Boolean(childId) && grades === null && !gradesError

  useEffect(() => {
    if (!childId) return
    let isActive = true

    getParentChildGrades(childId)
      .then((data) => {
        if (!isActive) return
        setResult(data)
        setResultStudentId(childId)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!isActive) return
        setError(parseApiError(requestError).message || 'Failed to load grades.')
        setErrorStudentId(childId)
      })

    return () => {
      isActive = false
    }
  }, [childId, revision])

  if (!childId) return null

  return (
    <Card>
      <CardLabel>Grades</CardLabel>

      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
          <Spinner /> Loading grades...
        </div>
      ) : gradesError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-600">
            <AlertCircle className="size-4" aria-hidden="true" /> {gradesError}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setErrorStudentId('')
              setRevision((value) => value + 1)
            }}
            className={`${buttonSecondary} mt-3 py-1.5`}
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Try again
          </button>
        </div>
      ) : grades?.length === 0 ? (
        <EmptyState title="No grades yet" text="Grades will appear here once teachers record them." />
      ) : grades ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-3 font-medium">Subject</th>
                <th className="py-3 font-medium">Assessment</th>
                <th className="py-3 font-medium">Period</th>
                <th className="py-3 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {grades.map((grade) => (
                <tr key={grade.id}>
                  <td className="py-3">
                    <p className="font-medium text-ink">{grade.subject}</p>
                    <p className="text-xs text-muted">{grade.subjectCode} · {grade.className}</p>
                  </td>
                  <td className="py-3 text-ink">
                    <p>{grade.assessmentName}</p>
                    <p className="text-xs text-muted">{grade.assessmentType.replaceAll('_', ' ')}</p>
                  </td>
                  <td className="py-3 text-ink">
                    {grade.academicYear} · Semester {grade.semester}
                  </td>
                  <td className="py-3 text-right">
                    <Pill className={scoreStyle(grade.score)}>{grade.score}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  )
}
