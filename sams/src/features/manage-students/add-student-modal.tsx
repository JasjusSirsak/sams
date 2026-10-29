'use client'

import { useState, type DragEvent, type ChangeEvent, type FormEvent } from 'react'
import { X, Upload, FileSpreadsheet, Plus, AlertCircle, CheckCircle2 } from 'lucide-react'
import { buttonPrimary, buttonSecondary, inputClass, Pill } from '@/components/ui-kit'
import type { AdminClassStudent } from '@/lib/api'

type StudentInput = {
  nis: string
  name: string
  birth_date?: string
  phone_number?: string
  address?: string
  account_status?: 'Active' | 'Pending' | 'Inactive'
}

type AddStudentModalProps = {
  classNameTitle: string
  onClose: () => void
  onAddManual: (student: StudentInput) => void | Promise<void>
  onAddExcel: (students: StudentInput[]) => void | Promise<void>
}

export function AddStudentModal({
  classNameTitle,
  onClose,
  onAddManual,
  onAddExcel,
}: AddStudentModalProps) {
  const [activeTab, setActiveTab] = useState<'excel' | 'manual'>('excel')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Manual Form fields
  const [manualForm, setManualForm] = useState({
    nis: '',
    name: '',
    birth_date: '',
    phone_number: '',
    address: '',
    account_status: 'Active' as const,
  })

  // Drag & drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processSelectedFile(file)
    }
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processSelectedFile(file)
    }
  }

  const processSelectedFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrorMsg('Please upload a valid Excel or CSV spreadsheet (.xlsx, .xls, .csv).')
      setUploadedFile(null)
      return
    }
    setErrorMsg(null)
    setUploadedFile(file)
  }

  const handleUploadExcelSubmit = () => {
    if (!uploadedFile) {
      setErrorMsg('Please select an Excel or CSV file first.')
      return
    }

    // Mock parsed students from Excel
    const mockParsed: Omit<MockStudent, 'id'>[] = [
      {
        nis: `NIS-2026-${Math.floor(100 + Math.random() * 900)}`,
        name: 'Arga Putra Perkasa',
        birth_date: '2010-03-15',
        phone_number: '+6281234567890',
        address: 'Jl. Merdeka No. 100, Bandung',
        account_status: 'Active',
      },
      {
        nis: `NIS-2026-${Math.floor(100 + Math.random() * 900)}`,
        name: 'Belinda Kartika',
        birth_date: '2010-07-22',
        phone_number: '+6281298765432',
        address: 'Jl. Surya Sumantri No. 12, Bandung',
        account_status: 'Active',
      },
      {
        nis: `NIS-2026-${Math.floor(100 + Math.random() * 900)}`,
        name: 'Caraka Yudha',
        birth_date: '2009-11-04',
        phone_number: '+6281311223344',
        address: 'Jl. Asia Afrika No. 45, Bandung',
        account_status: 'Pending',
      },
    ]

    setExcelSuccessMsg(`Successfully extracted ${mockParsed.length} student records from ${uploadedFile.name}.`)
    setTimeout(() => {
      onAddExcel(mockParsed)
      onClose()
    }, 900)
  }

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!manualForm.nis.trim() || !manualForm.name.trim()) {
      setErrorMsg('Student NIS and Name are required.')
      return
    }
    onAddManual(manualForm)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-students-modal-title"
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-surface border border-line shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="add-students-modal-title" className="text-lg font-bold text-ink">
              Add Students
            </h2>
            <p className="text-xs text-muted">
              Enrolling into <span className="font-semibold text-primary">{classNameTitle}</span>
            </p>
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

        {/* Tab switch */}
        <div className="flex border-b border-line bg-surface-muted/60 p-1.5 px-6 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('excel')
              setErrorMsg(null)
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition ${
              activeTab === 'excel'
                ? 'bg-surface text-ink shadow-xs border border-line'
                : 'text-muted hover:text-ink'
            }`}
          >
            <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
            Upload Excel (Bulk)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual')
              setErrorMsg(null)
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition ${
              activeTab === 'manual'
                ? 'bg-surface text-ink shadow-xs border border-line'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Plus className="size-4 text-primary" />
            Manual Form (Single)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs text-danger">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'excel' ? (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                  isDragging
                    ? 'border-primary bg-primary-soft/50'
                    : 'border-line bg-surface-muted/40 hover:bg-surface-muted/70'
                }`}
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary mb-3">
                  <Upload className="size-6" />
                </div>
                <h4 className="text-sm font-semibold text-ink">
                  {uploadedFile ? uploadedFile.name : 'Upload student roster file'}
                </h4>
                <p className="mt-1 text-xs text-muted max-w-xs">
                  Drag and drop your Excel or CSV file here, or browse from your computer. Supports .xlsx, .xls, .csv.
                </p>

                <label className="mt-4 cursor-pointer">
                  <span className={`${buttonSecondary} py-1.5 px-3.5 text-xs`}>
                    Browse File
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInput}
                    className="sr-only"
                  />
                </label>

                {uploadedFile && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface px-3 py-1.5 border border-line text-xs font-medium text-ink shadow-xs">
                    <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate max-w-[200px]">{uploadedFile.name}</span>
                    <Pill className="bg-success/15 text-success text-[10px]">Ready</Pill>
                  </div>
                )}
              </div>

              {/* Template hint */}
              <div className="rounded-xl bg-surface-muted p-3.5 text-xs text-muted space-y-1">
                <p className="font-semibold text-ink">File Format Requirements:</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted">
                  <li>Columns should include: <code className="text-ink">NIS</code>, <code className="text-ink">Name</code>, <code className="text-ink">Birth Date (YYYY-MM-DD)</code>, <code className="text-ink">Phone</code>, <code className="text-ink">Address</code></li>
                  <li>First row must contain the column headers.</li>
                </ul>
              </div>

              {excelSuccessMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success font-medium">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{excelSuccessMsg}</span>
                </div>
              )}
            </div>
          ) : (
            <form id="manual-student-form" onSubmit={handleManualSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs font-medium text-ink">
                  Student Number (NIS) <span className="text-danger">*</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NIS-2026-042"
                    value={manualForm.nis}
                    onChange={(e) => setManualForm({ ...manualForm, nis: e.target.value })}
                    className={inputClass}
                  />
                </label>

                <label className="block space-y-1 text-xs font-medium text-ink">
                  Full Name <span className="text-danger">*</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amanda Putri"
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs font-medium text-ink">
                  Birth Date
                  <input
                    type="date"
                    value={manualForm.birth_date}
                    onChange={(e) => setManualForm({ ...manualForm, birth_date: e.target.value })}
                    className={inputClass}
                  />
                </label>

                <label className="block space-y-1 text-xs font-medium text-ink">
                  Phone Number
                  <input
                    type="tel"
                    placeholder="+62812345678"
                    value={manualForm.phone_number}
                    onChange={(e) => setManualForm({ ...manualForm, phone_number: e.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block space-y-1 text-xs font-medium text-ink">
                Address
                <input
                  type="text"
                  placeholder="Street name, neighborhood, city"
                  value={manualForm.address}
                  onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })}
                  className={inputClass}
                />
              </label>

              <label className="block space-y-1 text-xs font-medium text-ink">
                Account Status
                <select
                  value={manualForm.account_status}
                  onChange={(e) =>
                    setManualForm({
                      ...manualForm,
                      account_status: e.target.value as 'Active' | 'Pending' | 'Inactive',
                    })
                  }
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line bg-surface p-4">
          <button type="button" onClick={onClose} className={buttonSecondary}>
            Cancel
          </button>
          {activeTab === 'excel' ? (
            <button
              type="button"
              onClick={handleUploadExcelSubmit}
              disabled={!uploadedFile}
              className={buttonPrimary}
            >
              <Upload className="size-4" />
              Process & Import Excel
            </button>
          ) : (
            <button type="submit" form="manual-student-form" className={buttonPrimary}>
              <Plus className="size-4" />
              Add Student
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
