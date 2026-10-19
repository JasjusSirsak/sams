import apiClient, { parseApiError } from './apiClient'

export interface SubmitAttendanceParams {
  status: string
  note?: string
  evidence?: string | null
  file?: File | null
  student_id?: string
  class_id?: string
}

export interface TodayAttendanceRecord {
  record_id: string
  session_id: string
  status: string
  note: string | null
  document_url: string | null
  approval_status: string
  created_at: string
}

export interface SubmitAttendanceResponse {
  message: string
  data: TodayAttendanceRecord & {
    class_name: string
    student_id: string
    student_name: string
    student_nis: string
  }
}

export async function submitAttendance(payload: SubmitAttendanceParams): Promise<SubmitAttendanceResponse> {
  // If a file is attached, send as multipart/form-data
  if (payload.file) {
    const formData = new FormData()
    formData.append('status', payload.status)
    if (payload.note) formData.append('note', payload.note)
    if (payload.student_id) formData.append('student_id', payload.student_id)
    if (payload.class_id) formData.append('class_id', payload.class_id)
    formData.append('file', payload.file)

    const response = await apiClient.post<SubmitAttendanceResponse>('/attendance/record', formData)
    return response.data
  }

  const response = await apiClient.post<SubmitAttendanceResponse>('/attendance/record', {
    status: payload.status,
    note: payload.note,
    evidence: payload.evidence,
    student_id: payload.student_id,
    class_id: payload.class_id,
  })
  return response.data
}

