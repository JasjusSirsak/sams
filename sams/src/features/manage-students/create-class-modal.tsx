'use client'

import { useState, type FormEvent } from 'react'
import { X, GraduationCap, AlertCircle, Plus, Info } from 'lucide-react'
import { buttonPrimary, buttonSecondary } from '@/components/ui-kit'
import { ClassNameFields, type ClassNameFieldsValue } from './class-name-fields'
import { parseApiError } from '@/lib/apiClient'

export type CreateClassInput = {
  name: string
  grade_level: number
  academic_period_id: string
  teacher_id: string
}

type CreateClassModalProps = {
  onClose: () => void
  onCreate: (newClass: CreateClassInput) => void | Promise<void>
}

export function CreateClassModal({ onClose, onCreate }: CreateClassModalProps) {
  const [classFields, setClassFields] = useState<ClassNameFieldsValue>({
    name: '',
    grade_level: '',
    academic_period_id: '',
    teacher_id: '',
  })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (
      !classFields.name ||
      classFields.grade_level === '' ||
      !classFields.academic_period_id ||
      !classFields.teacher_id
    ) {
      setErrorMsg('Select a grade, class major, class parallel, academic period, and homeroom teacher.')
      return
    }

    setErrorMsg(null)
    setIsSubmitting(true)
    try {
      await onCreate({
        name: classFields.name,
        grade_level: classFields.grade_level,
        academic_period_id: classFields.academic_period_id,
        teacher_id: classFields.teacher_id,
      })
      onClose()
    } catch (error: unknown) {
      setErrorMsg(parseApiError(error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-class-modal-title"
        className="w-full max-w-lg rounded-2xl bg-surface border border-line shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <GraduationCap className="size-5" />
            </span>
            <div>
              <h2 id="create-class-modal-title" className="text-lg font-bold text-ink">
                Create Class
              </h2>
              <p className="text-xs text-muted">Add a new class to your academic library</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-1.5 text-muted hover:bg-surface-muted hover:text-ink transition"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs text-danger">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <ClassNameFields onChange={setClassFields} />

          <div className="rounded-xl bg-primary-soft/60 border border-primary/20 p-3 flex items-start gap-2.5 text-xs text-primary dark:text-primary-foreground">
            <Info className="size-4 shrink-0 mt-0.5 text-primary" />
            <p className="text-muted leading-relaxed">
              The selected academic period and homeroom teacher will be linked to this class. You can then add students via <strong className="text-ink">Excel bulk upload</strong> or individual <strong className="text-ink">manual entries</strong>.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={onClose} disabled={isSubmitting} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className={buttonPrimary}>
              <Plus className="size-4" />
              {isSubmitting ? 'Creating...' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
