import prisma from '../db'
import { getJakartaDate } from './academicPeriod'

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

export type DatedAgendaEntries = {
  date: string
  items: AgendaEntry[]
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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getDateRange(from: Date, to: Date): Date[] {
  const dates: Date[] = []
  for (const date = new Date(from); date <= to; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(new Date(date))
  }
  return dates
}

async function getAgendaEntriesForRange(
  userId: string,
  from: Date,
  to: Date,
  requestedStudentId: unknown,
): Promise<DatedAgendaEntries[]> {
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
  const isTeacher = role === 'teacher'
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

  const dates = getDateRange(from, to)
  const periods = await prisma.academic_periods.findMany({
    where: {
      start_date: { lte: to },
      end_date: { gte: from },
    },
    orderBy: { start_date: 'desc' },
  })
  const periodByDate = new Map<string, (typeof periods)[number]>()
  for (const date of dates) {
    const period = periods.find(({ start_date, end_date }) => date >= start_date && date <= end_date)
    if (period) periodByDate.set(formatDate(date), period)
  }

  const scopeByPeriod = new Map<string, bigint[]>()
  for (const period of new Map([...periodByDate.values()].map((item) => [item.academic_period_id.toString(), item])).values()) {
    let classIds: bigint[] = []
    if (isTeacher && user.teachers) {
      const [teachingAssignments, homeroomAssignments] = await Promise.all([
        prisma.teaching_assignments.findMany({
          where: { teacher_id: user.teachers.teacher_id, academic_period_id: period.academic_period_id },
          select: { class_id: true },
        }),
        prisma.homeroom_assignments.findMany({
          where: { teacher_id: user.teachers.teacher_id, academic_period_id: period.academic_period_id },
          select: { class_id: true },
        }),
      ])
      classIds = [...new Set([...teachingAssignments, ...homeroomAssignments].map(({ class_id }) => class_id))]
    } else if (role === 'student' && user.students) {
      const enrollment = await prisma.student_enrollments.findFirst({
        where: { student_id: user.students.student_id, academic_period_id: period.academic_period_id },
        select: { class_id: true },
      })
      if (enrollment) classIds = [enrollment.class_id]
    } else if (role === 'parent' && parentStudentId !== null) {
      const enrollment = await prisma.student_enrollments.findFirst({
        where: { student_id: parentStudentId, academic_period_id: period.academic_period_id },
        select: { class_id: true },
      })
      if (enrollment) classIds = [enrollment.class_id]
    } else if (role === 'admin' || role === 'staff') {
      const classes = await prisma.classes.findMany({ select: { class_id: true } })
      classIds = classes.map(({ class_id }) => class_id)
    }
    scopeByPeriod.set(period.academic_period_id.toString(), classIds)
  }

  const activeDays = dates.filter((date) => periodByDate.has(formatDate(date)))
  if (activeDays.length === 0) {
    return dates.map((date) => ({ date: formatDate(date), items: [] }))
  }

  const allVisibleClassIds = [
    ...new Set([...scopeByPeriod.values()].flat().map((id) => id.toString())),
  ].map((id) => BigInt(id))

  const dayOfWeek = (date: Date) => date.getUTCDay() || 7
  const scheduleScopes = [...new Map(
    activeDays.map((date) => {
      const period = periodByDate.get(formatDate(date))!
      const classIds = scopeByPeriod.get(period.academic_period_id.toString()) ?? []
      return [
        `${period.academic_period_id}:${dayOfWeek(date)}`,
        {
          academic_period_id: period.academic_period_id,
          day_of_week: dayOfWeek(date),
          classIds,
        },
      ] as const
    }),
  ).values()]
    .filter(({ classIds }) => classIds.length > 0)
    .map(({ academic_period_id, day_of_week, classIds }) => ({
      day_of_week,
      teaching_assignments: {
        is: {
          academic_period_id,
          class_id: { in: classIds },
          ...(isTeacher && user.teachers ? { teacher_id: user.teachers.teacher_id } : {}),
        },
      },
    }))

  const [agendas, schedules] = await Promise.all([
    prisma.agendas.findMany({
      where: {
        agenda_date: { gte: from, lte: to },
        OR: [{ class_id: null }, { class_id: { in: allVisibleClassIds } }],
      },
      include: { classes: { select: { name: true } } },
    }),
    scheduleScopes.length
      ? prisma.class_schedules.findMany({
          where: { OR: scheduleScopes },
          include: {
            teaching_assignments: {
              select: {
                academic_period_id: true,
                classes: { select: { class_id: true, name: true } },
                subjects: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ])

  return dates.map((date) => {
    const dateKey = formatDate(date)
    const period = periodByDate.get(dateKey)
    if (!period) return { date: dateKey, items: [] }
    const visibleClassIds = new Set(
      (scopeByPeriod.get(period.academic_period_id.toString()) ?? []).map((id) => id.toString()),
    )
    const entries: AgendaEntry[] = [
      ...agendas
        .filter((agenda) =>
          formatDate(agenda.agenda_date) === dateKey &&
          (agenda.class_id === null || visibleClassIds.has(agenda.class_id.toString())),
        )
        .map((agenda) => ({
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
      ...schedules
        .filter((schedule) =>
          schedule.teaching_assignments.academic_period_id === period.academic_period_id &&
          schedule.day_of_week === dayOfWeek(date) &&
          visibleClassIds.has(schedule.teaching_assignments.classes.class_id.toString()),
        )
        .map((schedule) => ({
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

    entries.sort((left, right) => {
      if (left.startTime === null) return right.startTime === null ? 0 : 1
      if (right.startTime === null) return -1
      return left.startTime.localeCompare(right.startTime)
    })
    return { date: dateKey, items: entries }
  })
}

export async function getAgendaForUser(
  userId: string,
  date: string,
  requestedStudentId: unknown,
): Promise<AgendaEntry[]> {
  const day = new Date(`${date}T00:00:00.000Z`)
  const result = await getAgendaEntriesForRange(userId, day, day, requestedStudentId)
  return result[0]?.items ?? []
}

export async function getAgendaRangeForUser(
  userId: string,
  from: string,
  to: string,
  requestedStudentId: unknown,
): Promise<DatedAgendaEntries[]> {
  return getAgendaEntriesForRange(
    userId,
    new Date(`${from}T00:00:00.000Z`),
    new Date(`${to}T00:00:00.000Z`),
    requestedStudentId,
  )
}
