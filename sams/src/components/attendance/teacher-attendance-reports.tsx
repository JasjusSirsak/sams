'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Card, EmptyState, Pill, buttonSecondary, inputClass } from '@/components/ui-kit'
import {
  exportMonthlyAttendanceReport,
  exportWeeklyAttendanceReport,
  type TeacherClassAttendanceStudent,
} from '@/lib/api'
import { cn } from '@/lib/helpers'

type ReportTab = 'weekly' | 'monthly'
type AttendanceCode = 'H' | 'S' | 'I' | 'A'
type ReportStudent = Pick<TeacherClassAttendanceStudent, 'student_id' | 'name' | 'nis'>

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function parseLocalDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null
}

function formatISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date)
}

function getWeekDates(year: number, month: number, week: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const daysBeforeFirstMonday = (firstDay.getDay() + 6) % 7
  const monday = new Date(year, month, 1 - daysBeforeFirstMonday + (week - 1) * 7)
  return WEEKDAYS.map((_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date
  })
}

function mockStatus(studentId: string, date: Date): AttendanceCode {
  const dateKey = formatISODate(date)
  const seed = `${studentId}:${dateKey}`
  let hash = 0
  for (const character of seed) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  }
  const value = hash % 100
  if (value < 76) return 'H'
  if (value < 84) return 'S'
  if (value < 93) return 'I'
  return 'A'
}

function getMonthRows(students: ReportStudent[], year: number, month: number) {
  const dates: Date[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= daysInMonth; day += 1) {
    dates.push(new Date(year, month, day))
  }

  return students.map((student) => {
    const totals = { S: 0, I: 0, A: 0, H: 0 }
    for (const date of dates) {
      totals[mockStatus(student.student_id, date)] += 1
    }
    return { student, totals }
  })
}

function getReportDateLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))
}

function getWeekLabel(dates: Date[]): string {
  if (dates.length === 0) return ''
  const yearLabel = dates[0].getFullYear() === dates[dates.length - 1].getFullYear()
    ? String(dates[0].getFullYear())
    : `${dates[0].getFullYear()} – ${dates[dates.length - 1].getFullYear()}`
  return `${formatShortDate(dates[0])} – ${formatShortDate(dates[dates.length - 1])}, ${yearLabel}`
}

