import { Router, type Request, type Response } from 'express'
import prisma from './db'
import { requireAuth } from './auth'

const teacherRouter = Router()

// Helper: Get authenticated teacher profile from JWT session userId
async function getAuthenticatedTeacher(userId: string) {
  return await prisma.teachers.findFirst({
    where: { user_id: BigInt(userId) },
    // FIX: 'nip' replaced with 'employee_number' according to schema
    select: { teacher_id: true, name: true, employee_number: true },
  })
}

// 1. Teacher Dashboard Summary Endpoint
teacherRouter.get('/dashboard-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionUser = req.user!
    const teacher = await getAuthenticatedTeacher(sessionUser.userId)

    if (!teacher) {
      return res.status(403).json({ message: 'Access denied. Teacher profile not found.' })
    }

    // Count taught classes
    const classesCount = await prisma.teaching_assignments.count({
      where: { teacher_id: teacher.teacher_id },
    })

    // Count total unique students taught by this teacher
    const assignments = await prisma.teaching_assignments.findMany({
      where: { teacher_id: teacher.teacher_id },
      select: { class_id: true },
    })
    const classIds = assignments.map((a) => a.class_id)

    const studentsCount = await prisma.student_enrollments.count({
      where: { class_id: { in: classIds } },
    })

    return res.json({
      teacher_name: teacher.name,
      employee_number: teacher.employee_number, // Adjusted
      classes_taught_count: classesCount,
      total_students: studentsCount,
    })
  } catch (error) {
    console.error('Failed to fetch dashboard summary:', error)
    return res.status(500).json({ message: 'Failed to load dashboard summary.' })
  }
})

// 2. Teacher Classes List Endpoint
teacherRouter.get('/classes', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionUser = req.user!
    const teacher = await getAuthenticatedTeacher(sessionUser.userId)

    if (!teacher) {
      return res.status(403).json({ message: 'Access denied. Teacher profile not found.' })
    }

    const assignments = await prisma.teaching_assignments.findMany({
      where: { teacher_id: teacher.teacher_id },
      include: {
        classes: {
          select: {
            class_id: true,
            name: true,
            grade_level: true,
            student_enrollments: { select: { student_id: true } },
          },
        },
        subjects: { select: { subject_id: true, name: true } },
        academic_periods: {
          select: { academic_period_id: true, academic_year: true, semester: true },
        },
        grades: { select: { grade_id: true } },
      },
    })

    // Flatten data to match TeacherClassItem type on frontend (api.ts)
    const data = assignments.map((a) => {
      const studentCount = a.classes.student_enrollments.length
      const gradesCount = a.grades.length
      // Calculate progress percentage based on recorded grades
      const calculatedProgress =
        studentCount > 0 ? Math.min(100, Math.round((gradesCount / studentCount) * 100)) : 0

      return {
        id: a.teaching_assignment_id.toString(),
        assignment_id: a.teaching_assignment_id.toString(),
        class_id: a.classes.class_id.toString(),
        subject_id: a.subjects.subject_id.toString(),
        name: a.classes.name,
        subject: a.subjects.name,
        grade_level: a.classes.grade_level,
        students: studentCount,
        progress: calculatedProgress,
        academic_year: a.academic_periods.academic_year,
        semester: a.academic_periods.semester,
      }
    })

    return res.json({ data })
  } catch (error) {
    console.error('Failed to fetch teacher classes:', error)
    return res.status(500).json({ message: 'Failed to load teacher classes.' })
  }
})

