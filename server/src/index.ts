
import 'dotenv/config'
import express from 'express'
import prisma from './db.ts'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(express.json())

// Cheking if express running or nah
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'SAMS API is running',
  })
})

// Cheking database connection via prisma
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

//this is endpoint for students
app.get('/api/students', async (_req, res) => {
  try {
    const students = await prisma.students.findMany({
      select: {
        student_id: true,
        nis: true,
        name: true,
        student_enrollments: {
          select: {
            classes: {
              select: {
                name: true,
              },
            },
            academic_periods: {
              select: {
                academic_year: true,
                semester: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
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

    res.status(500).json({
      message: 'Failed to fetch students',
    })
  }
})

app.listen(PORT, () => {
  console.log(`SAMS API running at http://localhost:${PORT}`)
})
