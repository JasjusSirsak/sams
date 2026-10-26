import prisma from '../db'

const MAX_PAGE_SIZE = 100

export type StudentEnrollmentInput = {
  student_id: string
  class_id: string
  academic_period_id: string
}

export type StudentEnrollmentPatch = Partial<StudentEnrollmentInput>

export type EnrollmentPagination = {
  page: number
  limit: number
}

export type StudentEnrollmentRecord = {
  enrollment_id: string
  student_id: string
  class_id: string
  academic_period_id: string
}

export class EnrollmentServiceError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409) {
    super(message)
  }
}

function serializeEnrollment(enrollment: {
  enrollment_id: bigint
  student_id: bigint
  class_id: bigint
  academic_period_id: bigint
}): StudentEnrollmentRecord {
  return {
    enrollment_id: enrollment.enrollment_id.toString(),
    student_id: enrollment.student_id.toString(),
    class_id: enrollment.class_id.toString(),
    academic_period_id: enrollment.academic_period_id.toString(),
  }
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

async function validateForeignKeys(input: StudentEnrollmentInput): Promise<void> {
  const studentId = BigInt(input.student_id)
  const classId = BigInt(input.class_id)
  const academicPeriodId = BigInt(input.academic_period_id)

  const [student, classRecord, academicPeriod] = await Promise.all([
    prisma.students.findUnique({ where: { student_id: studentId }, select: { student_id: true } }),
    prisma.classes.findUnique({ where: { class_id: classId }, select: { class_id: true } }),
    prisma.academic_periods.findUnique({
      where: { academic_period_id: academicPeriodId },
      select: { academic_period_id: true },
    }),
  ])

  const missing: string[] = []
  if (!student) missing.push('student_id')
  if (!classRecord) missing.push('class_id')
  if (!academicPeriod) missing.push('academic_period_id')

  if (missing.length > 0) {
    throw new EnrollmentServiceError(`Referenced record(s) not found: ${missing.join(', ')}.`, 404)
  }
}

async function ensureNoDuplicate(
  studentId: bigint,
  academicPeriodId: bigint,
  excludeEnrollmentId?: bigint,
): Promise<void> {
  const duplicate = await prisma.student_enrollments.findFirst({
    where: {
      student_id: studentId,
      academic_period_id: academicPeriodId,
      ...(excludeEnrollmentId ? { enrollment_id: { not: excludeEnrollmentId } } : {}),
    },
    select: { enrollment_id: true },
  })

  if (duplicate) {
    throw new EnrollmentServiceError(
      'This student already has an enrollment for the specified academic period.',
      409,
    )
  }
}

async function translateWriteError(error: unknown): Promise<never> {
  if (isPrismaErrorCode(error, 'P2002')) {
    throw new EnrollmentServiceError(
      'This student already has an enrollment for the specified academic period.',
      409,
    )
  }

  if (isPrismaErrorCode(error, 'P2003')) {
    throw new EnrollmentServiceError(
      'A referenced student, class, or academic period was not found.',
      404,
    )
  }

  throw error
}

export async function listStudentEnrollments({ page, limit }: EnrollmentPagination) {
  if (limit > MAX_PAGE_SIZE) {
    throw new EnrollmentServiceError(`limit must not exceed ${MAX_PAGE_SIZE}.`, 400)
  }

  const [enrollments, total] = await Promise.all([
    prisma.student_enrollments.findMany({
      orderBy: { enrollment_id: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student_enrollments.count(),
  ])

  return {
    data: enrollments.map(serializeEnrollment),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getStudentEnrollment(id: string): Promise<StudentEnrollmentRecord> {
  const enrollment = await prisma.student_enrollments.findUnique({
    where: { enrollment_id: BigInt(id) },
  })
  if (!enrollment) throw new EnrollmentServiceError('Student enrollment not found.', 404)
  return serializeEnrollment(enrollment)
}

export async function createStudentEnrollment(
  input: StudentEnrollmentInput,
): Promise<StudentEnrollmentRecord> {
  await validateForeignKeys(input)
  await ensureNoDuplicate(BigInt(input.student_id), BigInt(input.academic_period_id))

  try {
    const enrollment = await prisma.student_enrollments.create({
      data: {
        student_id: BigInt(input.student_id),
        class_id: BigInt(input.class_id),
        academic_period_id: BigInt(input.academic_period_id),
      },
    })
    return serializeEnrollment(enrollment)
  } catch (error) {
    return translateWriteError(error)
  }
}

export async function updateStudentEnrollment(
  id: string,
  patch: StudentEnrollmentPatch,
): Promise<StudentEnrollmentRecord> {
  const enrollmentId = BigInt(id)
  const existing = await prisma.student_enrollments.findUnique({
    where: { enrollment_id: enrollmentId },
  })
  if (!existing) throw new EnrollmentServiceError('Student enrollment not found.', 404)

  const input: StudentEnrollmentInput = {
    student_id: patch.student_id ?? existing.student_id.toString(),
    class_id: patch.class_id ?? existing.class_id.toString(),
    academic_period_id: patch.academic_period_id ?? existing.academic_period_id.toString(),
  }

  if (patch.class_id !== undefined) {
    await validateForeignKeys(input)
  } else if (patch.student_id !== undefined || patch.academic_period_id !== undefined) {
    const [student, academicPeriod] = await Promise.all([
      prisma.students.findUnique({
        where: { student_id: BigInt(input.student_id) },
        select: { student_id: true },
      }),
      prisma.academic_periods.findUnique({
        where: { academic_period_id: BigInt(input.academic_period_id) },
        select: { academic_period_id: true },
      }),
    ])
    const missing: string[] = []
    if (!student) missing.push('student_id')
    if (!academicPeriod) missing.push('academic_period_id')
    if (missing.length > 0) {
      throw new EnrollmentServiceError(`Referenced record(s) not found: ${missing.join(', ')}.`, 404)
    }
  }

  if (patch.student_id !== undefined || patch.academic_period_id !== undefined) {
    await ensureNoDuplicate(
      BigInt(input.student_id),
      BigInt(input.academic_period_id),
      enrollmentId,
    )
  }

  try {
    const enrollment = await prisma.student_enrollments.update({
      where: { enrollment_id: enrollmentId },
      data: {
        ...(patch.student_id !== undefined ? { student_id: BigInt(patch.student_id) } : {}),
        ...(patch.class_id !== undefined ? { class_id: BigInt(patch.class_id) } : {}),
        ...(patch.academic_period_id !== undefined
          ? { academic_period_id: BigInt(patch.academic_period_id) }
          : {}),
      },
    })
    return serializeEnrollment(enrollment)
  } catch (error) {
    return translateWriteError(error)
  }
}

export async function deleteStudentEnrollment(id: string): Promise<void> {
  try {
    await prisma.student_enrollments.delete({ where: { enrollment_id: BigInt(id) } })
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2025')) {
      throw new EnrollmentServiceError('Student enrollment not found.', 404)
    }
    if (isPrismaErrorCode(error, 'P2003')) {
      throw new EnrollmentServiceError('Student enrollment is still referenced and cannot be deleted.', 409)
    }
    throw error
  }
}