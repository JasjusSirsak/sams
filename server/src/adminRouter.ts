import { Router, type Request, type Response } from 'express'
import prisma from './db'
import { requireAuth, requireRole } from './auth'

type Input = Record<string, unknown>
type AdminRecord = Record<string, unknown>

class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

type Resource = {
  list: () => Promise<AdminRecord[]>
  create: (input: Input) => Promise<AdminRecord>
  update: (id: bigint, input: Input) => Promise<AdminRecord>
  remove: (id: bigint) => Promise<void>
}

function inputObject(body: unknown): Input {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RequestError('A JSON object is required.', 400)
  }
  return body as Input
}

function text(input: Input, key: string, maxLength: number, required = true): string | undefined {
  const value = input[key]
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string' || (required && value.trim() === '') || value.length > maxLength) {
    throw new RequestError(`${key} must be a non-empty string of at most ${maxLength} characters.`, 400)
  }
  return value.trim()
}

function integer(input: Input, key: string, min: number, max: number): number {
  const value = Number(input[key])
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RequestError(`${key} must be an integer between ${min} and ${max}.`, 400)
  }
  return value
}

function optionalInteger(input: Input, key: string): bigint | undefined {
  const value = input[key]
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new RequestError(`${key} must be a valid ID.`, 400)
  }
  try {
    const parsed = BigInt(value)
    if (parsed < 1n) throw new Error()
    return parsed
  } catch {
    throw new RequestError(`${key} must be a valid positive ID.`, 400)
  }
}

function requiredId(input: Input, key: string): bigint {
  const value = optionalInteger(input, key)
  if (value === undefined) throw new RequestError(`${key} is required.`, 400)
  return value
}

function date(input: Input, key: string): Date {
  const value = input[key]
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RequestError(`${key} must be a valid date in YYYY-MM-DD format.`, 400)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RequestError(`${key} must be a valid date in YYYY-MM-DD format.`, 400)
  }
  return parsed
}

function serialize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (Array.isArray(value)) return value.map(serialize)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]))
  }
  return value
}

function record(value: unknown, id: bigint): AdminRecord {
  const serialized = serialize(value)
  if (typeof serialized !== 'object' || serialized === null || Array.isArray(serialized)) {
    throw new Error('Unexpected database record.')
  }
  return Object.assign({}, serialized, { id: id.toString() })
}

function createResourceRouter(resource: Resource): Router {
  const router = Router()

  router.get('/', async (_req, res) => {
    try {
      res.json({ data: await resource.list() })
    } catch (error) {
      sendError(res, error, 'Failed to fetch records.')
    }
  })

  router.post('/', async (req, res) => {
    try {
      res.status(201).json({ data: await resource.create(inputObject(req.body)) })
    } catch (error) {
      sendError(res, error, 'Failed to create record.')
    }
  })

  const update = async (req: Request, res: Response) => {
    const id = parseId(typeof req.params.id === 'string' ? req.params.id : undefined)
    if (!id) return res.status(400).json({ message: 'A valid record ID is required.' })
    try {
      return res.json({ data: await resource.update(id, inputObject(req.body)) })
    } catch (error) {
      return sendError(res, error, 'Failed to update record.')
    }
  }

  router.put('/:id', update)
  router.patch('/:id', update)

  router.delete('/:id', async (req, res) => {
    const id = parseId(typeof req.params.id === 'string' ? req.params.id : undefined)
    if (!id) return res.status(400).json({ message: 'A valid record ID is required.' })
    try {
      await resource.remove(id)
      return res.status(204).end()
    } catch (error) {
      return sendError(res, error, 'Failed to delete record.')
    }
  })

  return router
}

function parseId(value: string | undefined): bigint | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof RequestError) {
    return res.status(error.status).json({ message: error.message })
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code
    if (code === 'P2002') return res.status(409).json({ message: 'A record with these unique values already exists.' })
    if (code === 'P2003') {
      return res.status(409).json({ message: 'A related record does not exist or this record is still referenced.' })
    }
    if (code === 'P2025') return res.status(404).json({ message: 'Record not found.' })
  }
  console.error(fallback, error)
  return res.status(500).json({ message: fallback })
}

function updateData(input: Input, fields: Record<string, (input: Input) => unknown>): AdminRecord {
  const data: AdminRecord = {}
  for (const [key, parse] of Object.entries(fields)) {
    if (Object.hasOwn(input, key)) data[key] = parse(input)
  }
  if (Object.keys(data).length === 0) throw new RequestError('Provide at least one field to update.', 400)
  return data
}

const classesRouter = createResourceRouter({
  async list() {
    const rows = await prisma.classes.findMany({ orderBy: { name: 'asc' } })
    return rows.map((row) => record(row, row.class_id))
  },
  async create(input) {
    const row = await prisma.classes.create({
      data: { name: text(input, 'name', 100)!, grade_level: integer(input, 'grade_level', 1, 20) },
    })
    return record(row, row.class_id)
  },
  async update(id, input) {
    const data = updateData(input, {
      name: (body) => text(body, 'name', 100)!,
      grade_level: (body) => integer(body, 'grade_level', 1, 20),
    })
    const row = await prisma.classes.update({ where: { class_id: id }, data })
    return record(row, row.class_id)
  },
  async remove(id) {
    await prisma.classes.delete({ where: { class_id: id } })
  },
})

