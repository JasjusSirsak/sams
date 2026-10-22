import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Router, type Request, type Response } from 'express'
import { fileTypeFromFile } from 'file-type'
import prisma from './db'
import { requireAuth, requireRole } from './auth'
import { discardEvidenceUpload, EVIDENCE_DIR, handleEvidenceUpload } from './middlewares/upload'
import { getActivePeriod, getJakartaDate } from './services/academicPeriod'
import {
  createOrGetAttendanceSession,
  getAttendanceHistory,
  getTodayAttendance,
  submitAttendanceRecord,
  submitStudentAttendanceRecord,
  type ServiceResult,
} from './services/attendanceService'

const attendanceRouter = Router()
const EVIDENCE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function sendResult(res: Response, serviceResult: ServiceResult) {
  return res.status(serviceResult.statusCode).json(serviceResult.body)
}

function sendInternalError(res: Response, message: string, error: unknown) {
  console.error(message, error)
  return res.status(500).json({ message: 'Internal server error.' })
}

attendanceRouter.get(
  '/class',
  requireAuth,
  requireRole('teacher'),
  async (req: Request, res: Response) => {
    const classIdValue = req.query.classId
    const dateValue = req.query.date
    if (typeof classIdValue !== 'string' || !/^[1-9]\d*$/.test(classIdValue)) {
      return res.status(400).json({ message: 'A valid classId is required.' })
    }

    let selectedDate = getJakartaDate()
    if (dateValue !== undefined) {
      if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return res.status(400).json({ message: 'Date must use YYYY-MM-DD format.' })
      }
      const parsedDate = new Date(`${dateValue}T00:00:00.000Z`)
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateValue) {
        return res.status(400).json({ message: 'Date must be a valid calendar date.' })
      }
      selectedDate = parsedDate
    }

    try {
      const period = await getActivePeriod()
      if (!period) {
        return res.status(404).json({ message: 'No active academic period for the selected date.' })
      }
      if (selectedDate < period.start_date || selectedDate > period.end_date) {
        return res.status(400).json({ message: 'The selected date is outside the active academic period.' })
      }

      const teacher = await prisma.teachers.findUnique({
        where: { user_id: BigInt(req.user!.userId) },
        select: { teacher_id: true },
      })
      if (!teacher) {
        return res.status(403).json({ message: 'Teacher profile not found.' })
      }

      const classId = BigInt(classIdValue)
      const [classInfo, teachingAssignment, homeroomAssignment] = await Promise.all([
        prisma.classes.findUnique({
          where: { class_id: classId },
          select: { class_id: true, name: true },
        }),
        prisma.teaching_assignments.findFirst({
          where: {
            teacher_id: teacher.teacher_id,
            class_id: classId,
            academic_period_id: period.academic_period_id,
          },
          select: { teaching_assignment_id: true },
        }),
        prisma.homeroom_assignments.findFirst({
          where: {
            teacher_id: teacher.teacher_id,
            class_id: classId,
            academic_period_id: period.academic_period_id,
          },
          select: { homeroom_assignment_id: true },
        }),
      ])

      if (!classInfo) return res.status(404).json({ message: 'Class not found.' })
      if (!teachingAssignment && !homeroomAssignment) {
        return res.status(403).json({ message: 'You are not assigned to this class in the active academic period.' })
      }

      const dayOfWeek = selectedDate.getUTCDay()
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const weekStart = new Date(selectedDate)
      weekStart.setUTCDate(weekStart.getUTCDate() - daysFromMonday)
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
      const rangeStart = new Date(Math.max(weekStart.getTime(), period.start_date.getTime()))
      const rangeEnd = new Date(Math.min(weekEnd.getTime(), period.end_date.getTime()))

      const [enrollments, sessions] = await Promise.all([
        prisma.student_enrollments.findMany({
          where: { class_id: classId, academic_period_id: period.academic_period_id },
          select: { students: { select: { student_id: true, name: true, nis: true } } },
          orderBy: { students: { name: 'asc' } },
        }),
        prisma.attendance_sessions.findMany({
          where: {
            class_id: classId,
            attendance_date: { gte: rangeStart, lte: rangeEnd },
          },
          select: {
            attendance_date: true,
            attendance_records: {
              select: {
                attendance_record_id: true,
                student_id: true,
                status: true,
                approval_status: true,
                note: true,
                document_url: true,
              },
            },
          },
          orderBy: { attendance_date: 'asc' },
        }),
      ])

      const sessionForDate = sessions.find(
        (session) => session.attendance_date.getTime() === selectedDate.getTime()
      )
      const recordByStudent = new Map(
        (sessionForDate?.attendance_records ?? []).map((record) => [
          record.student_id.toString(),
          record,
        ])
      )
      const weekly = WEEKDAYS.map((day) => ({
        day,
        hadir: 0,
        izin: 0,
        sakit: 0,
        alfa: 0,
      }))

      for (const session of sessions) {
        const index = (session.attendance_date.getUTCDay() + 6) % 7
        for (const record of session.attendance_records) {
          if (record.approval_status === 'REJECTED' || record.status === 'ABSENT') {
            weekly[index]!.alfa++
          } else if (record.status === 'PRESENT') {
            weekly[index]!.hadir++
          } else if (record.status === 'PERMITTED') {
            weekly[index]!.izin++
          } else if (record.status === 'SICK') {
            weekly[index]!.sakit++
          }
        }
      }

      return res.json({
        data: {
          class: { id: classInfo.class_id.toString(), name: classInfo.name },
          period: {
            id: period.academic_period_id.toString(),
            year: period.academic_year,
            semester: period.semester,
          },
          date: selectedDate.toISOString().slice(0, 10),
          is_homeroom: homeroomAssignment !== null,
          students: enrollments.map(({ students }) => {
            const record = recordByStudent.get(students.student_id.toString())
            return {
              student_id: students.student_id.toString(),
              name: students.name,
              nis: students.nis,
              record_id: record?.attendance_record_id.toString() ?? null,
              status: record?.status ?? null,
              approval_status: record?.approval_status ?? null,
              note: record?.note ?? null,
              has_evidence: record ? record.document_url !== null : null,
            }
          }),
          weekly,
        },
      })
    } catch (error) {
      return sendInternalError(res, 'Failed to fetch class attendance:', error)
    }
  }
)

