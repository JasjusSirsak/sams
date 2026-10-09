'use client'

import { useState } from 'react'
import { CircleCheck, Download } from 'lucide-react'
import { generateReport } from '@/lib/api'
import { GRADE_ENTRY } from '@/lib/data'
import { average, finalScore } from '@/lib/helpers'
import { Card, CardLabel, ProgressBar, Spinner, buttonPrimary } from '@/components/ui-kit'

const SUBJECT_AVERAGES = [
  { subject: 'Mathematics', avg: average(GRADE_ENTRY['xi-ipa-2'].map(finalScore).filter((s): s is number => s != null)) },
  { subject: 'Physics', avg: 84.6 },
  { subject: 'Chemistry', avg: 80.2 },
  { subject: 'English', avg: 86.9 },
]

export function ReportCard() {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [file, setFile] = useState('')

  async function handleGenerate() {
    setState('loading')
    const res = await generateReport('XI IPA 2')
    setFile(res.file)
    setState('done')
  }

  return (
    <Card>
      <CardLabel>Grade recap · XI IPA 2</CardLabel>
      <ul className="space-y-3">
        {SUBJECT_AVERAGES.map((s) => (
          <li key={s.subject}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-ink">{s.subject}</span>
              <span className="font-semibold text-ink">{s.avg}</span>
            </div>
            <ProgressBar value={s.avg} label={`${s.subject} class average`} />
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-line pt-4">
        {state === 'done' ? (
          <p className="flex items-center gap-2 text-sm text-ink" role="status">
            <CircleCheck className="size-4 text-success" aria-hidden="true" />
            Report ready: <span className="font-medium">{file}</span>
            <Download className="ml-auto size-4 text-primary" aria-label="Download" />
          </p>
        ) : (
          <button type="button" onClick={handleGenerate} disabled={state === 'loading'} className={buttonPrimary}>
            {state === 'loading' && <Spinner />}
            {state === 'loading' ? 'Generating...' : 'Generate semester recap'}
          </button>
        )}
      </div>
    </Card>
  )
}
