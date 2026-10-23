'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import {
  getTeacherClassAttendance,
  getTeacherDashboardSummary,
  reviewRequest,
  type TeacherClassAttendance,
  type TeacherClassAttendanceStudent,
  type TeacherDashboardSummary,
} from '@/lib/api'
import { ApprovalBadge, Card, EmptyState, PageHeader, Pill, StatusBadge, buttonSecondary, inputClass } from '@/components/ui-kit'
import { WeeklyChart } from './weekly-chart'
import type { Approval, AttendanceStatus } from '@/lib/data'

function jakartaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function toAttendanceStatus(status: string): AttendanceStatus | null {
  if (status === 'PRESENT') return 'present'
  if (status === 'PERMITTED') return 'permitted'
  if (status === 'SICK') return 'sick'
  if (status === 'ABSENT') return 'absent'
  return null
}

function toApprovalStatus(status: string): Approval | null {
  if (status === 'APPROVED') return 'approved'
  if (status === 'PENDING') return 'pending'
  if (status === 'REJECTED') return 'rejected'
  return null
}

export function TeacherClassAttendance() {
  const [summary, setSummary] = useState<TeacherDashboardSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(jakartaToday)
  const [attendance, setAttendance] = useState<TeacherClassAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    getTeacherDashboardSummary()
      .then((data) => {
        if (!isMounted) return
        setSummary(data)
        setClassId((current) => current || data.homeroom_class_id || data.classes[0]?.class_id || '')
        setSummaryLoading(false)
      })
      .catch((requestError: unknown) => {
        if (!isMounted) return
        setSummaryError(requestError instanceof Error ? requestError.message : 'Failed to load teacher classes.')
        setSummaryLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!classId) return

    let isMounted = true
    void Promise.resolve().then(() => {
      if (isMounted) {
        setLoading(true)
        setError(null)
        setActionError(null)
      }
      return getTeacherClassAttendance(classId, date || undefined)
    })
      .then((data) => {
        if (!isMounted) return
        setAttendance(data)
        setDate(data.date)
        setLoading(false)
      })
      .catch((requestError: unknown) => {
        if (!isMounted) return
        setError(requestError instanceof Error ? requestError.message : 'Failed to load class attendance.')
        setAttendance(null)
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [classId, date])

  const classes = summary?.classes ?? []
  const homeroomClassId = summary?.homeroom_class_id ?? null
  const hasHomeroomOption = Boolean(
    homeroomClassId && !classes.some((item) => item.class_id === homeroomClassId),
  )
  const selectedClass = classes.find((item) => item.class_id === classId)
  const pageTitle = attendance?.class.name ?? selectedClass?.name ?? 'Class attendance'
  const pageSubtitle = attendance
    ? `${attendance.period.year} · Semester ${attendance.period.semester}`
    : summary?.active_period
      ? `${summary.active_period.year} · Semester ${summary.active_period.semester}`
      : undefined

  async function reviewAttendance(student: TeacherClassAttendanceStudent, decision: 'approved' | 'rejected') {
    const recordId = student.record_id
    if (!recordId) return
    setBusyRecordId(recordId)
    setActionError(null)
    try {
      await reviewRequest(recordId, decision)
      setAttendance((current) => current
        ? {
            ...current,
            students: current.students.map((item) =>
              item.student_id === student.student_id
                ? {
                    ...item,
                    approval_status: decision === 'approved' ? 'APPROVED' : 'REJECTED',
                  }
                : item,
            ),
          }
        : current)
    } catch (requestError: unknown) {
      setActionError(requestError instanceof Error ? requestError.message : 'Failed to update attendance approval.')
    } finally {
      setBusyRecordId(null)
    }
  }

  if (summaryLoading) {
    return (
      <>
        <PageHeader title="Attendance" subtitle="Loading class details..." />
        <Card><p className="text-sm text-muted">Loading attendance...</p></Card>
      </>
    )
  }

  if (summaryError) {
    return (
      <>
        <PageHeader title="Attendance" />
        <EmptyState title="Failed to load attendance" text={summaryError} />
      </>
    )
  }

  if (summary?.active_period === null) {
    return (
      <>
        <PageHeader title="Attendance" />
        <EmptyState title="No active academic period" text="Class attendance will appear when an academic period is active." />
      </>
    )
  }

  if (!classId) {
    return (
      <>
        <PageHeader title="Attendance" subtitle={pageSubtitle} />
        <EmptyState title="No classes assigned" text="No classes are assigned to you in the active academic period." />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Attendance" subtitle={`${pageTitle} · ${pageSubtitle ?? 'Active academic period'}`} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="attendance-class">Class</label>
        <select
          id="attendance-class"
          className={inputClass}
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          {hasHomeroomOption && (
            <option value={homeroomClassId!}>
              {attendance?.class.id === homeroomClassId ? attendance.class.name : 'Homeroom class'}
            </option>
          )}
          {classes.map((item) => <option key={item.class_id} value={item.class_id}>{item.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="attendance-date">Attendance date</label>
        <input
          id="attendance-date"
          type="date"
          className={inputClass}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{error}</div>
      ) : (
        <>
          {actionError && (
            <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              {actionError}
            </div>
          )}
          <div className="space-y-6">
            <WeeklyChart
              weeklyData={attendance?.weekly ?? []}
              classLabel={attendance?.class.name ?? pageTitle}
              isLoading={loading}
            />
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                      <th className="py-3 font-medium">Student</th>
                      <th className="py-3 font-medium">NIS</th>
                      <th className="py-3 font-medium">Status</th>
                      <th className="py-3 font-medium">Approval</th>
                      <th className="py-3 font-medium">Note</th>
                      <th className="py-3 font-medium">Evidence</th>
                      {attendance?.is_homeroom && <th className="py-3 text-right font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {loading ? (
                      <tr><td colSpan={attendance?.is_homeroom ? 7 : 6} className="py-8 text-center text-muted">Loading attendance...</td></tr>
                    ) : attendance?.students.length ? attendance.students.map((student) => {
                      const status = student.status ? toAttendanceStatus(student.status) : null
                      const approval = student.approval_status
                        ? toApprovalStatus(student.approval_status)
                        : null
                      const isPending = student.approval_status === 'PENDING'
                      return (
                        <tr key={student.student_id}>
                          <td className="py-3 font-medium text-ink">{student.name}</td>
                          <td className="py-3 text-muted">{student.nis}</td>
                          <td className="py-3">
                            {status ? <StatusBadge status={status} /> : <span className="text-muted">Not recorded</span>}
                          </td>
                          <td className="py-3">
                            {approval
                              ? <ApprovalBadge approval={approval} />
                              : <span className="text-muted">{student.record_id ? 'Not required' : 'Not recorded'}</span>}
                          </td>
                          <td className="max-w-xs truncate py-3 text-muted" title={student.note ?? undefined}>{student.note || '—'}</td>
                          <td className="py-3">
                            {student.has_evidence ? <Pill className="bg-info/15 text-info">Available</Pill> : <span className="text-muted">—</span>}
                          </td>
                          {attendance.is_homeroom && (
                            <td className="py-3 text-right">
                              {isPending ? (
                                <span className="inline-flex gap-2">
                                  <button
                                    type="button"
                                    className={buttonSecondary}
                                    disabled={busyRecordId === student.record_id}
                                    onClick={() => void reviewAttendance(student, 'approved')}
                                    aria-label={`Approve attendance for ${student.name}`}
                                  >
                                    <Check className="size-4" aria-hidden="true" /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    className={buttonSecondary}
                                    disabled={busyRecordId === student.record_id}
                                    onClick={() => void reviewAttendance(student, 'rejected')}
                                    aria-label={`Reject attendance for ${student.name}`}
                                  >
                                    <X className="size-4" aria-hidden="true" /> Reject
                                  </button>
                                </span>
                              ) : <span className="text-muted">—</span>}
                            </td>
                          )}
                        </tr>
                      )
                    }) : (
                      <tr><td colSpan={attendance?.is_homeroom ? 7 : 6} className="py-8 text-center text-muted">No students are enrolled in this class.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
