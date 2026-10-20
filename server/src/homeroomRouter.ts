import { Router, type Request, type Response } from 'express'
import prisma from './db'
import { requireAuth, requireRole } from './auth'
import { getActivePeriod, getJakartaDate } from './services/academicPeriod'

const homeroomRouter = Router()

/**
 * Allowed approval action status values
 */
const VALID_APPROVAL_STATUSES = ['APPROVED', 'REJECTED'] as const
type ApprovalStatus = (typeof VALID_APPROVAL_STATUSES)[number]

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
 * Helper to get the authenticated homeroom teacher profile and their assigned classes
 */
async function getActiveHomeroomAssignments(userId: string) {
  const period = await getActivePeriod()
  if (!period) return { period: null, assignments: [] }

  const assignments = await prisma.homeroom_assignments.findMany({
    where: {
      teachers: { user_id: BigInt(userId) },
      academic_period_id: period.academic_period_id,
    },
    orderBy: { academic_periods: { start_date: 'desc' } },
    select: {
      class_id: true,
      classes: {
        select: { class_id: true, name: true, grade_level: true },
      },
    },
  })
  return { period, assignments }
}

async function approvePresentAttendanceToday(req: Request, res: Response) {
  const classId = parseBigIntSafe(req.body.class_id ?? req.body.classId)
  if (!classId) {
    return res.status(400).json({ message: 'Invalid or missing class_id.' })
  }

  const sessionUser = req.user!
  const now = new Date()
  const today = getJakartaDate(now)
  const period = await getActivePeriod(now)
  if (!period) {
    return res.status(403).json({ message: 'There is no active academic period today.' })
  }

  try {
    const approvedCount = await prisma.$transaction(async (transaction) => {
      const assignment = await transaction.homeroom_assignments.findFirst({
        where: {
          class_id: classId,
          teachers: { user_id: BigInt(sessionUser.userId) },
          academic_period_id: period.academic_period_id,
        },
        select: { homeroom_assignment_id: true },
      })

      if (!assignment) return null

      const sessions = await transaction.attendance_sessions.findMany({
        where: { class_id: classId, attendance_date: today },
        select: { attendance_session_id: true },
      })
      if (sessions.length === 0) return 0

      const result = await transaction.attendance_records.updateMany({
        where: {
          attendance_session_id: { in: sessions.map((session) => session.attendance_session_id) },
          status: 'PRESENT',
          approval_status: 'PENDING',
        },
        data: {
          approval_status: 'APPROVED',
          approved_by: BigInt(sessionUser.userId),
          approved_at: now,
        },
      })

      return result.count
    })

    if (approvedCount === null) {
      return res.status(403).json({
        message: 'Forbidden. You are not assigned as a homeroom teacher for this class.',
      })
    }

    return res.status(200).json({
      message: `Approved ${approvedCount} pending present attendance record(s) for today.`,
      approved_count: approvedCount,
    })
  } catch (error) {
    console.error('Failed to bulk approve present attendance:', error)
    return res.status(500).json({
      message: 'Internal server error while approving attendance.',
    })
  }
}

homeroomRouter.put(
  ['/approve-all-present', '/attendance/approve-all-present'],
  requireAuth,
  requireRole('teacher'),
  approvePresentAttendanceToday
)

homeroomRouter.post(
  ['/approve-all-present', '/attendance/approve-all-present'],
  requireAuth,
  requireRole('teacher'),
  approvePresentAttendanceToday
)

/**
 * GET /api/homeroom/attendance-requests
 * Retrieve pending attendance/permission/sick requests for the homeroom teacher's assigned class(es).
 */
