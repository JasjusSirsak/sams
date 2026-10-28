import 'dotenv/config'
import express from 'express'
import type { ErrorRequestHandler } from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { MulterError } from 'multer'
import prisma from './db'
import authRouter from './authRouter'
import teacherRouter from './teacherRouter'
import attendanceRouter from './attendanceRouter'
import gradesRouter from './gradesRouter'
import homeroomRouter from './homeroomRouter'
import journalsRouter from './journalsRouter'
import parentRouter from './parentRouter'
import reportsRouter from './reportsRouter'
import adminRouter from './adminRouter'
import agendaRouter from './agendaRouter'
import {
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  requireAuth,
  requireRole,
  requireSameOrigin,
} from './auth'
import { getActivePeriod } from './services/academicPeriod'

const app = express()
const PORT = Number(process.env.PORT) || 3000

// This fixes express-rate-limit error when X-Forwarded-For is present
if (process.env.NODE_ENV !== 'production') {
  app.set('trust proxy', 1)
}

// 1. HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}))
app.disable('x-powered-by')

app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use(cookieParser())
app.use('/api', (req, res, next) => {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
  const hasAuthCookie =
    Boolean(req.cookies?.[AUTH_COOKIE_NAME]) || Boolean(req.cookies?.[REFRESH_COOKIE_NAME])
  if (isMutation && hasAuthCookie) return requireSameOrigin(req, res, next)
  return next()
})

// 2. Rate Limiter for Login Endpoint (Prevents brute-force & credential stuffing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 attempts per IP
  message: {
    success: false,
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many attempts. Please try again in a moment.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false, // Disable strict X-Forwarded-For validation
  },
})
app.use('/api/auth/login', authLimiter)

// Authentication module routing
app.use('/api/auth', authRouter)

// Attendance module routing
app.use('/api/attendance', attendanceRouter)

// Grades module routing
app.use('/api/grades', gradesRouter)

// Homeroom approval module routing
app.use('/api/homeroom', homeroomRouter)

// KBM Journals module routing
app.use('/api/journals', journalsRouter)

// Parent portal module routing
app.use('/api/parent', parentRouter)

// Reports module routing
app.use('/api/reports', reportsRouter)

// Admin master-data routes
app.use('/api/admin', adminRouter)

// Shared agenda for authenticated users; role and data scope are resolved in its service.
app.use('/api/agenda', agendaRouter)

// Teacher module routing (Apply RBAC directly to Teacher Module Router)
app.use('/api/teacher', requireAuth, requireRole('teacher'), teacherRouter)

// Checking if express running
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'SAMS API is running',
  })
})

// Checking database connection via prisma
app.get('/api/health/database', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    res.status(200).json({
      status: 'ok',
      database: 'connected',
    })
  } catch (error) {
    console.error('Database health check failed:', error)

    res.status(503).json({
      status: 'error',
      database: 'disconnected',
    })
  }
})

// Protected endpoint for students - requires valid authentication and authorized role
app.get(
  '/api/students',
  requireAuth,
  requireRole('teacher', 'staff', 'admin'),
  async (req, res) => {
    try {
      const isTeacher = req.user!.role === 'teacher'
      let periodId: bigint | undefined
      let classId: bigint | undefined

      if (isTeacher) {
        const period = await getActivePeriod()
        if (!period) return res.json({ data: [] })
        periodId = period.academic_period_id

        const rawClassId = req.query.classId ?? req.query.class_id
        if (rawClassId !== undefined) {
          if (typeof rawClassId !== 'string' || !/^[1-9]\d*$/.test(rawClassId)) {
            return res.status(400).json({ message: 'Invalid classId query parameter.' })
          }

          classId = BigInt(rawClassId)
          const teacher = await prisma.teachers.findUnique({
            where: { user_id: BigInt(req.user!.userId) },
            select: { teacher_id: true },
          })
          if (!teacher) {
            return res.status(403).json({ message: 'Teacher profile not found.' })
          }
          const assignment = await prisma.teaching_assignments.findFirst({
            where: {
              teacher_id: teacher.teacher_id,
              class_id: classId,
              academic_period_id: periodId,
            },
            select: { teaching_assignment_id: true },
          })
          if (!assignment) {
            return res.status(403).json({ message: 'You are not assigned to this class in the active academic period.' })
          }
        }
      }

      const students = await prisma.students.findMany({
        where: periodId
          ? {
              student_enrollments: {
                some: {
                  academic_period_id: periodId,
                  ...(classId ? { class_id: classId } : {}),
                },
              },
            }
          : undefined,
        select: {
          student_id: true,
          nis: true,
          name: true,
          student_enrollments: {
            where: periodId
              ? {
                  academic_period_id: periodId,
                  ...(classId ? { class_id: classId } : {}),
                }
              : undefined,
            select: {
              classes: { select: { name: true } },
              academic_periods: { select: { academic_year: true, semester: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      })
      const data = students.map((student) => ({
        student_id: student.student_id.toString(),
        nis: student.nis,
        name: student.name,
        enrollments: student.student_enrollments.map((enrollment) => ({
          class_name: enrollment.classes.name,
          academic_year: enrollment.academic_periods.academic_year,
          semester: enrollment.academic_periods.semester,
        })),
      }))
      res.json({ data })
    } catch (error) {
      console.error('Failed to fetch students:', error)
      res.status(500).json({ message: 'Failed to fetch students' })
    }
  }
)

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error)

  if (error instanceof MulterError) {
    const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    return res.status(statusCode).json({
      message: statusCode === 413 ? 'Uploaded file is too large.' : 'Invalid file upload.',
    })
  }

  console.error('Unhandled request error:', error)
  return res.status(500).json({
    success: false,
    code: 'SERVER_ERROR',
    message: 'Something went wrong on the server. Please try again.',
  })
}
app.use(errorHandler)

// ── Start server ────────────────────────────────
app.listen(PORT, () => {
  console.log(`SAMS API server is running on http://localhost:${PORT}`)
})