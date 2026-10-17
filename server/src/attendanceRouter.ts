import { Router, type Request, type Response } from 'express'
import prisma from './db'
import { requireAuth, requireRole } from './auth'
import { handleEvidenceUpload } from './middlewares/upload'

const attendanceRouter = Router()

// Allowed attendance status enum values
const VALID_ATTENDANCE_STATUSES = ['PRESENT', 'SICK', 'PERMITTED', 'PERMISSION', 'ABSENT'] as const
type AttendanceStatus = 'PRESENT' | 'SICK' | 'PERMITTED' | 'ABSENT'

/**
 * Normalizes input status (supports PERMISSION and PERMITTED)
 */
function normalizeStatus(rawStatus: unknown): AttendanceStatus | null {
  if (typeof rawStatus !== 'string') return null
  const upper = rawStatus.trim().toUpperCase()
  if (upper === 'PERMISSION') return 'PERMITTED'
  if (upper === 'HADIR') return 'PRESENT'
  if (upper === 'SAKIT') return 'SICK'
  if (upper === 'IZIN') return 'PERMITTED'
  if (upper === 'ALFA') return 'ABSENT'
  if (upper === 'PRESENT' || upper === 'SICK' || upper === 'PERMITTED' || upper === 'ABSENT') {
    return upper
  }
  return null
}

/**
 * Helper to safely parse and validate date string (YYYY-MM-DD)
 */
function parseDateString(dateStr: unknown): Date | null {
  if (!dateStr) {
    const today = new Date()
    return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  }
  if (typeof dateStr !== 'string') return null
  const trimmed = dateStr.trim()
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(trimmed)) return null

  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) return null
  return parsed
}

/**
 * Helper to safely parse BigInt from string/number
 */
function parseBigIntSafe(val: unknown): bigint | null {
  if (val === undefined || val === null || val === '') return null
  try {
    return BigInt(val.toString())
  } catch {
    return null
  }
}

/**
 * Helper to get student_id and class_id for authenticated student
 */
async function getStudentProfileByUserId(userId: string) {
  const student = await prisma.students.findUnique({
    where: { user_id: BigInt(userId) },
    include: {
      student_enrollments: {
        include: { classes: true },
        orderBy: { academic_period_id: 'desc' },
        take: 1,
      },
    },
  })
  return student
}

/**
 * POST /api/attendance/session
 * Check if attendance session for class_id and date exists. If not, create a new one.
 */
