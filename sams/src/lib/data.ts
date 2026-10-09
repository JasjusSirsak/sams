// All mock data lives here. Replace these with real API calls later (see lib/api.ts).

export type Role = 'student' | 'parent' | 'teacher' | 'homeroom'
export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alfa'
export type Approval = 'approved' | 'pending' | 'rejected'
export type AgendaCategory = 'school' | 'academic' | 'assignment' | 'meeting' | 'exam'

export const TODAY = new Date(2026, 9, 7)

export const USERS: Record<Role, { name: string; initials: string; subtitle: string; roleLabel: string }> = {
  student: { name: 'Raka Pratama', initials: 'RP', subtitle: 'Class XI IPA 2', roleLabel: 'Student' },
  parent: { name: 'Sri Wahyuni', initials: 'SW', subtitle: 'Parent of 2', roleLabel: 'Parent' },
  teacher: { name: 'Budi Santoso', initials: 'BS', subtitle: 'Mathematics', roleLabel: 'Teacher' },
  homeroom: { name: 'Ratna Dewi', initials: 'RD', subtitle: 'Homeroom · XI IPA 2', roleLabel: 'Homeroom' },
}

export const STUDENTS = [
  { nis: '2024101', name: 'Raka Pratama', cls: 'XI IPA 2', gender: 'Male', attendance: 96 },
  { nis: '2024102', name: 'Ayu Saraswati', cls: 'XI IPA 2', gender: 'Female', attendance: 92 },
  { nis: '2024103', name: 'Bima Nugroho', cls: 'XI IPA 2', gender: 'Male', attendance: 88 },
  { nis: '2024104', name: 'Citra Maharani', cls: 'XI IPA 2', gender: 'Female', attendance: 99 },
  { nis: '2024105', name: 'Dimas Aditya', cls: 'XI IPA 2', gender: 'Male', attendance: 81 },
  { nis: '2024106', name: 'Eka Putri', cls: 'XI IPA 2', gender: 'Female', attendance: 94 },
  { nis: '2024107', name: 'Fajar Ramadhan', cls: 'XI IPA 2', gender: 'Male', attendance: 90 },
  { nis: '2024108', name: 'Gita Anjani', cls: 'XI IPA 2', gender: 'Female', attendance: 97 },
  { nis: '2024109', name: 'Hendra Wijaya', cls: 'XI IPA 2', gender: 'Male', attendance: 85 },
  { nis: '2024110', name: 'Indah Permata', cls: 'XI IPA 2', gender: 'Female', attendance: 93 },
]

export const CHILDREN = [
  { id: 'raka', name: 'Raka Pratama', initials: 'RP', cls: 'XI IPA 2', nis: '2024101' },
  { id: 'nadia', name: 'Nadia Pratama', initials: 'NP', cls: 'VIII B', nis: '2023215' },
]

export type SubjectGrade = { subject: string; teacher: string; daily: number; midterm: number; final: number }

export const SUBJECT_GRADES: Record<string, SubjectGrade[]> = {
  raka: [
    { subject: 'Mathematics', teacher: 'Budi Santoso', daily: 86, midterm: 82, final: 87 },
    { subject: 'Physics', teacher: 'Agus Salim', daily: 90, midterm: 88, final: 91 },
    { subject: 'Chemistry', teacher: 'Maya Lestari', daily: 84, midterm: 80, final: 83 },
    { subject: 'Biology', teacher: 'Rina Kartika', daily: 88, midterm: 86, final: 89 },
    { subject: 'Indonesian', teacher: 'Siti Aminah', daily: 85, midterm: 84, final: 86 },
    { subject: 'English', teacher: 'Dewi Anggraini', daily: 89, midterm: 87, final: 90 },
  ],
  nadia: [
    { subject: 'Mathematics', teacher: 'Budi Santoso', daily: 78, midterm: 75, final: 80 },
    { subject: 'Science', teacher: 'Agus Salim', daily: 84, midterm: 82, final: 85 },
    { subject: 'Indonesian', teacher: 'Siti Aminah', daily: 90, midterm: 88, final: 91 },
    { subject: 'English', teacher: 'Dewi Anggraini', daily: 86, midterm: 83, final: 87 },
    { subject: 'Social Studies', teacher: 'Hadi Purnomo', daily: 81, midterm: 79, final: 82 },
  ],
}

