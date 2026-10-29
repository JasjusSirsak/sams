'use client'

import { useState, type FormEvent } from 'react'
import { X, GraduationCap, AlertCircle, Plus, Info } from 'lucide-react'
import { buttonPrimary, buttonSecondary, inputClass } from '@/components/ui-kit'

export type CreateClassInput = {
  name: string
  grade_level: number
  academic_year?: string
  room?: string
}

type CreateClassModalProps = {
  onClose: () => void
  onCreate: (newClass: CreateClassInput) => void | Promise<void>
  isSubmitting?: boolean
}

export function CreateClassModal({ onClose, onCreate }: CreateClassModalProps) {
  const [name, setName] = useState('')
  const [gradeLevel, setGradeLevel] = useState<number>(10)
  const [academicYear, setAcademicYear] = useState('2026/2027')
  const [room, setRoom] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg('Please enter a class name.')
      return
    }

    onCreate({
      name: name.trim(),
      grade_level: Number(gradeLevel),
      academic_year: academicYear.trim(),
      room: room.trim() || undefined,
    })
    onClose()
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

          <label className="block space-y-1 text-xs font-medium text-ink">
            Class Name <span className="text-danger">*</span>
            <input
              type="text"
              required
              placeholder="e.g. Class X-C or XII MIPA 3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs font-medium text-ink">
              Grade Level <span className="text-danger">*</span>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(Number(e.target.value))}
                className={inputClass}
              >
                <option value={10}>Grade 10 (X)</option>
                <option value={11}>Grade 11 (XI)</option>
                <option value={12}>Grade 12 (XII)</option>
                <option value={7}>Grade 7 (VII)</option>
                <option value={8}>Grade 8 (VIII)</option>
                <option value={9}>Grade 9 (IX)</option>
              </select>
            </label>

            <label className="block space-y-1 text-xs font-medium text-ink">
              Academic Year <span className="text-danger">*</span>
              <input
                type="text"
                required
                placeholder="2026/2027"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs font-medium text-ink">
            Assigned Room / Lab (Optional)
            <input
              type="text"
              placeholder="e.g. Room 204 or Lab Komputer 1"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className={inputClass}
            />
          </label>

          <div className="rounded-xl bg-primary-soft/60 border border-primary/20 p-3 flex items-start gap-2.5 text-xs text-primary dark:text-primary-foreground">
            <Info className="size-4 shrink-0 mt-0.5 text-primary" />
            <p className="text-muted leading-relaxed">
              Once created, you can open this class to add students via <strong className="text-ink">Excel bulk upload</strong> or individual <strong className="text-ink">manual entries</strong>.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={onClose} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" className={buttonPrimary}>
              <Plus className="size-4" />
              Create Class
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
