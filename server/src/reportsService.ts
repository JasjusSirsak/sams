import prisma from './db'

export type AttendanceStatus = 'PRESENT' | 'SICK' | 'PERMITTED' | 'ABSENT'

export interface AttendanceReportStudent {
  nis: string
  name: string
  sessions: number
  present: number
  sick: number
  permitted: number
  absent: number
  unrecorded: number
  attendanceRate: number
}

export interface AttendanceReport {
  className: string
  gradeLevel: number
  startDate: string
  endDate: string
  classSessionCount: number
  students: AttendanceReportStudent[]
  totals: Omit<AttendanceReportStudent, 'nis' | 'name' | 'attendanceRate'> & {
    attendanceRate: number
  }
}

function normalizeAttendanceStatus(status: string): AttendanceStatus | null {
  const normalized = status.trim().toUpperCase()
  if (normalized === 'PRESENT') return 'PRESENT'
  if (normalized === 'SICK') return 'SICK'
  if (normalized === 'PERMITTED' || normalized === 'PERMISSION') return 'PERMITTED'
  if (normalized === 'ABSENT') return 'ABSENT'
  return null
}

export async function getAttendanceReport(
  classId: bigint,
  startDate: Date,
  endDate: Date,
  userId: string,
  role: string
): Promise<AttendanceReport | null> {
  const normalizedRole = role.toLowerCase()

  if (normalizedRole === 'teacher') {
    const teacher = await prisma.teachers.findUnique({
      where: { user_id: BigInt(userId) },
      select: { teacher_id: true },
    })

    if (!teacher) throw new Error('FORBIDDEN_CLASS_SCOPE')

    const assignment = normalizedRole === 'teacher'
      ? await prisma.teaching_assignments.findFirst({
          where: {
            teacher_id: teacher.teacher_id,
            class_id: classId,
            academic_periods: {
              start_date: { lte: endDate },
              end_date: { gte: startDate },
            },
          },
          select: { teaching_assignment_id: true },
        })
      : await prisma.homeroom_assignments.findFirst({
          where: {
            teacher_id: teacher.teacher_id,
            class_id: classId,
            academic_periods: {
              start_date: { lte: endDate },
              end_date: { gte: startDate },
            },
          },
          select: { homeroom_assignment_id: true },
        })

    if (!assignment) throw new Error('FORBIDDEN_CLASS_SCOPE')
  }

  const classInfo = await prisma.classes.findUnique({
    where: { class_id: classId },
    select: { name: true, grade_level: true },
  })

  if (!classInfo) return null

  const sessions = await prisma.attendance_sessions.findMany({
    where: {
      class_id: classId,
      attendance_date: { gte: startDate, lte: endDate },
    },
    select: {
      attendance_date: true,
      attendance_records: {
        select: {
          status: true,
          students: { select: { student_id: true, nis: true, name: true } },
        },
      },
    },
    orderBy: { attendance_date: 'asc' },
  })

  if (sessions.length === 0) return null

  const enrollments = await prisma.student_enrollments.findMany({
    where: {
      class_id: classId,
      academic_periods: {
        start_date: { lte: endDate },
        end_date: { gte: startDate },
      },
    },
    select: {
      students: { select: { student_id: true, nis: true, name: true } },
      academic_periods: { select: { start_date: true, end_date: true } },
    },
  })

  const sessionDates = sessions.map((session) => session.attendance_date.toISOString().slice(0, 10))
  const roster = new Map<string, {
    nis: string
    name: string
    eligibleDates: Set<string>
    counts: Record<Lowercase<AttendanceStatus>, number>
  }>()

  for (const enrollment of enrollments) {
    const studentId = enrollment.students.student_id.toString()
    const entry = roster.get(studentId) ?? {
      nis: enrollment.students.nis,
      name: enrollment.students.name,
      eligibleDates: new Set<string>(),
      counts: { present: 0, sick: 0, permitted: 0, absent: 0 },
    }

    for (const sessionDate of sessionDates) {
      if (
        sessionDate >= enrollment.academic_periods.start_date.toISOString().slice(0, 10) &&
        sessionDate <= enrollment.academic_periods.end_date.toISOString().slice(0, 10)
      ) {
        entry.eligibleDates.add(sessionDate)
      }
    }

    roster.set(studentId, entry)
  }

  for (const session of sessions) {
    const sessionDate = session.attendance_date.toISOString().slice(0, 10)

    for (const record of session.attendance_records) {
      const studentId = record.students.student_id.toString()
      const entry = roster.get(studentId) ?? {
        nis: record.students.nis,
        name: record.students.name,
        eligibleDates: new Set(sessionDates),
        counts: { present: 0, sick: 0, permitted: 0, absent: 0 },
      }

      if (!entry.eligibleDates.has(sessionDate)) continue

      const status = normalizeAttendanceStatus(record.status)
      if (status) entry.counts[status.toLowerCase() as Lowercase<AttendanceStatus>]++
      roster.set(studentId, entry)
    }
  }

  const students = [...roster.values()]
    .map((student) => {
      const eligibleSessions = student.eligibleDates.size
      const recorded = Object.values(student.counts).reduce((sum, count) => sum + count, 0)
      const { present } = student.counts

      return {
        nis: student.nis,
        name: student.name,
        sessions: eligibleSessions,
        present,
        sick: student.counts.sick,
        permitted: student.counts.permitted,
        absent: student.counts.absent,
        unrecorded: Math.max(0, eligibleSessions - recorded),
        attendanceRate: eligibleSessions === 0 ? 0 : present / eligibleSessions,
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))

  const totals = students.reduce(
    (summary, student) => {
      summary.sessions += student.sessions
      summary.present += student.present
      summary.sick += student.sick
      summary.permitted += student.permitted
      summary.absent += student.absent
      summary.unrecorded += student.unrecorded
      return summary
    },
    { sessions: 0, present: 0, sick: 0, permitted: 0, absent: 0, unrecorded: 0, attendanceRate: 0 }
  )
  totals.attendanceRate = totals.sessions === 0 ? 0 : totals.present / totals.sessions

  return {
    className: classInfo.name,
    gradeLevel: classInfo.grade_level,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    classSessionCount: sessions.length,
    students,
    totals,
  }
}