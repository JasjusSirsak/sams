import prisma from '../db'
import { getActivePeriod, getJakartaDate } from './academicPeriod'

export type ServiceResult<T = unknown> = {
  statusCode: number
  body: T
}

type SessionUser = {
  userId: string
  role: string
}

type AttendanceStatus = 'PRESENT' | 'SICK' | 'PERMITTED' | 'ABSENT'

function result<T>(statusCode: number, body: T): ServiceResult<T> {
  return { statusCode, body }
}

function normalizeStatus(rawStatus: unknown): AttendanceStatus | null {
  if (typeof rawStatus !== 'string') return null
  const status = rawStatus.trim().toUpperCase()
  if (status === 'PERMISSION' || status === 'IZIN') return 'PERMITTED'
  if (status === 'HADIR') return 'PRESENT'
  if (status === 'SAKIT') return 'SICK'
  if (status === 'ALFA') return 'ABSENT'
  if (status === 'PRESENT' || status === 'SICK' || status === 'PERMITTED' || status === 'ABSENT') {
    return status
  }
  return null
}

function parseBigIntSafe(value: unknown): bigint | null {
  if (value === undefined || value === null || value === '') return null
  try {
    const parsed = BigInt(value.toString())
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}

function parseDateString(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') {
    const now = new Date()
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null
  const date = new Date(value.trim())
  if (Number.isNaN(date.getTime())) return null
  return date
}

function isPrismaUniqueError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

async function getStudentProfileByUserId(userId: string) {
  return prisma.students.findUnique({
    where: { user_id: BigInt(userId) },
    include: {
      student_enrollments: {
        include: { classes: true },
        orderBy: { academic_period_id: 'desc' },
        take: 1,
      },
    },
  })
}

async function getStudentAttendanceContext(userId: string, now = new Date()) {
  const [student, period] = await Promise.all([
    prisma.students.findUnique({
      where: { user_id: BigInt(userId) },
      select: { student_id: true },
    }),
    getActivePeriod(now),
  ])
  if (!student || !period) {
    return { studentId: student?.student_id ?? null, classId: null, attendanceDate: getJakartaDate(now), hasActivePeriod: !!period }
  }

  const enrollment = await prisma.student_enrollments.findFirst({
    where: {
      student_id: student.student_id,
      academic_period_id: period.academic_period_id,
    },
    select: { class_id: true },
  })
  return {
    studentId: student.student_id,
    classId: enrollment?.class_id ?? null,
    attendanceDate: getJakartaDate(now),
    hasActivePeriod: true,
  }
}

export async function createOrGetAttendanceSession(
  body: Record<string, unknown>,
  user: SessionUser
): Promise<ServiceResult> {
  let classId: bigint | null
  let attendanceDate: Date | null
  if (user.role.toLowerCase() === 'student') {
    const context = await getStudentAttendanceContext(user.userId)
    if (!context.studentId) return result(403, { message: 'Student profile not found.' })
    if (!context.hasActivePeriod) return result(403, { message: 'There is no active academic period today.' })
    if (!context.classId) return result(403, { message: 'Student is not enrolled in an active class.' })
    classId = context.classId
    attendanceDate = context.attendanceDate
  } else {
    classId = parseBigIntSafe(body.class_id ?? body.classId)
    const rawDate = body.date ?? body.attendance_date ?? new Date().toISOString().slice(0, 10)
    attendanceDate = parseDateString(rawDate)
  }

  const agendaId = parseBigIntSafe(body.agenda_id ?? body.agendaId)
  if (!classId) return result(400, { message: 'Invalid or missing class_id.' })
  if (!attendanceDate) return result(400, { message: 'Invalid date format. Expected YYYY-MM-DD.' })

  let session = await prisma.attendance_sessions.findFirst({
    where: { class_id: classId, attendance_date: attendanceDate },
    include: { classes: { select: { name: true, grade_level: true } } },
  })
  let isNew = false

  if (!session) {
    try {
      session = await prisma.attendance_sessions.create({
        data: {
          class_id: classId,
          attendance_date: attendanceDate,
          created_by: BigInt(user.userId),
          agenda_id: agendaId,
        },
        include: { classes: { select: { name: true, grade_level: true } } },
      })
      isNew = true
    } catch (error) {
      if (!isPrismaUniqueError(error)) throw error
      session = await prisma.attendance_sessions.findFirst({
        where: { class_id: classId, attendance_date: attendanceDate },
        include: { classes: { select: { name: true, grade_level: true } } },
      })
      if (!session) throw error
    }
  }

  return result(isNew ? 201 : 200, {
    message: isNew ? 'New attendance session created successfully.' : 'Existing attendance session retrieved.',
    data: {
      session_id: session.attendance_session_id.toString(),
      class_id: session.class_id.toString(),
      class_name: session.classes.name,
      date: session.attendance_date.toISOString().slice(0, 10),
      created_by: session.created_by.toString(),
      created_at: session.created_at,
      is_new: isNew,
    },
  })
}

export async function submitAttendanceRecord(
  body: Record<string, unknown>,
  user: SessionUser,
  evidencePath?: string
): Promise<ServiceResult> {
  if (user.role.toLowerCase() === 'student') {
    return submitStudentAttendanceRecord(body, user, evidencePath)
  }

  const records = body.records
  if (Array.isArray(records)) {
    if (evidencePath) {
      return result(400, { message: 'Evidence uploads are not supported for bulk attendance submissions.' })
    }
    const sessionId = parseBigIntSafe(body.session_id ?? body.sessionId)
    if (!sessionId) return result(400, { message: 'Missing session_id for bulk records.' })

    const normalizedRecords: {
      studentId: bigint
      status: AttendanceStatus
      note: string | null
      documentUrl: string | null
      approvalStatus: 'PENDING' | 'NOT_REQUIRED'
    }[] = []
    for (const [index, rawRecord] of records.entries()) {
      if (typeof rawRecord !== 'object' || rawRecord === null) {
        return result(400, { message: `Invalid attendance record at index ${index}.` })
      }
      const record = rawRecord as Record<string, unknown>
      const studentId = parseBigIntSafe(record.student_id ?? record.studentId)
      if (!studentId) return result(400, { message: `Invalid student_id at record index ${index}.` })
      const status = normalizeStatus(record.status) ?? 'PRESENT'
      normalizedRecords.push({
        studentId,
        status,
        note: (record.note ?? record.notes)?.toString().trim() || null,
        documentUrl: null,
        approvalStatus: status === 'SICK' || status === 'PERMITTED' ? 'PENDING' : 'NOT_REQUIRED',
      })
    }

    const saved = await prisma.$transaction(
      normalizedRecords.map((record) =>
        prisma.attendance_records.upsert({
          where: {
            attendance_session_id_student_id: {
              attendance_session_id: sessionId,
              student_id: record.studentId,
            },
          },
          update: {
            status: record.status,
            note: record.note,
            document_url: record.documentUrl,
            approval_status: record.approvalStatus,
          },
          create: {
            attendance_session_id: sessionId,
            student_id: record.studentId,
            status: record.status,
            note: record.note,
            document_url: record.documentUrl,
            approval_status: record.approvalStatus,
          },
        })
      )
    )

    return result(200, {
      message: `Successfully processed ${saved.length} records.`,
      count: saved.length,
      data: saved.map((record) => ({
        record_id: record.attendance_record_id.toString(),
        session_id: record.attendance_session_id.toString(),
        student_id: record.student_id.toString(),
        status: record.status,
        approval_status: record.approval_status,
      })),
    })
  }

  let studentId = parseBigIntSafe(body.student_id ?? body.studentId)
  let studentProfile: Awaited<ReturnType<typeof getStudentProfileByUserId>> | null = null
  if (user.role.toLowerCase() === 'student') {
    studentProfile = await getStudentProfileByUserId(user.userId)
    if (!studentProfile) return result(403, { message: 'Student profile not found.' })
    studentId = studentProfile.student_id
  }
  if (!studentId) return result(400, { message: 'Missing or invalid student_id.' })

  let sessionId = parseBigIntSafe(body.session_id ?? body.sessionId)
  if (!sessionId) {
    let classId = parseBigIntSafe(body.class_id ?? body.classId)
    if (!classId && user.role.toLowerCase() === 'student') {
      studentProfile ??= await getStudentProfileByUserId(user.userId)
      classId = studentProfile?.student_enrollments[0]?.class_id ?? null
    }
    if (!classId) return result(400, { message: 'Missing session_id or class_id.' })

    const attendanceDate = parseDateString(null)!
    let session = await prisma.attendance_sessions.findFirst({
      where: { class_id: classId, attendance_date: attendanceDate },
    })
    if (!session) {
      try {
        session = await prisma.attendance_sessions.create({
          data: {
            class_id: classId,
            attendance_date: attendanceDate,
            created_by: BigInt(user.userId),
          },
        })
      } catch (error) {
        if (!isPrismaUniqueError(error)) throw error
        session = await prisma.attendance_sessions.findFirst({
          where: { class_id: classId, attendance_date: attendanceDate },
        })
        if (!session) throw error
      }
    }
    sessionId = session.attendance_session_id
  }

  const status = normalizeStatus(body.status)
  if (!status) {
    return result(400, { message: 'Invalid status. Allowed values: PRESENT, SICK, PERMITTED, ABSENT.' })
  }

  const approvalStatus = status === 'SICK' || status === 'PERMITTED' ? 'PENDING' : 'NOT_REQUIRED'
  const note = (body.note ?? body.notes)?.toString().trim() || null
  const documentUrl = evidencePath ?? null
  const record = await prisma.attendance_records.upsert({
    where: {
      attendance_session_id_student_id: {
        attendance_session_id: sessionId,
        student_id: studentId,
      },
    },
    update: { status, note, document_url: documentUrl, approval_status: approvalStatus },
    create: {
      attendance_session_id: sessionId,
      student_id: studentId,
      status,
      note,
      document_url: documentUrl,
      approval_status: approvalStatus,
    },
    include: {
      students: { select: { name: true, nis: true } },
      attendance_sessions: { include: { classes: { select: { name: true } } } },
    },
  })

  return result(200, {
    message: 'Attendance record submitted successfully.',
    data: {
      record_id: record.attendance_record_id.toString(),
      session_id: record.attendance_session_id.toString(),
      class_name: record.attendance_sessions.classes.name,
      student_id: record.student_id.toString(),
      student_name: record.students.name,
      student_nis: record.students.nis,
      status: record.status,
      note: record.note,
      document_url: record.document_url,
      approval_status: record.approval_status,
      created_at: record.created_at,
    },
  })
}

export async function submitStudentAttendanceRecord(
  body: Record<string, unknown>,
  user: SessionUser,
  evidencePath?: string
): Promise<ServiceResult> {
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''
  if (!['PRESENT', 'SICK', 'PERMITTED'].includes(status)) {
    return result(400, {
      message: 'Invalid status. Allowed values: PRESENT, SICK, PERMITTED.',
    })
  }

  const submittedAt = new Date()
  const context = await getStudentAttendanceContext(user.userId, submittedAt)
  if (!context.studentId) return result(403, { message: 'Student profile not found.' })
  if (!context.hasActivePeriod) return result(403, { message: 'There is no active academic period today.' })
  if (!context.classId) return result(403, { message: 'Student is not enrolled in an active class.' })

  const classId = context.classId
  const attendanceDate = context.attendanceDate
  let session = await prisma.attendance_sessions.findUnique({
    where: { class_id_attendance_date: { class_id: classId, attendance_date: attendanceDate } },
  })

  if (!session) {
    try {
      session = await prisma.attendance_sessions.create({
        data: {
          class_id: classId,
          attendance_date: attendanceDate,
          created_by: BigInt(user.userId),
          created_at: submittedAt,
        },
      })
    } catch (error) {
      if (!isPrismaUniqueError(error)) throw error
      session = await prisma.attendance_sessions.findUnique({
        where: { class_id_attendance_date: { class_id: classId, attendance_date: attendanceDate } },
      })
      if (!session) throw error
    }
  }

  const note = (body.note ?? body.notes)?.toString().trim() || null
  const documentUrl = evidencePath ?? null
  const record = await prisma.attendance_records.upsert({
    where: {
      attendance_session_id_student_id: {
        attendance_session_id: session.attendance_session_id,
        student_id: context.studentId,
      },
    },
    update: {
      status,
      note,
      document_url: documentUrl,
      approval_status: 'PENDING',
      approved_by: null,
      approved_at: null,
      created_at: submittedAt,
    },
    create: {
      attendance_session_id: session.attendance_session_id,
      student_id: context.studentId,
      status,
      note,
      document_url: documentUrl,
      approval_status: 'PENDING',
      created_at: submittedAt,
    },
    include: {
      students: { select: { name: true, nis: true } },
      attendance_sessions: { include: { classes: { select: { name: true } } } },
    },
  })

  return result(200, {
    message: 'Attendance record submitted successfully.',
    data: {
      record_id: record.attendance_record_id.toString(),
      session_id: record.attendance_session_id.toString(),
      class_name: record.attendance_sessions.classes.name,
      student_id: record.student_id.toString(),
      student_name: record.students.name,
      student_nis: record.students.nis,
      status: record.status,
      note: record.note,
      document_url: record.document_url,
      approval_status: record.approval_status,
      created_at: record.created_at,
    },
  })
}

export async function getTodayAttendance(userId: string): Promise<ServiceResult> {
  const student = await getStudentProfileByUserId(userId)
  if (!student) return result(404, { message: 'Student profile not found.' })

  const today = parseDateString(null)!
  const record = await prisma.attendance_records.findFirst({
    where: {
      student_id: student.student_id,
      attendance_sessions: { attendance_date: today },
    },
    include: {
      attendance_sessions: { include: { classes: { select: { name: true } } } },
    },
  })

  if (!record) return result(200, { data: null })
  return result(200, {
    data: {
      record_id: record.attendance_record_id.toString(),
      session_id: record.attendance_session_id.toString(),
      status: record.status,
      note: record.note,
      document_url: record.document_url,
      approval_status: record.approval_status,
      created_at: record.created_at,
    },
  })
}

export async function getAttendanceHistory(
  user: SessionUser,
  rawStudentId: unknown
): Promise<ServiceResult> {
  const role = user.role.toLowerCase()
  let studentId = parseBigIntSafe(rawStudentId)
  let teacherClassIds: bigint[] | undefined
  let teacherPeriod: { start_date: Date; end_date: Date } | null = null

  if (role === 'student') {
    const student = await getStudentProfileByUserId(user.userId)
    if (!student) return result(404, { message: 'Student profile not found.' })
    studentId = student.student_id
  } else if (role === 'parent') {
    if (!studentId) {
      const parent = await prisma.parents.findUnique({
        where: { user_id: BigInt(user.userId) },
        include: { parent_students: { select: { student_id: true }, take: 1 } },
      })
      studentId = parent?.parent_students[0]?.student_id ?? null
    }
    if (!studentId) return result(400, { message: 'Missing student_id.' })

    const parent = await prisma.parents.findUnique({
      where: { user_id: BigInt(user.userId) },
      select: { parent_id: true },
    })
    if (!parent) return result(403, { message: 'Parent profile not found.' })
    const relationship = await prisma.parent_students.findUnique({
      where: { parent_id_student_id: { parent_id: parent.parent_id, student_id: studentId } },
    })
    if (!relationship) return result(403, { message: 'Forbidden. You do not have access to this student.' })
  } else if (!['teacher', 'staff', 'admin'].includes(role)) {
    return result(403, { message: 'Forbidden.' })
  }

  if (!studentId) return result(400, { message: 'Missing student_id.' })

  if (role === 'teacher') {
    const period = await getActivePeriod()
    if (!period) {
      return result(200, {
        data: {
          student_id: studentId.toString(),
          history: [],
          recap: { hadir: 0, izin: 0, sakit: 0, alfa: 0 },
        },
      })
    }
    teacherPeriod = period

    const teacher = await prisma.teachers.findUnique({
      where: { user_id: BigInt(user.userId) },
      select: { teacher_id: true },
    })
    if (!teacher) return result(403, { message: 'Teacher profile not found.' })

    const assignments = await prisma.teaching_assignments.findMany({
      where: {
        teacher_id: teacher.teacher_id,
        academic_period_id: period.academic_period_id,
      },
      select: { class_id: true },
    })
    teacherClassIds = [...new Set(assignments.map((assignment) => assignment.class_id))]
    if (teacherClassIds.length === 0) {
      return result(200, {
        data: {
          student_id: studentId.toString(),
          history: [],
          recap: { hadir: 0, izin: 0, sakit: 0, alfa: 0 },
        },
      })
    }
  }

  const records = await prisma.attendance_records.findMany({
    where: {
      student_id: studentId,
      ...(teacherClassIds && teacherPeriod
        ? {
            attendance_sessions: {
              class_id: { in: teacherClassIds },
              attendance_date: {
                gte: teacherPeriod.start_date,
                lte: teacherPeriod.end_date,
              },
            },
          }
        : {}),
    },
    include: {
      attendance_sessions: {
        select: { attendance_date: true, classes: { select: { name: true } } },
      },
    },
    orderBy: { attendance_sessions: { attendance_date: 'desc' } },
    take: 50,
  })

  const recap = { hadir: 0, izin: 0, sakit: 0, alfa: 0 }
  const history = records.map((record) => {
    const date = record.attendance_sessions.attendance_date
    const rawDate = date.toISOString().slice(0, 10)
    const status = record.status === 'PERMITTED'
      ? 'izin'
      : record.status === 'SICK'
        ? 'sakit'
        : record.status === 'ABSENT'
          ? 'alfa'
          : 'hadir'
    const approval = record.approval_status === 'PENDING'
      ? 'pending'
      : record.approval_status === 'REJECTED'
        ? 'rejected'
        : 'approved'
    recap[status]++

    return {
      id: record.attendance_record_id.toString(),
      date: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      raw_date: rawDate,
      status,
      approval,
      note: record.note || '',
      evidence: record.document_url || '',
    }
  })

  return result(200, { data: { student_id: studentId.toString(), history, recap } })
}
