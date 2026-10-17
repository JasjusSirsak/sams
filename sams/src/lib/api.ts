// Mock service layer. Later, swap these bodies for Axios calls to the Express API,
// e.g. `return apiClient.post('/attendance', payload)`.
function delay<T>(data: T, ms = 700): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export function submitAttendance(payload: { status: string; note: string; evidence: string | null }) {
  return delay({ ok: true, ...payload })
}

export function saveGrades(classId: string, rows: unknown[]) {
  return delay({ ok: true, classId, count: rows.length }, 900)
}

export function reviewRequest(id: string, decision: 'approved' | 'rejected') {
  return delay({ ok: true, id, decision }, 500)
}

export function generateReport(className: string) {
  return delay({ file: `${className.replace(/\s+/g, '-')}-Semester-1.pdf` }, 1200)
}

// Get students function
import apiClient from './apiClient'

export type Student = {
  student_id: string
  nis: string | null
  name: string | null
  enrollments: {
    class_name: string
    academic_year: string
    semester: number
  }[]
}

export async function getStudents(): Promise<Student[]> {
  const response = await apiClient.get<{ data: Student[] }>('/students')
  return response.data.data
}

export type TeacherDashboardSummary = {
  teacher_id: string
  name: string
  classes_taught: number
  total_students: number
  attendance_today: {
    rate: number
    present: number
    total: number
    hint: string
  }
  subjects: string[]
  active_period: {
    academic_year: string
    semester: number
  } | null
}

export async function getTeacherDashboardSummary(): Promise<TeacherDashboardSummary> {
  const response = await apiClient.get<{ data: TeacherDashboardSummary }>('/teacher/dashboard-summary')
  return response.data.data
}

export type TeacherClassItem = {
  id: string
  assignment_id: string
  name: string
  subject: string
  students: number
  progress: number
  academic_year: string
  semester: number
}

export async function getTeacherClasses(): Promise<TeacherClassItem[]> {
  const response = await apiClient.get<{ data: TeacherClassItem[] }>('/teacher/classes')
  return response.data.data
}

export type TeacherWeeklyAttendanceDay = {
  day: string
  hadir: number
  izin: number
  sakit: number
  alfa: number
}

export type TeacherWeeklyAttendance = {
  class_name: string
  weekly: TeacherWeeklyAttendanceDay[]
}

export async function getTeacherWeeklyAttendance(): Promise<TeacherWeeklyAttendance> {
  const response = await apiClient.get<{ data: TeacherWeeklyAttendance }>('/teacher/attendance-weekly')
  return response.data.data
}

export type TeacherAgendaItem = {
  id: string
  title: string
  description: string
  date: string
  time: string
  place: string
  category: 'school' | 'academic' | 'assignment' | 'meeting' | 'exam'
}

export async function getTeacherAgendas(params?: { date?: string; start_date?: string; end_date?: string }): Promise<TeacherAgendaItem[]> {
  const response = await apiClient.get<{ data: TeacherAgendaItem[] }>('/teacher/agendas', { params })
  return response.data.data
}