attendanceRouter.post(
  ['/session', '/sessions'],
  requireAuth,
  requireRole('teacher', 'staff', 'admin', 'student'),
  async (req: Request, res: Response) => {
    try {
      return sendResult(res, await createOrGetAttendanceSession(req.body, req.user!))
    } catch (error) {
      return sendInternalError(res, 'Failed to get or create attendance session:', error)
    }
  }
)

attendanceRouter.get(
  '/evidence/:filename',
  requireAuth,
  async (req: Request, res: Response) => {
    const filenameParam = req.params.filename
    const filename = typeof filenameParam === 'string' ? filenameParam : ''
    if (!EVIDENCE_FILENAME_PATTERN.test(filename)) {
      return res.status(404).json({ message: 'Evidence file not found.' })
    }

    const relativePath = `private_uploads/attendance-evidence/${filename}`

    try {
      const period = await getActivePeriod()
      const record = await prisma.attendance_records.findFirst({
        where: { document_url: relativePath },
        select: {
          students: { select: { user_id: true } },
          attendance_sessions: {
            select: {
              class_id: true,
            },
          },
        },
      })

      if (!record) return res.status(404).json({ message: 'Evidence file not found.' })

      const role = req.user!.role.toLowerCase()
      const isAuthorizedStaff = role === 'staff' || role === 'admin'
      const isOwningStudent = role === 'student' && record.students.user_id?.toString() === req.user!.userId
      const assignment =
        role === 'teacher' && period
          ? await prisma.homeroom_assignments.findFirst({
              where: {
                class_id: record.attendance_sessions.class_id,
                academic_period_id: period.academic_period_id,
                teachers: { user_id: BigInt(req.user!.userId) },
              },
              select: { homeroom_assignment_id: true },
            })
          : null
      const isAssignedHomeroomTeacher = assignment !== null

      if (!isAuthorizedStaff && !isOwningStudent && !isAssignedHomeroomTeacher) {
        return res.status(404).json({ message: 'Evidence file not found.' })
      }

      const filePath = path.join(EVIDENCE_DIR, filename)
      const fileStats = await stat(filePath)
      if (!fileStats.isFile()) return res.status(404).json({ message: 'Evidence file not found.' })

      const fileType = await fileTypeFromFile(filePath)
      if (!fileType || !['image/jpeg', 'image/png'].includes(fileType.mime)) {
        console.error('Stored attendance evidence has an unsupported file type:', filename)
        return res.status(404).json({ message: 'Evidence file not found.' })
      }

      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Type', fileType.mime)
      res.setHeader('Content-Length', fileStats.size)
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
      res.setHeader('Cache-Control', 'private, no-store')

      try {
        await pipeline(createReadStream(filePath), res)
      } catch (error) {
        if (res.headersSent) {
          res.destroy(error instanceof Error ? error : new Error('Evidence stream failed.'))
          return
        }
        throw error
      }
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        return res.status(404).json({ message: 'Evidence file not found.' })
      }
      console.error('Failed to serve attendance evidence:', error)
      if (!res.headersSent) {
        return res.status(500).json({ message: 'Internal server error.' })
      }
    }
  }
)

attendanceRouter.post(
  ['/submit', '/student/submit'],
  requireAuth,
  requireRole('student'),
  handleEvidenceUpload('file'),
  async (req: Request, res: Response) => {
    try {
      const result = await submitStudentAttendanceRecord(req.body, req.user!, req.evidencePath)
      if (result.statusCode >= 400) await discardEvidenceUpload(req)
      return sendResult(res, result)
    } catch (error) {
      try {
        await discardEvidenceUpload(req)
      } catch (cleanupError) {
        console.error('Failed to remove unpersisted attendance evidence:', cleanupError)
      }
      return sendInternalError(res, 'Failed to submit student attendance:', error)
    }
  }
)

attendanceRouter.post(
  ['/record', '/records'],
  requireAuth,
  requireRole('teacher', 'staff', 'admin', 'student'),
  handleEvidenceUpload('file'),
  async (req: Request, res: Response) => {
    try {
      const result = await submitAttendanceRecord(req.body, req.user!, req.evidencePath)
      if (result.statusCode >= 400) await discardEvidenceUpload(req)
      return sendResult(res, result)
    } catch (error) {
      try {
        await discardEvidenceUpload(req)
      } catch (cleanupError) {
        console.error('Failed to remove unpersisted attendance evidence:', cleanupError)
      }
      return sendInternalError(res, 'Failed to submit attendance record:', error)
    }
  }
)

attendanceRouter.get('/today', requireAuth, async (req: Request, res: Response) => {
  try {
    return sendResult(res, await getTodayAttendance(req.user!.userId))
  } catch (error) {
    return sendInternalError(res, 'Failed to check today attendance:', error)
  }
})

attendanceRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.query.student_id ?? req.query.studentId
    return sendResult(res, await getAttendanceHistory(req.user!, studentId))
  } catch (error) {
    return sendInternalError(res, 'Failed to get attendance history:', error)
  }
})

export default attendanceRouter
