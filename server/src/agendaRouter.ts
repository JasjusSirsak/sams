import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from './auth'
import { AgendaScopeError, getAgendaForUser, getAgendaRangeForUser } from './services/agendaService'
import prisma from './db'

const agendaRouter = Router()
const requireStaff = [requireAuth, requireRole('staff')]
const agendaTypes = ['EVENT', 'HOLIDAY', 'ACTIVITY', 'EXAM', 'MEETING', 'OTHER'] as const

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  })

const timeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)

const agendaInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  date: dateSchema,
  type: z.enum(agendaTypes),
  start_time: timeSchema.nullable(),
  end_time: timeSchema.nullable(),
  location: z.string().trim().max(100).nullable(),
}).refine(
  ({ start_time, end_time }) =>
    (start_time === null && end_time === null) ||
    (start_time !== null && end_time !== null && end_time > start_time),
  { message: 'Provide both valid event times, or leave both empty for an all-day event.' },
)

function toDatabaseTime(value: string | null): Date | null {
  return value ? new Date(`1970-01-01T${value}:00.000Z`) : null
}

const agendaQuerySchema = z
  .object({
    date: dateSchema.optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    studentId: z.string().optional(),
  })
  .refine(
    ({ date, from, to }) =>
      (date !== undefined && from === undefined && to === undefined) ||
      (date === undefined && from !== undefined && to !== undefined),
    { message: 'Provide either date or both from and to.' },
  )
  .refine(
    ({ from, to }) =>
      from === undefined ||
      to === undefined ||
      (from <= to &&
        (new Date(`${to}T00:00:00.000Z`).getTime() -
          new Date(`${from}T00:00:00.000Z`).getTime()) /
          86_400_000 <
          31),
    { message: 'Date range must be in order and no longer than 31 days.' },
  )

agendaRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const parsedQuery = agendaQuerySchema.safeParse({
    date: req.query.date,
    from: req.query.from,
    to: req.query.to,
    studentId: req.query.studentId,
  })
  if (!parsedQuery.success) {
    return res.status(400).json({ message: parsedQuery.error.issues[0]?.message ?? 'Invalid agenda query.' })
  }

  try {
    const { date, from, to, studentId } = parsedQuery.data
    const data = date
      ? await getAgendaForUser(req.user!.userId, date, studentId)
      : await getAgendaRangeForUser(req.user!.userId, from!, to!, studentId)
    return res.json({ data })
  } catch (error) {
    if (error instanceof AgendaScopeError) {
      return res.status(error.status).json({ message: error.message })
    }

    console.error('Failed to fetch shared agenda:', error)
    return res.status(500).json({ message: 'Failed to load agenda.' })
  }
})

agendaRouter.get('/manage', ...requireStaff, async (_req: Request, res: Response) => {
  try {
    const agendas = await prisma.agendas.findMany({
      where: { class_id: null },
      orderBy: [{ agenda_date: 'asc' }, { created_at: 'desc' }],
      select: {
        agenda_id: true,
        title: true,
        description: true,
        agenda_date: true,
        agenda_type: true,
        start_time: true,
        end_time: true,
        location: true,
      },
    })

    return res.json({
      data: agendas.map((agenda) => ({
        id: agenda.agenda_id.toString(),
        title: agenda.title,
        description: agenda.description,
        date: agenda.agenda_date.toISOString().slice(0, 10),
        type: agenda.agenda_type,
        start_time: agenda.start_time ? agenda.start_time.toISOString().slice(11, 16) : null,
        end_time: agenda.end_time ? agenda.end_time.toISOString().slice(11, 16) : null,
        location: agenda.location,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch agendas for management:', error)
    return res.status(500).json({ message: 'Failed to load agendas.' })
  }
})

agendaRouter.post('/manage', ...requireStaff, async (req: Request, res: Response) => {
  const parsedInput = agendaInputSchema.safeParse(req.body)
  if (!parsedInput.success) {
    return res.status(400).json({ message: parsedInput.error.issues[0]?.message ?? 'Invalid agenda data.' })
  }

  try {
    const input = parsedInput.data
    const agenda = await prisma.agendas.create({
      data: {
        title: input.title,
        description: input.description || null,
        agenda_date: new Date(`${input.date}T00:00:00.000Z`),
        agenda_type: input.type,
        start_time: toDatabaseTime(input.start_time),
        end_time: toDatabaseTime(input.end_time),
        location: input.location || null,
        class_id: null,
        created_by: BigInt(req.user!.userId),
      },
      select: { agenda_id: true },
    })

    return res.status(201).json({ data: { id: agenda.agenda_id.toString() } })
  } catch (error) {
    console.error('Failed to create agenda:', error)
    return res.status(500).json({ message: 'Failed to create agenda.' })
  }
})

agendaRouter.put('/manage/:agendaId', ...requireStaff, async (req: Request, res: Response) => {
  const agendaIdValue = typeof req.params.agendaId === 'string' ? req.params.agendaId : ''
  if (!/^[1-9]\d*$/.test(agendaIdValue)) {
    return res.status(400).json({ message: 'A valid agenda ID is required.' })
  }

  const parsedInput = agendaInputSchema.safeParse(req.body)
  if (!parsedInput.success) {
    return res.status(400).json({ message: parsedInput.error.issues[0]?.message ?? 'Invalid agenda data.' })
  }

  try {
    const agendaId = BigInt(agendaIdValue)
    const existing = await prisma.agendas.findFirst({
      where: { agenda_id: agendaId, class_id: null },
      select: { agenda_id: true },
    })
    if (!existing) return res.status(404).json({ message: 'Agenda not found.' })

    const input = parsedInput.data
    await prisma.agendas.update({
      where: { agenda_id: agendaId },
      data: {
        title: input.title,
        description: input.description || null,
        agenda_date: new Date(`${input.date}T00:00:00.000Z`),
        agenda_type: input.type,
        start_time: toDatabaseTime(input.start_time),
        end_time: toDatabaseTime(input.end_time),
        location: input.location || null,
      },
    })

    return res.json({ message: 'Agenda updated successfully.' })
  } catch (error) {
    console.error('Failed to update agenda:', error)
    return res.status(500).json({ message: 'Failed to update agenda.' })
  }
})

agendaRouter.delete('/manage/:agendaId', ...requireStaff, async (req: Request, res: Response) => {
  const agendaIdValue = typeof req.params.agendaId === 'string' ? req.params.agendaId : ''
  if (!/^[1-9]\d*$/.test(agendaIdValue)) {
    return res.status(400).json({ message: 'A valid agenda ID is required.' })
  }

  try {
    const agendaId = BigInt(agendaIdValue)
    const existing = await prisma.agendas.findFirst({
      where: { agenda_id: agendaId, class_id: null },
      select: {
        agenda_id: true,
        _count: { select: { attendance_sessions: true } },
      },
    })
    if (!existing) return res.status(404).json({ message: 'Agenda not found.' })
    if (existing._count.attendance_sessions > 0) {
      return res.status(409).json({
        message: 'This agenda is linked to an attendance session and cannot be deleted.',
      })
    }

    await prisma.agendas.delete({ where: { agenda_id: agendaId } })
    return res.json({ message: 'Agenda deleted successfully.' })
  } catch (error) {
    console.error('Failed to delete agenda:', error)
    return res.status(500).json({ message: 'Failed to delete agenda.' })
  }
})

export default agendaRouter
