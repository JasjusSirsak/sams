'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { SUBJECT_GRADES } from '@/lib/data'
import { average, finalScore } from '@/lib/helpers'
import { Card, CardLabel, EmptyState, Pill, buttonSecondary, inputClass } from '@/components/ui-kit'

function scoreColor(score: number) {
  if (score >= 85) return 'bg-success/15 text-success'
  if (score >= 75) return 'bg-info/15 text-info'
  return 'bg-warning/15 text-warning'
}

export function GradeTable({ studentId }: { studentId: string }) {
  const [semester, setSemester] = useState('1')
  const rows = semester === '1' ? SUBJECT_GRADES[studentId] : []
  const avg = average(rows.map((r) => finalScore(r) ?? 0))

  return (
    <Card>
      <CardLabel
        action={
          <div className="flex items-center gap-2">
            <label htmlFor="semester" className="sr-only">
              Semester
            </label>
            <select id="semester" value={semester} onChange={(e) => setSemester(e.target.value)} className={`${inputClass} w-auto py-1.5`}>
              <option value="1">Semester 1 · 2026/2027</option>
              <option value="2">Semester 2 · 2026/2027</option>
            </select>
            <button type="button" className={`${buttonSecondary} py-1.5`} disabled={rows.length === 0}>
              <Download className="size-4" aria-hidden="true" /> Report
            </button>
          </div>
        }
      >
        Grades & report
      </CardLabel>

      {rows.length === 0 ? (
        <EmptyState title="No grades yet" text="Grades for this semester will appear once teachers publish them." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-3 font-medium">Subject</th>
                  <th className="py-3 text-center font-medium">Daily (40%)</th>
                  <th className="py-3 text-center font-medium">Midterm (30%)</th>
                  <th className="py-3 text-center font-medium">Final (30%)</th>
                  <th className="py-3 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const score = finalScore(r) ?? 0
                  return (
                    <tr key={r.subject}>
                      <td className="py-3">
                        <p className="font-medium text-ink">{r.subject}</p>
                        <p className="text-xs text-muted">{r.teacher}</p>
                      </td>
                      <td className="py-3 text-center text-ink">{r.daily}</td>
                      <td className="py-3 text-center text-ink">{r.midterm}</td>
                      <td className="py-3 text-center text-ink">{r.final}</td>
                      <td className="py-3 text-right">
                        <Pill className={scoreColor(score)}>{score}</Pill>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-right text-sm text-muted">
            Semester average: <span className="font-bold text-ink">{avg}</span>
          </p>
        </>
      )}
    </Card>
  )
}