homeroomRouter.get(
  ['/', '/attendance-requests', '/requests'],
  requireAuth,
  requireRole('teacher'),
  async (req: Request, res: Response) => {
    try {
      const { period, assignments } = await getActiveHomeroomAssignments(req.user!.userId)
      if (!period || assignments.length === 0) {
        return res.status(403).json({
          message: 'Forbidden. You do not have an active homeroom assignment for today.',
        })
      }
      const assignedClassIds = assignments.map((assignment) => assignment.class_id)

      // Filter by approval_status (default: PENDING)
      const statusFilter = (req.query.status as string)?.trim().toUpperCase() || 'PENDING'

      // 2. Query attendance records
      const whereCondition: any = {
        approval_status: statusFilter,
        attendance_sessions: {
          attendance_date: {
            gte: period.start_date,
            lte: period.end_date,
          },
        },
      }

      if (assignedClassIds.length > 0) {
        whereCondition.attendance_sessions = {
          ...whereCondition.attendance_sessions,
          class_id: { in: assignedClassIds },
        }
      }

      const records = await prisma.attendance_records.findMany({
        where: whereCondition,
        include: {
          students: {
            select: {
              student_id: true,
              nis: true,
              name: true,
            },
          },
          attendance_sessions: {
            include: {
              classes: {
                select: {
                  class_id: true,
                  name: true,
                  grade_level: true,
                },
              },
            },
          },
          users: {
            select: {
              user_id: true,
              username: true,
            },
          },
        },
        orderBy: [
          { attendance_sessions: { attendance_date: 'desc' } },
          { created_at: 'desc' },
        ],
      })

      // 3. Format response data
      const data = records.map((record) => ({
        record_id: record.attendance_record_id.toString(),
        session_id: record.attendance_session_id.toString(),
        date: record.attendance_sessions.attendance_date.toISOString().split('T')[0],
        class: {
          class_id: record.attendance_sessions.classes.class_id.toString(),
          name: record.attendance_sessions.classes.name,
          grade_level: record.attendance_sessions.classes.grade_level,
        },
        student: {
          student_id: record.students.student_id.toString(),
          nis: record.students.nis,
          name: record.students.name,
        },
        attendance_status: record.status,
        note: record.note,
        document_url: record.document_url,
        approval_status: record.approval_status,
        approved_by: record.users?.username ?? null,
        approved_at: record.approved_at,
        created_at: record.created_at,
      }))

      return res.status(200).json({
        message: `Found ${data.length} attendance request(s).`,
        count: data.length,
        data,
      })
    } catch (error) {
      console.error('Failed to retrieve homeroom attendance requests:', error)
      return res.status(500).json({
        message: 'Internal server error while fetching attendance requests.',
      })
    }
  }
)

/**
 * PATCH /api/homeroom/attendance-requests/:recordId
 * Approve or reject an attendance permission/sick request.
 */
homeroomRouter.patch(
  ['/attendance-requests/:recordId', '/requests/:recordId', '/:recordId'],
  requireAuth,
  requireRole('teacher'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const recordId = parseBigIntSafe(req.params.recordId)

      if (!recordId) {
        return res.status(400).json({
          message: 'Invalid record ID parameter.',
        })
      }

      const { status, approval_status, note, notes } = req.body

      // Normalize requested status: accept either 'status' or 'approval_status'
      const rawStatus = (approval_status ?? status)?.toString().trim().toUpperCase()

      if (!rawStatus || !VALID_APPROVAL_STATUSES.includes(rawStatus as ApprovalStatus)) {
        return res.status(400).json({
          message: `Invalid approval status. Allowed values are: ${VALID_APPROVAL_STATUSES.join(', ')}.`,
        })
      }

      const targetStatus: ApprovalStatus = rawStatus as ApprovalStatus
      const optionalNote: string | undefined = typeof (note ?? notes) === 'string' ? (note ?? notes).trim() : undefined

      // 1. Fetch the attendance record with its session and class info
      const record = await prisma.attendance_records.findUnique({
        where: { attendance_record_id: recordId },
        include: {
          attendance_sessions: {
            include: {
              classes: { select: { class_id: true, name: true } },
            },
          },
          students: { select: { student_id: true, name: true } },
        },
      })

      if (!record) {
        return res.status(404).json({
          message: `Attendance request with ID ${recordId.toString()} not found.`,
        })
      }

      // 2. Strict Homeroom Authorization Check
      // Verify that the logged-in user is the homeroom teacher of the student's class
      const { assignments } = await getActiveHomeroomAssignments(sessionUser.userId)
      const isAssignedClass = assignments.some(
        (assignment) => assignment.class_id === record.attendance_sessions.class_id
      )
      if (!isAssignedClass) {
        return res.status(403).json({
          message: `Forbidden. You are not assigned to class "${record.attendance_sessions.classes.name}" for the current academic period.`,
        })
      }

      // 3. Update attendance record approval status
      const updateData: any = {
        approval_status: targetStatus,
        approved_by: BigInt(sessionUser.userId),
        approved_at: new Date(),
      }

      // If homeroom teacher provided feedback notes, append or update note
      if (optionalNote !== undefined && optionalNote !== '') {
        updateData.note = record.note
          ? `${record.note} (Homeroom Note: ${optionalNote})`
          : optionalNote
      }

      const updatedRecord = await prisma.attendance_records.update({
        where: { attendance_record_id: recordId },
        data: updateData,
        include: {
          students: { select: { name: true, nis: true } },
          attendance_sessions: {
            include: { classes: { select: { name: true } } },
          },
          users: { select: { username: true } },
        },
      })

      return res.status(200).json({
        message: `Attendance request for student "${updatedRecord.students.name}" has been ${targetStatus.toLowerCase()}.`,
        data: {
          record_id: updatedRecord.attendance_record_id.toString(),
          session_id: updatedRecord.attendance_session_id.toString(),
          class_name: updatedRecord.attendance_sessions.classes.name,
          student_name: updatedRecord.students.name,
          student_nis: updatedRecord.students.nis,
          attendance_status: updatedRecord.status,
          approval_status: updatedRecord.approval_status,
          note: updatedRecord.note,
          approved_by: updatedRecord.users?.username ?? sessionUser.username,
          approved_at: updatedRecord.approved_at,
        },
      })
    } catch (error) {
      console.error('Failed to update attendance request:', error)
      return res.status(500).json({
        message: 'Internal server error while updating attendance request.',
      })
    }
  }
)

