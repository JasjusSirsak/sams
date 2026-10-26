import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import {
  EnrollmentServiceError,
  createStudentEnrollment,
  deleteStudentEnrollment,
  getStudentEnrollment,
  listStudentEnrollments,
  updateStudentEnrollment,
} from './services/studentEnrollmentsService'

const studentEnrollmentsRouter = Router()

const idSchema = z.string().regex(/^[1-9]\d*$/, 'ID must be a positive integer.')

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const enrollmentInputSchema = z.object({
  student_id: idSchema,
  class_id: idSchema,
  academic_period_id: idSchema,
})

const enrollmentPatchSchema = enrollmentInputSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: 'Provide at least one field to update.' },
)

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof EnrollmentServiceError) {
    return res.status(error.status).json({ message: error.message })
  }

  console.error(fallback, error)
  return res.status(500).json({ message: fallback })
}

studentEnrollmentsRouter.get('/', async (req: Request, res: Response) => {
  const parsedQuery = paginationSchema.safeParse({
    page: req.query.page,
    limit: req.query.limit,
  })
  if (!parsedQuery.success) {
    return res.status(400).json({
      message: parsedQuery.error.issues[0]?.message ?? 'Invalid pagination query.',
    })
  }

  try {
    const result = await listStudentEnrollments(parsedQuery.data)
    return res.json(result)
  } catch (error) {
    return sendError(res, error, 'Failed to fetch student enrollments.')
  }
})

studentEnrollmentsRouter.get('/:id', async (req: Request, res: Response) => {
  const parsedId = idSchema.safeParse(req.params.id)
  if (!parsedId.success) {
    return res.status(400).json({ message: 'A valid enrollment ID is required.' })
  }

  try {
    const data = await getStudentEnrollment(parsedId.data)
    return res.json({ data })
  } catch (error) {
    return sendError(res, error, 'Failed to fetch student enrollment.')
  }
})

studentEnrollmentsRouter.post('/', async (req: Request, res: Response) => {
  const parsedBody = enrollmentInputSchema.safeParse(req.body)
  if (!parsedBody.success) {
    return res.status(400).json({
      message: parsedBody.error.issues[0]?.message ?? 'Invalid student enrollment.',
    })
  }

  try {
    const data = await createStudentEnrollment(parsedBody.data)
    return res.status(201).json({ data })
  } catch (error) {
    return sendError(res, error, 'Failed to create student enrollment.')
  }
})

studentEnrollmentsRouter.patch('/:id', async (req: Request, res: Response) => {
  const parsedId = idSchema.safeParse(req.params.id)
  if (!parsedId.success) {
    return res.status(400).json({ message: 'A valid enrollment ID is required.' })
  }

  const parsedBody = enrollmentPatchSchema.safeParse(req.body)
  if (!parsedBody.success) {
    return res.status(400).json({
      message: parsedBody.error.issues[0]?.message ?? 'Invalid student enrollment update.',
    })
  }

  try {
    const data = await updateStudentEnrollment(parsedId.data, parsedBody.data)
    return res.json({ data })
  } catch (error) {
    return sendError(res, error, 'Failed to update student enrollment.')
  }
})

studentEnrollmentsRouter.delete('/:id', async (req: Request, res: Response) => {
  const parsedId = idSchema.safeParse(req.params.id)
  if (!parsedId.success) {
    return res.status(400).json({ message: 'A valid enrollment ID is required.' })
  }

  try {
    await deleteStudentEnrollment(parsedId.data)
    return res.status(204).end()
  } catch (error) {
    return sendError(res, error, 'Failed to delete student enrollment.')
  }
})

export default studentEnrollmentsRouter