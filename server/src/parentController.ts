import type { Request, Response } from 'express'
import prisma from './db'
import { parseBigIntSafe } from './parentAuth'

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export async function getParentChildren(req: Request, res: Response) {
  try {
    const parent = await prisma.parents.findUnique({
      where: { user_id: BigInt(req.user!.userId) },
      include: {
        parent_students: {
          include: {
            students: {
              include: {
                student_enrollments: {
                  include: {
                    classes: {
                      select: {
                        class_id: true,
                        name: true,
                        grade_level: true,
                      },
                    },
                    academic_periods: {
                      select: {
                        academic_year: true,
                        semester: true,
                      },
                    },
                  },
                  orderBy: { academic_period_id: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })

    if (!parent) {
      return res.status(404).json({ message: 'Parent profile not found for this user.' })
    }

    const children = parent.parent_students.map(({ students: student, relationship_type }) => {
      const enrollment = student.student_enrollments[0]
      const className = enrollment?.classes.name ?? 'Unassigned'
      const classId = enrollment?.classes.class_id.toString() ?? null
      const studentId = student.student_id.toString()

      return {
        id: studentId,
        student_id: studentId,
        studentId,
        name: student.name,
        initials: getInitials(student.name),
        avatar: getInitials(student.name),
        nis: student.nis,
        cls: className,
        class_name: className,
        className,
        class_id: classId,
        classId,
        relationship_type: relationship_type ?? 'Parent',
        academic_year: enrollment?.academic_periods.academic_year ?? null,
        semester: enrollment?.academic_periods.semester ?? null,
      }
    })

    return res.status(200).json({ count: children.length, data: children })
  } catch (error) {
    console.error('Failed to fetch parent children:', error)
    return res.status(500).json({ message: 'Internal server error while fetching children list.' })
  }
}

export async function getChildAttendance(req: Request, res: Response) {
  const studentId = parseBigIntSafe(req.params.studentId)
  if (!studentId || studentId < 1n) {
    return res.status(400).json({ message: 'A valid studentId is required.' })
  }

  try {
    const parent = await prisma.parents.findUnique({
      where: { user_id: BigInt(req.user!.userId) },
      select: { parent_id: true },
    })

    if (!parent) {
      return res.status(404).json({ message: 'Parent profile not found for this user.' })
    }

    const relationship = await prisma.parent_students.findUnique({
      where: {
        parent_id_student_id: {
          parent_id: parent.parent_id,
          student_id: studentId,
        },
      },
      select: { student_id: true },
    })

    if (!relationship) {
      return res.status(403).json({ message: 'You do not have access to this child.' })
    }

    const records = await prisma.attendance_records.findMany({
      where: { student_id: studentId },
      include: {
        attendance_sessions: {
          select: {
            attendance_date: true,
            classes: { select: { name: true } },
          },
        },
      },
      orderBy: { attendance_sessions: { attendance_date: 'desc' } },
      take: 50,
    })

    const summary = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 }
    const statusMap: Record<string, keyof typeof summary> = {
      PRESENT: 'HADIR',
      HADIR: 'HADIR',
      PERMITTED: 'IZIN',
      PERMISSION: 'IZIN',
      IZIN: 'IZIN',
      SICK: 'SAKIT',
      SAKIT: 'SAKIT',
      ABSENT: 'ALPHA',
      ALFA: 'ALPHA',
      ALPHA: 'ALPHA',
    }

    const attendance = records.map((record) => {
      const status = statusMap[record.status.toUpperCase()]
      if (!status) {
        throw new Error(`Unsupported attendance status for record ${record.attendance_record_id}.`)
      }
      summary[status] += 1

      return {
        id: record.attendance_record_id.toString(),
        date: record.attendance_sessions.attendance_date.toISOString().slice(0, 10),
        status,
        note: record.note,
        className: record.attendance_sessions.classes.name,
      }
    })

    return res.status(200).json({
      data: {
        studentId: studentId.toString(),
        attendance,
        summary,
      },
    })
  } catch (error) {
    console.error('Failed to fetch child attendance:', error)
    return res.status(500).json({ message: 'Internal server error while fetching child attendance.' })
  }
}

export async function getChildGrades(req: Request, res: Response) {
  const studentId = parseBigIntSafe(req.params.studentId)
  if (!studentId || studentId < 1n) {
    return res.status(400).json({ message: 'A valid studentId is required.' })
  }

  try {
    const parent = await prisma.parents.findUnique({
      where: { user_id: BigInt(req.user!.userId) },
      select: { parent_id: true },
    })

    if (!parent) {
      return res.status(404).json({ message: 'Parent profile not found for this user.' })
    }

    const relationship = await prisma.parent_students.findUnique({
      where: {
        parent_id_student_id: {
          parent_id: parent.parent_id,
          student_id: studentId,
        },
      },
      select: { student_id: true },
    })

    if (!relationship) {
      return res.status(403).json({ message: 'You do not have access to this child.' })
    }

    const grades = await prisma.grades.findMany({
      where: { student_id: studentId },
      include: {
        teaching_assignments: {
          select: {
            classes: { select: { name: true } },
            subjects: { select: { name: true, code: true } },
            academic_periods: { select: { academic_year: true, semester: true } },
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    })

    return res.status(200).json({
      data: {
        studentId: studentId.toString(),
        grades: grades.map((grade) => ({
          id: grade.grade_id.toString(),
          subject: grade.teaching_assignments.subjects.name,
          subjectCode: grade.teaching_assignments.subjects.code,
          className: grade.teaching_assignments.classes.name,
          assessmentType: grade.assessment_type,
          assessmentName: grade.assessment_name,
          score: Number(grade.score),
          academicYear: grade.teaching_assignments.academic_periods.academic_year,
          semester: grade.teaching_assignments.academic_periods.semester,
          updatedAt: grade.updated_at.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('Failed to fetch child grades:', error)
    return res.status(500).json({ message: 'Internal server error while fetching child grades.' })
  }
}
