'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Clock, Paperclip, RefreshCw, Upload } from 'lucide-react'
import { getTodayAttendance, submitAttendance, type TodayAttendanceRecord } from '@/lib/api'
import { cn } from '@/lib/helpers'
import { ApprovalBadge, Card, CardLabel, Skeleton, Spinner, STATUS_META, StatusBadge, buttonPrimary, buttonSecondary, inputClass } from '@/components/ui-kit'

type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alfa'
type ApprovalStatus = 'approved' | 'pending' | 'rejected'

type TodayViewRecord = {
  status: AttendanceStatus
  approval: ApprovalStatus
  note: string
  evidence: string | null
  time: string
}

const OPTIONS: AttendanceStatus[] = ['hadir', 'izin', 'sakit']
const MAX_FILE_MB = 2

function toTodayViewRecord(record: TodayAttendanceRecord): TodayViewRecord {
  const statusMap: Record<string, AttendanceStatus> = {
    PRESENT: 'hadir',
    SICK: 'sakit',
    PERMITTED: 'izin',
    PERMISSION: 'izin',
    ABSENT: 'alfa',
  }
  const approvalMap: Record<string, ApprovalStatus> = {
    NOT_REQUIRED: 'approved',
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  }
  const status = statusMap[record.status.toUpperCase()]
  const approval = approvalMap[record.approval_status.toUpperCase()]
  if (!status || !approval) {
    throw new Error('The server returned an unsupported attendance status.')
  }
  const createdAt = new Date(record.created_at)

  return {
    status,
    approval,
    note: record.note ?? '',
    evidence: record.document_url,
    time: Number.isNaN(createdAt.getTime())
      ? ''
      : createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response) {
      const data = error.response.data
      if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
        return data.message
      }
    }
    if ('message' in error && typeof error.message === 'string') return error.message
  }
  return fallback
}

export function TodayAttendance() {
  const [today, setToday] = useState<TodayViewRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadRetry, setLoadRetry] = useState(0)
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const needsEvidence = status === 'izin' || status === 'sakit'

  useEffect(() => {
    let isActive = true

    getTodayAttendance()
      .then((record) => {
        if (isActive) {
          setToday(record ? toTodayViewRecord(record) : null)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (isActive) setLoadError(getErrorMessage(error, "Couldn't load today's attendance."))
      })
      .finally(() => {
        if (isActive) setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [loadRetry])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!status) {
      setSubmitError('Please choose your attendance status.')
      return
    }
    if (needsEvidence && note.trim().length < 5) {
      setSubmitError('Please write a short reason (at least 5 characters).')
      return
    }
    if (needsEvidence && !file) {
      setSubmitError('Please upload a letter or evidence file.')
      return
    }

    setSubmitError('')
    setSubmitting(true)
    try {
      const serverStatus = status === 'hadir' ? 'PRESENT' : status === 'sakit' ? 'SICK' : 'PERMITTED'
      const response = await submitAttendance({
        status: serverStatus,
        note: needsEvidence ? note.trim() : undefined,
        file: needsEvidence ? file : null,
      })
      setToday(toTodayViewRecord(response.data))
    } catch (error: unknown) {
      setSubmitError(getErrorMessage(error, 'Failed to submit attendance. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleFile(fileToUpload: File | null) {
    if (fileToUpload && fileToUpload.size > MAX_FILE_MB * 1024 * 1024) {
      setFile(null)
      setSubmitError(`File is too large. Maximum size is ${MAX_FILE_MB} MB.`)
      return
    }
    setSubmitError('')
    setFile(fileToUpload)
  }

  if (loading) {
    return (
      <Card>
        <CardLabel>Today's attendance</CardLabel>
        <div role="status" aria-label="Loading today's attendance" className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card>
        <CardLabel>Today's attendance</CardLabel>
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-600">
            <AlertCircle className="size-4" aria-hidden="true" /> {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setLoadRetry((retry) => retry + 1)
            }}
            className={`${buttonSecondary} mt-3 py-1.5`}
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Try again
          </button>
        </div>
      </Card>
    )
  }

  if (today) {
    return (
      <Card>
        <CardLabel>Today's attendance</CardLabel>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={today.status} />
          <ApprovalBadge approval={today.approval} />
          {today.time && (
            <span className="flex items-center gap-1 text-sm text-muted">
              <Clock className="size-4" aria-hidden="true" /> Submitted at {today.time}
            </span>
          )}
        </div>

        {today.approval === 'pending' && (
          <p className="mt-4 rounded-xl bg-warning/10 p-3 text-sm text-ink">
            Your request is waiting for your homeroom teacher to review the evidence.
          </p>
        )}
        {today.approval === 'approved' && (
          <p className="mt-4 rounded-xl bg-success/10 p-3 text-sm text-ink">
            {today.status === 'hadir' ? "You're checked in. Have a great day at school!" : 'Your request was approved by your homeroom teacher.'}
          </p>
        )}
        {today.approval === 'rejected' && (
          <p className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-ink">
            Your request was rejected and recorded as Absent. Please contact your homeroom teacher.
          </p>
        )}

        {(today.note || today.evidence) && (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {today.note && (
              <div>
                <dt className="text-muted">Reason</dt>
                <dd className="text-ink">{today.note}</dd>
              </div>
            )}
            {today.evidence && (
              <div>
                <dt className="text-muted">Evidence</dt>
                <dd className="flex items-center gap-1 text-ink">
                  <Paperclip className="size-4" aria-hidden="true" /> {today.evidence}
                </dd>
              </div>
            )}
          </dl>
        )}
      </Card>
    )
  }

  return (
    <Card>
      <CardLabel>Today's attendance</CardLabel>
      <p className="mb-4 text-sm text-muted">You haven't checked in yet today.</p>

      <form onSubmit={handleSubmit} noValidate>
        <fieldset disabled={submitting}>
          <legend className="mb-2 text-sm font-medium text-ink">
            Status <span className="text-danger">*</span>
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {OPTIONS.map((option) => {
              const meta = STATUS_META[option]
              return (
                <label
                  key={option}
                  className={cn(
                    'cursor-pointer rounded-xl border-2 p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
                    status === option ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option}
                    checked={status === option}
                    onChange={() => {
                      setStatus(option)
                      setSubmitError('')
                    }}
                    className="sr-only"
                  />
                  <StatusBadge status={option} />
                  <span className="mt-2 block text-sm text-muted">{meta.hint}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {needsEvidence && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-ink">
                Reason <span className="text-danger">*</span>
              </label>
              <textarea
                id="reason"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={status === 'sakit' ? 'e.g. Fever, visited the doctor' : 'e.g. Family event'}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="evidence" className="mb-1.5 block text-sm font-medium text-ink">
                Evidence / letter <span className="text-danger">*</span>
              </label>
              <label className="flex h-[86px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line px-3 text-center text-sm text-muted hover:border-primary/50">
                <Upload className="size-5" aria-hidden="true" />
                {file ? <span className="truncate text-ink">{file.name}</span> : <span>Upload image or PDF (max {MAX_FILE_MB} MB)</span>}
                <input
                  id="evidence"
                  type="file"
                  accept="image/*,.pdf"
                  className="sr-only"
                  onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        )}

        {submitError && (
          <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="size-4" aria-hidden="true" /> {submitError}
          </p>
        )}

        <button type="submit" disabled={submitting} className={cn(buttonPrimary, 'mt-5')}>
          {submitting && <Spinner />}
          {submitting ? 'Submitting...' : 'Submit attendance'}
        </button>
      </form>
    </Card>
  )
}
