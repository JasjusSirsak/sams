'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { buttonSecondary, inputClass } from '@/components/ui-kit'
import { getAdminHomeroomTeachers, getAdminRecords, type AdminDataRecord } from '@/lib/api'
import { parseApiError } from '@/lib/apiClient'

export type ClassNameFieldsValue = {
  name: string
  grade_level: number | ''
  academic_period_id: string
  teacher_id: string
}

type ClassNameFieldsProps = {
  onChange: (value: ClassNameFieldsValue) => void
}

type GradeOption = {
  value: number
  label: string
  roman: string
}

type SelectOption = {
  id: string
  label: string
}

const CLASS_MAJORS = ['IPA', 'IPS', 'Bahasa'] as const

function toRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let remainder = value
  let result = ''

  for (const [number, numeral] of numerals) {
    while (remainder >= number) {
      result += numeral
      remainder -= number
    }
  }

  return result
}

function getGradeOptions(records: AdminDataRecord[]): GradeOption[] {
  const grades = new Set<number>()

  for (const record of records) {
    const grade = record.grade_level
    if (typeof grade === 'number' && Number.isInteger(grade) && grade > 0) {
      grades.add(grade)
    }
  }

  return [...grades]
    .sort((left, right) => left - right)
    .map((value) => {
      const roman = toRoman(value)
      return { value, roman, label: `Grade ${value} (${roman})` }
    })
}

function buildClassName(grade: number | null, major: string, parallel: string): string {
  const roman = grade === null ? '' : toRoman(grade)
  const parallelNumber = Number(parallel)

  if (!roman || !CLASS_MAJORS.includes(major as (typeof CLASS_MAJORS)[number])) return ''
  if (!Number.isInteger(parallelNumber) || parallelNumber < 1 || parallelNumber > 5) return ''

  return `${roman}-${major}-${parallelNumber}`
}

