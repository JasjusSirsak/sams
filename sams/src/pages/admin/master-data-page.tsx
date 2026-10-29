'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  createAdminRecord,
  deleteAdminRecord,
  getAdminRecords,
  updateAdminRecord,
  type AdminDataRecord,
  type AdminEntity,
} from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'
import { usePathname } from '@/lib/nav'
import { Card, EmptyState, PageHeader, Spinner, buttonPrimary, buttonSecondary, inputClass } from '@/components/ui-kit'

type Field = {
  name: string
  label: string
  type?: 'text' | 'number' | 'date'
  required?: boolean
}

type EntityConfig = {
  title: string
  description: string
  fields: Field[]
}

const ENTITY_CONFIG: Record<AdminEntity, EntityConfig> = {
  classes: {
    title: 'Classes',
    description: 'Create and update the school class list.',
    fields: [
      { name: 'name', label: 'Class name', required: true },
      { name: 'grade_level', label: 'Grade level', type: 'number', required: true },
    ],
  },
  subjects: {
    title: 'Subjects',
    description: 'Manage subject codes and names.',
    fields: [
      { name: 'code', label: 'Subject code', required: true },
      { name: 'name', label: 'Subject name', required: true },
    ],
  },
  'academic-periods': {
    title: 'Academic Periods',
    description: 'Manage school years, semesters, and their dates.',
    fields: [
      { name: 'academic_year', label: 'Academic year', required: true },
      { name: 'semester', label: 'Semester', type: 'number', required: true },
      { name: 'start_date', label: 'Start date', type: 'date', required: true },
      { name: 'end_date', label: 'End date', type: 'date', required: true },
    ],
  },
  teachers: {
    title: 'Teachers',
    description: 'Link a teacher profile to an existing user account.',
    fields: [
      { name: 'user_id', label: 'User ID', type: 'number', required: true },
      { name: 'name', label: 'Name', required: true },
      { name: 'employee_number', label: 'Employee number' },
      { name: 'classes', label: 'Classes' },
      { name: 'subjects', label: 'Subjects' },
    ],
  },
  students: {
    title: 'Students',
    description: 'Manage student profiles and contact details.',
    fields: [
      { name: 'nis', label: 'Student number (NIS)', required: true },
      { name: 'name', label: 'Name', required: true },
      { name: 'user_id', label: 'User ID', type: 'number' },
      { name: 'birth_date', label: 'Birth date', type: 'date' },
      { name: 'phone_number', label: 'Phone number' },
      { name: 'address', label: 'Address' },
    ],
  },
}

const ENTITY_PATHS = Object.keys(ENTITY_CONFIG) as AdminEntity[]