attendanceRouter.post(
  ['/session', '/sessions'],
  requireAuth,
  requireRole('teacher', 'homeroom', 'staff', 'admin', 'student'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      let { class_id, classId, date, attendance_date, agenda_id, agendaId } = req.body

      let resolvedClassId = parseBigIntSafe(class_id ?? classId)

      // If user is a student, automatically resolve class_id from active enrollment if not provided
      if (!resolvedClassId && sessionUser.role === 'student') {
        const student = await getStudentProfileByUserId(sessionUser.userId)
        if (student && student.student_enrollments[0]) {
          resolvedClassId = student.student_enrollments[0].class_id
        }
      }

      const rawDateStr = date ?? attendance_date ?? new Date().toISOString().split('T')[0]
      const parsedDate = parseDateString(rawDateStr)
      const resolvedAgendaId = parseBigIntSafe(agenda_id ?? agendaId)

      if (!resolvedClassId) {
        return res.status(400).json({
          message: 'Invalid or missing class_id.',
        })
      }

      if (!parsedDate) {
        return res.status(400).json({
          message: 'Invalid date format. Expected YYYY-MM-DD.',
        })
      }

      // Check if session already exists
      let session = await prisma.attendance_sessions.findFirst({
        where: {
          class_id: resolvedClassId,
          attendance_date: parsedDate,
        },
        include: {
          classes: { select: { name: true, grade_level: true } },
        },
      })

      let isNew = false

      // If not, create it
      if (!session) {
        session = await prisma.attendance_sessions.create({
          data: {
            class_id: resolvedClassId,
            attendance_date: parsedDate,
            created_by: BigInt(sessionUser.userId),
            agenda_id: resolvedAgendaId,
          },
          include: {
            classes: { select: { name: true, grade_level: true } },
          },
        })
        isNew = true
      }

      return res.status(isNew ? 201 : 200).json({
        message: isNew
          ? 'New attendance session created successfully.'
          : 'Existing attendance session retrieved.',
        data: {
          session_id: session.attendance_session_id.toString(),
          class_id: session.class_id.toString(),
          class_name: session.classes.name,
          date: session.attendance_date.toISOString().split('T')[0],
          created_by: session.created_by.toString(),
          created_at: session.created_at,
          is_new: isNew,
        },
      })
    } catch (error: any) {
      if (error?.code === 'P2002') {
        // Concurrency catch: retrieve newly created session
        const existing = await prisma.attendance_sessions.findFirst({
          where: {
            class_id: BigInt(req.body.class_id ?? req.body.classId),
            attendance_date: parseDateString(req.body.date ?? req.body.attendance_date)!,
          },
          include: { classes: { select: { name: true } } },
        })
        if (existing) {
          return res.status(200).json({
            message: 'Existing attendance session retrieved.',
            data: {
              session_id: existing.attendance_session_id.toString(),
              class_id: existing.class_id.toString(),
              class_name: existing.classes.name,
              date: existing.attendance_date.toISOString().split('T')[0],
              created_by: existing.created_by.toString(),
              created_at: existing.created_at,
              is_new: false,
            },
          })
        }
      }
      console.error('Failed to get or create attendance session:', error)
      return res.status(500).json({
        message: 'Internal server error while processing attendance session.',
      })
    }
  }
)

/**
 * POST /api/attendance/record (or /records)
 * Submit or update attendance record with optional file upload (multipart/form-data or json)
 * If status is SICK or PERMITTED -> approval_status = 'PENDING'
 * If status is PRESENT or ABSENT -> approval_status = 'NOT_REQUIRED'
 */
