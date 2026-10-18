import prisma from '../db'

type ServiceResult<T = unknown> = {
  statusCode: number
  body: T
}

type SessionUser = {
  userId: string
  role: string
}

interface RawGradeItem {
  student_id?: unknown
  studentId?: unknown
  score?: unknown
  assessment_type?: unknown
  assessmentType?: unknown
  assessment_name?: unknown
  assessmentName?: unknown
}

function result<T>(statusCode: number, body: T): ServiceResult<T> {
  return { statusCode, body }
}

function parseBigIntSafe(value: unknown): bigint | null {
  if (value === undefined || value === null || value === '') return null
  try {
    const parsed = BigInt(value.toString())
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}

function parseScore(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const score = Number(value)
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null
}

async function getTeacherProfileByUserId(userId: string) {
  return prisma.teachers.findUnique({
    where: { user_id: BigInt(userId) },
    select: { teacher_id: true, name: true, employee_number: true },
  })
}

export async function saveGrades(body: Record<string, unknown>, user: SessionUser): Promise<ServiceResult> {
  const role = user.role.toLowerCase()
  const resolvedAssignmentId = parseBigIntSafe(body.teaching_assignment_id ?? body.teachingAssignmentId)
  const resolvedClassId = parseBigIntSafe(body.class_id ?? body.classId)
  const resolvedSubjectId = parseBigIntSafe(body.subject_id ?? body.subjectId)
  const resolvedPeriodId = parseBigIntSafe(body.academic_period_id ?? body.academicPeriodId)
  let targetAssignment = null

  if (resolvedAssignmentId) {
    targetAssignment = await prisma.teaching_assignments.findUnique({
      where: { teaching_assignment_id: resolvedAssignmentId },
      include: {
        classes: { select: { name: true } },
        subjects: { select: { name: true, code: true } },
      },
    })
  } else if (resolvedClassId && resolvedSubjectId) {
    targetAssignment = await prisma.teaching_assignments.findFirst({
      where: {
        class_id: resolvedClassId,
        subject_id: resolvedSubjectId,
        ...(resolvedPeriodId ? { academic_period_id: resolvedPeriodId } : {}),
      },
      include: {
        classes: { select: { name: true } },
        subjects: { select: { name: true, code: true } },
      },
      orderBy: { academic_period_id: 'desc' },
    })
  }

  if (!targetAssignment) {
    return result(404, {
      message: 'Teaching assignment not found. Please provide a valid teaching_assignment_id or (class_id and subject_id).',
    })
  }

  if (role === 'teacher' || role === 'homeroom') {
    const teacher = await getTeacherProfileByUserId(user.userId)
    if (!teacher || teacher.teacher_id !== targetAssignment.teacher_id) {
      return result(403, {
        message: teacher
          ? `Forbidden. You do not have permission to grade for class "${targetAssignment.classes.name}" and subject "${targetAssignment.subjects.name}". You are not assigned to this class and subject.`
          : 'Forbidden. Teacher profile not found for authenticated account.',
      })
    }
  }

  const rawGradeList: RawGradeItem[] = Array.isArray(body.grades)
    ? body.grades as RawGradeItem[]
    : body.student_id !== undefined || body.studentId !== undefined || body.score !== undefined
      ? [{
          student_id: body.student_id ?? body.studentId,
          score: body.score,
          assessment_type: body.assessment_type ?? body.assessmentType,
          assessment_name: body.assessment_name ?? body.assessmentName,
        }]
      : []

  if (rawGradeList.length === 0) {
    return result(400, {
      message: 'No grade records provided. Please provide an array in "grades" or single grade fields.',
    })
  }

  const defaultAssessmentType = normalizeOptionalText(body.assessment_type ?? body.assessmentType)
  const defaultAssessmentName = normalizeOptionalText(body.assessment_name ?? body.assessmentName)
  const validationErrors: string[] = []
  const validatedGrades: {
    studentId: bigint
    assessmentType: string
    assessmentName: string
    score: number
  }[] = []

  rawGradeList.forEach((item, index) => {
    const studentId = parseBigIntSafe(item.student_id ?? item.studentId)
    const score = parseScore(item.score)
    const rawType = item.assessment_type ?? item.assessmentType
    const rawName = item.assessment_name ?? item.assessmentName
    const assessmentType = typeof rawType === 'string' ? rawType.trim() : defaultAssessmentType
    const assessmentName = typeof rawName === 'string' ? rawName.trim() : defaultAssessmentName

    if (!studentId) {
      validationErrors.push(`Grade item index ${index}: Invalid or missing student_id.`)
      return
    }
    if (score === null) {
      validationErrors.push(`Grade item index ${index}: Invalid score "${String(item.score)}". Score must be a valid number between 0 and 100.`)
      return
    }
    if (!assessmentType) {
      validationErrors.push(`Grade item index ${index}: Missing assessment_type (e.g., 'ASSIGNMENT', 'QUIZ', 'MID_EXAM', 'FINAL_EXAM').`)
      return
    }
    if (!assessmentName) {
      validationErrors.push(`Grade item index ${index}: Missing assessment_name (e.g., 'Ulangan Harian 1', 'UTS').`)
      return
    }

    validatedGrades.push({ studentId, assessmentType, assessmentName, score })
  })

  if (validationErrors.length > 0) {
    return result(400, {
      message: 'Validation failed for one or more grade items.',
      errors: validationErrors,
    })
  }

  const uniqueStudentIds = [...new Set(validatedGrades.map((item) => item.studentId.toString()))]
    .map((id) => BigInt(id))
  const enrolledStudents = await prisma.student_enrollments.findMany({
    where: {
      class_id: targetAssignment.class_id,
      student_id: { in: uniqueStudentIds },
    },
    select: {
      student_id: true,
      students: { select: { student_id: true, name: true, nis: true } },
    },
  })
  const enrolledStudentIds = new Set(enrolledStudents.map((item) => item.student_id.toString()))
  const notEnrolledIds = uniqueStudentIds.filter((id) => !enrolledStudentIds.has(id.toString()))

  if (notEnrolledIds.length > 0) {
    return result(400, {
      message: `The following student ID(s) are not enrolled in class "${targetAssignment.classes.name}": ${notEnrolledIds.map((id) => id.toString()).join(', ')}.`,
    })
  }

  const savedGrades = await prisma.$transaction(
    validatedGrades.map((item) =>
      prisma.grades.upsert({
        where: {
          student_id_teaching_assignment_id_assessment_name: {
            student_id: item.studentId,
            teaching_assignment_id: targetAssignment.teaching_assignment_id,
            assessment_name: item.assessmentName,
          },
        },
        update: {
          assessment_type: item.assessmentType,
          score: item.score,
          updated_at: new Date(),
        },
        create: {
          student_id: item.studentId,
          teaching_assignment_id: targetAssignment.teaching_assignment_id,
          assessment_type: item.assessmentType,
          assessment_name: item.assessmentName,
          score: item.score,
        },
        select: {
          grade_id: true,
          student_id: true,
          teaching_assignment_id: true,
          assessment_type: true,
          assessment_name: true,
          score: true,
          updated_at: true,
        },
      })
    )
  )

  const data = savedGrades.map((grade) => ({
    grade_id: grade.grade_id.toString(),
    teaching_assignment_id: grade.teaching_assignment_id.toString(),
    student_id: grade.student_id.toString(),
    assessment_type: grade.assessment_type,
    assessment_name: grade.assessment_name,
    score: Number(grade.score),
    updated_at: grade.updated_at,
  }))

  return result(200, {
    message: `Successfully saved ${data.length} grade record(s).`,
    count: data.length,
    data,
  })
}

export async function getGradesByClassAndSubject(
  classIdValue: unknown,
  subjectIdValue: unknown,
  filters: { assessment_name?: unknown; assessment_type?: unknown },
  user: SessionUser
): Promise<ServiceResult> {
  const classId = parseBigIntSafe(classIdValue)
  const subjectId = parseBigIntSafe(subjectIdValue)
  if (!classId || !subjectId) {
    return result(400, { message: 'Invalid classId or subjectId in URL parameters.' })
  }

  const assignments = await prisma.teaching_assignments.findMany({
    where: { class_id: classId, subject_id: subjectId },
    include: {
      classes: { select: { class_id: true, name: true, grade_level: true } },
      subjects: { select: { subject_id: true, name: true, code: true } },
      academic_periods: { select: { academic_period_id: true, academic_year: true, semester: true } },
    },
  })
  if (assignments.length === 0) {
    return result(404, { message: 'No teaching assignment found for the specified class and subject.' })
  }

  const role = user.role.toLowerCase()
  if (role === 'teacher' || role === 'homeroom') {
    const teacher = await getTeacherProfileByUserId(user.userId)
    if (!teacher) return result(403, { message: 'Forbidden. Teacher profile not found for authenticated account.' })
    if (!assignments.some((assignment) => assignment.teacher_id === teacher.teacher_id)) {
      return result(403, {
        message: `Forbidden. You do not have permission to view grades for class "${assignments[0].classes.name}" and subject "${assignments[0].subjects.name}". You are not assigned to this class and subject.`,
      })
    }
  }

  const assignmentIds = assignments.map((assignment) => assignment.teaching_assignment_id)
  const enrolledStudents = await prisma.student_enrollments.findMany({
    where: { class_id: classId },
    include: {
      students: { select: { student_id: true, nis: true, name: true } },
    },
    orderBy: { students: { name: 'asc' } },
  })

  const assessmentName = typeof filters.assessment_name === 'string' ? filters.assessment_name.trim() : ''
  const assessmentType = typeof filters.assessment_type === 'string' ? filters.assessment_type.trim().toUpperCase() : ''
  const grades = await prisma.grades.findMany({
    where: {
      teaching_assignment_id: { in: assignmentIds },
      ...(assessmentName ? { assessment_name: assessmentName } : {}),
      ...(assessmentType ? { assessment_type: assessmentType } : {}),
    },
    include: {
      students: { select: { student_id: true, nis: true, name: true } },
      teaching_assignments: {
        select: { academic_periods: { select: { academic_year: true, semester: true } } },
      },
    },
    orderBy: [{ assessment_name: 'asc' }, { students: { name: 'asc' } }],
  })

  const assignment = assignments[0]
  return result(200, {
    data: {
      class: {
        id: assignment.classes.class_id.toString(),
        name: assignment.classes.name,
        grade_level: assignment.classes.grade_level,
      },
      subject: {
        id: assignment.subjects.subject_id.toString(),
        name: assignment.subjects.name,
        code: assignment.subjects.code,
      },
      enrolled_students: enrolledStudents.map((enrollment) => ({
        student_id: enrollment.students.student_id.toString(),
        nis: enrollment.students.nis,
        name: enrollment.students.name,
      })),
      grades: grades.map((grade) => ({
        grade_id: grade.grade_id.toString(),
        teaching_assignment_id: grade.teaching_assignment_id.toString(),
        student_id: grade.student_id.toString(),
        student_nis: grade.students.nis,
        student_name: grade.students.name,
        assessment_type: grade.assessment_type,
        assessment_name: grade.assessment_name,
        score: Number(grade.score),
        academic_year: grade.teaching_assignments.academic_periods.academic_year,
        semester: grade.teaching_assignments.academic_periods.semester,
        updated_at: grade.updated_at,
      })),
    },
  })
}