function getFieldValue(record: AdminDataRecord, field: Field): string {
  const value = record[field.name]
  return value === null || value === undefined ? '' : String(value)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function AdminMasterDataPage() {
  const pathname = usePathname()
  const pathEntity = pathname.startsWith('/admin/') ? pathname.slice('/admin/'.length) : 'classes'
  const entity = ENTITY_PATHS.includes(pathEntity as AdminEntity) ? pathEntity as AdminEntity : 'classes'
  const config = ENTITY_CONFIG[entity]
  const requestKey = `${entity}`

  const [result, setResult] = useState<{
    key: string
    records: AdminDataRecord[] | null
    error: string | null
  }>({ key: '', records: null, error: null })
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<AdminDataRecord | null | undefined>(undefined)
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [classOptions, setClassOptions] = useState<AdminDataRecord[]>([])
  const [subjectOptions, setSubjectOptions] = useState<AdminDataRecord[]>([])

  useEffect(() => {
    let isActive = true
    const key = `${requestKey}:${revision}`

    // Fetch main entity records
    getAdminRecords(entity)
      .then((records) => {
        if (isActive) setResult({ key, records, error: null })
      })
      .catch((error: unknown) => {
        if (isActive) setResult({ key, records: null, error: parseApiError(error).message })
      })

    // Load class and subject options for teachers
    if (entity === 'teachers') {
      Promise.all([getAdminRecords('classes'), getAdminRecords('subjects')])
        .then(([cls, sub]) => {
          if (isActive) {
            setClassOptions(cls ?? [])
            setSubjectOptions(sub ?? [])
          }
        })
        .catch((e) => console.error('Failed to load class/subject options', e))
    }

    return () => { isActive = false }
  }, [entity, requestKey, revision])
  const currentKey = `${requestKey}:${revision}`
  const records = result.key === currentKey ? result.records : null
  const error = result.key === currentKey ? result.error : null
  const loading = records === null && error === null

  function openCreate() {
    setFormValues(Object.fromEntries(config.fields.map((field) => [field.name, ''])))
    setActionError(null)
    setEditing(null)
  }

  function openEdit(record: AdminDataRecord) {
    setFormValues(Object.fromEntries(config.fields.map((field) => [field.name, getFieldValue(record, field)])))
    setActionError(null)
    setEditing(record)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setActionError(null)
    try {
      if (editing) {
        await updateAdminRecord(entity, editing.id, formValues)
      } else {
        await createAdminRecord(entity, formValues)
      }
      setEditing(undefined)
      setRevision((value) => value + 1)
    } catch (error: unknown) {
      setActionError(parseApiError(error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(record: AdminDataRecord) {
    if (!window.confirm('Delete this record?')) return
    setDeletingId(record.id)
    setActionError(null)
    try {
      await deleteAdminRecord(entity, record.id)
      setRevision((value) => value + 1)
    } catch (error: unknown) {
      setActionError(parseApiError(error).message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title={`Manage ${config.title}`}
        subtitle={config.description}
        action={
          <button type="button" onClick={openCreate} className={buttonPrimary}>
            <Plus className="size-4" aria-hidden="true" /> Create
          </button>
        }
      />

      {actionError && !editing && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <Card>
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Spinner /> Loading {config.title.toLowerCase()}...
          </div>
        ) : error ? (
          <div role="alert" className="py-6 text-center">
            <p className="mb-3 flex items-center justify-center gap-2 text-sm text-danger">
              <AlertCircle className="size-4" aria-hidden="true" /> {error}
            </p>
            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
              className={`${buttonSecondary} py-1.5`}
            >
              <RefreshCw className="size-4" aria-hidden="true" /> Try again
            </button>
          </div>
        ) : records?.length === 0 ? (
          <EmptyState title={`No ${config.title.toLowerCase()} found`} text="Create the first record to get started." />
        ) : records ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  {config.fields.map((field) => (
                    <th key={field.name} className="px-3 py-3 font-medium first:pl-0">
                      {field.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {records.map((record) => (
                  <tr key={record.id}>
                    {config.fields.map((field) => (
                      <td key={field.name} className="max-w-64 truncate px-3 py-3 text-ink first:pl-0">
                        {displayValue(record[field.name])}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(record)}
                          aria-label={`Edit ${config.title.toLowerCase()} record`}
                          className={`${buttonSecondary} px-2.5 py-2`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(record)}
                          disabled={deletingId === record.id}
                          aria-label={`Delete ${config.title.toLowerCase()} record`}
                          className="inline-flex items-center justify-center rounded-xl border border-danger/30 px-2.5 py-2 text-danger hover:bg-danger/10 disabled:opacity-50"
                        >
                          {deletingId === record.id ? <Spinner /> : <Trash2 className="size-4" aria-hidden="true" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {editing !== undefined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-record-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl"
          >
            <h2 id="admin-record-title" className="mb-5 text-lg font-semibold text-ink">
              {editing ? `Edit ${config.title}` : `Create ${config.title}`}
            </h2>
            <form className="space-y-4" onSubmit={(event) => void save(event)}>
              {config.fields.map((field) => {
                if (field.name === 'classes') {
                  return (
                    <label key={field.name} className="block space-y-1.5 text-sm font-medium text-ink">
                      {field.label}
                      <select
                        multiple
                        value={formValues[field.name] ?? []}
                        onChange={(event) => {
                          const selected = Array.from(event.target.selectedOptions).map((opt) => opt.value)
                          setFormValues((values) => ({ ...values, [field.name]: selected }))
                        }}
                        className={inputClass}
                      >
                        {classOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {String(opt.name ?? opt.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                }

                if (field.name === 'subjects') {
                  return (
                    <label key={field.name} className="block space-y-1.5 text-sm font-medium text-ink">
                      {field.label}
                      <select
                        multiple
                        value={formValues[field.name] ?? []}
                        onChange={(event) => {
                          const selected = Array.from(event.target.selectedOptions).map((opt) => opt.value)
                          setFormValues((values) => ({ ...values, [field.name]: selected }))
                        }}
                        className={inputClass}
                      >
                        {subjectOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {String(opt.name ?? opt.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                }

                return (
                  <label key={field.name} className="block space-y-1.5 text-sm font-medium text-ink">
                    {field.label}
                    <input
                      type={field.type ?? 'text'}
                      min={field.type === 'number' ? (field.name === 'grade_level' ? 1 : 1) : undefined}
                      max={field.name === 'semester' ? 2 : field.name === 'grade_level' ? 20 : undefined}
                      required={field.required}
                      value={formValues[field.name] ?? ''}
                      onChange={(event) =>
                        setFormValues((values) => ({ ...values, [field.name]: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                )
              })}
              {actionError && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {actionError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(undefined)}
                  disabled={saving}
                  className={buttonSecondary}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={buttonPrimary}>
                  {saving && <Spinner />}
                  {editing ? 'Save changes' : 'Create record'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default AdminMasterDataPage
