'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, Download, FileSpreadsheet, FileText, X } from 'lucide-react'
import { buttonPrimary, buttonSecondary, inputClass, Spinner } from '@/components/ui-kit'
import { exportAttendanceReport, type AdminClassCatalogItem } from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type AttendanceExportModalProps = {
  classes: AdminClassCatalogItem[]
  onClose: () => void
}

export function AttendanceExportModal({ classes, onClose }: AttendanceExportModalProps) {
  const currentDate = new Date()
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1))
  const [year, setYear] = useState(String(currentDate.getFullYear()))
  const [format, setFormat] = useState<'xlsx' | 'pdf'>('xlsx')
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const years = Array.from({ length: 11 }, (_, index) => currentDate.getFullYear() - index)

  async function downloadReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsDownloading(true)
    setError(null)
    try {
      await exportAttendanceReport({ classId, month: Number(month), year: Number(year), format })
      onClose()
    } catch (downloadError: unknown) {
      setError(parseApiError(downloadError).message)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-export-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Download className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="attendance-export-title" className="text-lg font-bold text-ink">
                Export Attendance Report
              </h2>
              <p className="mt-1 text-sm text-muted">Choose a reporting period and file format.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            aria-label="Close dialog"
            className="rounded-xl p-1.5 text-muted transition hover:bg-surface-muted hover:text-ink disabled:opacity-50"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(event) => void downloadReport(event)} className="space-y-5 px-6 py-5">
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}

          <fieldset disabled={isDownloading} className="space-y-2">
            <legend className="text-sm font-semibold text-ink">Class</legend>
            <label className="sr-only" htmlFor="attendance-export-class">Class</label>
            <select
              id="attendance-export-class"
              required
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className={inputClass}
            >
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
              ))}
            </select>
            {classes.length === 0 && (
              <p className="text-xs text-danger">No classes are available for export.</p>
            )}
          </fieldset>

          <fieldset disabled={isDownloading} className="space-y-2">
            <legend className="text-sm font-semibold text-ink">Reporting period</legend>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface-muted/30 p-4">
              <label className="space-y-1.5 text-xs font-medium text-muted">
                Month
                <select
                  required
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className={inputClass}
                >
                  {MONTHS.map((monthName, index) => (
                    <option key={monthName} value={index + 1}>{monthName}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted">
                Year
                <select
                  required
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className={inputClass}
                >
                  {years.map((yearValue) => (
                    <option key={yearValue} value={yearValue}>{yearValue}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset disabled={isDownloading} className="space-y-2">
            <legend className="text-sm font-semibold text-ink">File format</legend>
            <div className="grid grid-cols-2 gap-3">
              <FormatOption
                checked={format === 'xlsx'}
                value="xlsx"
                icon={<FileSpreadsheet className="size-5" aria-hidden="true" />}
                label="Excel"
                detail=".xlsx spreadsheet"
                onSelect={() => setFormat('xlsx')}
              />
              <FormatOption
                checked={format === 'pdf'}
                value="pdf"
                icon={<FileText className="size-5" aria-hidden="true" />}
                label="PDF"
                detail=".pdf document"
                onSelect={() => setFormat('pdf')}
              />
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onClose} disabled={isDownloading} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={isDownloading || !classId} className={buttonPrimary}>
              {isDownloading ? <Spinner /> : <Download className="size-4" aria-hidden="true" />}
              {isDownloading ? 'Preparing report...' : 'Download Report'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function FormatOption({
  checked,
  value,
  icon,
  label,
  detail,
  onSelect,
}: {
  checked: boolean
  value: 'xlsx' | 'pdf'
  icon: ReactNode
  label: string
  detail: string
  onSelect: () => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
        checked
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-line bg-surface hover:bg-surface-muted/40'
      }`}
    >
      <input
        type="radio"
        name="attendance-export-format"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-1 accent-primary"
      />
      <span className={checked ? 'text-primary' : 'text-muted'}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{detail}</span>
      </span>
    </label>
  )
}
