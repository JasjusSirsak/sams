'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Filter, AlertCircle, RefreshCw } from 'lucide-react'
import { PageHeader, EmptyState, Spinner, buttonPrimary, buttonSecondary, inputClass } from '@/components/ui-kit'
import { useRouter, usePathname } from '@/lib/nav'
import { ClassCard } from '@/features/manage-students/class-card'
import { ClassDetailView } from '@/features/manage-students/class-detail-view'
import { CreateClassModal, type CreateClassInput } from '@/features/manage-students/create-class-modal'
import {
  getAdminClassCatalog,
  getAdminClassStudents,
  addAdminClassStudents,
  removeAdminClassStudent,
  createAdminRecord,
  type AdminClassCatalogItem,
  type AdminClassStudent,
} from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'

export default function ManageStudentsPage() {
  const router = useRouter()
  const pathname = usePathname()

  // State for Catalog
  const [classes, setClasses] = useState<AdminClassCatalogItem[]>([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogRevision, setCatalogRevision] = useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // State for Selected Class Details
  const prefix = '/admin/students/'
  const currentClassId = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : null

  const [selectedClassData, setSelectedClassData] = useState<AdminClassCatalogItem | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<AdminClassStudent[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailRevision, setDetailRevision] = useState(0)

  // 1. Fetch Class Catalog
  useEffect(() => {
    let isActive = true
    setIsLoadingCatalog(true)
    setCatalogError(null)

    getAdminClassCatalog()
      .then((data) => {
        if (isActive) {
          setClasses(Array.isArray(data) ? data : [])
          setIsLoadingCatalog(false)
        }
      })
      .catch((err: unknown) => {
        if (isActive) {
          setCatalogError(parseApiError(err).message)
          setIsLoadingCatalog(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [catalogRevision])

  // 2. Fetch Selected Class Details & Students
  useEffect(() => {
    if (!currentClassId) {
      setSelectedClassData(null)
      setSelectedStudents([])
      return
    }

    let isActive = true
    setIsLoadingDetail(true)
    setDetailError(null)

    getAdminClassStudents(currentClassId)
      .then((res) => {
        if (isActive) {
          setSelectedClassData(res.class)
          setSelectedStudents(res.students)
          setIsLoadingDetail(false)
        }
      })
      .catch((err: unknown) => {
        if (isActive) {
          setDetailError(parseApiError(err).message)
          setIsLoadingDetail(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [currentClassId, detailRevision])

  // Class filtering
  const q = searchQuery.toLowerCase().trim()
  const filteredClasses = classes.filter((cls) => {
    const matchesSearch = !q || cls.name.toLowerCase().includes(q)
    const matchesGrade = gradeFilter === 'all' || cls.grade_level.toString() === gradeFilter
    return matchesSearch && matchesGrade
  })

  // Handlers
  const handleOpenClass = (clsId: string) => {
    router.push(`/admin/students/${clsId}`)
  }

  const handleBackToCatalog = () => {
    router.push('/admin/students')
    setCatalogRevision((v) => v + 1)
  }

  const handleCreateClass = async (newClassData: CreateClassInput) => {
    setActionError(null)
    try {
      await createAdminRecord('classes', {
        name: newClassData.name,
        grade_level: String(newClassData.grade_level),
      })
      // Refresh catalog list
      setCatalogRevision((v) => v + 1)
    } catch (err: unknown) {
      setActionError(parseApiError(err).message)
    }
  }

  const handleAddManualStudent = async (newStudent: {
    nis: string
    name: string
    birth_date?: string
    phone_number?: string
    address?: string
  }) => {
    if (!currentClassId) return
    setActionError(null)
    try {
      await addAdminClassStudents(currentClassId, [newStudent])
      setDetailRevision((v) => v + 1)
      setCatalogRevision((v) => v + 1)
    } catch (err: unknown) {
      setActionError(parseApiError(err).message)
    }
  }

  const handleAddExcelStudents = async (
    newStudents: Array<{
      nis: string
      name: string
      birth_date?: string
      phone_number?: string
      address?: string
    }>
  ) => {
    if (!currentClassId) return
    setActionError(null)
    try {
      await addAdminClassStudents(currentClassId, newStudents)
      setDetailRevision((v) => v + 1)
      setCatalogRevision((v) => v + 1)
    } catch (err: unknown) {
      setActionError(parseApiError(err).message)
    }
  }

  const handleDeleteStudent = async (studentId: string) => {
    if (!currentClassId) return
    setActionError(null)
    try {
      await removeAdminClassStudent(currentClassId, studentId)
      setDetailRevision((v) => v + 1)
      setCatalogRevision((v) => v + 1)
    } catch (err: unknown) {
      setActionError(parseApiError(err).message)
    }
  }

  // If a classId is present in URL, render Class Detail View
  if (currentClassId) {
    if (isLoadingDetail && !selectedClassData) {
      return (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
          <Spinner /> Loading class and students...
        </div>
      )
    }

    if (detailError) {
      return (
        <div role="alert" className="py-12 text-center space-y-3">
          <p className="flex items-center justify-center gap-2 text-sm text-danger font-medium">
            <AlertCircle className="size-4" /> {detailError}
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleBackToCatalog}
              className={`${buttonSecondary} text-xs py-1.5`}
            >
              Back to Class Library
            </button>
            <button
              type="button"
              onClick={() => setDetailRevision((v) => v + 1)}
              className={`${buttonPrimary} text-xs py-1.5`}
            >
              <RefreshCw className="size-3.5" /> Retry
            </button>
          </div>
        </div>
      )
    }

    if (selectedClassData) {
      return (
        <div className="space-y-4">
          {actionError && (
            <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger flex items-center justify-between">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-xs underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}
          <ClassDetailView
            classData={selectedClassData}
            students={selectedStudents}
            onBack={handleBackToCatalog}
            onAddStudentManual={handleAddManualStudent}
            onAddStudentsExcel={handleAddExcelStudents}
            onDeleteStudent={handleDeleteStudent}
            isLoading={isLoadingDetail}
          />
        </div>
      )
    }
  }

  // Otherwise, render Class Library Grid
  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Students"
        subtitle="Organize student records by class library. Select a class to view its roster or enroll new students."
        action={
          <button
            type="button"
            onClick={() => setIsCreateClassOpen(true)}
            className={buttonPrimary}
          >
            <Plus className="size-4" />
            Create Class
          </button>
        }
      />

      {actionError && (
        <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger flex items-center justify-between">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar above the grid */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search classes by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${inputClass} pl-10`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted flex items-center gap-1">
            <Filter className="size-3" /> Grade Level:
          </span>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">All Grades</option>
            <option value="10">Grade 10 (X)</option>
            <option value="11">Grade 11 (XI)</option>
            <option value="12">Grade 12 (XII)</option>
            <option value="7">Grade 7</option>
            <option value="8">Grade 8</option>
            <option value="9">Grade 9</option>
          </select>
        </div>
      </div>

      {/* Classes Grid */}
      {isLoadingCatalog ? (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
          <Spinner /> Loading class library...
        </div>
      ) : catalogError ? (
        <div role="alert" className="py-12 text-center space-y-3">
          <p className="flex items-center justify-center gap-2 text-sm text-danger font-medium">
            <AlertCircle className="size-4" /> {catalogError}
          </p>
          <button
            type="button"
            onClick={() => setCatalogRevision((v) => v + 1)}
            className={`${buttonSecondary} text-xs py-1.5`}
          >
            <RefreshCw className="size-3.5" /> Try again
          </button>
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          text="Your class library is empty. Click 'Create Class' to set up your first class roster."
          action={
            <button
              type="button"
              onClick={() => setIsCreateClassOpen(true)}
              className={`${buttonPrimary} mt-2 text-xs py-2`}
            >
              <Plus className="size-3.5" />
              Create Class
            </button>
          }
        />
      ) : filteredClasses.length === 0 ? (
        <EmptyState
          title="No classes found"
          text="No classes match your current search and filter criteria. Try adjusting your query."
          action={
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setGradeFilter('all')
              }}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClasses.map((cls) => (
            <ClassCard
              key={cls.id}
              classItem={cls}
              onClick={() => handleOpenClass(cls.id)}
            />
          ))}
        </div>
      )}

      {/* Create Class Modal */}
      {isCreateClassOpen && (
        <CreateClassModal
          onClose={() => setIsCreateClassOpen(false)}
          onCreate={handleCreateClass}
        />
      )}
    </div>
  )
}
