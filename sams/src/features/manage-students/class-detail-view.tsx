'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Calendar,
  Phone,
  MapPin,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import {
  Card,
  EmptyState,
  PageHeader,
  Pill,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from '@/components/ui-kit'
import { AddStudentModal } from './add-student-modal'
import type { AdminClassCatalogItem, AdminClassStudent } from '@/lib/api'

type ClassDetailViewProps = {
  classData: AdminClassCatalogItem & { room?: string }
  students: AdminClassStudent[]
  onBack: () => void
  onAddStudentManual: (newStudent: {
    nis: string
    name: string
    birth_date?: string
    phone_number?: string
    address?: string
  }) => Promise<void> | void
  onAddStudentsExcel: (newStudents: Array<{
    nis: string
    name: string
    birth_date?: string
    phone_number?: string
    address?: string
  }>) => Promise<void> | void
  onDeleteStudent: (studentId: string) => Promise<void> | void
  isLoading?: boolean
}

const PAGE_SIZE = 10

export function ClassDetailView({
  classData,
  students,
  onBack,
  onAddStudentManual,
  onAddStudentsExcel,
  onDeleteStudent,
}: ClassDetailViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(0)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<AdminClassStudent | null>(null)

  // Filter students by search (NIS, Name, Address, Phone) & Status
  const q = searchQuery.toLowerCase().trim()
  const filtered = students.filter((s) => {
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.nis.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      s.phone_number.toLowerCase().includes(q)

    const matchesStatus =
      statusFilter === 'all' || s.account_status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  // Pagination calculation (10 rows per page)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages - 1)
  const paginatedRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  )

  const handleManualAdd = (data: {
    nis: string
    name: string
    birth_date?: string
    phone_number?: string
    address?: string
  }) => {
    onAddStudentManual(data)
  }

  const handleExcelAdd = (dataList: Array<{
    nis: string
    name: string
    birth_date?: string
    phone_number?: string
    address?: string
  }>) => {
    onAddStudentsExcel(dataList)
  }

  const getStatusBadge = (status: AdminClassStudent['account_status']) => {
    switch (status) {
      case 'Active':
        return <Pill className="bg-success/15 text-success font-medium">Active</Pill>
      case 'Pending':
        return <Pill className="bg-warning/15 text-warning font-medium">Pending</Pill>
      case 'Inactive':
        return <Pill className="bg-danger/15 text-danger font-medium">Inactive</Pill>
      default:
        return <Pill className="bg-muted/15 text-muted">{status}</Pill>
    }
  }

  return (
    <div className="space-y-6">
      {/* Top back navigation */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary transition"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
          Back to Class Library
        </button>
      </div>

      {/* Class Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                {classData.name}
              </h1>
              <Pill className="bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
                Grade {classData.grade_level}
              </Pill>
              {classData.room && (
                <span className="rounded-lg bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                  {classData.room}
                </span>
              )}
            </div>
            <p className="text-sm text-muted">
              Academic Year: <span className="font-medium text-ink">{classData.academic_year}</span> ·{' '}
              Total Enrolled:{' '}
              <span className="font-semibold text-primary">{students.length} students</span>
              {students.length < 10 && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-warning font-medium">
                  <AlertCircle className="size-3.5" /> Minimum 10 recommended
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className={`${buttonPrimary} shrink-0 shadow-sm`}
          >
            <UserPlus className="size-4" />
            Add Students
          </button>
        </div>
      </div>

      {/* Main Student Table Card */}
      <Card>
        {/* Table Controls: Search & Status Filter */}
        <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, NIS, address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(0)
              }}
              className={`${inputClass} pl-10`}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(0)
              }}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-primary focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Empty States */}
        {students.length === 0 ? (
          <EmptyState
            title="No students in this class yet"
            text="Get started by enrolling students via bulk Excel upload or using the manual form."
            action={
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className={`${buttonPrimary} mt-2 text-xs py-2`}
              >
                <UserPlus className="size-3.5" />
                Add Students Now
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No matching students found"
            text="No records matched your search query or status filter. Try clearing the filter."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
                className={`${buttonSecondary} mt-2 text-xs py-2`}
              >
                Clear Search
              </button>
            }
          />
        ) : (
          <>
            {/* Student Table: Removed "User ID" Column per requirement */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-3 py-3.5 font-medium">Student Number (NIS)</th>
                    <th className="px-3 py-3.5 font-medium">Name</th>
                    <th className="px-3 py-3.5 font-medium">Birth Date</th>
                    <th className="px-3 py-3.5 font-medium">Phone Number</th>
                    <th className="px-3 py-3.5 font-medium">Address</th>
                    <th className="px-3 py-3.5 font-medium">Account Status</th>
                    <th className="px-3 py-3.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paginatedRows.map((student) => (
                    <tr
                      key={student.id}
                      className="group transition-colors hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-3.5 font-medium text-ink font-mono text-xs">
                        {student.nis}
                      </td>
                      <td className="px-3 py-3.5 font-medium text-ink">
                        {student.name}
                      </td>
                      <td className="px-3 py-3.5 text-muted">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Calendar className="size-3 text-muted/70" />
                          {student.birth_date || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-muted">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Phone className="size-3 text-muted/70" />
                          {student.phone_number || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-muted max-w-xs truncate" title={student.address}>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <MapPin className="size-3 text-muted/70 shrink-0" />
                          <span className="truncate">{student.address || '—'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        {getStatusBadge(student.account_status)}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingStudent(student)}
                            title="Edit student"
                            className="inline-flex items-center justify-center size-8 rounded-xl border border-line bg-surface text-ink hover:bg-surface-muted transition"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteStudent(student.id)}
                            title="Remove student"
                            className="inline-flex items-center justify-center size-8 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 transition"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
              <div>
                Showing{' '}
                <span className="font-semibold text-ink">
                  {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-ink">
                  {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)}
                </span>{' '}
                of <span className="font-semibold text-ink">{filtered.length}</span> students
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className={`${buttonSecondary} py-1.5 px-3 text-xs`}
                >
                  <ChevronLeft className="size-3.5" /> Previous
                </button>
                <span className="px-2 font-medium text-ink">
                  Page {safePage + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className={`${buttonSecondary} py-1.5 px-3 text-xs`}
                >
                  Next <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Add Students Modal */}
      {isAddModalOpen && (
        <AddStudentModal
          classNameTitle={classData.name}
          onClose={() => setIsAddModalOpen(false)}
          onAddManual={handleManualAdd}
          onAddExcel={handleExcelAdd}
        />
      )}

      {/* Edit Student Simple Inline Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-line shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-ink">Edit Student: {editingStudent.name}</h3>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-ink">
                Student Name
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, name: e.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-medium text-ink">
                Phone Number
                <input
                  type="text"
                  value={editingStudent.phone_number}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, phone_number: e.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-medium text-ink">
                Account Status
                <select
                  value={editingStudent.account_status}
                  onChange={(e) =>
                    setEditingStudent({
                      ...editingStudent,
                      account_status: e.target.value as AdminClassStudent['account_status'],
                    })
                  }
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className={buttonSecondary}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className={buttonPrimary}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
