import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
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
import { requireAuth, requireRole } from './auth'
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

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// 2. Rate Limiter for Login Endpoint (Prevents brute-force & credential stuffing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 attempts per IP
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
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

// ── Start server ────────────────────────────────
app.listen(PORT, () => {
  console.log(`SAMS API server is running on http://localhost:${PORT}`)
})