const subjectsRouter = createResourceRouter({
  async list() {
    const rows = await prisma.subjects.findMany({ orderBy: { name: 'asc' } })
    return rows.map((row) => record(row, row.subject_id))
  },
  async create(input) {
    const row = await prisma.subjects.create({
      data: { code: text(input, 'code', 30)!, name: text(input, 'name', 100)! },
    })
    return record(row, row.subject_id)
  },
  async update(id, input) {
    const data = updateData(input, {
      code: (body) => text(body, 'code', 30)!,
      name: (body) => text(body, 'name', 100)!,
    })
    const row = await prisma.subjects.update({ where: { subject_id: id }, data })
    return record(row, row.subject_id)
  },
  async remove(id) {
    await prisma.subjects.delete({ where: { subject_id: id } })
  },
})

const academicPeriodsRouter = createResourceRouter({
  async list() {
    const rows = await prisma.academic_periods.findMany({
      orderBy: [{ academic_year: 'desc' }, { semester: 'asc' }],
    })
    return rows.map((row) => record(row, row.academic_period_id))
  },
  async create(input) {
    const startDate = date(input, 'start_date')
    const endDate = date(input, 'end_date')
    if (startDate > endDate) throw new RequestError('start_date must not be after end_date.', 400)
    const row = await prisma.academic_periods.create({
      data: {
        academic_year: text(input, 'academic_year', 20)!,
        semester: integer(input, 'semester', 1, 2),
        start_date: startDate,
        end_date: endDate,
      },
    })
    return record(row, row.academic_period_id)
  },
  async update(id, input) {
    const data = updateData(input, {
      academic_year: (body) => text(body, 'academic_year', 20)!,
      semester: (body) => integer(body, 'semester', 1, 2),
      start_date: (body) => date(body, 'start_date'),
      end_date: (body) => date(body, 'end_date'),
    })
    const current = await prisma.academic_periods.findUnique({
      where: { academic_period_id: id },
      select: { start_date: true, end_date: true },
    })
    if (!current) throw new RequestError('Record not found.', 404)
    const startDate = data.start_date instanceof Date ? data.start_date : current.start_date
    const endDate = data.end_date instanceof Date ? data.end_date : current.end_date
    if (startDate > endDate) throw new RequestError('start_date must not be after end_date.', 400)
    const row = await prisma.academic_periods.update({ where: { academic_period_id: id }, data })
    return record(row, row.academic_period_id)
  },
  async remove(id) {
    await prisma.academic_periods.delete({ where: { academic_period_id: id } })
  },
})

const teachersRouter = createResourceRouter({
  async list() {
    const rows = await prisma.teachers.findMany({ orderBy: { name: 'asc' } })
    return rows.map((row) => record(row, row.teacher_id))
  },
  async create(input) {
    const row = await prisma.teachers.create({
      data: {
        user_id: requiredId(input, 'user_id'),
        name: text(input, 'name', 150)!,
        employee_number: text(input, 'employee_number', 50, false) ?? null,
      },
    })
    return record(row, row.teacher_id)
  },
  async update(id, input) {
    const data = updateData(input, {
      user_id: (body) => {
        const userId = optionalInteger(body, 'user_id')
        if (userId === undefined) throw new RequestError('user_id is required.', 400)
        return userId
      },
      name: (body) => text(body, 'name', 150)!,
      employee_number: (body) => text(body, 'employee_number', 50, false) ?? null,
    })
    const row = await prisma.teachers.update({ where: { teacher_id: id }, data })
    return record(row, row.teacher_id)
  },
  async remove(id) {
    await prisma.teachers.delete({ where: { teacher_id: id } })
  },
})

const studentsRouter = createResourceRouter({
  async list() {
    const rows = await prisma.students.findMany({ orderBy: { name: 'asc' } })
    return rows.map((row) => record(row, row.student_id))
  },
  async create(input) {
    const row = await prisma.students.create({
      data: {
        nis: text(input, 'nis', 50)!,
        name: text(input, 'name', 150)!,
        user_id: optionalInteger(input, 'user_id') ?? null,
        birth_date: input.birth_date ? date(input, 'birth_date') : null,
        phone_number: text(input, 'phone_number', 30, false) ?? null,
        address: text(input, 'address', 1000, false) ?? null,
      },
    })
    return record(row, row.student_id)
  },
  async update(id, input) {
    const data = updateData(input, {
      nis: (body) => text(body, 'nis', 50)!,
      name: (body) => text(body, 'name', 150)!,
      user_id: (body) => optionalInteger(body, 'user_id') ?? null,
      birth_date: (body) => body.birth_date === '' || body.birth_date === null ? null : date(body, 'birth_date'),
      phone_number: (body) => text(body, 'phone_number', 30, false) ?? null,
      address: (body) => text(body, 'address', 1000, false) ?? null,
    })
    const row = await prisma.students.update({ where: { student_id: id }, data })
    return record(row, row.student_id)
  },
  async remove(id) {
    await prisma.students.delete({ where: { student_id: id } })
  },
})

const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('admin', 'staff'))
adminRouter.use('/classes', classesRouter)
adminRouter.use('/subjects', subjectsRouter)
adminRouter.use('/academic-periods', academicPeriodsRouter)
adminRouter.use('/teachers', teachersRouter)
adminRouter.use('/students', studentsRouter)

export default adminRouter
