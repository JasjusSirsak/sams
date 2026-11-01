import { Router, type Request, type Response } from 'express'
import prisma from './db'
import { requireAuth, requireRole } from './auth'
import studentEnrollmentsRouter from './studentEnrollmentsRouter'
import { getActivePeriod } from './services/academicPeriod'
import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'

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

async function getClassRoomsByPeriod(
  classPeriods: Array<{ classId: bigint; academicPeriodId: bigint }>,
): Promise<Map<string, string>> {
  if (classPeriods.length === 0) return new Map()

  const schedules = await prisma.class_schedules.findMany({
    where: {
      OR: classPeriods.map(({ classId, academicPeriodId }) => ({
        teaching_assignments: {
          is: { class_id: classId, academic_period_id: academicPeriodId },
        },
      })),
    },
    select: {
      room: true,
      teaching_assignments: {
        select: { class_id: true, academic_period_id: true },
      },
    },
  })

  const roomsByClassPeriod = new Map<string, Set<string>>()
  for (const schedule of schedules) {
    if (!schedule.room?.trim()) continue
    const key = `${schedule.teaching_assignments.class_id}:${schedule.teaching_assignments.academic_period_id}`
    const rooms = roomsByClassPeriod.get(key) ?? new Set<string>()
    rooms.add(schedule.room.trim())
    roomsByClassPeriod.set(key, rooms)
  }

  return new Map(
    [...roomsByClassPeriod].map(([key, rooms]) => [key, [...rooms].join(' · ')]),
  )
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
    const name = text(input, 'name', 100)!
    const gradeLevel = integer(input, 'grade_level', 1, 20)
    const academicPeriodId = requiredId(input, 'academic_period_id')
    const teacherId = requiredId(input, 'teacher_id')

    return prisma.$transaction(async (transaction) => {
      const row = await transaction.classes.create({
        data: { name, grade_level: gradeLevel },
      })
      await transaction.homeroom_assignments.create({
        data: {
          class_id: row.class_id,
          academic_period_id: academicPeriodId,
          teacher_id: teacherId,
        },
      })
      return record(row, row.class_id)
    })
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
    const rows = await prisma.teachers.findMany({
      orderBy: { name: 'asc' },
      include: {
        teaching_assignments: {
          select: {
            classes: { select: { name: true } },
            subjects: { select: { name: true } },
          },
        },
      },
    })
    return rows.map((row) => {
      // Extract unique class and subject names
      const classSet = new Set<string>()
      const subjectSet = new Set<string>()
      for (const ta of row.teaching_assignments ?? []) {
        if (ta.classes?.name) classSet.add(ta.classes.name)
        if (ta.subjects?.name) subjectSet.add(ta.subjects.name)
      }
      // Attach arrays to the row object for serialization
      const enriched = {
        ...row,
        classes: Array.from(classSet),
        subjects: Array.from(subjectSet),
      }
      return record(enriched, row.teacher_id)
    })
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
    // Remove user_id from input - we'll create it automatically
    const nis = text(input, 'nis', 50)!
    const name = text(input, 'name', 150)!

    // Look up Student role by name
    const studentRole = await prisma.roles.findUnique({
      where: { name: 'Student' },
    })
    if (!studentRole) {
      throw new RequestError('Student role not found in database.', 500)
    }

    // Generate random password and create user account
    const initialPassword = generateRandomPassword()
    const passwordHash = await hashPassword(initialPassword)

    const user = await prisma.users.create({
      data: {
        username: nis,
        password_hash: passwordHash,
        role_id: studentRole.role_id,
        is_active: true,
      },
    })

    const row = await prisma.students.create({
      data: {
        nis,
        name,
        user_id: user.user_id,
        birth_date: input.birth_date ? date(input, 'birth_date') : null,
        phone_number: text(input, 'phone_number', 30, false) ?? null,
        address: text(input, 'address', 1000, false) ?? null,
      },
    })

    // Return the record with the initial password (one-time only)
    const serialized = record(row, row.student_id)
    ;(serialized as any).initial_password = initialPassword
    return serialized
  },
  async update(id, input) {
    const data = updateData(input, {
      nis: (body) => text(body, 'nis', 50)!,
      name: (body) => text(body, 'name', 150)!,
      birth_date: (body) => body.birth_date === '' || body.birth_date === null ? null : date(body, 'birth_date'),
      phone_number: (body) => text(body, 'phone_number', 30, false) ?? null,
      address: (body) => text(body, 'address', 1000, false) ?? null,
      gender: (body) => text(body, 'gender', 10, false) || null,
    })
    const row = await prisma.$transaction(async (transaction) => {
      const current = await transaction.students.findUnique({
        where: { student_id: id },
        select: { user_id: true },
      })
      if (!current) throw new RequestError('Record not found.', 404)

      const updated = await transaction.students.update({ where: { student_id: id }, data })
      if (typeof data.nis === 'string' && current.user_id) {
        await transaction.users.update({
          where: { user_id: current.user_id },
          data: { username: data.nis },
        })
      }
      return updated
    })
    return record(row, row.student_id)
  },
  async remove(id) {
    await prisma.students.delete({ where: { student_id: id } })
  },
})