function getWeekOfMonth(date: Date): number {
  const firstDayOffset = (new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7
  return Math.floor((firstDayOffset + date.getDate() - 1) / 7) + 1
}

function getWeeksInMonth(year: number, month: number): number {
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Math.ceil((firstDayOffset + daysInMonth) / 7)
}

export function TeacherAttendanceReports({
  classId,
  date,
  students,
}: {
  classId: string
  date: string
  students: ReportStudent[]
}) {
  const [activeTab, setActiveTab] = useState<ReportTab>('weekly')
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const selectedDate = parseLocalDate(date)
  const initialDate = selectedDate ?? new Date()
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear())
  const [selectedWeek, setSelectedWeek] = useState(getWeekOfMonth(initialDate))
  const weekDates = getWeekDates(selectedYear, selectedMonth, selectedWeek)
  const monthlyRows = getMonthRows(students, selectedYear, selectedMonth)
  const monthLabel = getReportDateLabel(selectedYear, selectedMonth)
  const weekLabel = getWeekLabel(weekDates)
  const weeksInMonth = getWeeksInMonth(selectedYear, selectedMonth)
  const monthOptions = Array.from({ length: 12 }, (_, month) => ({
    value: month,
    label: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2026, month, 1)),
  }))
  const yearOptions = Array.from({ length: 9 }, (_, index) => initialDate.getFullYear() - 4 + index)

  async function handleMonthlyExport(format: 'xlsx' | 'pdf') {
    if (!Number.isInteger(selectedMonth) || !Number.isInteger(selectedYear)) return
    setExporting(`monthly-${format}`)
    setExportError(null)
    try {
      await exportMonthlyAttendanceReport({ classId, month: selectedMonth + 1, year: selectedYear, format })
    } catch (error: unknown) {
      setExportError(error instanceof Error ? error.message : 'Failed to export the monthly report.')
    } finally {
      setExporting(null)
    }
  }

  async function handleWeeklyExport(format: 'xlsx' | 'pdf') {
    if (weekDates.length !== 7) return
    setExporting(`weekly-${format}`)
    setExportError(null)
    try {
      await exportWeeklyAttendanceReport({
        classId,
        weekStart: formatISODate(weekDates[0]),
        weekEnd: formatISODate(weekDates[weekDates.length - 1]),
        format,
      })
    } catch (error: unknown) {
      setExportError(error instanceof Error ? error.message : 'Failed to export the weekly report.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <Card className="p-0">
      <div className="border-b border-line px-5 pt-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Raw Data</p>
            <h2 className="mt-1 text-lg font-bold text-ink">Detailed Report</h2>
            <p className="mt-1 text-xs text-muted">
              {activeTab === 'weekly'
                ? `Week ${selectedWeek} · ${weekLabel}`
                : `${monthLabel} · Full month`}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2 pb-4">
            {activeTab === 'weekly' && (
              <div>
                <label htmlFor="report-week" className="mb-1 block text-xs font-medium text-muted">Week</label>
                <select
                  id="report-week"
                  value={selectedWeek}
                  onChange={(event) => setSelectedWeek(Number(event.target.value))}
                  className={`${inputClass} min-w-28 py-1.5`}
                >
                  {Array.from({ length: weeksInMonth }, (_, index) => index + 1).map((week) => (
                    <option key={week} value={week}>Week {week}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="report-month" className="mb-1 block text-xs font-medium text-muted">Month</label>
              <select
                id="report-month"
                value={selectedMonth}
                onChange={(event) => {
                  const month = Number(event.target.value)
                  setSelectedMonth(month)
                  setSelectedWeek(1)
                }}
                className={`${inputClass} min-w-36 py-1.5`}
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="report-year" className="mb-1 block text-xs font-medium text-muted">Year</label>
              <select
                id="report-year"
                value={selectedYear}
                onChange={(event) => {
                  const year = Number(event.target.value)
                  setSelectedYear(year)
                  setSelectedWeek((week) => Math.min(week, getWeeksInMonth(year, selectedMonth)))
                }}
                className={`${inputClass} min-w-24 py-1.5`}
              >
                {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-1" role="tablist" aria-label="Attendance report period">
          {([
            { id: 'weekly', label: 'Weekly Overview' },
            { id: 'monthly', label: 'Monthly Report' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              id={`attendance-report-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="attendance-report-panel"
              onClick={() => {
                setActiveTab(tab.id)
                setExportError(null)
              }}
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
      </div>

      <div id="attendance-report-panel" role="tabpanel" aria-labelledby={`attendance-report-tab-${activeTab}`} className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink">
              {activeTab === 'weekly' ? 'Daily Attendance' : 'Monthly Attendance Summary'}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Mock report data based on the selected class roster and date.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeTab === 'weekly' ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleWeeklyExport('xlsx')}
                  disabled={exporting !== null}
                  className={`${buttonSecondary} py-1.5`}
                >
                  {exporting === 'weekly-xlsx' ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <FileSpreadsheet className="size-4" aria-hidden="true" />}
                  Export to Excel
                </button>
                <button
                  type="button"
                  onClick={() => void handleWeeklyExport('pdf')}
                  disabled={exporting !== null}
                  className={`${buttonSecondary} py-1.5`}
                >
                  {exporting === 'weekly-pdf' ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <FileText className="size-4" aria-hidden="true" />}
                  Export to PDF
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleMonthlyExport('xlsx')}
                  disabled={exporting !== null}
                  className={`${buttonSecondary} py-1.5`}
                >
                  {exporting === 'monthly-xlsx' ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <FileSpreadsheet className="size-4" aria-hidden="true" />}
                  Export to Excel
                </button>
                <button
                  type="button"
                  onClick={() => void handleMonthlyExport('pdf')}
                  disabled={exporting !== null}
                  className={`${buttonSecondary} py-1.5`}
                >
                  {exporting === 'monthly-pdf' ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <Download className="size-4" aria-hidden="true" />}
                  Export to PDF
                </button>
              </>
            )}
          </div>
        </div>

        {exportError && (
          <p role="alert" className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {exportError}
          </p>
        )}

        {students.length === 0 ? (
          <EmptyState title="No students available" text="The selected class has no student roster to report." />
        ) : activeTab === 'weekly' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="sticky left-0 bg-surface py-3 pr-4 font-medium">Student Name</th>
                  {weekDates.map((weekDate, index) => (
                    <th key={WEEKDAYS[index]} className="px-2 py-3 text-center font-medium">
                      <span className="block">{WEEKDAY_SHORT[index]}</span>
                      <span className="mt-1 block normal-case tracking-normal">{formatShortDate(weekDate)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((student) => (
                  <tr key={student.student_id}>
                    <td className="sticky left-0 bg-surface py-3 pr-4 font-medium text-ink">
                      {student.name}
                    </td>
                    {weekDates.map((weekDate) => {
                      const status = mockStatus(student.student_id, weekDate)
                      const color = status === 'H'
                        ? 'text-success'
                        : status === 'S'
                          ? 'text-warning'
                          : status === 'I'
                            ? 'text-info'
                            : 'text-danger'
                      return (
                        <td key={formatISODate(weekDate)} className="px-2 py-3 text-center">
                          <Pill className={cn('min-w-8 justify-center font-bold', color)}>{status}</Pill>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-muted">H: Present · S: Sick · I: Permission · A: Absent</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-3 pr-3 font-medium">No</th>
                  <th className="py-3 font-medium">Student Name</th>
                  <th className="py-3 font-medium">NIS</th>
                  <th className="px-3 py-3 text-center font-medium">Total S (Sick)</th>
                  <th className="px-3 py-3 text-center font-medium">Total I (Permission)</th>
                  <th className="px-3 py-3 text-center font-medium">Total A (Absent)</th>
                  <th className="px-3 py-3 text-center font-medium">Total H (Present)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {monthlyRows.map(({ student, totals }, index) => (
                  <tr key={student.student_id}>
                    <td className="py-3 pr-3 text-muted">{index + 1}</td>
                    <td className="py-3 font-medium text-ink">{student.name}</td>
                    <td className="py-3 text-muted">{student.nis}</td>
                    <td className="px-3 py-3 text-center text-warning">{totals.S}</td>
                    <td className="px-3 py-3 text-center text-info">{totals.I}</td>
                    <td className="px-3 py-3 text-center text-danger">{totals.A}</td>
                    <td className="px-3 py-3 text-center font-semibold text-success">{totals.H}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}