export const ATTENDANCE_RECAP: Record<string, Record<AttendanceStatus, number>> = {
  raka: { hadir: 52, izin: 2, sakit: 1, alfa: 0 },
  nadia: { hadir: 49, izin: 1, sakit: 3, alfa: 2 },
}

export type HistoryItem = { date: string; status: AttendanceStatus; approval: Approval; note?: string }

export const ATTENDANCE_HISTORY: Record<string, HistoryItem[]> = {
  raka: [
    { date: 'Tue, 6 Oct', status: 'hadir', approval: 'approved' },
    { date: 'Mon, 5 Oct', status: 'hadir', approval: 'approved' },
    { date: 'Fri, 2 Oct', status: 'izin', approval: 'approved', note: 'Family event' },
    { date: 'Thu, 1 Oct', status: 'hadir', approval: 'approved' },
    { date: 'Wed, 30 Sep', status: 'sakit', approval: 'approved', note: 'Fever' },
  ],
  nadia: [
    { date: 'Tue, 6 Oct', status: 'sakit', approval: 'pending', note: 'Flu, doctor letter' },
    { date: 'Mon, 5 Oct', status: 'hadir', approval: 'approved' },
    { date: 'Fri, 2 Oct', status: 'alfa', approval: 'rejected', note: 'No evidence provided' },
    { date: 'Thu, 1 Oct', status: 'hadir', approval: 'approved' },
    { date: 'Wed, 30 Sep', status: 'hadir', approval: 'approved' },
  ],
}

export type AgendaItem = {
  id: string
  date: string
  time: string
  title: string
  place: string
  category: AgendaCategory
}

export const AGENDA: AgendaItem[] = [
  { id: 'a0', date: '2026-10-06', time: '09:00', title: 'English presentation', place: 'Room 108', category: 'academic' },
  { id: 'a1', date: '2026-10-07', time: '07:15', title: 'Flag ceremony', place: 'Main field', category: 'school' },
  { id: 'a2', date: '2026-10-07', time: '08:00', title: 'Mathematics — Derivatives quiz', place: 'Room 204', category: 'academic' },
  { id: 'a3', date: '2026-10-07', time: '10:30', title: 'Physics practicum: Optics', place: 'Physics lab', category: 'academic' },
  { id: 'a4', date: '2026-10-08', time: '09:00', title: 'Chemistry assignment due', place: 'Online', category: 'assignment' },
  { id: 'a5', date: '2026-10-09', time: '13:00', title: 'Parent–teacher meeting', place: 'Hall A', category: 'meeting' },
  { id: 'a6', date: '2026-10-11', time: '08:00', title: 'Inter-school basketball match', place: 'Gym', category: 'school' },
  { id: 'a7', date: '2026-10-12', time: '07:30', title: 'Midterm exam week begins', place: 'All classes', category: 'exam' },
]

export const TEACHER_CLASSES = [
  { id: 'xi-ipa-2', name: 'XI IPA 2', subject: 'Mathematics', schedule: 'Mon, Wed · 08:00', students: 32, progress: 78 },
  { id: 'xi-ipa-1', name: 'XI IPA 1', subject: 'Mathematics', schedule: 'Tue, Thu · 10:00', students: 30, progress: 64 },
  { id: 'viii-b', name: 'VIII B', subject: 'Mathematics', schedule: 'Fri · 07:30', students: 28, progress: 52 },
]

export const WEEKLY_ATTENDANCE = [
  { day: 'Mon', hadir: 30, izin: 1, sakit: 1, alfa: 0 },
  { day: 'Tue', hadir: 29, izin: 1, sakit: 1, alfa: 1 },
  { day: 'Wed', hadir: 31, izin: 0, sakit: 1, alfa: 0 },
  { day: 'Thu', hadir: 28, izin: 2, sakit: 1, alfa: 1 },
  { day: 'Fri', hadir: 30, izin: 1, sakit: 0, alfa: 1 },
]

