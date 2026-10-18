'use client'

import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, RefreshCw, Save } from 'lucide-react'
import { getGradesByClassAndSubject, getTeacherClasses, saveGrades, type ClassSubjectGradesResponse, type TeacherClassItem } from '@/lib/api'
import { average, cn, finalScore } from '@/lib/helpers'
import { Card, Pill, Skeleton, Spinner, buttonPrimary, buttonSecondary, inputClass } from '@/components/ui-kit'

type Field = 'daily' | 'midterm' | 'final'
const FIELDS: { key: Field; label: string; assessmentType: string; assessmentName: string }[] = [
  { key: 'daily', label: 'Daily (40%)', assessmentType: 'DAILY_TASK', assessmentName: 'Daily Average' },
  { key: 'midterm', label: 'Midterm (30%)', assessmentType: 'MID_EXAM', assessmentName: 'Midterm Exam' },
  { key: 'final', label: 'Final (30%)', assessmentType: 'FINAL_EXAM', assessmentName: 'Final Exam' },
]

const isInvalid = (v: number | null) => v != null && (Number.isNaN(v) || v < 0 || v > 100)

type GradeEntryRow = {
  student_id: string
  nis: string
  name: string
  daily: number | null
  midterm: number | null
  final: number | null
}

function toGradeRows(response: ClassSubjectGradesResponse, assignmentId: string): GradeEntryRow[] {
  const rows: GradeEntryRow[] = response.enrolled_students.map((student) => ({
    student_id: student.student_id,
    nis: student.nis ?? student.student_id,
    name: student.name ?? 'Unknown Student',
    daily: null,
    midterm: null,
    final: null,
  }))
  const rowsByStudent = new Map(rows.map((row) => [row.student_id, row]))

  for (const grade of response.grades) {
    if (grade.teaching_assignment_id !== assignmentId) continue

    const field = FIELDS.find(
      (item) => item.assessmentType === grade.assessment_type.toUpperCase() && item.assessmentName === grade.assessment_name
    )
    const row = rowsByStudent.get(grade.student_id)
    if (field && row) row[field.key] = grade.score
  }

  return rows
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

export function GradeEntry() {
  const [classes, setClasses] = useState<TeacherClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState<TeacherClassItem | null>(null)
  const [period, setPeriod] = useState('s1')
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [rows, setRows] = useState<GradeEntryRow[]>([])
  const [gradesRevision, setGradesRevision] = useState(0)
  const [settledGradeRequestKey, setSettledGradeRequestKey] = useState<string | null>(null)
  const [gradeLoadError, setGradeLoadError] = useState<{ key: string; message: string } | null>(null)
  const [save, setSave] = useState<'saved' | 'dirty' | 'saving'>('saved')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [missingOnly, setMissingOnly] = useState(false)

  useEffect(() => {
    getTeacherClasses()
      .then((res) => {
        setClasses(res)
        if (res.length > 0) {
          setSelectedClass(res[0])
        }
      })
      .catch((err) => {
        setErrorMessage(getErrorMessage(err, 'Failed to load assigned classes.'))
      })
      .finally(() => {
        setLoadingClasses(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedClass) return

    let isActive = true
    const requestKey = `${selectedClass.assignment_id}:${gradesRevision}`

    getGradesByClassAndSubject(selectedClass.class_id, selectedClass.subject_id)
      .then((response) => {
        if (isActive) {
          setRows(toGradeRows(response, selectedClass.assignment_id))
          setGradeLoadError(null)
          setErrorMessage(null)
          setSettledGradeRequestKey(requestKey)
        }
      })
      .catch((err) => {
        if (isActive) {
          setRows([])
          setGradeLoadError({
            key: requestKey,
            message: getErrorMessage(err, 'Failed to load grades for this class and subject.'),
          })
          setSettledGradeRequestKey(requestKey)
        }
      })

    return () => {
      isActive = false
    }
  }, [selectedClass, gradesRevision])

  const gradeRequestKey = selectedClass ? `${selectedClass.assignment_id}:${gradesRevision}` : null
  const loadingGrades = gradeRequestKey !== null && settledGradeRequestKey !== gradeRequestKey
  const loadErrorMessage =
    gradeRequestKey !== null && gradeLoadError?.key === gradeRequestKey ? gradeLoadError.message : null
  const visibleErrorMessage = loadErrorMessage || errorMessage

  const scores = rows.map(finalScore).filter((s): s is number => s != null)
  const missing = rows.length - scores.length
  const hasInvalid = rows.some((r) => FIELDS.some((f) => isInvalid(r[f.key])))
  const visible = missingOnly ? rows.filter((r) => finalScore(r) == null) : rows

  function update(studentId: string, field: Field, raw: string) {
    const value = raw === '' ? null : Number(raw)
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.student_id === studentId ? { ...row, [field]: value } : row
      )
    )
    setSave('dirty')
    setErrorMessage(null)
  }

  async function handleSave() {
    if (!selectedClass) return

    setSave('saving')
    setErrorMessage(null)
    let savedAnyGrades = false
    try {
      for (const field of FIELDS) {
        const validGrades = rows
          .filter((r) => r[field.key] != null)
          .map((r) => ({
            student_id: r.student_id,
            score: r[field.key]!,
          }))

        if (validGrades.length > 0) {
          await saveGrades({
            teaching_assignment_id: selectedClass.assignment_id,
            assessment_type: field.assessmentType,
            assessment_name: field.assessmentName,
            grades: validGrades,
          })
          savedAnyGrades = true
        }
      }
      setSave('saved')
      setGradesRevision((revision) => revision + 1)
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, 'Failed to save grades. Please check permissions.'))
      setSave('dirty')
      if (savedAnyGrades) setGradesRevision((revision) => revision + 1)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="class" className="mb-1.5 block text-sm font-medium text-ink">
              Class
            </label>
            {loadingClasses ? (
              <Skeleton className="h-10 w-full rounded-lg" />
            ) : (
              <select
                id="class"
                value={selectedClass?.assignment_id || ''}
                disabled={save === 'dirty' || save === 'saving'}
                onChange={(e) => {
                  const found = classes.find((c) => c.assignment_id === e.target.value)
                  if (found) setSelectedClass(found)
                }}
                className={inputClass}
              >
                {classes.length === 0 ? (
                  <option value="">No assigned classes</option>
                ) : (
                  classes.map((c) => (
                    <option key={c.assignment_id} value={c.assignment_id}>
                      {c.name} — {c.subject}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-ink">
              Subject
            </label>
            <select id="subject" className={inputClass} disabled value={selectedClass?.subject || 'Mathematics'}>
              <option value={selectedClass?.subject || 'Mathematics'}>
                {selectedClass?.subject || 'Mathematics'}
              </option>
            </select>
          </div>
          <div>
            <label htmlFor="period" className="mb-1.5 block text-sm font-medium text-ink">
              Academic period
            </label>
            <select id="period" value={period} onChange={(e) => setPeriod(e.target.value)} className={inputClass}>
              <option value="s1">Semester 1 · 2026/2027</option>
              <option value="s2">Semester 2 · 2026/2027</option>
            </select>
          </div>
        </div>
      </Card>

      {visibleErrorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm text-red-600 font-medium">
            <CircleAlert className="size-4" /> {visibleErrorMessage}
            {selectedClass && !loadingGrades && (
              <button
                type="button"
                onClick={() => setGradesRevision((revision) => revision + 1)}
                className={`${buttonSecondary} py-1.5`}
              >
                <RefreshCw className="size-4" aria-hidden="true" /> Retry
              </button>
            )}
          </p>
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Pill className="bg-primary-soft text-primary">Class average {average(scores)}</Pill>
          {missing > 0 ? (
            <Pill className="bg-warning/15 text-warning">{missing} missing</Pill>
          ) : (
            <Pill className="bg-success/15 text-success">Complete</Pill>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Show missing only
          </label>

          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
              {save === 'saved' && (
                <>
                  <CircleCheck className="size-4 text-success" aria-hidden="true" /> All changes saved
                </>
              )}
              {save === 'dirty' && 'Unsaved changes'}
              {save === 'saving' && 'Saving...'}
            </span>
            <button
              type="button"
              onClick={() => setGradesRevision((revision) => revision + 1)}
              disabled={!selectedClass || loadingGrades || save !== 'saved'}
              className={`${buttonSecondary} py-1.5`}
            >
              <RefreshCw className="size-4" aria-hidden="true" /> Refresh
            </button>
            <button type="button" onClick={handleSave} disabled={save !== 'dirty' || hasInvalid} className={buttonPrimary}>
              {save === 'saving' ? <Spinner /> : <Save className="size-4" aria-hidden="true" />}
              Save
            </button>
          </div>
        </div>

        {hasInvalid && (
          <p role="alert" className="mb-4 flex items-center gap-2 text-sm text-danger">
            <CircleAlert className="size-4" aria-hidden="true" /> Scores must be between 0 and 100.
          </p>
        )}

        {period === 's2' ? (
          <p className="rounded-xl bg-surface-muted p-6 text-center text-sm text-muted">Semester 2 grade entry opens in January 2027.</p>
        ) : loadingClasses || loadingGrades ? (
          <div role="status" className="flex items-center justify-center gap-2 rounded-xl bg-surface-muted p-6 text-sm text-muted">
            <Spinner /> Loading grades...
          </div>
        ) : !selectedClass ? (
          <p className="rounded-xl bg-surface-muted p-6 text-center text-sm text-muted">No assigned classes available.</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-surface-muted p-6 text-center text-sm text-muted">No enrolled students found for this class.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-3 font-medium">NIS</th>
                  <th className="py-3 font-medium">Student</th>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="py-3 text-center font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="py-3 text-right font-medium">Final score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((r) => {
                  const score = finalScore(r)
                  return (
                    <tr key={r.student_id} className={cn(score == null && 'bg-warning/5')}>
                      <td className="py-2.5 text-muted">{r.nis}</td>
                      <td className="py-2.5 font-medium text-ink">{r.name}</td>
                      {FIELDS.map((f) => (
                        <td key={f.key} className="px-1 py-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            inputMode="numeric"
                            aria-label={`${f.label} for ${r.name}`}
                            value={r[f.key] ?? ''}
                            onChange={(e) => update(r.student_id, f.key, e.target.value)}
                            placeholder="—"
                            className={cn(
                              inputClass,
                              'mx-auto w-20 text-center',
                              r[f.key] == null && 'border-warning/60',
                              isInvalid(r[f.key]) && 'border-danger text-danger',
                            )}
                          />
                        </td>
                      ))}
                      <td className="py-2.5 text-right font-semibold">
                        {score == null ? <span className="text-warning">Missing</span> : <span className="text-ink">{score}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">Final score = Daily × 40% + Midterm × 30% + Final × 30%</p>
      </Card>
    </div>
  )
}
