import { Router, type Request, type Response } from 'express'
import { requireAuth, requireRole } from './auth'
import { handleEvidenceUpload } from './middlewares/upload'
import {
  createOrGetAttendanceSession,
  getAttendanceHistory,
  getTodayAttendance,
  submitAttendanceRecord,
  type ServiceResult,
} from './services/attendanceService'

const attendanceRouter = Router()

function sendResult(res: Response, serviceResult: ServiceResult) {
  return res.status(serviceResult.statusCode).json(serviceResult.body)
}

function sendInternalError(res: Response, message: string, error: unknown) {
  console.error(message, error)
  return res.status(500).json({ message: 'Internal server error.' })
}

attendanceRouter.post(
  ['/session', '/sessions'],
  requireAuth,
  requireRole('teacher', 'homeroom', 'staff', 'admin', 'student'),
  async (req: Request, res: Response) => {
    try {
      return sendResult(res, await createOrGetAttendanceSession(req.body, req.user!))
    } catch (error) {
      return sendInternalError(res, 'Failed to get or create attendance session:', error)
    }
  }
)

attendanceRouter.post(
  ['/record', '/records'],
  requireAuth,
  handleEvidenceUpload('file'),
  async (req: Request, res: Response) => {
    try {
      return sendResult(res, await submitAttendanceRecord(req.body, req.user!))
    } catch (error) {
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
