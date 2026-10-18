'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import {
  getParentChildAttendance,
  type ParentAttendanceStatus,
  type ParentChildAttendance,
} from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'
import { useApp } from '@/lib/app-context'
import { Card, CardLabel, EmptyState, Pill, Spinner, buttonSecondary } from '@/components/ui-kit'

const STATUS_LABELS: Record<ParentAttendanceStatus, string> = {
  HADIR: 'Present',
  IZIN: 'Permission',
  SAKIT: 'Sick',
  ALPHA: 'Absent',
}

const STATUS_STYLES: Record<ParentAttendanceStatus, string> = {
  HADIR: 'bg-success/15 text-success',
  IZIN: 'bg-info/15 text-info',
  SAKIT: 'bg-warning/15 text-warning',
  ALPHA: 'bg-danger/15 text-danger',
}

const STATUS_ORDER: ParentAttendanceStatus[] = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA']

function formatDate(date: string): string {
  const parsedDate = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsedDate.getTime())
    ? date
    : parsedDate.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

export function ParentAttendance() {
  const { childId } = useApp()
  const [result, setResult] = useState<ParentChildAttendance | null>(null)
  const [resultStudentId, setResultStudentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorStudentId, setErrorStudentId] = useState('')
  const [revision, setRevision] = useState(0)
  const attendance = resultStudentId === childId ? result : null
  const attendanceError = errorStudentId === childId ? error : null
  const loading = Boolean(childId) && !attendance && !attendanceError

  useEffect(() => {
    if (!childId) return
    let isActive = true

    getParentChildAttendance(childId)
      .then((data) => {
        if (!isActive) return
        setResult(data)
        setResultStudentId(childId)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!isActive) return
        setError(parseApiError(requestError).message || 'Failed to load attendance.')
        setErrorStudentId(childId)
      })

    return () => {
      isActive = false
    }
  }, [childId, revision])

  if (!childId) return null

  return (
    <Card>
      <CardLabel>Attendance</CardLabel>

      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
          <Spinner /> Loading attendance...
        </div>
      ) : attendanceError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-600">
            <AlertCircle className="size-4" aria-hidden="true" /> {attendanceError}
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
      ) : attendance ? (
        <>
          <ul className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATUS_ORDER.map((status) => (
              <li
                key={status}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-muted px-3 py-2 text-sm"
              >
                <span className="text-muted">{STATUS_LABELS[status]}</span>
                <span className="font-semibold text-ink">{attendance.summary[status]}</span>
              </li>
            ))}
          </ul>

          {attendance.attendance.length === 0 ? (
            <EmptyState
              title="No attendance records found"
              text="Attendance records will appear here once they are submitted."
            />
          ) : (
            <ul className="divide-y divide-line">
              {attendance.attendance.map((record) => (
                <li key={record.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-36 text-sm font-medium text-ink">{formatDate(record.date)}</span>
                  <Pill className={STATUS_STYLES[record.status]}>{STATUS_LABELS[record.status]}</Pill>
                  <span className="text-sm text-muted">{record.className}</span>
                  {record.note && <span className="text-sm text-muted">{record.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Card>
  )
}