attendanceRouter.post(
  ['/record', '/records'],
  requireAuth,
  handleEvidenceUpload('file'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const {
        session_id,
        sessionId,
        class_id,
        classId,
        student_id,
        studentId,
        status,
        note,
        notes,
        document_url,
        evidence,
        records,
      } = req.body

      // A. Support Bulk Upsert if 'records' array is provided
      if (Array.isArray(records)) {
        const resolvedSessionId = parseBigIntSafe(session_id ?? sessionId)
        if (!resolvedSessionId) {
          return res.status(400).json({ message: 'Missing session_id for bulk records.' })
        }

        const upsertOps = records.map((r: any) => {
          const sId = parseBigIntSafe(r.student_id ?? r.studentId)!
          const parsedStatus = normalizeStatus(r.status) || 'PRESENT'
          const approvalStatus =
            parsedStatus === 'SICK' || parsedStatus === 'PERMITTED' ? 'PENDING' : 'NOT_REQUIRED'

          return prisma.attendance_records.upsert({
            where: {
              attendance_session_id_student_id: {
                attendance_session_id: resolvedSessionId,
                student_id: sId,
              },
            },
            update: {
              status: parsedStatus,
              note: r.note ?? r.notes ?? null,
              document_url: r.document_url ?? r.proof_url ?? null,
              approval_status: approvalStatus,
            },
            create: {
              attendance_session_id: resolvedSessionId,
              student_id: sId,
              status: parsedStatus,
              note: r.note ?? r.notes ?? null,
              document_url: r.document_url ?? r.proof_url ?? null,
              approval_status: approvalStatus,
            },
          })
        })

        const saved = await prisma.$transaction(upsertOps)
        return res.status(200).json({
          message: `Successfully processed ${saved.length} records.`,
          count: saved.length,
          data: saved.map((s) => ({
            record_id: s.attendance_record_id.toString(),
            session_id: s.attendance_session_id.toString(),
            student_id: s.student_id.toString(),
            status: s.status,
            approval_status: s.approval_status,
          })),
        })
      }

      // B. Single Record Submission (Common for Student Daily Attendance Check-In)
      let targetStudentId = parseBigIntSafe(student_id ?? studentId)

      // If user is a student, automatically get student_id
      if (sessionUser.role === 'student') {
        const studentProfile = await getStudentProfileByUserId(sessionUser.userId)
        if (!studentProfile) {
          return res.status(403).json({ message: 'Student profile not found.' })
        }
        targetStudentId = studentProfile.student_id
      }

      if (!targetStudentId) {
        return res.status(400).json({ message: 'Missing or invalid student_id.' })
      }

      let resolvedSessionId = parseBigIntSafe(session_id ?? sessionId)

      // If session_id not provided, check or create session for class_id and today's date
      if (!resolvedSessionId) {
        let targetClassId = parseBigIntSafe(class_id ?? classId)
        if (!targetClassId && sessionUser.role === 'student') {
          const studentProfile = await getStudentProfileByUserId(sessionUser.userId)
          if (studentProfile?.student_enrollments[0]) {
            targetClassId = studentProfile.student_enrollments[0].class_id
          }
        }

        if (!targetClassId) {
          return res.status(400).json({ message: 'Missing session_id or class_id.' })
        }

        const today = parseDateString(null)!
        let session = await prisma.attendance_sessions.findFirst({
          where: { class_id: targetClassId, attendance_date: today },
        })

        if (!session) {
          session = await prisma.attendance_sessions.create({
            data: {
              class_id: targetClassId,
              attendance_date: today,
              created_by: BigInt(sessionUser.userId),
            },
          })
        }
        resolvedSessionId = session.attendance_session_id
      }

      const parsedStatus = normalizeStatus(status)
      if (!parsedStatus) {
        return res.status(400).json({
          message: 'Invalid status. Allowed values: PRESENT, SICK, PERMITTED, ABSENT.',
        })
      }

      // Set approval_status based on PRD requirements:
      // SICK or PERMITTED -> PENDING
      // PRESENT or ABSENT -> NOT_REQUIRED
      const approvalStatus =
        parsedStatus === 'SICK' || parsedStatus === 'PERMITTED' ? 'PENDING' : 'NOT_REQUIRED'

      const noteText = (note ?? notes)?.toString().trim() || null
      const docUrl =
        (req.body.document_url ?? document_url ?? evidence)?.toString().trim() || null

      const record = await prisma.attendance_records.upsert({
        where: {
          attendance_session_id_student_id: {
            attendance_session_id: resolvedSessionId,
            student_id: targetStudentId,
          },
        },
        update: {
          status: parsedStatus,
          note: noteText,
          document_url: docUrl,
          approval_status: approvalStatus,
        },
        create: {
          attendance_session_id: resolvedSessionId,
          student_id: targetStudentId,
          status: parsedStatus,
          note: noteText,
          document_url: docUrl,
          approval_status: approvalStatus,
        },
        include: {
          students: { select: { name: true, nis: true } },
          attendance_sessions: {
            include: { classes: { select: { name: true } } },
          },
        },
      })

      return res.status(200).json({
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
    } catch (error) {
      console.error('Failed to submit attendance record:', error)
      return res.status(500).json({
        message: 'Internal server error while saving attendance record.',
      })
    }
  }
)

/**
 * GET /api/attendance/today
 * Check current authenticated student's attendance record for today
 */
attendanceRouter.get('/today', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionUser = req.user!
    const student = await getStudentProfileByUserId(sessionUser.userId)

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' })
    }

    const today = parseDateString(null)!
    const record = await prisma.attendance_records.findFirst({
      where: {
        student_id: student.student_id,
        attendance_sessions: {
          attendance_date: today,
        },
      },
      include: {
        attendance_sessions: {
          include: { classes: { select: { name: true } } },
        },
      },
    })

    if (!record) {
      return res.status(200).json({ data: null })
    }

    return res.status(200).json({
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
  } catch (error) {
    console.error('Failed to check today attendance:', error)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default attendanceRouter