studentsRouter.put('/:id/parents', async (req, res) => {
  const studentId = parseId(typeof req.params.id === 'string' ? req.params.id : undefined)
  if (!studentId) return res.status(400).json({ message: 'A valid student ID is required.' })

  try {
    const body = inputObject(req.body)
    if (!Array.isArray(body.parents)) {
      throw new RequestError('parents must be an array.', 400)
    }

    const parents = body.parents.map((value) => {
      const input = inputObject(value)
      const parentId = optionalInteger(input, 'parent_id') ?? null
      const relationshipType = text(input, 'relationship_type', 50)!
      if (!['FATHER', 'MOTHER', 'GUARDIAN'].includes(relationshipType)) {
        throw new RequestError('relationship_type must be FATHER, MOTHER, or GUARDIAN.', 400)
      }

      const passwordValue = input.temporary_password
      if (passwordValue !== undefined && typeof passwordValue !== 'string') {
        throw new RequestError('temporary_password must be a string.', 400)
      }
      if (typeof passwordValue === 'string' && passwordValue.length > 128) {
        throw new RequestError('temporary_password must be at most 128 characters.', 400)
      }
      const temporaryPassword =
        typeof passwordValue === 'string' && passwordValue.length > 0
          ? passwordValue
          : undefined
      if (!parentId && !temporaryPassword) {
        throw new RequestError('temporary_password is required for a new parent.', 400)
      }
      if (temporaryPassword && (temporaryPassword.length < 8 || !temporaryPassword.trim())) {
        throw new RequestError('temporary_password must be at least 8 characters and not blank.', 400)
      }

      return {
        parentId,
        name: text(input, 'name', 150)!,
        relationshipType,
        phoneNumber: text(input, 'phone_number', 30, false) ?? '',
        address: text(input, 'address', 1000, false) ?? '',
        username: text(input, 'username', 100)!,
        temporaryPassword,
      }
    })

    const parentIds = parents.flatMap((parent) => parent.parentId ? [parent.parentId.toString()] : [])
    if (new Set(parentIds).size !== parentIds.length) {
      throw new RequestError('A parent cannot be listed more than once.', 400)
    }
    const usernames = parents.map((parent) => parent.username.toLowerCase())
    if (new Set(usernames).size !== usernames.length) {
      throw new RequestError('Each parent must have a unique username.', 400)
    }

    const newParentCount = parents.filter((parent) => !parent.parentId).length
    const parentRole = newParentCount
      ? await prisma.roles.findUnique({ where: { name: 'Parent' } })
      : null
    if (newParentCount && !parentRole) {
      throw new RequestError('Parent role not found in database.', 500)
    }

    const preparedParents: Array<(typeof parents)[number] & { passwordHash?: string }> = []
    for (const parent of parents) {
      preparedParents.push({
        ...parent,
        passwordHash: parent.temporaryPassword
          ? await hashPassword(parent.temporaryPassword)
          : undefined,
      })
    }

    const credentials = await prisma.$transaction(async (transaction) => {
      const student = await transaction.students.findUnique({
        where: { student_id: studentId },
        select: { student_id: true },
      })
      if (!student) throw new RequestError('Student not found.', 404)

      const currentRelations = await transaction.parent_students.findMany({
        where: { student_id: studentId },
        include: { parents: { select: { parent_id: true, user_id: true } } },
      })
      const currentById = new Map(
        currentRelations.map((relation) => [relation.parent_id.toString(), relation]),
      )
      for (const parentId of parentIds) {
        if (!currentById.has(parentId)) {
          throw new RequestError('A parent is not linked to this student.', 400)
        }
      }

      const updatedCredentials: Array<{ username: string; password: string }> = []
      for (const parent of preparedParents) {
        if (parent.parentId) {
          const current = currentById.get(parent.parentId.toString())
          if (!current) throw new RequestError('A parent is not linked to this student.', 400)

          const matchingUser = await transaction.users.findFirst({
            where: {
              username: { equals: parent.username, mode: 'insensitive' },
            },
            select: { user_id: true },
          })
          if (matchingUser && matchingUser.user_id !== current.parents.user_id) {
            throw new RequestError('That username is already in use.', 409)
          }

          await transaction.users.update({
            where: { user_id: current.parents.user_id },
            data: {
              username: parent.username,
              ...(parent.passwordHash ? { password_hash: parent.passwordHash } : {}),
            },
          })
          await transaction.parents.update({
            where: { parent_id: parent.parentId },
            data: {
              name: parent.name,
              phone_number: parent.phoneNumber || null,
              address: parent.address || null,
            },
          })
          await transaction.parent_students.update({
            where: {
              parent_id_student_id: {
                parent_id: parent.parentId,
                student_id: studentId,
              },
            },
            data: { relationship_type: parent.relationshipType },
          })
          if (parent.temporaryPassword) {
            updatedCredentials.push({
              username: parent.username,
              password: parent.temporaryPassword,
            })
          }
          continue
        }

        if (!parentRole || !parent.passwordHash || !parent.temporaryPassword) {
          throw new RequestError('Parent account credentials could not be prepared.', 500)
        }
        const existingUser = await transaction.users.findFirst({
          where: {
            username: { equals: parent.username, mode: 'insensitive' },
          },
          select: { user_id: true },
        })
        if (existingUser) throw new RequestError('That username is already in use.', 409)

        const user = await transaction.users.create({
          data: {
            username: parent.username,
            password_hash: parent.passwordHash,
            role_id: parentRole.role_id,
            is_active: true,
          },
        })
        const parentRecord = await transaction.parents.create({
          data: {
            user_id: user.user_id,
            name: parent.name,
            phone_number: parent.phoneNumber || null,
            address: parent.address || null,
          },
        })
        await transaction.parent_students.create({
          data: {
            parent_id: parentRecord.parent_id,
            student_id: studentId,
            relationship_type: parent.relationshipType,
          },
        })
        updatedCredentials.push({
          username: parent.username,
          password: parent.temporaryPassword,
        })
      }

      const retainedParentIds = new Set(parentIds)
      for (const relation of currentRelations) {
        if (retainedParentIds.has(relation.parent_id.toString())) continue

        await transaction.parent_students.delete({
          where: {
            parent_id_student_id: {
              parent_id: relation.parent_id,
              student_id: studentId,
            },
          },
        })
        const remainingRelations = await transaction.parent_students.count({
          where: { parent_id: relation.parent_id },
        })
        if (remainingRelations === 0) {
          await transaction.parents.delete({
            where: { parent_id: relation.parent_id },
          })
        }
      }

      return updatedCredentials
    })

    return res.json({
      message: 'Parent information updated successfully.',
      data: { credentials },
    })
  } catch (error) {
    return sendError(res, error, 'Failed to update parent information.')
  }
})

