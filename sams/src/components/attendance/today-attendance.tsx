'use client'

import { useState } from 'react'
import { CircleAlert, Clock, Paperclip, RotateCcw, Upload } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { submitAttendance } from '@/lib/api'
import type { AttendanceStatus } from '@/lib/data'
import { cn } from '@/lib/helpers'
import { ApprovalBadge, Card, CardLabel, Spinner, STATUS_META, StatusBadge, buttonPrimary, buttonSecondary, inputClass } from '@/components/ui-kit'

const OPTIONS: AttendanceStatus[] = ['hadir', 'izin', 'sakit']
const MAX_FILE_MB = 2

export function TodayAttendance() {
  const { today, submitToday, resetToday } = useApp()
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const needsEvidence = status === 'izin' || status === 'sakit'

  if (today) {
    return (
      <Card>
        <CardLabel>{"Today's attendance"}</CardLabel>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={today.status} />
          <ApprovalBadge approval={today.approval} />
          <span className="flex items-center gap-1 text-sm text-muted">
            <Clock className="size-4" aria-hidden="true" /> Submitted at {today.time}
          </span>
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
            Your request was rejected and recorded as Alfa. Please contact your homeroom teacher.
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

        <button type="button" onClick={resetToday} className={cn(buttonSecondary, 'mt-5')}>
          <RotateCcw className="size-4" aria-hidden="true" /> Reset (demo)
        </button>
      </Card>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!status) return setError('Please choose your attendance status.')
    if (needsEvidence && note.trim().length < 5) return setError('Please write a short reason (at least 5 characters).')
    if (needsEvidence && !file) return setError('Please upload a letter or evidence file.')
    setError('')
    setSubmitting(true)
    try {
      await submitAttendance({ status, note, evidence: file?.name ?? null })
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      submitToday({ status, note: needsEvidence ? note : '', evidence: needsEvidence ? (file?.name ?? null) : null, time })
    } catch {
      setError('Something went wrong while saving. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleFile(f: File | null) {
    if (f && f.size > MAX_FILE_MB * 1024 * 1024) {
      setFile(null)
      return setError(`File is too large. Maximum size is ${MAX_FILE_MB} MB.`)
    }
    setError('')
    setFile(f)
  }

  return (
    <Card>
      <CardLabel>{"Today's attendance"}</CardLabel>
      <p className="mb-4 text-sm text-muted">{"You haven't checked in yet today."}</p>

      <form onSubmit={handleSubmit} noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">
            Status <span className="text-danger">*</span>
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {OPTIONS.map((opt) => {
              const meta = STATUS_META[opt]
              const selected = status === opt
              return (
                <label
                  key={opt}
                  className={cn(
                    'cursor-pointer rounded-xl border-2 p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
                    selected ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name="status"
                    value={opt}
                    checked={selected}
                    onChange={() => {
                      setStatus(opt)
                      setError('')
                    }}
                    className="sr-only"
                  />
                  <StatusBadge status={opt} />
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
                onChange={(e) => setNote(e.target.value)}
                placeholder={status === 'sakit' ? 'e.g. Fever, visited the doctor' : 'e.g. Family event'}
                className={inputClass}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">
                Evidence / letter <span className="text-danger">*</span>
              </p>
              <label className="flex h-[86px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line px-3 text-center text-sm text-muted hover:border-primary/50">
                <Upload className="size-5" aria-hidden="true" />
                {file ? <span className="truncate text-ink">{file.name}</span> : <span>Upload image or PDF (max {MAX_FILE_MB} MB)</span>}
                <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-danger">
            <CircleAlert className="size-4" aria-hidden="true" /> {error}
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
