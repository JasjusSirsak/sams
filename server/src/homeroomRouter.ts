import { Router, type Request, type Response } from 'express'
import prisma from './db'
import { requireAuth, requireRole } from './auth'

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
async function getHomeroomTeacherAssignments(userId: string) {
  const teacher = await prisma.teachers.findUnique({
    where: { user_id: BigInt(userId) },
    select: {
      teacher_id: true,
      name: true,
      homeroom_assignments: {
        select: {
          class_id: true,
          classes: {
            select: { class_id: true, name: true, grade_level: true },
          },
        },
      },
    },
  })

  return teacher
}

/**
 * GET /api/homeroom/attendance-requests
 * Retrieve pending attendance/permission/sick requests for the homeroom teacher's assigned class(es).
 */
homeroomRouter.get(
  '/attendance-requests',
  requireAuth,
  requireRole('homeroom', 'teacher', 'admin', 'staff'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const userRole = (sessionUser.role || '').toLowerCase()

      // 1. Fetch teacher and homeroom assignment
      const teacher = await getHomeroomTeacherAssignments(sessionUser.userId)

      // Admin or staff can query all or specific classes, but for homeroom/teacher we enforce homeroom assignment
      let assignedClassIds: bigint[] = []

      if (userRole === 'homeroom' || userRole === 'teacher') {
        if (!teacher || teacher.homeroom_assignments.length === 0) {
          return res.status(403).json({
            message: 'Forbidden. You are not assigned as a homeroom teacher for any class.',
          })
        }
        assignedClassIds = teacher.homeroom_assignments.map((ha) => ha.class_id)
      } else {
        // Admin or staff
        if (req.query.class_id) {
          const parsedId = parseBigIntSafe(req.query.class_id)
          if (parsedId) assignedClassIds = [parsedId]
        }
      }

      // Filter by approval_status (default: PENDING)
      const statusFilter = (req.query.status as string)?.trim().toUpperCase() || 'PENDING'

      // 2. Query attendance records
      const whereCondition: any = {
        approval_status: statusFilter,
      }

      if (assignedClassIds.length > 0) {
        whereCondition.attendance_sessions = {
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
  '/attendance-requests/:recordId',
  requireAuth,
  requireRole('homeroom', 'teacher', 'admin', 'staff'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const userRole = (sessionUser.role || '').toLowerCase()
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
      if (userRole === 'homeroom' || userRole === 'teacher') {
        const teacher = await getHomeroomTeacherAssignments(sessionUser.userId)

        if (!teacher || teacher.homeroom_assignments.length === 0) {
          return res.status(403).json({
            message: 'Forbidden. You are not assigned as a homeroom teacher for any class.',
          })
        }

        const isHomeroomOfClass = teacher.homeroom_assignments.some(
          (ha) => ha.class_id === record.attendance_sessions.class_id
        )

        if (!isHomeroomOfClass) {
          return res.status(403).json({
            message: `Forbidden. You do not have permission to review attendance for class "${record.attendance_sessions.classes.name}". You are not the assigned homeroom teacher for this class.`,
          })
        }
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

export default homeroomRouter
