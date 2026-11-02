'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CircleCheck, CircleAlert, Plus, RefreshCw, Save, X } from 'lucide-react'
import {
  deleteGrades,
  getGradesByClassAndSubject,
  getTeacherClasses,
  saveGrades,
  type ClassSubjectGradesResponse,
  type TeacherClassItem,
} from '@/lib/api'
import { cn } from '@/lib/helpers'
import { Card, EmptyState, Pill, Spinner, buttonPrimary, buttonSecondary, inputClass } from '@/components/ui-kit'

type GradeTab = 'daily' | 'midterm' | 'final'
type Assessment = { name: string; type: string }
type PendingGrades = {
  assignmentId: string
  assessmentName: string
  assessmentType: string
  scores: Record<string, number | null>
}

const TABS: Array<{ id: GradeTab; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'midterm', label: 'Midterm' },
  { id: 'final', label: 'Final' },
]

function requestKey(assignmentId: string, revision: number) {
  return `${assignmentId}:${revision}`
}

function getAssessmentKey(assignmentId: string, assessmentName: string) {
  return `${assignmentId}:${assessmentName}`
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

function getAssessmentType(tab: GradeTab): string {
  if (tab === 'midterm') return 'MID_EXAM'
  if (tab === 'final') return 'FINAL_EXAM'
  return 'DAILY_TASK'
}

function getAssessmentName(tab: GradeTab, grades: ClassSubjectGradesResponse['grades']): string {
  const type = getAssessmentType(tab)
  return grades.find((grade) => grade.assessment_type.toUpperCase() === type)?.assessment_name
    ?? (tab === 'midterm' ? 'Midterm Exam' : 'Final Exam')
}

function getDailyAssessments(grades: ClassSubjectGradesResponse['grades']): Assessment[] {
  const assessmentsByName = new Map<string, Assessment>()
  for (const grade of grades) {
    const type = grade.assessment_type.toUpperCase()
    if (type === 'MID_EXAM' || type === 'FINAL_EXAM') continue
    if (!assessmentsByName.has(grade.assessment_name)) {
      assessmentsByName.set(grade.assessment_name, {
        name: grade.assessment_name,
        type: grade.assessment_type,
      })
    }
  }
  return [...assessmentsByName.values()]
}

export function GradeEntry() {
  const [classes, setClasses] = useState<TeacherClassItem[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [classesLoading, setClassesLoading] = useState(true)
  const [classesError, setClassesError] = useState<string | null>(null)
  const [classesRevision, setClassesRevision] = useState(0)
  const [gradesRevision, setGradesRevision] = useState(0)
  const [loadedGrades, setLoadedGrades] = useState<{
    key: string
    data: ClassSubjectGradesResponse
  } | null>(null)
  const [gradeLoadError, setGradeLoadError] = useState<{ key: string; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<GradeTab>('daily')
  const [selectedAssessmentName, setSelectedAssessmentName] = useState('')
  const [draftAssessments, setDraftAssessments] = useState<Record<string, Assessment[]>>({})
  const [pendingGrades, setPendingGrades] = useState<Record<string, PendingGrades>>({})
  const [isAddingAssessment, setIsAddingAssessment] = useState(false)
  const [newAssessmentName, setNewAssessmentName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getTeacherClasses()
      .then((result) => {
        if (!active) return
        setClasses(result)
        setSelectedAssignmentId((current) =>
          result.some((item) => item.assignment_id === current)
            ? current
            : result[0]?.assignment_id ?? '',
        )
        setClassesError(null)
        setClassesLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setClassesError(getErrorMessage(error, 'Failed to load your teaching assignments.'))
        setClassesLoading(false)
      })
    return () => {
      active = false
    }
  }, [classesRevision])

  const selectedContext = classes.find((item) => item.assignment_id === selectedAssignmentId) ?? null
  const activeGradeRequestKey = selectedContext
    ? requestKey(selectedContext.assignment_id, gradesRevision)
    : null

  useEffect(() => {
    if (!selectedContext || !activeGradeRequestKey) return
    let active = true
    getGradesByClassAndSubject(selectedContext.class_id, selectedContext.subject_id)
      .then((result) => {
        if (!active) return
        setLoadedGrades({ key: activeGradeRequestKey, data: result })
        setGradeLoadError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        setGradeLoadError({
          key: activeGradeRequestKey,
          message: getErrorMessage(error, 'Failed to load students and grades for this teaching context.'),
        })
      })
    return () => {
      active = false
    }
  }, [selectedContext, activeGradeRequestKey])

  const gradeData = loadedGrades?.key === activeGradeRequestKey ? loadedGrades.data : null
  const currentGradeError = gradeLoadError?.key === activeGradeRequestKey
    ? gradeLoadError.message
    : null
  const isLoadingGrades = Boolean(selectedContext && !gradeData && !currentGradeError)

  const periods = useMemo(() => {
    const map = new Map<string, { key: string; year: string; semester: number }>()
    for (const item of classes) {
      const key = `${item.academic_year}:${item.semester}`
      map.set(key, { key, year: item.academic_year, semester: item.semester })
    }
    return [...map.values()]
  }, [classes])
  const selectedPeriodKey = selectedContext
    ? `${selectedContext.academic_year}:${selectedContext.semester}`
    : ''
  const contextsInPeriod = classes.filter(
    (item) => `${item.academic_year}:${item.semester}` === selectedPeriodKey,
  )

  const persistedDailyAssessments = getDailyAssessments(gradeData?.grades ?? [])
  const currentDraftAssessments = selectedContext
    ? draftAssessments[selectedContext.assignment_id] ?? []
    : []
  const dailyAssessments = [...persistedDailyAssessments]
  for (const assessment of currentDraftAssessments) {
    if (!dailyAssessments.some((item) => item.name.toLowerCase() === assessment.name.toLowerCase())) {
      dailyAssessments.push(assessment)
    }
  }
  const selectedDailyAssessment =
    dailyAssessments.find((assessment) => assessment.name === selectedAssessmentName)
    ?? dailyAssessments[0]
    ?? null

  const assessmentName = activeTab === 'daily'
    ? selectedDailyAssessment?.name ?? ''
    : getAssessmentName(activeTab, gradeData?.grades ?? [])
  const assessmentType = activeTab === 'daily'
    ? selectedDailyAssessment?.type ?? 'DAILY_TASK'
    : getAssessmentType(activeTab)
  const pendingKey = selectedContext && assessmentName
    ? getAssessmentKey(selectedContext.assignment_id, assessmentName)
    : ''
  const activePending = pendingKey ? pendingGrades[pendingKey] : undefined
  const savedGradesForAssessment = gradeData?.grades.filter(
    (grade) => grade.assessment_name === assessmentName,
  ) ?? []
  const savedScoreByStudent = new Map(
    savedGradesForAssessment.map((grade) => [grade.student_id, grade.score]),
  )

  function getScore(studentId: string): number | null {
    if (activePending && Object.prototype.hasOwnProperty.call(activePending.scores, studentId)) {
      return activePending.scores[studentId]
    }
    return savedScoreByStudent.get(studentId) ?? null
  }

  const students = gradeData?.enrolled_students ?? []
  const enteredScores = students
    .map((student) => getScore(student.student_id))
    .filter((score): score is number => score !== null)
  const missingCount = students.length - enteredScores.length
  const average = enteredScores.length
    ? Math.round(enteredScores.reduce((total, score) => total + score, 0) / enteredScores.length)
    : null
  const hasUnsavedChanges = Object.values(pendingGrades).some(
    (pending) => pending.assignmentId === selectedContext?.assignment_id,
  )
  const hasInvalidScores = Object.values(pendingGrades)
    .filter((pending) => pending.assignmentId === selectedContext?.assignment_id)
    .some((pending) => Object.values(pending.scores).some(
      (score) => score !== null && (!Number.isFinite(score) || score < 0 || score > 100),
    ))

  function updateScore(studentId: string, rawValue: string) {
    if (!selectedContext || !assessmentName) return
    const value = rawValue === '' ? null : Number(rawValue)
    const key = getAssessmentKey(selectedContext.assignment_id, assessmentName)
    const savedValue = savedScoreByStudent.get(studentId) ?? null
    setPendingGrades((current) => {
      const previous = current[key]
      if (value === savedValue) {
        if (!previous || !Object.prototype.hasOwnProperty.call(previous.scores, studentId)) {
          return current
        }
        const scores = { ...previous.scores }
        delete scores[studentId]
        if (Object.keys(scores).length === 0) {
          const next = { ...current }
          delete next[key]
          return next
        }
        return { ...current, [key]: { ...previous, scores } }
      }
      return {
        ...current,
        [key]: {
          assignmentId: selectedContext.assignment_id,
          assessmentName,
          assessmentType,
          scores: {
            ...previous?.scores,
            [studentId]: value,
          },
        },
      }
    })
    setErrorMessage(null)
  }

  function addAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedContext) return
    const name = newAssessmentName.trim()
    if (!name) {
      setErrorMessage('Enter an assessment name.')
      return
    }
    if (dailyAssessments.some((assessment) => assessment.name.toLowerCase() === name.toLowerCase())) {
      setErrorMessage('An assessment with this name already exists.')
      return
    }

    setDraftAssessments((current) => ({
      ...current,
      [selectedContext.assignment_id]: [
        ...(current[selectedContext.assignment_id] ?? []),
        { name, type: 'DAILY_TASK' },
      ],
    }))
    setSelectedAssessmentName(name)
    setNewAssessmentName('')
    setIsAddingAssessment(false)
    setErrorMessage(null)
  }

  function handleContextChange(assignmentId: string) {
    setSelectedAssignmentId(assignmentId)
    setSelectedAssessmentName('')
    setErrorMessage(null)
  }

  async function handleSave() {
    if (!selectedContext || !gradeData || !hasUnsavedChanges || hasInvalidScores) return
    const changes = Object.values(pendingGrades).filter(
      (pending) => pending.assignmentId === selectedContext.assignment_id,
    )
    setIsSaving(true)
    setErrorMessage(null)
    let didPersist = false

    try {
      for (const change of changes) {
        const scoreEntries = Object.entries(change.scores)
        const valuesToSave = scoreEntries
          .filter((entry): entry is [string, number] => entry[1] !== null)
          .map(([student_id, score]) => ({ student_id, score }))
        const savedIds = new Set(
          gradeData.grades
            .filter((grade) => grade.assessment_name === change.assessmentName)
            .map((grade) => grade.student_id),
        )
        const studentIdsToDelete = scoreEntries
          .filter(([studentId, score]) => score === null && savedIds.has(studentId))
          .map(([studentId]) => studentId)

        if (valuesToSave.length) {
          await saveGrades({
            teaching_assignment_id: change.assignmentId,
            assessment_type: change.assessmentType,
            assessment_name: change.assessmentName,
            grades: valuesToSave,
          })
          didPersist = true
        }
        if (studentIdsToDelete.length) {
          await deleteGrades({
            teaching_assignment_id: change.assignmentId,
            assessment_name: change.assessmentName,
            student_ids: studentIdsToDelete,
          })
          didPersist = true
        }
      }

      if (!didPersist) {
        throw new Error('Enter at least one score before saving a new assessment.')
      }
      setPendingGrades((current) => Object.fromEntries(
        Object.entries(current).filter(([, pending]) => pending.assignmentId !== selectedContext.assignment_id),
      ))
      setGradesRevision((revision) => revision + 1)
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, 'Failed to save grades. Please try again.'))
      if (didPersist) setGradesRevision((revision) => revision + 1)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="teaching-context" className="mb-1.5 block text-sm font-medium text-ink">
              Select Teaching Context
            </label>
            <select
              id="teaching-context"
              value={selectedAssignmentId}
              onChange={(event) => handleContextChange(event.target.value)}
              className={inputClass}
              disabled={classesLoading || !classes.length || isSaving || hasUnsavedChanges}
            >
              {contextsInPeriod.length ? contextsInPeriod.map((context) => (
                <option key={context.assignment_id} value={context.assignment_id}>
                  {context.subject} - {context.name}
                </option>
              )) : (
                <option value="">No teaching contexts available</option>
              )}
            </select>
          </div>
          <div>
            <label htmlFor="academic-period" className="mb-1.5 block text-sm font-medium text-ink">
              Academic period
            </label>
            <select
              id="academic-period"
              value={selectedPeriodKey}
              onChange={(event) => {
                const nextContext = classes.find(
                  (item) => `${item.academic_year}:${item.semester}` === event.target.value,
                )
                if (nextContext) handleContextChange(nextContext.assignment_id)
              }}
              className={inputClass}
              disabled={classesLoading || periods.length <= 1 || isSaving || hasUnsavedChanges}
            >
              {periods.length ? periods.map((period) => (
                <option key={period.key} value={period.key}>
                  {period.year} · Semester {period.semester}
                </option>
              )) : <option value="">No active academic period</option>}
            </select>
          </div>
        </div>
      </Card>

      {classesError && (
        <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <CircleAlert className="size-4" aria-hidden="true" />
            {classesError}
          </p>
          <button
            type="button"
            onClick={() => {
              setClassesLoading(true)
              setClassesError(null)
              setClassesRevision((revision) => revision + 1)
            }}
            className={`${buttonSecondary} mt-3 py-1.5`}
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      <Card className="p-0">
        <div className="flex flex-col gap-4 border-b border-line px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1" role="tablist" aria-label="Assessment type">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`grade-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="grade-panel"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pb-3 sm:pb-2">
            <Pill className="bg-primary-soft text-primary">Average {average ?? '—'}</Pill>
            {missingCount > 0 ? (
              <Pill className="bg-warning/15 text-warning">{missingCount} missing</Pill>
            ) : students.length ? (
              <Pill className="bg-success/15 text-success">Complete</Pill>
            ) : null}
            <span className="flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
              {hasUnsavedChanges ? 'Unsaved changes' : (
                <>
                  <CircleCheck className="size-4 text-success" aria-hidden="true" /> All changes saved
                </>
              )}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving || hasInvalidScores || !gradeData}
              className={`${buttonPrimary} py-1.5`}
            >
              {isSaving ? <Spinner /> : <Save className="size-4" aria-hidden="true" />}
              Save
            </button>
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={() => {
                  if (!selectedContext) return
                  setPendingGrades((current) => Object.fromEntries(
                    Object.entries(current).filter(([, pending]) => pending.assignmentId !== selectedContext.assignment_id),
                  ))
                  setErrorMessage(null)
                }}
                disabled={isSaving}
                className={`${buttonSecondary} py-1.5`}
              >
                Discard
              </button>
            )}
          </div>
        </div>

        <div id="grade-panel" role="tabpanel" aria-labelledby={`grade-tab-${activeTab}`} className="p-5">
          {(errorMessage || currentGradeError) && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2">
              <p className="flex items-center gap-2 text-sm text-danger">
                <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                {errorMessage || currentGradeError}
              </p>
              {currentGradeError && (
                <button
                  type="button"
                  onClick={() => setGradesRevision((revision) => revision + 1)}
                  className={`${buttonSecondary} py-1.5`}
                >
                  <RefreshCw className="size-4" aria-hidden="true" /> Retry
                </button>
              )}
              {hasInvalidScores && (
                <p role="alert" className="mb-4 flex items-center gap-2 text-sm text-danger">
                  <CircleAlert className="size-4" aria-hidden="true" />
                  Scores must be between 0 and 100.
                </p>
              )}
            </div>
          )}

          {activeTab === 'daily' && (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 sm:max-w-sm">
                <label htmlFor="assessment-name" className="mb-1.5 block text-sm font-medium text-ink">
                  Assessment Name
                </label>
                <select
                  id="assessment-name"
                  value={selectedDailyAssessment?.name ?? ''}
                  onChange={(event) => setSelectedAssessmentName(event.target.value)}
                  className={inputClass}
                  disabled={!dailyAssessments.length || isSaving}
                >
                  {dailyAssessments.length ? dailyAssessments.map((assessment) => (
                    <option key={assessment.name} value={assessment.name}>{assessment.name}</option>
                  )) : <option value="">No assessments yet</option>}
                </select>
              </div>
              {!isAddingAssessment ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingAssessment(true)
                    setErrorMessage(null)
                  }}
                  className={`${buttonSecondary} py-2`}
                  disabled={!selectedContext || isSaving || hasUnsavedChanges}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  New Assessment
                </button>
              ) : (
                <form onSubmit={addAssessment} className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="new-assessment-name" className="sr-only">Assessment name</label>
                  <input
                    id="new-assessment-name"
                    autoFocus
                    value={newAssessmentName}
                    onChange={(event) => setNewAssessmentName(event.target.value)}
                    placeholder="Assessment name"
                    maxLength={100}
                    className={inputClass}
                  />
                  <button type="submit" className={`${buttonPrimary} py-2`}>
                    <Plus className="size-4" aria-hidden="true" />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingAssessment(false)
                      setNewAssessmentName('')
                      setErrorMessage(null)
                    }}
                    className={`${buttonSecondary} py-2`}
                    aria-label="Cancel adding assessment"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </form>
              )}
            </div>
          )}

          {classesLoading ? (
            <div role="status" className="flex items-center justify-center gap-2 rounded-xl bg-surface-muted p-8 text-sm text-muted">
              <Spinner /> Loading teaching assignments...
            </div>
          ) : classesError ? (
            <EmptyState title="Unable to load classes" text="Retry the request to load your teaching assignments." />
          ) : !selectedContext ? (
            <EmptyState
              title="No teaching contexts"
              text="You have no teaching assignments in the active academic period."
            />
          ) : isLoadingGrades ? (
            <div role="status" className="flex items-center justify-center gap-2 rounded-xl bg-surface-muted p-8 text-sm text-muted">
              <Spinner /> Loading students and grades...
            </div>
          ) : currentGradeError ? (
            <EmptyState title="Unable to load class grades" text="Retry the request to load the class roster and grades." />
          ) : !gradeData?.enrolled_students.length ? (
            <EmptyState title="No students enrolled" text="There are no enrolled students for this teaching context." />
          ) : activeTab === 'daily' && !selectedDailyAssessment ? (
            <EmptyState title="No assessments yet" text="Add an assessment and enter at least one score to save it." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                    <th className="py-3 font-medium">NIS</th>
                    <th className="py-3 font-medium">Student</th>
                    <th className="py-3 text-center font-medium">
                      {activeTab === 'daily'
                        ? selectedDailyAssessment?.name
                        : TABS.find((tab) => tab.id === activeTab)?.label}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {gradeData.enrolled_students.map((student) => {
                    const score = getScore(student.student_id)
                    const invalid = score !== null && (!Number.isFinite(score) || score < 0 || score > 100)
                    return (
                      <tr key={student.student_id} className={cn(score === null && 'bg-warning/5')}>
                        <td className="py-2.5 text-muted">{student.nis ?? '—'}</td>
                        <td className="py-2.5 font-medium text-ink">{student.name ?? 'Unknown Student'}</td>
                        <td className="px-1 py-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            inputMode="numeric"
                            aria-label={`${assessmentName || activeTab} score for ${student.name ?? 'student'}`}
                            value={score ?? ''}
                            onChange={(event) => updateScore(student.student_id, event.target.value)}
                            placeholder="—"
                            className={cn(
                              inputClass,
                              'mx-auto w-24 text-center',
                              score === null && 'border-warning/60',
                              invalid && 'border-danger text-danger',
                            )}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-muted">
            Grades are saved to the active academic period. A new assessment is recorded after its first score is saved.
          </p>
        </div>
      </Card>
    </div>
  )
}
