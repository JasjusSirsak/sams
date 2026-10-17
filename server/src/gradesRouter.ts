import { Router, type Request, type Response } from 'express'
import prisma from './db'
import { requireAuth, requireRole } from './auth'

const gradesRouter = Router()

/**
 * Helper to safely parse BigInt from string/number
 */
function parseBigIntSafe(val: unknown): bigint | null {
  if (val === undefined || val === null || val === '') return null
  try {
    return BigInt(val.toString())
  } catch {
    return null
  }
}

/**
 * Helper to safely parse and validate score (0.00 to 100.00)
 */
function parseScoreSafe(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null
  const num = Number(val)
  if (isNaN(num) || num < 0 || num > 100) return null
  return num
}

/**
 * Helper: Retrieve teacher profile for authenticated user
 */
async function getTeacherProfileByUserId(userId: string) {
  return await prisma.teachers.findUnique({
    where: { user_id: BigInt(userId) },
    select: { teacher_id: true, name: true, employee_number: true },
  })
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

/**
 * POST /api/grades
 * Create or update student grades with strict teacher teaching_assignments authorization.
 */
gradesRouter.post(
  '/',
  requireAuth,
  requireRole('teacher', 'homeroom', 'staff', 'admin'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const userRole = (sessionUser.role || '').toLowerCase()

      const {
        teaching_assignment_id,
        teachingAssignmentId,
        class_id,
        classId,
        subject_id,
        subjectId,
        academic_period_id,
        academicPeriodId,
        // Assessment metadata
        assessment_type,
        assessmentType,
        assessment_name,
        assessmentName,
        // Records
        grades,
        // Single record fields
        student_id,
        studentId,
        score,
      } = req.body

      const resolvedAssignmentId = parseBigIntSafe(teaching_assignment_id ?? teachingAssignmentId)
      const resolvedClassId = parseBigIntSafe(class_id ?? classId)
      const resolvedSubjectId = parseBigIntSafe(subject_id ?? subjectId)
      const resolvedPeriodId = parseBigIntSafe(academic_period_id ?? academicPeriodId)

      // 1. Identify or verify teaching assignment
      let targetAssignment: {
        teaching_assignment_id: bigint
        teacher_id: bigint
        class_id: bigint
        subject_id: bigint
        academic_period_id: bigint
        classes: { name: string }
        subjects: { name: string; code: string }
      } | null = null

      if (resolvedAssignmentId) {
        targetAssignment = await prisma.teaching_assignments.findUnique({
          where: { teaching_assignment_id: resolvedAssignmentId },
          include: {
            classes: { select: { name: true } },
            subjects: { select: { name: true, code: true } },
          },
        })
      } else if (resolvedClassId && resolvedSubjectId) {
        // Query by class_id and subject_id
        const whereClause: any = {
          class_id: resolvedClassId,
          subject_id: resolvedSubjectId,
        }
        if (resolvedPeriodId) {
          whereClause.academic_period_id = resolvedPeriodId
        }

        targetAssignment = await prisma.teaching_assignments.findFirst({
          where: whereClause,
          include: {
            classes: { select: { name: true } },
            subjects: { select: { name: true, code: true } },
          },
          orderBy: { academic_period_id: 'desc' },
        })
      }

      if (!targetAssignment) {
        return res.status(404).json({
          message:
            'Teaching assignment not found. Please provide a valid teaching_assignment_id or (class_id and subject_id).',
        })
      }

      // 2. Strict Teacher Authorization Check
      // If user is a teacher or homeroom, verify they own this teaching assignment
      if (userRole === 'teacher' || userRole === 'homeroom') {
        const teacherProfile = await getTeacherProfileByUserId(sessionUser.userId)

        if (!teacherProfile) {
          return res.status(403).json({
            message: 'Forbidden. Teacher profile not found for authenticated account.',
          })
        }

        if (teacherProfile.teacher_id !== targetAssignment.teacher_id) {
          return res.status(403).json({
            message: `Forbidden. You do not have permission to grade for class "${targetAssignment.classes.name}" and subject "${targetAssignment.subjects.name}". You are not assigned to this class and subject.`,
          })
        }
      }

      // 3. Normalize grade items payload
      let rawGradeList: RawGradeItem[] = []

      if (Array.isArray(grades)) {
        rawGradeList = grades
      } else if (student_id !== undefined || studentId !== undefined || score !== undefined) {
        rawGradeList = [
          {
            student_id: student_id ?? studentId,
            score,
            assessment_type: assessment_type ?? assessmentType,
            assessment_name: assessment_name ?? assessmentName,
          },
        ]
      }

      if (rawGradeList.length === 0) {
        return res.status(400).json({
          message:
            'No grade records provided. Please provide an array in "grades" or single grade fields.',
        })
      }

      // 4. Validate assessment properties and student scores
      interface ValidatedGradeItem {
        studentId: bigint
        assessmentType: string
        assessmentName: string
        score: number
      }

      const defaultAssessmentType =
        typeof (assessment_type ?? assessmentType) === 'string'
          ? (assessment_type ?? assessmentType).trim()
          : null
      const defaultAssessmentName =
        typeof (assessment_name ?? assessmentName) === 'string'
          ? (assessment_name ?? assessmentName).trim()
          : null

      const validatedList: ValidatedGradeItem[] = []
      const errors: string[] = []

      for (let i = 0; i < rawGradeList.length; i++) {
        const item = rawGradeList[i]
        const sId = parseBigIntSafe(item.student_id ?? item.studentId)
        const parsedScore = parseScoreSafe(item.score)
        const itemType =
          typeof (item.assessment_type ?? item.assessmentType) === 'string'
            ? (item.assessment_type ?? item.assessmentType).trim()
            : defaultAssessmentType
        const itemName =
          typeof (item.assessment_name ?? item.assessmentName) === 'string'
            ? (item.assessment_name ?? item.assessmentName).trim()
            : defaultAssessmentName

        if (!sId) {
          errors.push(`Grade item index ${i}: Invalid or missing student_id.`)
          continue
        }

        if (parsedScore === null) {
          errors.push(
            `Grade item index ${i}: Invalid score "${item.score}". Score must be a valid number between 0 and 100.`
          )
          continue
        }

        if (!itemType) {
          errors.push(
            `Grade item index ${i}: Missing assessment_type (e.g., 'ASSIGNMENT', 'QUIZ', 'MID_EXAM', 'FINAL_EXAM').`
          )
          continue
        }

        if (!itemName) {
          errors.push(
            `Grade item index ${i}: Missing assessment_name (e.g., 'Ulangan Harian 1', 'UTS').`
          )
          continue
        }

        validatedList.push({
          studentId: sId,
          assessmentType: itemType,
          assessmentName: itemName,
          score: parsedScore,
        })
      }

      if (errors.length > 0) {
        return res.status(400).json({
          message: 'Validation failed for one or more grade items.',
          errors,
        })
      }

      // 5. Verify students exist and are enrolled in the target class
      const uniqueStudentIds = Array.from(new Set(validatedList.map((item) => item.studentId)))
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

      const enrolledStudentIdSet = new Set(enrolledStudents.map((e) => e.student_id.toString()))
      const notEnrolledStudentIds = uniqueStudentIds.filter(
        (id) => !enrolledStudentIdSet.has(id.toString())
      )

      if (notEnrolledStudentIds.length > 0) {
        return res.status(400).json({
          message: `The following student ID(s) are not enrolled in class "${targetAssignment.classes.name}": ${notEnrolledStudentIds.map((id) => id.toString()).join(', ')}.`,
        })
      }

      // 6. Execute upsert operations in an atomic transaction
      const upsertOperations = validatedList.map((item) => {
        return prisma.grades.upsert({
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
      })

      const savedGrades = await prisma.$transaction(upsertOperations)

      const formattedResults = savedGrades.map((g) => ({
        grade_id: g.grade_id.toString(),
        teaching_assignment_id: g.teaching_assignment_id.toString(),
        student_id: g.student_id.toString(),
        assessment_type: g.assessment_type,
        assessment_name: g.assessment_name,
        score: Number(g.score),
        updated_at: g.updated_at,
      }))

      return res.status(200).json({
        message: `Successfully saved ${formattedResults.length} grade record(s).`,
        count: formattedResults.length,
        data: formattedResults,
      })
    } catch (error) {
      console.error('Failed to save student grades:', error)
      return res.status(500).json({
        message: 'Internal server error while saving grades.',
      })
    }
  }
)

/**
 * GET /api/grades/class/:classId/subject/:subjectId
 * Retrieve grades for a specific class and subject taught by the authenticated teacher.
 */
gradesRouter.get(
  '/class/:classId/subject/:subjectId',
  requireAuth,
  requireRole('teacher', 'homeroom', 'staff', 'admin'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const userRole = (sessionUser.role || '').toLowerCase()

      const classId = parseBigIntSafe(req.params.classId)
      const subjectId = parseBigIntSafe(req.params.subjectId)
      const assessmentNameQuery = req.query.assessment_name as string | undefined
      const assessmentTypeQuery = req.query.assessment_type as string | undefined

      if (!classId || !subjectId) {
        return res.status(400).json({
          message: 'Invalid classId or subjectId in URL parameters.',
        })
      }

      // 1. Find teaching assignments for this class and subject
      const teachingAssignments = await prisma.teaching_assignments.findMany({
        where: {
          class_id: classId,
          subject_id: subjectId,
        },
        include: {
          classes: { select: { class_id: true, name: true, grade_level: true } },
          subjects: { select: { subject_id: true, name: true, code: true } },
          academic_periods: {
            select: { academic_period_id: true, academic_year: true, semester: true },
          },
        },
      })

      if (teachingAssignments.length === 0) {
        return res.status(404).json({
          message: 'No teaching assignment found for the specified class and subject.',
        })
      }

      // 2. Strict Teacher Authorization Check
      // If user is a teacher or homeroom, ensure they are assigned to this class and subject
      if (userRole === 'teacher' || userRole === 'homeroom') {
        const teacherProfile = await getTeacherProfileByUserId(sessionUser.userId)

        if (!teacherProfile) {
          return res.status(403).json({
            message: 'Forbidden. Teacher profile not found for authenticated account.',
          })
        }

        const isAssigned = teachingAssignments.some(
          (ta) => ta.teacher_id === teacherProfile.teacher_id
        )

        if (!isAssigned) {
          return res.status(403).json({
            message: `Forbidden. You do not have permission to view grades for class "${teachingAssignments[0]?.classes.name}" and subject "${teachingAssignments[0]?.subjects.name}". You are not assigned to this class and subject.`,
          })
        }
      }

      const assignmentIds = teachingAssignments.map((ta) => ta.teaching_assignment_id)

      // 3. Fetch all enrolled students in the class
      const enrolledStudents = await prisma.student_enrollments.findMany({
        where: { class_id: classId },
        include: {
          students: {
            select: {
              student_id: true,
              nis: true,
              name: true,
            },
          },
        },
        orderBy: { students: { name: 'asc' } },
      })

      // 4. Fetch grade records
      const gradeWhere: any = {
        teaching_assignment_id: { in: assignmentIds },
      }

      if (assessmentNameQuery) {
        gradeWhere.assessment_name = assessmentNameQuery.trim()
      }

      if (assessmentTypeQuery) {
        gradeWhere.assessment_type = assessmentTypeQuery.trim().toUpperCase()
      }

      const gradesList = await prisma.grades.findMany({
        where: gradeWhere,
        include: {
          students: { select: { student_id: true, nis: true, name: true } },
          teaching_assignments: {
            select: {
              academic_periods: {
                select: { academic_year: true, semester: true },
              },
            },
          },
        },
        orderBy: [{ assessment_name: 'asc' }, { students: { name: 'asc' } }],
      })

      const primaryAssignment = teachingAssignments[0]

      return res.status(200).json({
        data: {
          class: {
            id: primaryAssignment.classes.class_id.toString(),
            name: primaryAssignment.classes.name,
            grade_level: primaryAssignment.classes.grade_level,
          },
          subject: {
            id: primaryAssignment.subjects.subject_id.toString(),
            name: primaryAssignment.subjects.name,
            code: primaryAssignment.subjects.code,
          },
          enrolled_students: enrolledStudents.map((e) => ({
            student_id: e.students.student_id.toString(),
            nis: e.students.nis,
            name: e.students.name,
          })),
          grades: gradesList.map((g) => ({
            grade_id: g.grade_id.toString(),
            teaching_assignment_id: g.teaching_assignment_id.toString(),
            student_id: g.student_id.toString(),
            student_nis: g.students.nis,
            student_name: g.students.name,
            assessment_type: g.assessment_type,
            assessment_name: g.assessment_name,
            score: Number(g.score),
            academic_year: g.teaching_assignments.academic_periods.academic_year,
            semester: g.teaching_assignments.academic_periods.semester,
            updated_at: g.updated_at,
          })),
        },
      })
    } catch (error) {
      console.error('Failed to retrieve grades for class and subject:', error)
      return res.status(500).json({
        message: 'Internal server error while retrieving grades.',
      })
    }
  }
)

export default gradesRouter