export async function getTodayAttendance(): Promise<TodayAttendanceRecord | null> {
  const response = await apiClient.get<{ data: TodayAttendanceRecord | null }>('/attendance/today')
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

export interface ClassSubjectGradesResponse {
  class: {
    id: string
    name: string
    grade_level: number
  }
  subject: {
    id: string
    name: string
    code: string | null
  }
  enrolled_students: {
    student_id: string
    nis: string | null
    name: string | null
  }[]
  grades: {
    grade_id: string
    teaching_assignment_id: string
    student_id: string
    student_nis: string | null
    student_name: string | null
    assessment_type: string
    assessment_name: string
    score: number
    academic_year: string
    semester: number
    updated_at: string
  }[]
}

export async function getGradesByClassAndSubject(classId: string, subjectId: string): Promise<ClassSubjectGradesResponse> {
  const response = await apiClient.get<{ data: ClassSubjectGradesResponse }>(`/grades/class/${classId}/subject/${subjectId}`)
  return response.data.data
}

export type ApiAttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alfa'
export type ApiApprovalStatus = 'approved' | 'pending' | 'rejected'

export interface AttendanceHistoryRecord {
  id: string
  date: string
  raw_date: string
  status: ApiAttendanceStatus
  approval: ApiApprovalStatus
  note: string
  evidence: string
}

export interface AttendanceRecapData {
  hadir: number
  izin: number
  sakit: number
  alfa: number
}

export interface AttendanceResponse {
  student_id: string
  history: AttendanceHistoryRecord[]
  recap: AttendanceRecapData
}

export async function getAttendance(studentId?: string): Promise<AttendanceResponse> {
  const params: Record<string, string> = {}
  if (studentId) params.student_id = studentId
  const response = await apiClient.get<{ data: AttendanceResponse }>('/attendance', { params })
  return response.data.data
}

export interface HomeroomAttendanceRequest {
  id: string
  record_id: string
  session_id: string
  date: string
  class: {
    class_id: string
    name: string
    grade_level: number
  }
  student: {
    student_id: string
    nis: string
    name: string
  }
  attendance_status: string
  note: string | null
  document_url: string | null
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED'
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export async function getHomeroomRequests(params?: {
  status?: string
  class_id?: string
}): Promise<HomeroomAttendanceRequest[]> {
  const response = await apiClient.get<{ data: any[] }>('/homeroom', { params })
  // Map backend record structure to convenient frontend structure
  return (response.data.data || []).map((item) => ({
    ...item,
    id: item.record_id || item.id,
  }))
}

export async function reviewRequest(id: string, decision: 'approved' | 'rejected', notes?: string) {
  // Use POST /api/homeroom/approve or /api/homeroom/reject with PATCH fallback
  try {
    const endpoint = decision === 'approved' ? '/homeroom/approve' : '/homeroom/reject'
    const response = await apiClient.post(endpoint, {
      record_id: id,
      note: notes,
    })
    return response.data
  } catch {
    const response = await apiClient.patch(`/homeroom/attendance-requests/${id}`, {
      status: decision.toUpperCase(),
      notes,
    })
    return response.data
  }
}

export async function generateReport(classId: string): Promise<{ file: string }> {
  if (!/^[1-9]\d*$/.test(classId)) {
    throw new Error('Enter a valid class ID to generate the report.')
  }

  let fileBlob: Blob
  try {
    const response = await apiClient.get<Blob>(`/reports/attendance/${encodeURIComponent(classId)}`, {
      responseType: 'blob',
    })
    fileBlob = response.data
  } catch (error: unknown) {
    const apiError = parseApiError(error)
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'data' in error.response &&
      error.response.data instanceof Blob
    ) {
      let payload: unknown
      try {
        payload = JSON.parse(await error.response.data.text())
      } catch {
        payload = null
      }
      if (typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string') {
        throw new Error(payload.message)
      }
    }
    throw new Error(apiError.message)
  }
  const filename = `attendance-report-${classId}.pdf`
  const objectUrl = URL.createObjectURL(fileBlob)
  const downloadLink = document.createElement('a')

  downloadLink.href = objectUrl
  downloadLink.download = filename
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)

  return { file: filename }
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
  class_id: string
  subject_id: string
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

export type SharedAgendaItem = {
  id: string
  source: 'agenda' | 'schedule'
  title: string
  startTime: string | null
  endTime: string | null
  location: string | null
  label: string
  note: string | null
  className: string | null
}

export async function getSharedAgenda(params: { date: string; studentId?: string }): Promise<SharedAgendaItem[]> {
  const response = await apiClient.get<{ data: SharedAgendaItem[] }>('/agenda', { params })
  return response.data.data
}

export interface ParentChild {
  id: string
  student_id: string
  studentId: string
  name: string
  initials: string
  avatar: string
  nis: string
  cls: string
  class_name: string
  className: string
  class_id: string | null
  classId: string | null
  relationship_type: string
  academic_year: string | null
  semester: number | null
}

export async function getParentChildren(): Promise<ParentChild[]> {
  const response = await apiClient.get<{ data: ParentChild[] }>('/parent/children')
  return response.data.data
}

export type ParentAttendanceStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA'

export interface ParentChildAttendance {
  studentId: string
  attendance: {
    id: string
    date: string
    status: ParentAttendanceStatus
    note: string | null
    className: string
  }[]
  summary: Record<ParentAttendanceStatus, number>
}

export async function getParentChildAttendance(childId: string): Promise<ParentChildAttendance> {
  const response = await apiClient.get<{ data: ParentChildAttendance }>(
    `/parent/children/${encodeURIComponent(childId)}/attendance`
  )
  return response.data.data
}

export interface ParentChildGrades {
  studentId: string
  grades: {
    id: string
    subject: string
    subjectCode: string
    className: string
    assessmentType: string
    assessmentName: string
    score: number
    academicYear: string
    semester: number
    updatedAt: string
  }[]
}

export async function getParentChildGrades(studentId: string): Promise<ParentChildGrades> {
  const response = await apiClient.get<{ data: ParentChildGrades }>(
    `/parent/children/${encodeURIComponent(studentId)}/grades`
  )
  return response.data.data
}

export type AdminEntity = 'classes' | 'subjects' | 'academic-periods' | 'teachers' | 'students'

export interface AdminDataRecord {
  id: string
  [key: string]: unknown
}

export async function getAdminRecords(entity: AdminEntity): Promise<AdminDataRecord[]> {
  const response = await apiClient.get<{ data: AdminDataRecord[] }>(`/admin/${entity}`)
  return response.data.data
}

export async function createAdminRecord(entity: AdminEntity, data: Record<string, string>): Promise<void> {
  await apiClient.post(`/admin/${entity}`, data)
}

export async function updateAdminRecord(
  entity: AdminEntity,
  id: string,
  data: Record<string, string>,
): Promise<void> {
  await apiClient.put(`/admin/${entity}/${encodeURIComponent(id)}`, data)
}

export async function deleteAdminRecord(entity: AdminEntity, id: string): Promise<void> {
  await apiClient.delete(`/admin/${entity}/${encodeURIComponent(id)}`)
}