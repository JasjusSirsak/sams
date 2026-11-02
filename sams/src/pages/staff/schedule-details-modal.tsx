'use client'

import { useState, type ReactNode } from 'react'
import { AlertCircle, Clock3, DoorOpen, Pencil, UserRound, X } from 'lucide-react'
import { buttonPrimary, buttonSecondary, inputClass, Spinner } from '@/components/ui-kit'
import type { ClassScheduleEntry } from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type ScheduleDetailsModalProps = {
  schedule: ClassScheduleEntry
  onClose: () => void
  onSaveRoom: (room: string) => Promise<void>
}

export function ScheduleDetailsModal({
  schedule,
  onClose,
  onSaveRoom,
}: ScheduleDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [room, setRoom] = useState(schedule.room ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function cancelEdit() {
    setRoom(schedule.room ?? '')
    setError(null)
    setIsEditing(false)
  }

  async function saveRoom() {
    setIsSaving(true)
    setError(null)
    try {
      await onSaveRoom(room)
      setIsEditing(false)
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
        aria-labelledby="schedule-details-title"
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="schedule-details-title" className="text-lg font-bold text-ink">
              Schedule Details
            </h2>
            <p className="mt-1 text-sm text-muted">{schedule.subject}</p>
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

        <div className="space-y-4">
          <ReadOnlyDetail label="Subject" value={schedule.subject} />
          <ReadOnlyDetail
            label="Teacher"
            value={schedule.teacher}
            icon={<UserRound className="size-4" aria-hidden="true" />}
          />
          <ReadOnlyDetail
            label="Day & Time"
            value={`${WEEKDAYS[schedule.day_of_week - 1] ?? 'Unknown day'} · ${schedule.start_time} - ${schedule.end_time}`}
            icon={<Clock3 className="size-4" aria-hidden="true" />}
          />

          {isEditing ? (
            <label className="block space-y-1.5 text-sm font-medium text-ink">
              Room
              <input
                type="text"
                maxLength={50}
                value={room}
                onChange={(event) => setRoom(event.target.value)}
                className={inputClass}
                placeholder="Enter a room"
              />
            </label>
          ) : (
            <ReadOnlyDetail
              label="Room"
              value={schedule.room || 'Not assigned'}
              icon={<DoorOpen className="size-4" aria-hidden="true" />}
            />
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          {isEditing ? (
            <>
              <button type="button" onClick={cancelEdit} disabled={isSaving} className={buttonSecondary}>
                Cancel
              </button>
              <button type="button" onClick={() => void saveRoom()} disabled={isSaving} className={buttonPrimary}>
                {isSaving && <Spinner />}
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setIsEditing(true)} className={buttonPrimary}>
              <Pencil className="size-4" aria-hidden="true" /> Edit
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

function ReadOnlyDetail({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted/40 px-3 py-2.5 text-sm text-muted">
        {icon}
        {value}
      </p>
    </div>
  )
}
