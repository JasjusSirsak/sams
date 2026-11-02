'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, ClipboardCheck, Download, FilePlus2, RefreshCw, Search, Users } from 'lucide-react'
import {
  Card,
  EmptyState,
  PageHeader,
  Pill,
  Spinner,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from '@/components/ui-kit'
import type { AdminClassCatalogItem, AdminClassStudent, ApiAttendanceStatus } from '@/lib/api'
import { getAdminClassCatalog, getAdminClassStudents, getTeacherClassAttendance, saveStaffAttendanceException } from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'
import { usePathname, useRouter } from '@/lib/nav'
import { cn, toKey } from '@/lib/helpers'
import { StaffAttendanceExceptionModal, type StaffExceptionStatus } from './staff-attendance-exception-modal'
import { AttendanceExportModal } from './attendance-export-modal'

const DEFAULT_STATUS_OPTIONS: Array<{ value: 'present' | 'absent'; label: string; className: string }> = [
  { value: 'present', label: 'Present', className: 'text-success' },
  { value: 'absent', label: 'Absent', className: 'text-danger' },
]

function getAttendanceStatus(status: string | null): ApiAttendanceStatus | null {
  switch (status?.toLowerCase()) {
    case 'present':
      return 'present'
    case 'absent':
      return 'absent'
    case 'permitted':
      return 'permitted'
    case 'sick':
      return 'sick'
    default:
      return null
  }
}

function getSampleCounts(classIndex: number, studentCount: number) {
  let remaining = studentCount
  const absent = Math.min(remaining, classIndex % 3)
  remaining -= absent
  const permitted = Math.min(remaining, (classIndex + 1) % 2)
  remaining -= permitted
  const sick = Math.min(remaining, (classIndex + 2) % 2)
  return { absent, permitted, sick }
}

function AttendanceCount({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <div className={cn('rounded-xl px-3 py-2 text-center', className)}>
      <p className="text-lg font-bold leading-tight">{count}</p>
      <p className="mt-0.5 text-[11px] font-medium">{label}</p>
    </div>
  )
}

export default function StaffClassesAttendancePage() {
  const pathname = usePathname()
  const router = useRouter()
  const prefix = '/staff/classes-attendance/'
  const selectedClassId = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : null
  const [classes, setClasses] = useState<AdminClassCatalogItem[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(true)
  const [classesError, setClassesError] = useState<string | null>(null)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  useEffect(() => {
    let active = true
    setIsLoadingClasses(true)
    setClassesError(null)
    getAdminClassCatalog()
      .then((result) => {
        if (!active) return
        setClasses(result)
        setIsLoadingClasses(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setClassesError(parseApiError(error).message)
        setIsLoadingClasses(false)
      })
    return () => {
      active = false
    }
  }, [catalogRevision])

  const filteredClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return classes.filter((classItem) => !query || classItem.name.toLowerCase().includes(query))
  }, [classes, searchQuery])

  if (selectedClassId) {
    return (
      <ClassAttendanceDetail
        classId={selectedClassId}
        onBack={() => {
          router.push('/staff/classes-attendance')
          setCatalogRevision((revision) => revision + 1)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes Attendance"
        subtitle="Select a class to record today's student attendance."
        action={
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            disabled={isLoadingClasses || classes.length === 0}
            className={buttonSecondary}
          >
            <Download className="size-4" aria-hidden="true" />
            Export Report
          </button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search classes..."
            aria-label="Search classes"
            className={`${inputClass} pl-10`}
          />
        </div>
        <p className="text-xs text-muted">Today attendance summary across classes.</p>
      </div>

      {isLoadingClasses ? (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
          <Spinner /> Loading classes...
        </div>
      ) : classesError ? (
        <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 p-5 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-danger">
            <AlertCircle className="size-4" aria-hidden="true" /> {classesError}
          </p>
          <button
            type="button"
            onClick={() => setCatalogRevision((revision) => revision + 1)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/15"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" /> Try again
          </button>
        </div>
      ) : filteredClasses.length === 0 ? (
        <EmptyState
          title={classes.length ? 'No matching classes' : 'No classes available'}
          text={classes.length ? 'Try another class name.' : 'There are no classes to take attendance for yet.'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredClasses.map((classItem) => {
            const counts = classItem.attendance_today ?? { absent: 0, permitted: 0, sick: 0 }
            return (
              <Card key={classItem.id} className="flex flex-col gap-5 transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Pill className="border border-primary/20 bg-primary/10 font-semibold text-primary">
                      Grade {classItem.grade_level}
                    </Pill>
                    <h2 className="mt-3 truncate text-lg font-bold tracking-tight text-ink">{classItem.name}</h2>
                    <p className="mt-1 text-xs text-muted">
                      {classItem.academic_year || 'Current academic period'}
                      {classItem.room ? ` · ${classItem.room}` : ''}
                    </p>
                  </div>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Users className="size-5" aria-hidden="true" />
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2" aria-label={`Sample attendance counts for ${classItem.name}`}>
                  <AttendanceCount label="Absent" count={counts.absent} className="bg-danger/10 text-danger" />
                  <AttendanceCount label="Permission" count={counts.permitted} className="bg-warning/15 text-warning" />
                  <AttendanceCount label="Sick" count={counts.sick} className="bg-info/10 text-info" />
                </div>

                <div className="flex items-center justify-between border-t border-line pt-4">
                  <p className="text-sm font-semibold text-ink">
                    {classItem.student_count} <span className="font-normal text-muted">students</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(`/staff/classes-attendance/${encodeURIComponent(classItem.id)}`)}
                    className={`${buttonPrimary} px-3 py-2`}
                  >
                    Open <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {isExportModalOpen && (
        <AttendanceExportModal
          classes={classes}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
    </div>
  )
}

function ClassAttendanceDetail({ classId, onBack }: { classId: string; onBack: () => void }) {
  const [classData, setClassData] = useState<AdminClassCatalogItem | null>(null)
  const [students, setStudents] = useState<AdminClassStudent[]>([])
  const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent'>>({})
  const [exceptions, setExceptions] = useState<Record<string, { status: StaffExceptionStatus; note: string }>>({})
  const [attendanceDate, setAttendanceDate] = useState(() => toKey(new Date()))
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)
    Promise.all([
      getAdminClassStudents(classId),
      getTeacherClassAttendance(classId, attendanceDate),
    ])
      .then(([roster, attendance]) => {
        if (!active) return
        const attendanceByStudent = new Map(attendance.students.map((student) => [student.student_id, student]))
        setClassData(roster.class)
        setStudents(roster.students)
        setStatuses(Object.fromEntries(roster.students.map((student) => {
          const currentStatus = getAttendanceStatus(attendanceByStudent.get(student.id)?.status ?? null)
          return [student.id, currentStatus === 'absent' ? 'absent' : 'present']
        })))
        setExceptions(Object.fromEntries(roster.students.flatMap((student) => {
          const current = attendanceByStudent.get(student.id)
          const currentStatus = getAttendanceStatus(current?.status ?? null)
          return current && (currentStatus === 'permitted' || currentStatus === 'sick')
            ? [[student.id, { status: currentStatus, note: current.note ?? '' }]]
            : []
        })))
        setIsLoading(false)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(parseApiError(loadError).message)
        setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [classId, attendanceDate, revision])

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const totals = students.reduce(
    (result, student) => {
      const status = exceptions[student.id]?.status ?? statuses[student.id] ?? 'present'
      result[status] += 1
      return result
    },
    { present: 0, absent: 0, permitted: 0, sick: 0 },
  )
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null

  async function saveException(status: StaffExceptionStatus, note: string) {
    if (!classData || !selectedStudent) return
    const result = await saveStaffAttendanceException({
      class_id: classData.id,
      student_id: selectedStudent.id,
      date: attendanceDate,
      status: status === 'permitted' ? 'PERMITTED' : 'SICK',
      note,
    })
    setExceptions((current) => ({
      ...current,
      [selectedStudent.id]: { status, note },
    }))
    setSelectedStudentId(null)
    setToast(
      result.notified_recipients > 0
        ? `Attendance exception saved. In-app notifications sent to ${result.notified_recipients} recipient${result.notified_recipients === 1 ? '' : 's'}.`
        : 'Attendance exception saved, but no linked parents or homeroom teacher were found to notify.',
    )
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to Classes
      </button>

      {isLoading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
          <Spinner /> Loading class roster...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 p-5 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-danger">
            <AlertCircle className="size-4" aria-hidden="true" /> {error}
          </p>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/15"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" /> Try again
          </button>
        </div>
      ) : !classData ? (
        <EmptyState title="Class not found" text="This class could not be loaded." />
      ) : (
        <>
          <PageHeader
            title={`${classData.name} Attendance`}
            subtitle={`Grade ${classData.grade_level} · ${students.length} enrolled students`}
            action={
              <label className="flex items-center gap-2 text-sm font-medium text-muted">
                Attendance date
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(event) => {
                    if (!event.target.value) return
                    setAttendanceDate(event.target.value)
                    setToast(null)
                  }}
                  required
                  className={`${inputClass} w-auto`}
                />
              </label>
            }
          />

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
                <h2 className="font-semibold text-ink">Student roster</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Pill className="bg-warning/15 text-warning">Permission exceptions {totals.permitted}</Pill>
                <Pill className="bg-info/10 text-info">Sick exceptions {totals.sick}</Pill>
              </div>
            </div>

            {students.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No students enrolled" text="This class does not have any students in its current roster." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-muted/50 text-xs uppercase tracking-wide text-muted">
                      <th scope="col" className="px-5 py-3 font-medium">Student</th>
                      <th scope="col" className="px-5 py-3 font-medium">NIS</th>
                      <th scope="col" className="px-5 py-3 font-medium">Attendance status</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {students.map((student) => {
                      const exception = exceptions[student.id]
                      const statusOptions = exception
                        ? [
                            ...DEFAULT_STATUS_OPTIONS,
                            {
                              value: exception.status,
                              label: exception.status === 'permitted' ? 'Permission' : 'Sick',
                              className: exception.status === 'permitted' ? 'text-warning' : 'text-info',
                            },
                          ]
                        : DEFAULT_STATUS_OPTIONS
                      return (
                        <tr key={student.id} className="hover:bg-surface-muted/40">
                          <th scope="row" className="px-5 py-4 font-medium text-ink">{student.name}</th>
                          <td className="px-5 py-4 text-muted">{student.nis}</td>
                          <td className="px-5 py-4">
                            <select
                              value={exception?.status ?? statuses[student.id] ?? 'present'}
                              disabled={Boolean(exception)}
                              onChange={(event) => {
                                const status = DEFAULT_STATUS_OPTIONS.find((option) => option.value === event.target.value)?.value
                                if (!status) return
                                setStatuses((current) => ({
                                  ...current,
                                  [student.id]: status,
                                }))
                              }}
                              aria-label={`Attendance status for ${student.name}`}
                              className={`${inputClass} max-w-48 disabled:cursor-not-allowed disabled:opacity-70`}
                            >
                              {statusOptions.map(({ value, label, className }) => (
                                <option key={value} value={value} className={className}>{label}</option>
                              ))}
                            </select>
                            {exception && <p className="mt-1.5 text-xs font-medium text-warning">Exception logged</p>}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentId(student.id)}
                              className={`${buttonSecondary} px-3 py-2`}
                            >
                              <FilePlus2 className="size-4" aria-hidden="true" />
                              {exceptions[student.id] ? 'Edit Exception' : 'Log Permit'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="text-sm text-muted">
            Present and Absent are default roster values. Only Permission and Sick exceptions are saved by Staff.
          </p>
        </>
      )}

      {selectedStudent && (
        <StaffAttendanceExceptionModal
          studentName={selectedStudent.name}
          initialStatus={exceptions[selectedStudent.id]?.status}
          initialNote={exceptions[selectedStudent.id]?.note}
          onClose={() => setSelectedStudentId(null)}
          onSave={saveException}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl border border-success/20 bg-surface px-4 py-3 text-sm font-medium text-ink shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