homeroomRouter.post(
  ['/approve', '/reject'],
  requireAuth,
  requireRole('teacher'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const recordId = parseBigIntSafe(req.body.record_id ?? req.body.recordId ?? req.body.id)

      if (!recordId) {
        return res.status(400).json({
          message: 'Invalid or missing record ID in request body.',
        })
      }

      const isApprove = req.path.endsWith('approve')
      const targetStatus: ApprovalStatus = isApprove ? 'APPROVED' : 'REJECTED'
      const optionalNote: string | undefined =
        typeof (req.body.note ?? req.body.notes) === 'string'
          ? (req.body.note ?? req.body.notes).trim()
          : undefined

      const record = await prisma.attendance_records.findUnique({
        where: { attendance_record_id: recordId },
        include: {
          attendance_sessions: {
            include: {
              classes: { select: { class_id: true, name: true } },
            },
          },
          students: { select: { student_id: true, name: true } },
        },
      })

      if (!record) {
        return res.status(404).json({
          message: `Attendance request with ID ${recordId.toString()} not found.`,
        })
      }

      const { assignments } = await getActiveHomeroomAssignments(sessionUser.userId)
      const isAssignedClass = assignments.some(
        (assignment) => assignment.class_id === record.attendance_sessions.class_id
      )
      if (!isAssignedClass) {
        return res.status(403).json({
          message: `Forbidden. You are not assigned to class "${record.attendance_sessions.classes.name}" for the current academic period.`,
        })
      }

      const updateData: any = {
        approval_status: targetStatus,
        approved_by: BigInt(sessionUser.userId),
        approved_at: new Date(),
      }

      if (optionalNote !== undefined && optionalNote !== '') {
        updateData.note = record.note
          ? `${record.note} (Homeroom Note: ${optionalNote})`
          : optionalNote
      }

      const updatedRecord = await prisma.attendance_records.update({
        where: { attendance_record_id: recordId },
        data: updateData,
        include: {
          students: { select: { name: true, nis: true } },
          attendance_sessions: {
            include: { classes: { select: { name: true } } },
          },
          users: { select: { username: true } },
        },
      })

      return res.status(200).json({
        message: `Attendance request for student "${updatedRecord.students.name}" has been ${targetStatus.toLowerCase()}.`,
        data: {
          record_id: updatedRecord.attendance_record_id.toString(),
          session_id: updatedRecord.attendance_session_id.toString(),
          class_name: updatedRecord.attendance_sessions.classes.name,
          student_name: updatedRecord.students.name,
          student_nis: updatedRecord.students.nis,
          attendance_status: updatedRecord.status,
          approval_status: updatedRecord.approval_status,
          note: updatedRecord.note,
          approved_by: updatedRecord.users?.username ?? sessionUser.username,
          approved_at: updatedRecord.approved_at,
        },
      })
    } catch (error) {
      console.error('Failed to update attendance request via POST:', error)
      return res.status(500).json({
        message: 'Internal server error while updating attendance request.',
      })
    }
  }
)

export default homeroomRouter
