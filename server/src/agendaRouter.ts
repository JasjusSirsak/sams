import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireAuth } from './auth'
import { AgendaScopeError, getAgendaForUser } from './services/agendaService'

const agendaRouter = Router()

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  })

agendaRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const parsedDate = dateSchema.safeParse(req.query.date)
  if (!parsedDate.success) {
    return res.status(400).json({ message: 'date must be a valid date in YYYY-MM-DD format.' })
  }

  try {
    const data = await getAgendaForUser(req.user!.userId, parsedDate.data, req.query.studentId)
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