export type GradeRow = { nis: string; name: string; daily: number | null; midterm: number | null; final: number | null }

export const GRADE_ENTRY: Record<string, GradeRow[]> = {
  'xi-ipa-2': [
    { nis: '2024101', name: 'Raka Pratama', daily: 86, midterm: 82, final: 87 },
    { nis: '2024102', name: 'Ayu Saraswati', daily: 80, midterm: 78, final: 79 },
    { nis: '2024103', name: 'Bima Nugroho', daily: 74, midterm: 70, final: 72 },
    { nis: '2024104', name: 'Citra Maharani', daily: 94, midterm: 92, final: 93 },
    { nis: '2024105', name: 'Dimas Aditya', daily: 76, midterm: null, final: null },
    { nis: '2024106', name: 'Eka Putri', daily: 88, midterm: 85, final: 88 },
    { nis: '2024107', name: 'Fajar Ramadhan', daily: 82, midterm: 80, final: 81 },
    { nis: '2024108', name: 'Gita Anjani', daily: 93, midterm: 90, final: 92 },
    { nis: '2024109', name: 'Hendra Wijaya', daily: 75, midterm: 73, final: 74 },
    { nis: '2024110', name: 'Indah Permata', daily: 86, midterm: 84, final: 85 },
  ],
  'xi-ipa-1': [
    { nis: '2024201', name: 'Joko Susilo', daily: 81, midterm: 77, final: null },
    { nis: '2024202', name: 'Kartika Sari', daily: 90, midterm: 88, final: 89 },
    { nis: '2024203', name: 'Lukman Hakim', daily: 72, midterm: null, final: null },
    { nis: '2024204', name: 'Melati Putri', daily: 85, midterm: 86, final: 84 },
    { nis: '2024205', name: 'Nanda Prasetyo', daily: 78, midterm: 74, final: null },
  ],
  'viii-b': [
    { nis: '2023211', name: 'Oki Firmansyah', daily: 80, midterm: null, final: null },
    { nis: '2023212', name: 'Putri Ayuningtyas', daily: 88, midterm: 85, final: null },
    { nis: '2023215', name: 'Nadia Pratama', daily: 78, midterm: 75, final: 80 },
    { nis: '2023218', name: 'Rizky Maulana', daily: 70, midterm: null, final: null },
  ],
}

export type PendingRequest = {
  id: string
  student: string
  nis: string
  status: 'izin' | 'sakit'
  date: string
  note: string
  evidence: string
}

export const INITIAL_PENDING: PendingRequest[] = [
  { id: 'p1', student: 'Bima Nugroho', nis: '2024103', status: 'sakit', date: 'Wed, 7 Oct', note: 'Fever since last night, doctor letter attached.', evidence: 'surat-dokter-bima.pdf' },
  { id: 'p2', student: 'Dimas Aditya', nis: '2024105', status: 'izin', date: 'Wed, 7 Oct', note: 'Family wedding in Bandung.', evidence: 'surat-izin-dimas.jpg' },
  { id: 'p3', student: 'Eka Putri', nis: '2024106', status: 'sakit', date: 'Tue, 6 Oct', note: 'Dental appointment and recovery.', evidence: 'klinik-eka.pdf' },
]

export const NOTIFICATIONS: Record<Role, string[]> = {
  student: ['Mathematics quiz today at 08:00', 'Physics grade updated: 91', 'Chemistry assignment due tomorrow'],
  parent: ["Nadia's sick request is pending approval", 'Parent–teacher meeting on Fri, 9 Oct', "Raka's Physics grade updated"],
  teacher: ['XI IPA 2 final exam scores are incomplete', 'Midterm exam week begins Mon, 12 Oct'],
  homeroom: ['3 attendance requests waiting for review', 'Semester recap can be generated'],
}