const STAFF_UP = requireRole('staff', 'admin', 'superadmin')
const ADMIN_UP = requireRole('admin', 'superadmin')

// Helper: Generate random password (12 chars, mixed case + numbers)
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const password = randomBytes(12)
  return Array.from(password)
    .map((b) => chars[b % chars.length])
    .join('')
}

// Helper: Hash password using Argon2
async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  })
}

const adminRouter = Router()
adminRouter.use(requireAuth)

// staff? yess
adminRouter.use('/classes', STAFF_UP, classesRouter)
adminRouter.use('/subjects', STAFF_UP, subjectsRouter)
adminRouter.use('/academic-periods', STAFF_UP, academicPeriodsRouter)

// admin only
adminRouter.use('/teachers', ADMIN_UP, teachersRouter)
adminRouter.use('/students', ADMIN_UP, studentsRouter)
adminRouter.use('/student-enrollments', ADMIN_UP, studentEnrollmentsRouter)

adminRouter.get('/dashboard', ADMIN_UP, async (_req: Request, res: Response) => {
  try {
    const [studentCount, teacherCount, classCount, parentCount, agendas, students] =
      await Promise.all([
        prisma.students.count(),
        prisma.teachers.count(),
        prisma.classes.count(),
        prisma.parents.count(),
        prisma.agendas.findMany({
          orderBy: [{ agenda_date: 'desc' }, { created_at: 'desc' }],
          take: 5,
          select: {
            agenda_id: true,
            title: true,
            agenda_date: true,
            agenda_type: true,
          },
        }),
        prisma.students.findMany({
          orderBy: { student_id: 'desc' },
          take: 5,
          select: {
            student_id: true,
            nis: true,
            name: true,
          },
        }),
      ])

    return res.json({
      data: {
        stats: {
          students: studentCount,
          teachers: teacherCount,
          classes: classCount,
          parents: parentCount,
        },
        recent_agendas: agendas.map((agenda) => ({
          id: agenda.agenda_id.toString(),
          title: agenda.title,
          date: agenda.agenda_date.toISOString().slice(0, 10),
          type: agenda.agenda_type,
        })),
        recent_students: students.map((student) => ({
          id: student.student_id.toString(),
          nis: student.nis,
          name: student.name,
        })),
      },
    })
  } catch (error) {
    return sendError(res, error, 'Failed to load the admin dashboard.')
  }
})

