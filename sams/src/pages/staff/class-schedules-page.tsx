'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Clock3,
  DoorOpen,
  Plus,
  RefreshCw,
  UserRound,
} from 'lucide-react'
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
import {
  createClassSchedule,
  getAdminClassCatalog,
  getClassSchedule,
  getClassScheduleOptions,
  updateClassScheduleRoom,
  type AdminClassCatalogItem,
  type ClassScheduleDetail,
  type ClassScheduleEntry,
  type ClassScheduleOptions,
  type CreateClassScheduleInput,
} from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'
import { usePathname, useRouter } from '@/lib/nav'
import { ScheduleDetailsModal } from './schedule-details-modal'

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const DEFAULT_TIME_SLOTS = Array.from({ length: 10 }, (_, index) => `${String(index + 7).padStart(2, '0')}:00`)

function addHour(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return `${String((hours + 1) % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export default function StaffClassSchedulesPage() {
  const pathname = usePathname()
  const router = useRouter()
  const prefix = '/staff/class-schedules/'
  const selectedClassId = pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null
  const [classes, setClasses] = useState<AdminClassCatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)
    getAdminClassCatalog()
      .then((result) => {
        if (!active) return
        setClasses(result)
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
  }, [revision])

  if (selectedClassId) {
    return (
      <ClassTimetable
        classId={selectedClassId}
        onBack={() => {
          router.push('/staff/class-schedules')
          setRevision((value) => value + 1)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class Schedules"
        subtitle="Choose a class to view and manage its weekly timetable."
      />

      {isLoading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
          <Spinner /> Loading classes...
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
      ) : classes.length === 0 ? (
        <EmptyState title="No classes available" text="Create a class before managing its schedule." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((classItem) => (
            <button
              key={classItem.id}
              type="button"
              onClick={() => router.push(`/staff/class-schedules/${encodeURIComponent(classItem.id)}`)}
              className="group rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Card className="flex h-full items-center gap-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <CalendarRange className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold text-ink">{classItem.name}</span>
                  <span className="mt-1 block text-sm text-muted">Grade {classItem.grade_level}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ClassTimetable({ classId, onBack }: { classId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<ClassScheduleDetail | null>(null)
  const [options, setOptions] = useState<ClassScheduleOptions | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [selectedCell, setSelectedCell] = useState<{ day: number; time: string } | null>(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)
    Promise.all([getClassSchedule(classId), getClassScheduleOptions()])
      .then(([classSchedule, scheduleOptions]) => {
        if (!active) return
        setDetail(classSchedule)
        setOptions(scheduleOptions)
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
  }, [classId, revision])

  const timeSlots = useMemo(() => {
    const times = new Set(DEFAULT_TIME_SLOTS)
    detail?.schedules.forEach((schedule) => times.add(schedule.start_time))
    return [...times].sort((left, right) => left.localeCompare(right))
  }, [detail])

  async function saveSchedule(input: CreateClassScheduleInput) {
    await createClassSchedule(classId, input)
    setSelectedCell(null)
    setSaveError(null)
    setRevision((value) => value + 1)
  }

  async function saveScheduleRoom(scheduleId: string, room: string) {
    await updateClassScheduleRoom(scheduleId, room)
    setDetail((current) => current
      ? {
          ...current,
          schedules: current.schedules.map((schedule) =>
            schedule.id === scheduleId ? { ...schedule, room: room.trim() || null } : schedule,
          ),
        }
      : current)
  }

  const selectedSchedule = detail?.schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null

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
          <Spinner /> Loading timetable...
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
      ) : detail ? (
        <>
          <PageHeader
            title={`${detail.class.name} Timetable`}
            subtitle={`Grade ${detail.class.grade_level}`}
            action={
              detail.period ? (
                <Pill className="border border-line bg-surface text-muted">
                  {detail.period.academic_year} · Semester {detail.period.semester}
                </Pill>
              ) : undefined
            }
          />

          {!detail.period && (
            <p role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              There is no active academic period. Create or activate an academic period before adding class schedules.
            </p>
          )}
          {saveError && (
            <p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              {saveError}
            </p>
          )}

          <Card className="p-0">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <CalendarRange className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-ink">Weekly timetable</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-surface-muted/50">
                    <th scope="col" className="sticky left-0 z-10 w-24 border-b border-r border-line bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      Time
                    </th>
                    {WEEKDAYS.map((day) => (
                      <th key={day.value} scope="col" className="min-w-40 border-b border-line px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted">
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {timeSlots.map((time) => (
                    <tr key={time} className="align-top">
                      <th scope="row" className="sticky left-0 z-10 border-r border-line bg-surface px-4 py-3 text-xs font-semibold tabular-nums text-muted">
                        {time}
                      </th>
                      {WEEKDAYS.map((day) => {
                        const cellSchedules = detail.schedules.filter(
                          (schedule) => schedule.day_of_week === day.value && schedule.start_time === time,
                        )
                        return (
                          <td key={`${day.value}-${time}`} className="border-l border-line p-2">
                            {cellSchedules.length ? (
                              <div className="space-y-2">
                                {cellSchedules.map((schedule) => (
                                  <ScheduleCard
                                    key={schedule.id}
                                    schedule={schedule}
                                    onClick={() => setSelectedScheduleId(schedule.id)}
                                  />
                                ))}
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!detail.period}
                                onClick={() => {
                                  setSaveError(null)
                                  setSelectedCell({ day: day.value, time })
                                }}
                                className="flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line px-2 py-3 text-xs text-muted transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus className="size-4" aria-hidden="true" />
                                Add Schedule
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail.schedules.length === 0 && (
              <p className="border-t border-line px-5 py-3 text-xs text-muted">
                No schedules are registered for this class in the selected academic period.
              </p>
            )}
          </Card>

          {selectedCell && options && (
            <ScheduleFormModal
              key={`${selectedCell.day}-${selectedCell.time}`}
              day={selectedCell.day}
              startTime={selectedCell.time}
              options={options}
              onClose={() => setSelectedCell(null)}
              onSave={saveSchedule}
              onError={setSaveError}
            />
          )}
          {selectedSchedule && (
            <ScheduleDetailsModal
              schedule={selectedSchedule}
              onClose={() => setSelectedScheduleId(null)}
              onSaveRoom={(room) => saveScheduleRoom(selectedSchedule.id, room)}
            />
          )}
        </>
      ) : (
        <EmptyState title="Class not found" text="This class could not be loaded." />
      )}
    </div>
  )
}

function ScheduleCard({ schedule, onClick }: { schedule: ClassScheduleEntry; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${schedule.subject} schedule details`}
      className="block w-full rounded-xl border border-primary/15 bg-primary/5 p-3 text-left transition hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <p className="font-semibold text-ink">{schedule.subject}</p>
      <p className="mt-1 flex items-center gap-1 text-xs tabular-nums text-muted">
        <Clock3 className="size-3.5" aria-hidden="true" />
        {schedule.start_time} - {schedule.end_time}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
        <UserRound className="size-3.5" aria-hidden="true" /> {schedule.teacher}
      </p>
      {schedule.room && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <DoorOpen className="size-3.5" aria-hidden="true" /> {schedule.room}
        </p>
      )}
    </button>
  )
}