export function ClassNameFields({ onChange }: ClassNameFieldsProps) {
  const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([])
  const [isLoadingGrades, setIsLoadingGrades] = useState(true)
  const [gradeError, setGradeError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [gradeSearch, setGradeSearch] = useState('')
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [isGradeOpen, setIsGradeOpen] = useState(false)
  const [major, setMajor] = useState('')
  const [parallel, setParallel] = useState('')
  const [periodOptions, setPeriodOptions] = useState<SelectOption[]>([])
  const [teacherOptions, setTeacherOptions] = useState<SelectOption[]>([])
  const [academicPeriodId, setAcademicPeriodId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const gradeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let isActive = true

    Promise.all([
      getAdminRecords('classes'),
      getAdminRecords('academic-periods'),
      getAdminHomeroomTeachers(),
    ])
      .then(([classes, periods, teachers]) => {
        if (!isActive) return
        setGradeOptions(getGradeOptions(classes))
        setPeriodOptions(
          periods.flatMap((period) =>
            typeof period.academic_year === 'string' && typeof period.semester === 'number'
              ? [{ id: period.id, label: `${period.academic_year} - Semester ${period.semester}` }]
              : [],
          ),
        )
        setTeacherOptions(
          teachers.flatMap((teacher) =>
            typeof teacher.name === 'string' ? [{ id: teacher.id, label: teacher.name }] : [],
          ),
        )
      })
      .catch((error: unknown) => {
        if (isActive) setGradeError(parseApiError(error).message)
      })
      .finally(() => {
        if (isActive) setIsLoadingGrades(false)
      })

    return () => {
      isActive = false
    }
  }, [reloadKey])

  const filteredGrades = useMemo(() => {
    const query = gradeSearch.trim().toLowerCase()
    if (!query) return gradeOptions

    return gradeOptions.filter(({ label, roman, value }) =>
      `${label} ${roman} ${value}`.toLowerCase().includes(query),
    )
  }, [gradeOptions, gradeSearch])

  function updateValue(
    grade: number | null,
    selectedMajor: string,
    selectedParallel: string,
    selectedPeriod = academicPeriodId,
    selectedTeacher = teacherId,
  ) {
    onChange({
      name: buildClassName(grade, selectedMajor, selectedParallel),
      grade_level: grade ?? '',
      academic_period_id: selectedPeriod,
      teacher_id: selectedTeacher,
    })
  }

  function selectGrade(grade: GradeOption) {
    setSelectedGrade(grade.value)
    setGradeSearch(grade.label)
    setIsGradeOpen(false)
    gradeInputRef.current?.setCustomValidity('')
    updateValue(grade.value, major, parallel)
  }

  function retryGrades() {
    setIsLoadingGrades(true)
    setGradeError(null)
    setReloadKey((value) => value + 1)
  }

  const selectedGradeLabel = gradeOptions.find(({ value }) => value === selectedGrade)?.label ?? ''

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative space-y-1">
          <label htmlFor="class-grade" className="block text-xs font-medium text-ink">
            Grade <span className="text-danger">*</span>
          </label>
          <input
            id="class-grade"
            ref={gradeInputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isGradeOpen}
            aria-controls="class-grade-options"
            aria-busy={isLoadingGrades}
            autoComplete="off"
            required
            disabled={isLoadingGrades || Boolean(gradeError) || gradeOptions.length === 0}
            placeholder={isLoadingGrades ? 'Loading grades...' : 'Search grades'}
            value={isGradeOpen ? gradeSearch : selectedGradeLabel}
            onFocus={() => {
              setGradeSearch('')
              setIsGradeOpen(true)
            }}
            onChange={(event) => {
              setSelectedGrade(null)
              setGradeSearch(event.target.value)
              setIsGradeOpen(true)
              gradeInputRef.current?.setCustomValidity('Select a grade from the list.')
              updateValue(null, major, parallel)
            }}
            onBlur={() => setIsGradeOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsGradeOpen(false)
              if (event.key === 'Enter' && isGradeOpen && filteredGrades[0]) {
                event.preventDefault()
                selectGrade(filteredGrades[0])
              }
            }}
            className={inputClass}
          />
          {isGradeOpen && (
            <ul
              id="class-grade-options"
              role="listbox"
              className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
            >
              {filteredGrades.length > 0 ? (
                filteredGrades.map((grade) => (
                  <li key={grade.value} role="option" aria-selected={grade.value === selectedGrade}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectGrade(grade)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted"
                    >
                      {grade.label}
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-muted">No grades found.</li>
              )}
            </ul>
          )}
        </div>

        <label className="block space-y-1 text-xs font-medium text-ink">
          Class Major <span className="text-danger">*</span>
          <select
            required
            value={major}
            onChange={(event) => {
              setMajor(event.target.value)
              updateValue(selectedGrade, event.target.value, parallel)
            }}
            className={inputClass}
          >
            <option value="">Select a major</option>
            {CLASS_MAJORS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs font-medium text-ink">
          Class Parallel <span className="text-danger">*</span>
          <input
            type="number"
            min={1}
            max={5}
            step={1}
            required
            value={parallel}
            onChange={(event) => {
              setParallel(event.target.value)
              updateValue(selectedGrade, major, event.target.value)
            }}
            placeholder="1 to 5"
            className={inputClass}
          />
        </label>

        <label className="block space-y-1 text-xs font-medium text-ink">
          Academic Period <span className="text-danger">*</span>
          <select
            required
            value={academicPeriodId}
            disabled={isLoadingGrades || Boolean(gradeError)}
            onChange={(event) => {
              setAcademicPeriodId(event.target.value)
              updateValue(selectedGrade, major, parallel, event.target.value)
            }}
            className={inputClass}
          >
            <option value="">Select an academic period</option>
            {periodOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs font-medium text-ink">
          Homeroom Teacher <span className="text-danger">*</span>
          <select
            required
            value={teacherId}
            disabled={isLoadingGrades || Boolean(gradeError)}
            onChange={(event) => {
              setTeacherId(event.target.value)
              updateValue(selectedGrade, major, parallel, academicPeriodId, event.target.value)
            }}
            className={inputClass}
          >
            <option value="">Select a teacher</option>
            {teacherOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      {gradeError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs text-danger sm:col-span-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            {gradeError}
          </span>
          <button
            type="button"
            onClick={retryGrades}
            className={buttonSecondary}
          >
            <RefreshCw className="size-3.5" /> Retry
          </button>
        </div>
      )}

      {!isLoadingGrades && !gradeError && (gradeOptions.length === 0 || periodOptions.length === 0 || teacherOptions.length === 0) && (
        <p role="alert" className="text-xs text-danger sm:col-span-3">
          {gradeOptions.length === 0
            ? 'No grade levels are available in the class records.'
            : periodOptions.length === 0
              ? 'No academic periods are available. Create an academic period first.'
              : 'No teachers are available to assign as homeroom teacher.'}
        </p>
      )}
    </div>
  )
}
