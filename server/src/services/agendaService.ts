import prisma from '../db'

export type AgendaEntry = {
  id: string
  source: 'agenda' | 'schedule'
  title: string
  startTime: string | null
  endTime: string | null
  location: string | null
  label: string
  note: string | null
  className: string | null
}

export class AgendaScopeError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message)
  }
}

function formatTime(value: Date | null): string | null {
  if (!value) return null
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`
}

export async function getAgendaForUser(userId: string, date: string, requestedStudentId: unknown): Promise<AgendaEntry[]> {
  const day = new Date(`${date}T00:00:00.000Z`)
  const user = await prisma.users.findUnique({
    where: { user_id: BigInt(userId) },
    select: {
      roles: { select: { name: true } },
      teachers: { select: { teacher_id: true } },
      students: { select: { student_id: true } },
      parents: { select: { parent_id: true } },
    },
  })

  if (!user) throw new AgendaScopeError('Authenticated user not found.', 403)

  const role = user.roles.name.trim().toLowerCase()
  const isTeacher = role === 'teacher' || role === 'homeroom' || role === 'wali' || role === 'wali kelas'
  if (!isTeacher && role !== 'student' && role !== 'parent' && role !== 'admin' && role !== 'staff') {
    throw new AgendaScopeError('You do not have permission to access agendas.', 403)
  }
  if (isTeacher && !user.teachers) throw new AgendaScopeError('Teacher profile not found.', 403)
  if (role === 'student' && !user.students) throw new AgendaScopeError('Student profile not found.', 403)

  let parentStudentId: bigint | null = null

  if (role === 'parent') {
    if (!user.parents) throw new AgendaScopeError('Parent profile not found.', 403)
    if (typeof requestedStudentId !== 'string' || !/^[1-9]\d*$/.test(requestedStudentId)) {
      throw new AgendaScopeError('A valid studentId is required.', 400)
    }

    parentStudentId = BigInt(requestedStudentId)
    const relationship = await prisma.parent_students.findUnique({
      where: {
        parent_id_student_id: {
          parent_id: user.parents.parent_id,
          student_id: parentStudentId,
        },
      },
      select: { student_id: true },
    })

    if (!relationship) throw new AgendaScopeError('You do not have access to this child.', 403)
  }

  const academicPeriod = await prisma.academic_periods.findFirst({
    where: {
      start_date: { lte: day },
      end_date: { gte: day },
    },
    select: { academic_period_id: true },
  })

  if (!academicPeriod) return []

  let visibleClassIds: bigint[] = []

  if (isTeacher && user.teachers) {
    const [teachingAssignments, homeroomAssignments] = await Promise.all([
      prisma.teaching_assignments.findMany({
        where: {
          teacher_id: user.teachers.teacher_id,
          academic_period_id: academicPeriod.academic_period_id,
        },
        select: { class_id: true },
      }),
      prisma.homeroom_assignments.findMany({
        where: {
          teacher_id: user.teachers.teacher_id,
          academic_period_id: academicPeriod.academic_period_id,
        },
        select: { class_id: true },
      }),
    ])

    visibleClassIds = [
      ...new Set([...teachingAssignments, ...homeroomAssignments].map(({ class_id }) => class_id)),
    ]
  } else if (role === 'student') {
    if (!user.students) throw new AgendaScopeError('Student profile not found.', 403)

    const enrollment = await prisma.student_enrollments.findFirst({
      where: {
        student_id: user.students.student_id,
        academic_period_id: academicPeriod.academic_period_id,
      },
      select: { class_id: true },
    })

    if (enrollment) visibleClassIds = [enrollment.class_id]
  } else if (role === 'parent') {
    if (parentStudentId === null) throw new AgendaScopeError('A valid studentId is required.', 400)

    const enrollment = await prisma.student_enrollments.findFirst({
      where: {
        student_id: parentStudentId,
        academic_period_id: academicPeriod.academic_period_id,
      },
      select: { class_id: true },
    })

    if (enrollment) visibleClassIds = [enrollment.class_id]
  } else if (role === 'admin' || role === 'staff') {
    const classes = await prisma.classes.findMany({ select: { class_id: true } })
    visibleClassIds = classes.map(({ class_id }) => class_id)
  }

  const dayOfWeek = day.getUTCDay() || 7
  const assignmentScope = {
    class_id: { in: visibleClassIds },
    academic_period_id: academicPeriod.academic_period_id,
    ...(role === 'teacher' && user.teachers ? { teacher_id: user.teachers.teacher_id } : {}),
  }

  const [agendas, schedules] = await Promise.all([
    prisma.agendas.findMany({
      where: {
        agenda_date: day,
        OR: [{ class_id: null }, { class_id: { in: visibleClassIds } }],
      },
      include: { classes: { select: { name: true } } },
    }),
    prisma.class_schedules.findMany({
      where: {
        day_of_week: dayOfWeek,
        teaching_assignments: { is: assignmentScope },
      },
      include: {
        teaching_assignments: {
          select: {
            classes: { select: { name: true } },
            subjects: { select: { name: true } },
          },
        },
      },
    }),
  ])

  const entries: AgendaEntry[] = [
    ...agendas.map((agenda) => ({
      id: `agenda-${agenda.agenda_id.toString()}`,
      source: 'agenda' as const,
      title: agenda.title,
      startTime: null,
      endTime: null,
      location: null,
      label: agenda.agenda_type,
      note: agenda.description,
      className: agenda.classes?.name ?? null,
    })),
    ...schedules.map((schedule) => ({
      id: `schedule-${schedule.class_schedule_id.toString()}`,
      source: 'schedule' as const,
      title: schedule.teaching_assignments.subjects.name,
      startTime: formatTime(schedule.start_time),
      endTime: formatTime(schedule.end_time),
      location: schedule.room,
      label: 'lesson',
      note: null,
      className: schedule.teaching_assignments.classes.name,
    })),
  ]

  return entries.sort((left, right) => {
    if (left.startTime === null) return right.startTime === null ? 0 : 1
    if (right.startTime === null) return -1
    return left.startTime.localeCompare(right.startTime)
  })
}
