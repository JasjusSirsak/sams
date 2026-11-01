'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, Plus, Trash2, Users, X } from 'lucide-react'
import { buttonPrimary, buttonSecondary, inputClass, Pill } from '@/components/ui-kit'
import type {
  AdminClassParent,
  AdminClassParentInput,
  AdminClassStudent,
} from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'

type StudentDraft = Omit<
  Pick<AdminClassStudent, 'nis' | 'name' | 'birth_date' | 'phone_number' | 'address' | 'gender'>,
  'gender'
> & { gender: string }

type ParentDraft = Omit<AdminClassParent, 'id' | 'is_active' | 'relationship_type'> & {
  id: string
  is_active: boolean | null
  relationship_type: string
  temporary_password: string
}

type EditStudentDrawerProps = {
  student: AdminClassStudent
  onClose: () => void
  onSaveStudent: (student: StudentDraft) => Promise<void>
  onSaveParents: (parents: AdminClassParentInput[]) => Promise<void>
  isSaving: boolean
  error: string | null
}

const fieldClass = 'block space-y-1.5 text-xs font-medium text-ink'

export function EditStudentDrawer({
  student,
  onClose,
  onSaveStudent,
  onSaveParents,
  isSaving,
  error,
}: EditStudentDrawerProps) {
  const [activeTab, setActiveTab] = useState<'student' | 'parents'>('student')
  const [draft, setDraft] = useState<StudentDraft>({
    nis: student.nis,
    name: student.name,
    birth_date: student.birth_date,
    phone_number: student.phone_number,
    address: student.address,
    gender: student.gender ?? '',
  })
  const [parents, setParents] = useState<ParentDraft[]>(
    (student.parents ?? []).map((parent) => ({
      ...parent,
      relationship_type: parent.relationship_type ?? '',
      temporary_password: '',
    })),
  )
  const [isSavingParents, setIsSavingParents] = useState(false)
  const [parentsError, setParentsError] = useState<string | null>(null)
  const isSavingAny = isSaving || isSavingParents

  const updateStudent = <K extends keyof StudentDraft>(key: K, value: StudentDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const addParent = () => {
    setParents((current) => [
      ...current,
      {
        id: `new-${Date.now()}-${current.length}`,
        name: '',
        relationship_type: 'GUARDIAN',
        phone_number: '',
        address: '',
        username: '',
        temporary_password: '',
        is_active: null,
      },
    ])
  }

  const updateParent = <K extends keyof ParentDraft>(
    id: string,
    key: K,
    value: ParentDraft[K],
  ) => {
    setParents((current) =>
      current.map((parent) => (parent.id === id ? { ...parent, [key]: value } : parent)),
    )
  }

  const handleStudentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSaveStudent({
      ...draft,
      nis: draft.nis.trim(),
      name: draft.name.trim(),
      phone_number: draft.phone_number.trim(),
      address: draft.address.trim(),
    })
  }

  const handleParentsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingParents(true)
    setParentsError(null)
    try {
      await onSaveParents(
        parents.map((parent) => ({
          ...(parent.id.startsWith('new-') ? {} : { parent_id: parent.id }),
          name: parent.name.trim(),
          username: parent.username.trim(),
          ...(parent.temporary_password
            ? { temporary_password: parent.temporary_password }
            : {}),
          relationship_type: parent.relationship_type,
          phone_number: parent.phone_number.trim(),
          address: parent.address.trim(),
        })),
      )
      onClose()
    } catch (saveError: unknown) {
      setParentsError(parseApiError(saveError).message)
    } finally {
      setIsSavingParents(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs">
      <button
        type="button"
        aria-label="Close student editor"
        className="absolute inset-0 size-full cursor-default"
        disabled={isSavingAny}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <h2 id="edit-student-title" className="text-lg font-bold text-ink">
              Edit Student
            </h2>
            <p className="mt-1 text-sm text-muted">{student.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSavingAny}
            className="rounded-xl p-2 text-muted transition hover:bg-surface-muted hover:text-ink"
            aria-label="Close drawer"
          >
            <X className="size-5" />
          </button>
        </header>

        <nav
          role="tablist"
          aria-label="Edit student sections"
          className="flex gap-2 border-b border-line px-6 py-3"
        >
          <button
            type="button"
            id="student-info-tab"
            role="tab"
            disabled={isSavingAny}
            onClick={() => setActiveTab('student')}
            aria-selected={activeTab === 'student'}
            aria-controls="student-info-panel"
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === 'student'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-surface-muted hover:text-ink'
            }`}
          >
            Student Info
          </button>
          <button
            type="button"
            id="parent-info-tab"
            role="tab"
            disabled={isSavingAny}
            onClick={() => setActiveTab('parents')}
            aria-selected={activeTab === 'parents'}
            aria-controls="parent-info-panel"
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === 'parents'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-surface-muted hover:text-ink'
            }`}
          >
            Parent Info
            <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs">
              {parents.length}
            </span>
          </button>
        </nav>

        {activeTab === 'student' ? (
          <form
            id="student-info-panel"
            role="tabpanel"
            aria-labelledby="student-info-tab"
            onSubmit={handleStudentSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={fieldClass}>
                  Student Number (NIS)
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={draft.nis}
                    onChange={(event) => updateStudent('nis', event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className={fieldClass}>
                  Student Name
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={draft.name}
                    onChange={(event) => updateStudent('name', event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className={fieldClass}>
                  Birth Date
                  <input
                    type="date"
                    value={draft.birth_date}
                    onChange={(event) => updateStudent('birth_date', event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className={fieldClass}>
                  Phone Number
                  <input
                    type="text"
                    maxLength={30}
                    value={draft.phone_number}
                    onChange={(event) => updateStudent('phone_number', event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className={fieldClass}>
                  Gender
                  <select
                    value={draft.gender}
                    onChange={(event) => updateStudent('gender', event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Not specified</option>
                    {draft.gender && !['Male', 'Female'].includes(draft.gender) && (
                      <option value={draft.gender}>{draft.gender}</option>
                    )}
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </label>
                <label className={`${fieldClass} sm:col-span-2`}>
                  Address
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={draft.address}
                    onChange={(event) => updateStudent('address', event.target.value)}
                    className={inputClass}
                  />
                </label>
            </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs text-danger"
                >
                  {error}
                </p>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSavingAny}
                className={buttonSecondary}
              >
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className={buttonPrimary}>
                {isSaving ? 'Saving...' : 'Save Student Info'}
              </button>
            </footer>
          </form>
        ) : (
          <form
            id="parent-info-panel"
            role="tabpanel"
            aria-labelledby="parent-info-tab"
            onSubmit={(event) => void handleParentsSubmit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <fieldset
              disabled={isSavingParents}
              className="min-h-0 w-full flex-1 space-y-4 overflow-y-auto border-0 p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-ink">Parents and guardians</h3>
                  <p className="mt-1 text-xs text-muted">
                    A student can be linked to multiple parents or guardians.
                  </p>
                </div>
                <button type="button" onClick={addParent} className={buttonSecondary}>
                  <Plus className="size-4" />
                  Add Parent
                </button>
              </div>

              {parents.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
                  <Users className="size-8 text-muted" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-ink">No parents linked</p>
                  <p className="mt-1 max-w-sm text-xs text-muted">
                    Add a parent or guardian to start managing this student&apos;s family links.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {parents.map((parent, index) => (
                    <section
                      key={parent.id}
                      className="space-y-4 rounded-2xl border border-line bg-surface p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-ink">
                          Parent {index + 1}
                        </h4>
                        <button
                          type="button"
                          onClick={() =>
                            setParents((current) =>
                              current.filter((entry) => entry.id !== parent.id),
                            )
                          }
                          aria-label={`Remove parent ${index + 1}`}
                          className="rounded-lg p-2 text-danger transition hover:bg-danger/10"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className={fieldClass}>
                          Name
                          <input
                            type="text"
                            required
                            maxLength={150}
                            value={parent.name}
                            onChange={(event) =>
                              updateParent(parent.id, 'name', event.target.value)
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className={fieldClass}>
                          Username
                          <input
                            type="text"
                            required
                            maxLength={100}
                            autoComplete="username"
                            value={parent.username}
                            onChange={(event) =>
                              updateParent(parent.id, 'username', event.target.value)
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className={fieldClass}>
                          Temporary Password
                          <input
                            type="password"
                            required={parent.id.startsWith('new-')}
                            minLength={8}
                            maxLength={128}
                            autoComplete="new-password"
                            value={parent.temporary_password}
                            onChange={(event) =>
                              updateParent(parent.id, 'temporary_password', event.target.value)
                            }
                            placeholder={
                              parent.id.startsWith('new-')
                                ? 'At least 8 characters'
                                : 'Leave blank to keep current password'
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className={fieldClass}>
                          Relationship Type
                          <select
                            required
                            value={parent.relationship_type ?? ''}
                            onChange={(event) =>
                              updateParent(parent.id, 'relationship_type', event.target.value)
                            }
                            className={inputClass}
                          >
                            <option value="">Not specified</option>
                            <option value="FATHER">Father</option>
                            <option value="MOTHER">Mother</option>
                            <option value="GUARDIAN">Guardian</option>
                          </select>
                        </label>
                        <label className={fieldClass}>
                          Phone Number
                          <input
                            type="text"
                            maxLength={30}
                            value={parent.phone_number}
                            onChange={(event) =>
                              updateParent(parent.id, 'phone_number', event.target.value)
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className={fieldClass}>
                          Account Status
                          <span className="block pt-1">
                            {parent.is_active === null ? (
                              <Pill className="bg-muted/15 text-muted">Not linked</Pill>
                            ) : parent.is_active ? (
                              <Pill className="bg-success/15 text-success">Active</Pill>
                            ) : (
                              <Pill className="bg-muted/15 text-muted">Non-Active</Pill>
                            )}
                          </span>
                        </label>
                        <label className={`${fieldClass} sm:col-span-2`}>
                          Address
                          <textarea
                            rows={3}
                            maxLength={1000}
                            value={parent.address}
                            onChange={(event) =>
                              updateParent(parent.id, 'address', event.target.value)
                            }
                            className={inputClass}
                          />
                        </label>
                      </div>
                    </section>
                  ))}
                </div>
              )}
              <p className="rounded-xl border border-info/20 bg-info/10 p-3 text-xs text-muted">
                New parent accounts use the selected username and temporary password. Save the
                credentials shown after saving; passwords are never displayed again.
              </p>
              {parentsError && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs text-danger"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {parentsError}
                </p>
              )}
            </fieldset>
            <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSavingAny}
                className={buttonSecondary}
              >
                Close
              </button>
              <button type="submit" disabled={isSavingAny} className={buttonPrimary}>
                {isSavingParents ? 'Saving Parents...' : 'Save Parent Info'}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  )
}
