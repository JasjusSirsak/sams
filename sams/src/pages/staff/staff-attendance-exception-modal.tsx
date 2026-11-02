'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, FilePlus2, X } from 'lucide-react'
import { buttonPrimary, buttonSecondary, inputClass, Spinner } from '@/components/ui-kit'
import { parseApiError } from '@/lib/apiClient'

export type StaffExceptionStatus = 'permitted' | 'sick'

type StaffAttendanceExceptionModalProps = {
  studentName: string
  initialStatus?: StaffExceptionStatus
  initialNote?: string
  onClose: () => void
  onSave: (status: StaffExceptionStatus, note: string) => Promise<void>
}

export function StaffAttendanceExceptionModal({
  studentName,
  initialStatus = 'permitted',
  initialNote = '',
  onClose,
  onSave,
}: StaffAttendanceExceptionModalProps) {
  const [status, setStatus] = useState<StaffExceptionStatus>(initialStatus)
  const [note, setNote] = useState(initialNote)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reason = note.trim()
    if (!reason) {
      setError('Please enter a reason.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await onSave(status, reason)
    } catch (saveError: unknown) {
      setError(parseApiError(saveError).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-exception-title"
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="attendance-exception-title" className="flex items-center gap-2 text-lg font-bold text-ink">
              <FilePlus2 className="size-5 text-primary" aria-hidden="true" />
              Log Permit
            </h2>
            <p className="mt-1 text-sm text-muted">Record a permission or sick-day exception for {studentName}.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close dialog"
            className="rounded-xl p-1.5 text-muted transition hover:bg-surface-muted hover:text-ink disabled:opacity-50"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {error}
          </p>
        )}

        <form onSubmit={(event) => void submit(event)}>
          <fieldset disabled={isSaving} className="space-y-4">
            <legend className="mb-2 text-sm font-medium text-ink">Exception status</legend>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'permitted', label: 'Permission' },
                { value: 'sick', label: 'Sick' },
              ] as const).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                    status === option.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-line text-ink hover:bg-surface-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="exception-status"
                    value={option.value}
                    checked={status === option.value}
                    onChange={() => setStatus(option.value)}
                    className="accent-primary"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <label className="block space-y-1.5 text-sm font-medium text-ink">
              Reason
              <textarea
                required
                maxLength={2000}
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={`${inputClass} resize-y`}
                placeholder="Enter the reason for this exception"
              />
            </label>
          </fieldset>

          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onClose} disabled={isSaving} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !note.trim()} className={buttonPrimary}>
              {isSaving && <Spinner />}
              {isSaving ? 'Saving...' : 'Save Exception'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
