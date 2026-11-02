'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, CalendarDays, Clock, MapPin, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
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
  createManagedAgenda,
  deleteManagedAgenda,
  getManagedAgendas,
  updateManagedAgenda,
  type ManagedAgenda,
  type ManagedAgendaType,
  type SaveAgendaInput,
} from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'

const AGENDA_TYPES: Array<{ value: ManagedAgendaType; label: string }> = [
  { value: 'EVENT', label: 'Event' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'ACTIVITY', label: 'Activity' },
  { value: 'EXAM', label: 'Exam' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'OTHER', label: 'Other' },
]

type AgendaFormState = {
  title: string
  description: string
  date: string
  type: ManagedAgendaType
  start_time: string
  end_time: string
  location: string
  all_day: boolean
}

const EMPTY_FORM: AgendaFormState = {
  title: '',
  description: '',
  date: '',
  type: 'EVENT',
  start_time: '',
  end_time: '',
  location: '',
  all_day: false,
}

function formatAgendaDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function StaffAgendaManagement() {
  const [agendas, setAgendas] = useState<ManagedAgenda[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [editingAgenda, setEditingAgenda] = useState<ManagedAgenda | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setLoadError(null)
    getManagedAgendas()
      .then((result) => {
        if (!active) return
        setAgendas(result)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadError(parseApiError(error).message)
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [revision])

  async function handleDelete(agenda: ManagedAgenda) {
    if (!window.confirm(`Delete "${agenda.title}"? This action cannot be undone.`)) return

    setDeletingId(agenda.id)
    setActionError(null)
    try {
      await deleteManagedAgenda(agenda.id)
      setAgendas((current) => current.filter((item) => item.id !== agenda.id))
    } catch (error: unknown) {
      setActionError(parseApiError(error).message)
    } finally {
      setDeletingId(null)
    }
  }

  function openCreateForm() {
    setActionError(null)
    setEditingAgenda(null)
    setIsCreating(true)
  }

  function openEditForm(agenda: ManagedAgenda) {
    setActionError(null)
    setIsCreating(false)
    setEditingAgenda(agenda)
  }

  function closeForm() {
    setIsCreating(false)
    setEditingAgenda(null)
    setActionError(null)
  }

  const formAgenda = isCreating ? null : editingAgenda

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Agenda"
        subtitle="Create and manage school-wide events, holidays, activities, and other agendas."
        action={
          <button type="button" onClick={openCreateForm} className={buttonPrimary}>
            <Plus className="size-4" aria-hidden="true" />
            Create Agenda
          </button>
        }
      />

      {actionError && !isCreating && !editingAgenda && (
        <p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
          {actionError}
        </p>
      )}

      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-ink">School-wide agendas</h2>
        </div>

        {isLoading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-muted">
            <Spinner /> Loading agendas...
          </div>
        ) : loadError ? (
          <div className="p-5 text-center">
            <p role="alert" className="flex items-center justify-center gap-2 text-sm text-danger">
              <AlertCircle className="size-4" aria-hidden="true" /> {loadError}
            </p>
            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/15"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" /> Try again
            </button>
          </div>
        ) : agendas.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No agendas yet"
              text="Create a school-wide agenda to share important dates and activities."
              action={
                <button type="button" onClick={openCreateForm} className={buttonPrimary}>
                  <Plus className="size-4" aria-hidden="true" /> Create Agenda
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-muted/50 text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-3 font-medium">Title</th>
                  <th scope="col" className="px-5 py-3 font-medium">Date</th>
                  <th scope="col" className="px-5 py-3 font-medium">Type</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {agendas.map((agenda) => (
                  <tr key={agenda.id} className="transition-colors hover:bg-surface-muted/40">
                    <th scope="row" className="px-5 py-4 font-medium text-ink">
                      <span className="block">{agenda.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-normal text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden="true" />
                          {agenda.start_time && agenda.end_time
                            ? `${agenda.start_time} - ${agenda.end_time}`
                            : 'All Day'}
                        </span>
                        {agenda.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" aria-hidden="true" />
                            {agenda.location}
                          </span>
                        )}
                      </span>
                      {agenda.description && (
                        <span className="mt-1 block max-w-lg truncate text-xs font-normal text-muted">
                          {agenda.description}
                        </span>
                      )}
                    </th>
                    <td className="whitespace-nowrap px-5 py-4 text-muted">{formatAgendaDate(agenda.date)}</td>
                    <td className="px-5 py-4">
                      <Pill className="bg-primary/10 text-primary">
                        {AGENDA_TYPES.find(({ value }) => value === agenda.type)?.label ?? agenda.type}
                      </Pill>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(agenda)}
                          aria-label={`Edit ${agenda.title}`}
                          className="inline-flex items-center justify-center rounded-xl border border-line px-2.5 py-2 text-muted transition hover:bg-surface-muted hover:text-primary"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(agenda)}
                          disabled={deletingId !== null}
                          aria-label={`Delete ${agenda.title}`}
                          className="inline-flex items-center justify-center rounded-xl border border-danger/30 px-2.5 py-2 text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === agenda.id ? (
                            <Spinner />
                          ) : (
                            <Trash2 className="size-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(isCreating || editingAgenda) && (
        <AgendaFormModal
          key={editingAgenda?.id ?? 'new-agenda'}
          agenda={formAgenda}
          error={actionError}
          onClose={closeForm}
          onSave={async (form) => {
            const payload: SaveAgendaInput = {
              title: form.title.trim(),
              description: form.description.trim(),
              date: form.date,
              type: form.type,
              start_time: form.all_day ? null : form.start_time,
              end_time: form.all_day ? null : form.end_time,
              location: form.location.trim() || null,
            }
            if (editingAgenda) {
              await updateManagedAgenda(editingAgenda.id, payload)
            } else {
              await createManagedAgenda(payload)
            }
            closeForm()
            setRevision((value) => value + 1)
          }}
          onError={setActionError}
        />
      )}
    </div>
  )
}

function AgendaFormModal({
  agenda,
  error,
  onClose,
  onSave,
  onError,
}: {
  agenda: ManagedAgenda | null
  error: string | null
  onClose: () => void
  onSave: (form: AgendaFormState) => Promise<void>
  onError: (message: string | null) => void
}) {
  const [form, setForm] = useState<AgendaFormState>(() =>
    agenda
      ? {
          title: agenda.title,
          description: agenda.description ?? '',
          date: agenda.date,
          type: agenda.type,
          start_time: agenda.start_time ?? '',
          end_time: agenda.end_time ?? '',
          location: agenda.location ?? '',
          all_day: agenda.start_time === null && agenda.end_time === null,
        }
      : { ...EMPTY_FORM },
  )
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    onError(null)
    setIsSaving(true)
    try {
      await onSave(form)
    } catch (saveError: unknown) {
      setFormError(parseApiError(saveError).message)
    } finally {
      setIsSaving(false)
    }
  }

  const errorMessage = formError ?? error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-modal-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="agenda-modal-title" className="text-lg font-bold text-ink">
              {agenda ? 'Edit Agenda' : 'Create Agenda'}
            </h2>
            <p className="mt-1 text-sm text-muted">Enter the details for this school-wide agenda.</p>
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

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          {errorMessage && (
            <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {errorMessage}
            </p>
          )}

          <label className="block space-y-1.5 text-sm font-medium text-ink">
            Title
            <input
              type="text"
              required
              maxLength={200}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className={inputClass}
              placeholder="e.g. Independence Day Celebration"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-ink">
            Description
            <textarea
              rows={4}
              maxLength={5000}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className={`${inputClass} resize-y`}
              placeholder="Add helpful details for students, parents, and teachers."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium text-ink">
              Date
              <input
                type="date"
                required
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                className={inputClass}
              />
            </label>

            <label className="block space-y-1.5 text-sm font-medium text-ink">
              Type
              <select
                value={form.type}
                onChange={(event) => {
                  const type = AGENDA_TYPES.find((option) => option.value === event.target.value)?.value
                  if (type) setForm((current) => ({ ...current, type }))
                }}
                className={inputClass}
              >
                {AGENDA_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  all_day: event.target.checked,
                  start_time: event.target.checked ? '' : current.start_time,
                  end_time: event.target.checked ? '' : current.end_time,
                }))
              }
              className="size-4 rounded border-line accent-primary"
            />
            All Day Event
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium text-ink">
              Start Time
              <input
                type="time"
                required={!form.all_day}
                disabled={form.all_day}
                value={form.start_time}
                onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
                className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-ink">
              End Time
              <input
                type="time"
                required={!form.all_day}
                disabled={form.all_day}
                min={form.start_time || undefined}
                value={form.end_time}
                onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm font-medium text-ink">
            Location / Venue
            <input
              type="text"
              list="agenda-location-options"
              maxLength={100}
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              className={inputClass}
              placeholder="Search or enter a location"
            />
            <datalist id="agenda-location-options">
              <option value="Auditorium" />
              <option value="School Grounds" />
              <option value="Gymnasium" />
              <option value="Meeting Room" />
            </datalist>
          </label>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onClose} disabled={isSaving} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className={buttonPrimary}>
              {isSaving && <Spinner />}
              {isSaving ? 'Saving...' : agenda ? 'Save changes' : 'Create Agenda'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
