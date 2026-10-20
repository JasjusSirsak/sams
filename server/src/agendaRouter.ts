import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireAuth } from './auth'
import { AgendaScopeError, getAgendaForUser, getAgendaRangeForUser } from './services/agendaService'

const agendaRouter = Router()

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  })

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

export default agendaRouter
