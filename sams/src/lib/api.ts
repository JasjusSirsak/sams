import apiClient from './apiClient'

export interface SubmitAttendanceParams {
  status: string
  note?: string
  evidence?: string | null
  file?: File | null
  student_id?: string
  class_id?: string
}

export async function submitAttendance(payload: SubmitAttendanceParams) {
  // If a file is attached, send as multipart/form-data
  if (payload.file) {
    const formData = new FormData()
    formData.append('status', payload.status)
    if (payload.note) formData.append('note', payload.note)
    if (payload.student_id) formData.append('student_id', payload.student_id)
    if (payload.class_id) formData.append('class_id', payload.class_id)
    formData.append('file', payload.file)

    const response = await apiClient.post('/attendance/record', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  const response = await apiClient.post('/attendance/record', {
    status: payload.status,
    note: payload.note,
    evidence: payload.evidence,
    student_id: payload.student_id,
    class_id: payload.class_id,
  })
  return response.data
}

export async function getTodayAttendance() {
  const response = await apiClient.get('/attendance/today')
  return response.data.data
}

export async function saveGrades(payload: {
  teaching_assignment_id?: string
  class_id?: string
  subject_id?: string
  assessment_type: string
  assessment_name: string
  grades: { student_id: string; score: number }[]
}) {
  const response = await apiClient.post('/grades', payload)
  return response.data
}

export async function getGradesByClassAndSubject(classId: string, subjectId: string) {
  const response = await apiClient.get(`/grades/class/${classId}/subject/${subjectId}`)
  return response.data.data
}

export async function reviewRequest(id: string, decision: 'approved' | 'rejected', notes?: string) {
  const response = await apiClient.patch(`/homeroom/attendance-requests/${id}`, {
    status: decision.toUpperCase(),
    notes,
  })
  return response.data
}

export function generateReport(className: string) {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ file: `${className.replace(/\s+/g, '-')}-Semester-1.pdf` }), 800)
  )
}

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