import { Router, type Request, type Response } from 'express'
import prisma from './db'
import { requireAuth } from './auth'
import { getActivePeriod, getJakartaDate } from './services/academicPeriod'

const teacherRouter = Router()

// Helper: Get authenticated teacher profile from JWT session userId
async function getAuthenticatedTeacher(userId: string) {
  return await prisma.teachers.findFirst({
    where: { user_id: BigInt(userId) },
    // FIX: 'nip' replaced with 'employee_number' according to schema
    select: { teacher_id: true, name: true, employee_number: true },
  })
}

// dont frgo, down here is something about the teacherRouter from frontend

// 1. Teacher Dashboard Summary Endpoint
teacherRouter.get('/dashboard-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const teacher = await getAuthenticatedTeacher(req.user!.userId)
    if (!teacher) {
      return res.status(403).json({ message: 'Access denied. Teacher profile not found.' })
    }

    const today = getJakartaDate()

    const base = {
      teacher_name: teacher.name,
      employee_number: teacher.employee_number,
    }

    const period = await getActivePeriod()

    if (!period) {
      return res.json({
        ...base,
        active_period: null,
        classes_taught_count: 0,
        total_students: 0,
        classes: [],
        is_homeroom: false,
        homeroom_class_id: null,
        attendance_today: null,
      })
    }

    const assignments = await prisma.teaching_assignments.findMany({
      where: { teacher_id: teacher.teacher_id, academic_period_id: period.academic_period_id },
      select: { class_id: true, classes: { select: { name: true } } },
    })

    // Distinct classes (a teacher can teach several subjects in one class)
    const classMap = new Map<string, { class_id: bigint; name: string }>()
    for (const a of assignments) {
      classMap.set(a.class_id.toString(), { class_id: a.class_id, name: a.classes.name })
    }
    const classIds = [...classMap.values()].map((c) => c.class_id)

    // Students per class in the active period
    const enrollmentCounts = classIds.length
      ? await prisma.student_enrollments.groupBy({
          by: ['class_id'],
          where: { class_id: { in: classIds }, academic_period_id: period.academic_period_id },
          _count: { _all: true },
        })
      : []
    const countByClass = new Map(enrollmentCounts.map((e) => [e.class_id.toString(), e._count._all]))
    const totalStudents = enrollmentCounts.reduce((sum, e) => sum + e._count._all, 0)

    // Homeroom is a fact in data, not a role
    const homeroom = await prisma.homeroom_assignments.findFirst({
      where: { teacher_id: teacher.teacher_id, academic_period_id: period.academic_period_id },
      select: { class_id: true },
    })

    // Attendance today across the teacher's classes
    let attendanceToday: null | Record<string, number> = null
    if (classIds.length) {
      const sessionCount = await prisma.attendance_sessions.count({
        where: { class_id: { in: classIds }, attendance_date: today },
      })
      if (sessionCount > 0) {
        const records = await prisma.attendance_records.findMany({
          where: { attendance_sessions: { class_id: { in: classIds }, attendance_date: today } },
          select: { status: true, approval_status: true },
        })
        let present = 0, sick = 0, permitted = 0, absent = 0, pending = 0
        for (const r of records) {
          if (r.approval_status === 'REJECTED') { absent++; continue }
          if (r.approval_status === 'PENDING') pending++
          if (r.status === 'PRESENT') present++
          else if (r.status === 'SICK') sick++
          else if (r.status === 'PERMITTED') permitted++
          else absent++
        }
        attendanceToday = {
          present, sick, permitted, absent, pending,
          not_recorded: Math.max(totalStudents - records.length, 0),
        }
      }
    }

    return res.json({
      ...base,
      active_period: { id: period.academic_period_id.toString(), year: period.academic_year, semester: period.semester },
      classes_taught_count: classMap.size,
      total_students: totalStudents,
      classes: [...classMap.values()].map((c) => ({
        class_id: c.class_id.toString(),
        name: c.name,
        student_count: countByClass.get(c.class_id.toString()) ?? 0,
      })),
      is_homeroom: !!homeroom,
      homeroom_class_id: homeroom ? homeroom.class_id.toString() : null,
      attendance_today: attendanceToday, // null = no session yet today
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

    const period = await getActivePeriod()
    if (!period) return res.json({ data: [] })

    const assignments = await prisma.teaching_assignments.findMany({
      where: {
        teacher_id: teacher.teacher_id,
        academic_period_id: period.academic_period_id,
      },
      include: {
        classes: {
          select: {
            class_id: true,
            name: true,
            grade_level: true,
            student_enrollments: {
              where: { academic_period_id: period.academic_period_id },
              select: { student_id: true },
            },
          },
        },
        subjects: { select: { subject_id: true, name: true } },
        grades: { select: { grade_id: true } },
        academic_periods: {
          select: { academic_period_id: true, academic_year: true, semester: true },
        },
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

    const requestedDate = dateFilter.gte ?? new Date()
    const period = await getActivePeriod(requestedDate)
    if (!period) return res.json({ data: [] })

    // Fetch teaching journals / agenda based on teacher's teaching assignments
    const assignments = await prisma.teaching_assignments.findMany({
      where: {
        teacher_id: teacher.teacher_id,
        academic_period_id: period.academic_period_id,
      },
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

    const today = new Date()
    const attendanceDate = getJakartaDate(today)
    const period = await getActivePeriod(today)
    const assignment = period ? await prisma.homeroom_assignments.findFirst({
      where: {
        teacher_id: teacher.teacher_id,
        academic_period_id: period.academic_period_id,
      },
      select: { class_id: true },
    }) : null

    if (!assignment) {
      return res.status(403).json({
        message: 'You do not have an active homeroom assignment for today.',
      })
    }
    const classIds = [assignment.class_id]

    // 2. Calculate current week range (Monday - Friday)
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
          select: { status: true, approval_status: true },
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
        const rawStatus = (record.status || '').toUpperCase()
        let status: 'present' | 'permitted' | 'sick' | 'absent' | null = null
        if (record.approval_status === 'REJECTED' || rawStatus === 'ABSENT') {
          status = 'absent'
        } else if (rawStatus === 'PRESENT') {
          status = 'present'
        } else if (rawStatus === 'PERMITTED') {
          status = 'permitted'
        } else if (rawStatus === 'SICK') {
          status = 'sick'
        }

        if (status) {
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
    { day: 'Mon', present: 0, permitted: 0, sick: 0, absent: 0 },
    { day: 'Tue', present: 0, permitted: 0, sick: 0, absent: 0 },
    { day: 'Wed', present: 0, permitted: 0, sick: 0, absent: 0 },
    { day: 'Thu', present: 0, permitted: 0, sick: 0, absent: 0 },
    { day: 'Fri', present: 0, permitted: 0, sick: 0, absent: 0 },
  ]
}

export default teacherRouter