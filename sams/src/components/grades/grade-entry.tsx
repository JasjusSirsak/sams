'use client'

import { useState } from 'react'
import { CircleAlert, CircleCheck, Save } from 'lucide-react'
import { saveGrades } from '@/lib/api'
import { GRADE_ENTRY, TEACHER_CLASSES, type GradeRow } from '@/lib/data'
import { average, cn, finalScore } from '@/lib/helpers'
import { Card, Pill, Spinner, buttonPrimary, inputClass } from '@/components/ui-kit'

type Field = 'daily' | 'midterm' | 'final'
const FIELDS: { key: Field; label: string }[] = [
  { key: 'daily', label: 'Daily (40%)' },
  { key: 'midterm', label: 'Midterm (30%)' },
  { key: 'final', label: 'Final (30%)' },
]

const isInvalid = (v: number | null) => v != null && (Number.isNaN(v) || v < 0 || v > 100)

export function GradeEntry() {
  const [classId, setClassId] = useState(TEACHER_CLASSES[0].id)
  const [period, setPeriod] = useState('s1')
  const [data, setData] = useState<Record<string, GradeRow[]>>(GRADE_ENTRY)
  const [save, setSave] = useState<'saved' | 'dirty' | 'saving'>('saved')
  const [missingOnly, setMissingOnly] = useState(false)

  const rows = data[classId]
  const scores = rows.map(finalScore).filter((s): s is number => s != null)
  const missing = rows.length - scores.length
  const hasInvalid = rows.some((r) => FIELDS.some((f) => isInvalid(r[f.key])))
  const visible = missingOnly ? rows.filter((r) => finalScore(r) == null) : rows

  function update(nis: string, field: Field, raw: string) {
    const value = raw === '' ? null : Number(raw)
    setData((d) => ({ ...d, [classId]: d[classId].map((r) => (r.nis === nis ? { ...r, [field]: value } : r)) }))
    setSave('dirty')
  }

  async function handleSave() {
    setSave('saving')
    await saveGrades(classId, rows)
    setSave('saved')
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="class" className="mb-1.5 block text-sm font-medium text-ink">
              Class
            </label>
            <select id="class" value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
              {TEACHER_CLASSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-ink">
              Subject
            </label>
            <select id="subject" className={inputClass} defaultValue="math">
              <option value="math">Mathematics</option>
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