adminRouter.get('/class-homeroom-teachers', STAFF_UP, async (_req: Request, res: Response) => {
  try {
    const teachers = await prisma.teachers.findMany({
      orderBy: { name: 'asc' },
      select: { teacher_id: true, name: true },
    })
    return res.json({
      data: teachers.map((teacher) => ({
        id: teacher.teacher_id.toString(),
        name: teacher.name,
      })),
    })
  } catch (error) {
    return sendError(res, error, 'Failed to fetch homeroom teachers.')
  }
})

// Class Library Catalog: list classes with enrollment counts for their linked academic periods
adminRouter.get('/class-catalog', STAFF_UP, async (_req: Request, res: Response) => {
  try {
    const activePeriod = await getActivePeriod()
    const activePeriodId = activePeriod?.academic_period_id

    const classesList = await prisma.classes.findMany({
      orderBy: [{ grade_level: 'asc' }, { name: 'asc' }],
      include: {
        homeroom_assignments: {
          orderBy: { academic_periods: { start_date: 'desc' } },
          take: 1,
          select: {
            academic_period_id: true,
            academic_periods: { select: { academic_year: true } },
          },
        },
      },
    })

    const classIds = classesList.map((cls) => cls.class_id)
    const periodIds = classesList.map(
      (cls) => cls.homeroom_assignments[0]?.academic_period_id ?? activePeriodId,
    ).filter((id): id is bigint => id !== undefined)
    const classPeriods = classesList.flatMap((cls) => {
      const academicPeriodId = cls.homeroom_assignments[0]?.academic_period_id ?? activePeriodId
      return academicPeriodId ? [{ classId: cls.class_id, academicPeriodId }] : []
    })
    const [enrollmentCounts, roomsByClassPeriod] = classIds.length && periodIds.length
      ? await Promise.all([
        prisma.student_enrollments.groupBy({
          by: ['class_id', 'academic_period_id'],
          where: {
            class_id: { in: classIds },
            academic_period_id: { in: periodIds },
          },
          _count: { _all: true },
        }),
        getClassRoomsByPeriod(classPeriods),
      ])
      : [[], new Map<string, string>()]

    const data = classesList.map((cls) => {
      const academicPeriodId = cls.homeroom_assignments[0]?.academic_period_id ?? activePeriodId
      return {
        id: cls.class_id.toString(),
        name: cls.name,
        grade_level: cls.grade_level,
        academic_year: cls.homeroom_assignments[0]?.academic_periods.academic_year ?? activePeriod?.academic_year ?? '',
        student_count: enrollmentCounts.find((count) =>
          count.class_id === cls.class_id &&
          count.academic_period_id === academicPeriodId,
        )?._count._all ?? 0,
        room: academicPeriodId
          ? roomsByClassPeriod.get(`${cls.class_id}:${academicPeriodId}`) ?? null
          : null,
      }
    })

    return res.json({ data, active_period: activePeriod ? serialize(activePeriod) : null })
  } catch (error) {
    return sendError(res, error, 'Failed to fetch class catalog.')
  }
})

