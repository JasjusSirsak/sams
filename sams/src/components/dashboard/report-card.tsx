'use client'

import { useState } from 'react'
import { AlertCircle, CircleCheck } from 'lucide-react'
import { generateReport } from '@/lib/api'
import { Card, CardLabel, Spinner, buttonPrimary, inputClass } from '@/components/ui-kit'

export function ReportCard() {
  const [classId, setClassId] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [file, setFile] = useState('')
  const [error, setError] = useState('')

  async function handleGenerate() {
    setState('loading')
    setError('')
    try {
      const result = await generateReport(classId)
      setFile(result.file)
      setState('done')
    } catch (requestError: unknown) {
      setError(
        typeof requestError === 'object' && requestError !== null && 'message' in requestError &&
          typeof requestError.message === 'string'
          ? requestError.message
          : 'Failed to generate the attendance report.',
      )
      setState('error')
    }
  }

  return (
    <Card>
      <CardLabel>Attendance report</CardLabel>
      <p className="mb-4 text-sm text-muted">Download a PDF summary for a class.</p>
      <label htmlFor="attendance-report-class-id" className="mb-2 block text-sm font-medium text-ink">
        Class ID
      </label>
      <input
        id="attendance-report-class-id"
        type="number"
        min="1"
        value={classId}
        onChange={(event) => {
          setClassId(event.target.value)
          setState('idle')
        }}
        className={inputClass}
        placeholder="Enter class ID"
      />

      <div className="mt-4">
        {state === 'done' ? (
          <p className="flex items-center gap-2 text-sm text-ink" role="status">
            <CircleCheck className="size-4 text-success" aria-hidden="true" />
            Downloaded {file}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={state === 'loading' || !classId}
            className={buttonPrimary}
          >
            {state === 'loading' && <Spinner />}
            {state === 'loading' ? 'Generating...' : 'Download PDF report'}
          </button>
        )}
        {state === 'error' && (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="size-4" aria-hidden="true" /> {error}
          </p>
        )}
      </div>
    </Card>
  )
}
