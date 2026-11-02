import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import prisma from './db'
import { requireAuth, requireRole } from './auth'
import { getActivePeriod } from './services/academicPeriod'

const classSchedulesRouter = Router()
classSchedulesRouter.use(requireAuth, requireRole('staff'))

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const scheduleInputSchema = z.object({
  day_of_week: z.number().int().min(1).max(6),
  start_time: timeSchema,
  end_time: timeSchema,
  subject_id: z.string().regex(/^[1-9]\d*$/),
  teacher_id: z.string().regex(/^[1-9]\d*$/),
  room: z.string().trim().max(50).nullable().optional(),
}).refine(({ start_time, end_time }) => start_time < end_time, {
  message: 'End time must be later than start time.',
})

class ScheduleConflictError extends Error {}

function parseId(value: string | undefined): bigint | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function toDatabaseTime(value: string): Date {
  return new Date(`1970-01-01T${value}:00.000Z`)
}

function formatTime(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`
}

classSchedulesRouter.get('/options', async (_req: Request, res: Response) => {
  try {
    const [subjects, teachers, period] = await Promise.all([
      prisma.subjects.findMany({
        orderBy: { name: 'asc' },
        select: { subject_id: true, code: true, name: true },
      }),
      prisma.teachers.findMany({
        orderBy: { name: 'asc' },
        select: { teacher_id: true, name: true, employee_number: true },
      }),
      getActivePeriod(),
    ])

    return res.json({
      data: {
        subjects: subjects.map(({ subject_id, code, name }) => ({
          id: subject_id.toString(),
          code,
          name,
        })),
        teachers: teachers.map(({ teacher_id, name, employee_number }) => ({
          id: teacher_id.toString(),
          name,
          employee_number,
        })),
        period: period
          ? {
              id: period.academic_period_id.toString(),
              academic_year: period.academic_year,
              semester: period.semester,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Failed to load class schedule options:', error)
    return res.status(500).json({ message: 'Failed to load schedule options.' })
  }
})

classSchedulesRouter.get('/classes/:classId', async (req: Request, res: Response) => {
  const classId = parseId(typeof req.params.classId === 'string' ? req.params.classId : undefined)
  if (!classId) return res.status(400).json({ message: 'A valid class ID is required.' })

  try {
    const [classItem, period] = await Promise.all([
      prisma.classes.findUnique({
        where: { class_id: classId },
        select: { class_id: true, name: true, grade_level: true },
      }),
      getActivePeriod(),
    ])
    if (!classItem) return res.status(404).json({ message: 'Class not found.' })

    if (!period) {
      return res.json({
        data: {
          class: {
            id: classItem.class_id.toString(),
            name: classItem.name,
            grade_level: classItem.grade_level,
          },
          period: null,
          schedules: [],
        },
      })
    }

    const assignments = await prisma.teaching_assignments.findMany({
      where: { class_id: classId, academic_period_id: period.academic_period_id },
      include: {
        teachers: { select: { name: true } },
        subjects: { select: { name: true, code: true } },
        class_schedules: { orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }] },
      },
    })
    const schedules = assignments.flatMap((assignment) =>
      assignment.class_schedules.map((schedule) => ({
        id: schedule.class_schedule_id.toString(),
        day_of_week: schedule.day_of_week,
        start_time: formatTime(schedule.start_time),
        end_time: formatTime(schedule.end_time),
        room: schedule.room,
        subject: assignment.subjects.name,
        subject_code: assignment.subjects.code,
        teacher: assignment.teachers.name,
      })),
    ).sort((left, right) =>
      left.day_of_week - right.day_of_week || left.start_time.localeCompare(right.start_time),
    )

    return res.json({
      data: {
        class: {
          id: classItem.class_id.toString(),
          name: classItem.name,
          grade_level: classItem.grade_level,
        },
        period: {
          id: period.academic_period_id.toString(),
          academic_year: period.academic_year,
          semester: period.semester,
        },
        schedules,
      },
    })
  } catch (error) {
    console.error('Failed to load class schedule:', error)
    return res.status(500).json({ message: 'Failed to load class schedule.' })
  }
})

classSchedulesRouter.put('/:scheduleId', async (req: Request, res: Response) => {
  const scheduleId = parseId(typeof req.params.scheduleId === 'string' ? req.params.scheduleId : undefined)
  if (!scheduleId) return res.status(400).json({ message: 'A valid schedule ID is required.' })

  const parsedInput = z.object({
    room: z.string().trim().max(50).nullable(),
  }).safeParse(req.body)
  if (!parsedInput.success) {
    return res.status(400).json({
      message: parsedInput.error.issues[0]?.message ?? 'Invalid schedule data.',
    })
  }

  try {
    const existing = await prisma.class_schedules.findUnique({
      where: { class_schedule_id: scheduleId },
      select: { class_schedule_id: true },
    })
    if (!existing) return res.status(404).json({ message: 'Class schedule not found.' })

    await prisma.class_schedules.update({
      where: { class_schedule_id: scheduleId },
      data: { room: parsedInput.data.room || null },
    })

    return res.json({ message: 'Class schedule updated successfully.' })
  } catch (error) {
    console.error('Failed to update class schedule:', error)
    return res.status(500).json({ message: 'Failed to update class schedule.' })
  }
})

classSchedulesRouter.post('/classes/:classId', async (req: Request, res: Response) => {
  const classId = parseId(typeof req.params.classId === 'string' ? req.params.classId : undefined)
  if (!classId) return res.status(400).json({ message: 'A valid class ID is required.' })

  const parsedInput = scheduleInputSchema.safeParse(req.body)
  if (!parsedInput.success) {
    return res.status(400).json({
      message: parsedInput.error.issues[0]?.message ?? 'Invalid class schedule data.',
    })
  }

  try {
    const input = parsedInput.data
    const [classItem, period] = await Promise.all([
      prisma.classes.findUnique({ where: { class_id: classId }, select: { class_id: true } }),
      getActivePeriod(),
    ])
    if (!classItem) return res.status(404).json({ message: 'Class not found.' })
    if (!period) return res.status(409).json({ message: 'There is no active academic period.' })

    const subjectId = BigInt(input.subject_id)
    const teacherId = BigInt(input.teacher_id)
    const startTime = toDatabaseTime(input.start_time)
    const endTime = toDatabaseTime(input.end_time)

    const schedule = await prisma.$transaction(async (transaction) => {
      const assignment = await transaction.teaching_assignments.upsert({
        where: {
          teacher_id_class_id_subject_id_academic_period_id: {
            teacher_id: teacherId,
            class_id: classId,
            subject_id: subjectId,
            academic_period_id: period.academic_period_id,
          },
        },
        create: {
          teacher_id: teacherId,
          class_id: classId,
          subject_id: subjectId,
          academic_period_id: period.academic_period_id,
        },
        update: {},
        select: { teaching_assignment_id: true },
      })

      const conflict = await transaction.class_schedules.findFirst({
        where: {
          day_of_week: input.day_of_week,
          start_time: { lt: endTime },
          end_time: { gt: startTime },
          teaching_assignments: {
            is: {
              academic_period_id: period.academic_period_id,
              OR: [{ class_id: classId }, { teacher_id: teacherId }],
            },
          },
        },
        select: { class_schedule_id: true },
      })
      if (conflict) throw new ScheduleConflictError('The class or teacher already has a schedule during this time.')

      return transaction.class_schedules.create({
        data: {
          teaching_assignment_id: assignment.teaching_assignment_id,
          day_of_week: input.day_of_week,
          start_time: startTime,
          end_time: endTime,
          room: input.room?.trim() || null,
        },
        select: { class_schedule_id: true },
      })
    })

    return res.status(201).json({ data: { id: schedule.class_schedule_id.toString() } })
  } catch (error) {
    if (error instanceof ScheduleConflictError) {
      return res.status(409).json({ message: error.message })
    }
    console.error('Failed to create class schedule:', error)
    return res.status(500).json({ message: 'Failed to create class schedule.' })
  }
})

export default classSchedulesRouter