function ScheduleFormModal({
  day,
  startTime,
  options,
  onClose,
  onSave,
  onError,
}: {
  day: number
  startTime: string
  options: ClassScheduleOptions
  onClose: () => void
  onSave: (input: CreateClassScheduleInput) => Promise<void>
  onError: (message: string | null) => void
}) {
  const [form, setForm] = useState({
    day_of_week: day,
    start_time: startTime,
    end_time: addHour(startTime),
    subject_id: '',
    teacher_id: '',
    room: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    onError(null)
    setIsSaving(true)
    try {
      await onSave(form)
    } catch (saveError: unknown) {
      setError(parseApiError(saveError).message)
    } finally {
      setIsSaving(false)
    }
  }

  const canSubmit = options.period !== null && options.subjects.length > 0 && options.teachers.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="mb-5">
          <h2 id="schedule-modal-title" className="text-lg font-bold text-ink">Add Class Schedule</h2>
          <p className="mt-1 text-sm text-muted">Choose the subject, teacher, and time for this class.</p>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}
          {!canSubmit && (
            <p role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              {!options.period
                ? 'There is no active academic period.'
                : 'Add at least one subject and one teacher before creating a schedule.'}
            </p>
          )}

          <label className="block space-y-1.5 text-sm font-medium text-ink">
            Day
            <select
              required
              value={form.day_of_week}
              onChange={(event) => setForm((current) => ({ ...current, day_of_week: Number(event.target.value) }))}
              className={inputClass}
            >
              {WEEKDAYS.map((weekday) => (
                <option key={weekday.value} value={weekday.value}>{weekday.label}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium text-ink">
              Start Time
              <input
                type="time"
                required
                value={form.start_time}
                onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-ink">
              End Time
              <input
                type="time"
                required
                min={form.start_time || undefined}
                value={form.end_time}
                onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm font-medium text-ink">
            Subject
            <select
              required
              value={form.subject_id}
              onChange={(event) => setForm((current) => ({ ...current, subject_id: event.target.value }))}
              className={inputClass}
            >
              <option value="" disabled>Select a subject</option>
              {options.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-ink">
            Teacher
            <select
              required
              value={form.teacher_id}
              onChange={(event) => setForm((current) => ({ ...current, teacher_id: event.target.value }))}
              className={inputClass}
            >
              <option value="" disabled>Select a teacher</option>
              {options.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}{teacher.employee_number ? ` (${teacher.employee_number})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-ink">
            Room
            <input
              type="text"
              maxLength={50}
              value={form.room}
              onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))}
              className={inputClass}
              placeholder="e.g. Room 204"
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onClose} disabled={isSaving} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !canSubmit} className={buttonPrimary}>
              {isSaving && <Spinner />}
              {isSaving ? 'Saving...' : 'Add Schedule'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