// 3. Teacher Teaching Agendas Endpoint (With Safe Date Validation)
teacherRouter.get('/agendas', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionUser = req.user!
    const teacher = await getAuthenticatedTeacher(sessionUser.userId)

    if (!teacher) {
      return res.status(403).json({ message: 'Access denied. Teacher profile not found.' })
    }

    const { date } = req.query
    const dateFilter: { gte?: Date; lte?: Date } = {}

    if (date && typeof date === 'string') {
      const parsedDate = new Date(date)
      if (!isNaN(parsedDate.getTime())) {
        parsedDate.setHours(0, 0, 0, 0)
        const nextDay = new Date(parsedDate)
        nextDay.setDate(parsedDate.getDate() + 1)
        dateFilter.gte = parsedDate
        dateFilter.lte = nextDay
      }
    }

    // Fetch teaching journals / agenda based on teacher's teaching assignments
    const assignments = await prisma.teaching_assignments.findMany({
      where: { teacher_id: teacher.teacher_id },
      // FIX: 'assignment_id' -> 'teaching_assignment_id'
      select: { teaching_assignment_id: true },
    })
    const assignmentIds = assignments.map((a) => a.teaching_assignment_id)

    const journals = await prisma.journals.findMany({
      where: {
        // FIX: 'assignment_id' -> 'teaching_assignment_id'
        teaching_assignment_id: { in: assignmentIds },
        // FIX: 'date' -> 'journal_date'
        ...(Object.keys(dateFilter).length > 0 ? { journal_date: dateFilter } : {}),
      },
      include: {
        teaching_assignments: {
          include: {
            classes: { select: { name: true } },
            subjects: { select: { name: true } },
          },
        },
      },
      // FIX: 'date' -> 'journal_date'
      orderBy: { journal_date: 'desc' },
    })

    const data = journals.map((j) => ({
      journal_id: j.journal_id.toString(),
      // FIX: 'date' -> 'journal_date'
      date: j.journal_date,
      topic: j.topic,
      description: j.description,
      class_name: j.teaching_assignments.classes.name,
      subject_name: j.teaching_assignments.subjects.name,
    }))

    return res.json({ data })
  } catch (error) {
    console.error('Failed to fetch teacher agendas:', error)
    return res.status(500).json({ message: 'Failed to load agendas.' })
  }
})

// 4. Teacher Class Weekly Attendance Endpoint (for WeeklyChart)
teacherRouter.get('/attendance-weekly', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionUser = req.user!
    const teacher = await getAuthenticatedTeacher(sessionUser.userId)

    if (!teacher) {
      return res.status(403).json({ message: 'Access denied. Teacher profile not found.' })
    }

    // 1. Get class_ids taught by this teacher
    const assignments = await prisma.teaching_assignments.findMany({
      where: { teacher_id: teacher.teacher_id },
      select: { class_id: true },
    })
    const classIds = [...new Set(assignments.map((a) => a.class_id))] // unique

    if (classIds.length === 0) {
      return res.json({
        data: { class_name: 'No Classes', weekly: buildEmptyWeek() },
      })
    }

    // 2. Calculate current week range (Monday - Friday)
    const today = new Date()
    const dayOfWeek = today.getDay() // 0=Sunday, 1=Monday, ...
    const monday = new Date(today)
    // Shift to Monday of current week
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    monday.setDate(today.getDate() + diff)
    monday.setHours(0, 0, 0, 0)

    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    friday.setHours(23, 59, 59, 999)

    // 3. Get attendance sessions in current week for these classes
    const sessions = await prisma.attendance_sessions.findMany({
      where: {
        class_id: { in: classIds },
        attendance_date: { gte: monday, lte: friday },
      },
      include: {
        classes: { select: { name: true } },
        attendance_records: {
          select: { status: true },
        },
      },
      orderBy: { attendance_date: 'asc' },
    })

    // 4. Group by day
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    const weekly = buildEmptyWeek()

    for (const session of sessions) {
      const d = new Date(session.attendance_date)
      const dayIndex = d.getDay() // 1=Monday...5=Friday
      if (dayIndex < 1 || dayIndex > 5) continue

      for (const record of session.attendance_records) {
        const status = (record.status || '').toLowerCase()
        if (status === 'hadir' || status === 'izin' || status === 'sakit' || status === 'alfa') {
          weekly[dayIndex - 1][status]++
        }
      }
    }

    // 5. Determine class label (if teacher teaches >1 class, show "X Classes")
    const uniqueClassNames = [...new Set(sessions.map((s) => s.classes.name))]
    const classNameLabel =
      uniqueClassNames.length === 0
        ? 'No Class'
        : uniqueClassNames.length === 1
        ? uniqueClassNames[0]
        : `${uniqueClassNames.length} Classes`

    return res.json({
      data: {
        class_name: classNameLabel,
        weekly,
      },
    })
  } catch (error) {
    console.error('Failed to fetch weekly attendance:', error)
    return res.status(500).json({ message: 'Failed to load weekly attendance.' })
  }
})

// Helper: build empty week structure
function buildEmptyWeek() {
  return [
    { day: 'Mon', hadir: 0, izin: 0, sakit: 0, alfa: 0 },
    { day: 'Tue', hadir: 0, izin: 0, sakit: 0, alfa: 0 },
    { day: 'Wed', hadir: 0, izin: 0, sakit: 0, alfa: 0 },
    { day: 'Thu', hadir: 0, izin: 0, sakit: 0, alfa: 0 },
    { day: 'Fri', hadir: 0, izin: 0, sakit: 0, alfa: 0 },
  ]
}

export default teacherRouter