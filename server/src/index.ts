import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import prisma from './db'
import authRouter from './authRouter'
import teacherRouter from './teacherRouter'
import { requireAuth, requireRole } from './auth'

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

app.use(express.json({ limit: '1mb' }))
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

// Teacher module routing (Apply RBAC directly to Teacher Module Router)
app.use('/api/teacher', requireAuth, requireRole('teacher', 'homeroom'), teacherRouter)

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
  requireRole('teacher', 'homeroom', 'staff', 'admin'),
  async (_req, res) => {
    try {
      const students = await prisma.students.findMany({
        select: {
          student_id: true,
          nis: true,
          name: true,
          student_enrollments: {
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