// Class Detail: Students in class for its linked academic period
adminRouter.get('/classes/:classId/students', STAFF_UP, async (req: Request, res: Response) => {
  const classId = parseId(typeof req.params.classId === 'string' ? req.params.classId : undefined)
  if (!classId) return res.status(400).json({ message: 'A valid class ID is required.' })

  try {
    const cls = await prisma.classes.findUnique({
      where: { class_id: classId },
    })
    if (!cls) return res.status(404).json({ message: 'Class not found.' })

    const classPeriod = await prisma.homeroom_assignments.findFirst({
      where: { class_id: classId },
      orderBy: { academic_periods: { start_date: 'desc' } },
      select: {
        academic_period_id: true,
        academic_periods: { select: { academic_year: true } },
      },
    })
    const activePeriod = classPeriod ? null : await getActivePeriod()
    const periodId = classPeriod?.academic_period_id ?? activePeriod?.academic_period_id
    const roomsByClassPeriod = periodId
      ? await getClassRoomsByPeriod([{ classId, academicPeriodId: periodId }])
      : new Map<string, string>()
    const room = periodId
      ? roomsByClassPeriod.get(`${classId}:${periodId}`) ?? null
      : null

    const enrollments = await prisma.student_enrollments.findMany({
      where: {
        class_id: classId,
        ...(periodId ? { academic_period_id: periodId } : {}),
      },
      include: {
        students: {
          include: {
            users: {
              select: {
                is_active: true,
              },
            },
            parent_students: {
              include: {
                parents: {
                  include: {
                    users: {
                      select: {
                        username: true,
                        is_active: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        students: {
          name: 'asc',
        },
      },
    })

    const students = enrollments.map((enr) => {
      const s = enr.students
      let accountStatus: 'Active' | 'Inactive' | 'No account'
      if (!s.user_id) {
        accountStatus = 'No account'
      } else {
        // Fetch user status
        accountStatus = s.users?.is_active ? 'Active' : 'Inactive'
      }
      const parents = s.parent_students.map(({ parents: parent, relationship_type }) => ({
        id: parent.parent_id.toString(),
        name: parent.name,
        username: parent.users.username,
        relationship_type,
        phone_number: parent.phone_number || '',
        address: parent.address || '',
        is_active: parent.users.is_active,
      }))
      return {
        id: s.student_id.toString(),
        enrollment_id: enr.enrollment_id.toString(),
        nis: s.nis,
        name: s.name,
        birth_date: s.birth_date ? s.birth_date.toISOString().slice(0, 10) : '',
        phone_number: s.phone_number || '',
        address: s.address || '',
        gender: s.gender || '',
        account_status: accountStatus,
        parent_status: parents.some((parent) => parent.is_active) ? 'Active' : 'Non-Active',
        parents,
      }
    })

    return res.json({
      data: {
        class: {
          id: cls.class_id.toString(),
          name: cls.name,
          grade_level: cls.grade_level,
          academic_year: classPeriod?.academic_periods.academic_year ?? activePeriod?.academic_year ?? '',
          student_count: students.length,
          room,
        },
        students,
      },
    })
  } catch (error) {
    return sendError(res, error, 'Failed to fetch class students.')
  }
})

// Bulk / Manual Add Students into Class
adminRouter.post('/classes/:classId/students', ADMIN_UP, async (req: Request, res: Response) => {
  const classId = parseId(typeof req.params.classId === 'string' ? req.params.classId : undefined)
  if (!classId) return res.status(400).json({ message: 'A valid class ID is required.' })

  try {
    const cls = await prisma.classes.findUnique({ where: { class_id: classId } })
    if (!cls) return res.status(404).json({ message: 'Class not found.' })

    let activePeriod = await prisma.academic_periods.findFirst({
      where: {
        homeroom_assignments: { some: { class_id: classId } },
      },
      orderBy: { start_date: 'desc' },
    })
    if (!activePeriod) {
      activePeriod = await getActivePeriod()
    }
    if (!activePeriod) {
      activePeriod = await prisma.academic_periods.findFirst({
        orderBy: [{ academic_year: 'desc' }, { semester: 'desc' }],
      })
    }
    if (!activePeriod) {
      return res.status(400).json({ message: 'No academic period found. Please create one first.' })
    }

    // Look up Student role by name
    const studentRole = await prisma.roles.findUnique({
      where: { name: 'Student' },
    })
    if (!studentRole) {
      return res.status(500).json({ message: 'Student role not found in database.' })
    }

    const body = req.body
    const items = Array.isArray(body?.students)
      ? body.students
      : body && typeof body === 'object' && body.nis
      ? [body]
      : []

    if (items.length === 0) {
      return res.status(400).json({ message: 'Please provide at least one student.' })
    }

    const addedStudents = []

    for (const item of items) {
      const nis = String(item.nis || '').trim()
      const name = String(item.name || '').trim()
      if (!nis || !name) continue

      const birthDate = item.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(String(item.birth_date))
        ? new Date(`${item.birth_date}T00:00:00.000Z`)
        : null
      const phone = item.phone_number ? String(item.phone_number).trim() : null
      const address = item.address ? String(item.address).trim() : null

      // Find or create student by NIS
      let student = await prisma.students.findUnique({ where: { nis } })
      let initialPassword: string | null = null

      if (!student) {
        // Generate random password and create user account
        initialPassword = generateRandomPassword()
        const passwordHash = await hashPassword(initialPassword)

        const user = await prisma.users.create({
          data: {
            username: nis,
            password_hash: passwordHash,
            role_id: studentRole.role_id,
            is_active: true,
          },
        })

        student = await prisma.students.create({
          data: {
            nis,
            name,
            birth_date: birthDate,
            phone_number: phone,
            address,
            user_id: user.user_id,
          },
        })
      } else {
        // Update basic info if provided
        student = await prisma.students.update({
          where: { student_id: student.student_id },
          data: {
            name,
            birth_date: birthDate ?? student.birth_date,
            phone_number: phone ?? student.phone_number,
            address: address ?? student.address,
          },
        })
      }

      // Ensure enrolled in this class for the active academic period
      const existingEnrollment = await prisma.student_enrollments.findFirst({
        where: {
          student_id: student.student_id,
          academic_period_id: activePeriod.academic_period_id,
        },
      })

      if (!existingEnrollment) {
        await prisma.student_enrollments.create({
          data: {
            student_id: student.student_id,
            class_id: classId,
            academic_period_id: activePeriod.academic_period_id,
          },
        })
      } else if (existingEnrollment.class_id !== classId) {
        // Update enrollment to current class
        await prisma.student_enrollments.update({
          where: { enrollment_id: existingEnrollment.enrollment_id },
          data: { class_id: classId },
        })
      }

      addedStudents.push({
        id: student.student_id.toString(),
        nis: student.nis,
        name: student.name,
        birth_date: student.birth_date ? student.birth_date.toISOString().slice(0, 10) : '',
        phone_number: student.phone_number || '',
        address: student.address || '',
        account_status: student.user_id ? 'Active' : 'No account',
        initial_password: initialPassword, // Only included for newly created students
      })
    }

    return res.status(201).json({
      message: `Enrolled ${addedStudents.length} student(s) successfully.`,
      data: addedStudents,
    })
  } catch (error) {
    return sendError(res, error, 'Failed to add students to class.')
  }
})

// Remove student enrollment from class
adminRouter.delete('/classes/:classId/students/:studentId', ADMIN_UP, async (req: Request, res: Response) => {
  const classId = parseId(typeof req.params.classId === 'string' ? req.params.classId : undefined)
  const studentId = parseId(typeof req.params.studentId === 'string' ? req.params.studentId : undefined)
  if (!classId || !studentId) {
    return res.status(400).json({ message: 'A valid class ID and student ID are required.' })
  }

  try {
    const classPeriod = await prisma.homeroom_assignments.findFirst({
      where: { class_id: classId },
      orderBy: { academic_periods: { start_date: 'desc' } },
      select: { academic_period_id: true },
    })
    const activePeriod = classPeriod ? null : await getActivePeriod()
    await prisma.student_enrollments.deleteMany({
      where: {
        class_id: classId,
        student_id: studentId,
        ...((classPeriod?.academic_period_id ?? activePeriod?.academic_period_id)
          ? { academic_period_id: classPeriod?.academic_period_id ?? activePeriod?.academic_period_id }
          : {}),
      },
    })
    return res.status(204).end()
  } catch (error) {
    return sendError(res, error, 'Failed to remove student from class.')
  }
})

// Reset student password
adminRouter.post('/students/:id/reset-password', ADMIN_UP, async (req: Request, res: Response) => {
  const studentId = parseId(typeof req.params.id === 'string' ? req.params.id : undefined)
  if (!studentId) {
    return res.status(400).json({ message: 'A valid student ID is required.' })
  }

  try {
    const student = await prisma.students.findUnique({
      where: { student_id: studentId },
      include: { users: true },
    })

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' })
    }

    // Look up Student role by name
    const studentRole = await prisma.roles.findUnique({
      where: { name: 'Student' },
    })
    if (!studentRole) {
      return res.status(500).json({ message: 'Student role not found in database.' })
    }

    // Generate new random password
    const newPassword = generateRandomPassword()
    const passwordHash = await hashPassword(newPassword)

    let userId: bigint

    if (student.user_id) {
      // Update existing user's password
      userId = student.user_id
      await prisma.users.update({
        where: { user_id: userId },
        data: {
          password_hash: passwordHash,
          is_active: true,
        },
      })
    } else {
      // Create new user account for student
      const user = await prisma.users.create({
        data: {
          username: student.nis,
          password_hash: passwordHash,
          role_id: studentRole.role_id,
          is_active: true,
        },
      })
      userId = user.user_id

      // Link user to student
      await prisma.students.update({
        where: { student_id: studentId },
        data: { user_id: userId },
      })
    }

    return res.json({
      message: 'Password reset successfully.',
      data: {
        student_id: student.student_id.toString(),
        nis: student.nis,
        initial_password: newPassword, // Return only once
      },
    })
  } catch (error) {
    return sendError(res, error, 'Failed to reset student password.')
  }
})

export default adminRouter
