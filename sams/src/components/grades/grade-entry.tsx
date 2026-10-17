'use client'

import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, RefreshCw, Save } from 'lucide-react'
import { getTeacherClasses, saveGrades, type TeacherClassItem } from '@/lib/api'
import { GRADE_ENTRY, type GradeRow } from '@/lib/data'
import { average, cn, finalScore } from '@/lib/helpers'
import { Card, Pill, Skeleton, Spinner, buttonPrimary, inputClass } from '@/components/ui-kit'

type Field = 'daily' | 'midterm' | 'final'
const FIELDS: { key: Field; label: string; assessmentType: string; assessmentName: string }[] = [
  { key: 'daily', label: 'Daily (40%)', assessmentType: 'DAILY_TASK', assessmentName: 'Daily Average' },
  { key: 'midterm', label: 'Midterm (30%)', assessmentType: 'MID_EXAM', assessmentName: 'Midterm Exam' },
  { key: 'final', label: 'Final (30%)', assessmentType: 'FINAL_EXAM', assessmentName: 'Final Exam' },
]

const isInvalid = (v: number | null) => v != null && (Number.isNaN(v) || v < 0 || v > 100)

export function GradeEntry() {
  const [classes, setClasses] = useState<TeacherClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState<TeacherClassItem | null>(null)
  const [period, setPeriod] = useState('s1')
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [data, setData] = useState<Record<string, GradeRow[]>>(GRADE_ENTRY)
  const [save, setSave] = useState<'saved' | 'dirty' | 'saving'>('saved')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [missingOnly, setMissingOnly] = useState(false)

  useEffect(() => {
    setLoadingClasses(true)
    getTeacherClasses()
      .then((res) => {
        setClasses(res)
        if (res.length > 0) {
          setSelectedClass(res[0])
        }
      })
      .catch((err) => {
        setErrorMessage(err?.message || 'Failed to load assigned classes.')
      })
      .finally(() => {
        setLoadingClasses(false)
      })
  }, [])

  const currentClassId = selectedClass?.assignment_id || '1'
  const rows = data[currentClassId] || data['1'] || []
  const scores = rows.map(finalScore).filter((s): s is number => s != null)
  const missing = rows.length - scores.length
  const hasInvalid = rows.some((r) => FIELDS.some((f) => isInvalid(r[f.key])))
  const visible = missingOnly ? rows.filter((r) => finalScore(r) == null) : rows

  function update(nis: string, field: Field, raw: string) {
    const value = raw === '' ? null : Number(raw)
    setData((d) => ({
      ...d,
      [currentClassId]: (d[currentClassId] || rows).map((r) =>
        r.nis === nis ? { ...r, [field]: value } : r
      ),
    }))
    setSave('dirty')
    setErrorMessage(null)
  }

  async function handleSave() {
    setSave('saving')
    setErrorMessage(null)
    try {
      if (selectedClass) {
        // Send grades to real backend
        for (const field of FIELDS) {
          const validGrades = rows
            .filter((r) => r[field.key] != null)
            .map((r, idx) => ({
              student_id: (idx + 1).toString(),
              score: r[field.key]!,
            }))

          if (validGrades.length > 0) {
            await saveGrades({
              teaching_assignment_id: selectedClass.assignment_id,
              assessment_type: field.assessmentType,
              assessment_name: field.assessmentName,
              grades: validGrades,
            })
          }
        }
      }
      setSave('saved')
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save grades. Please check permissions.')
      setSave('dirty')
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

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm text-red-600 font-medium">
            <CircleAlert className="size-4" /> {errorMessage}
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
                    <tr key={r.nis} className={cn(score == null && 'bg-warning/5')}>
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
                            onChange={(e) => update(r.nis, f.key, e.target.value)}
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
