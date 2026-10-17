import { Router, type Request, type Response } from 'express'
import prisma from './db'
import { requireAuth, requireRole } from './auth'

const journalsRouter = Router()

/**
 * Safely parse BigInt
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
 * Retrieve teacher profile by user_id
 */
async function getTeacherProfileByUserId(userId: string) {
  return await prisma.teachers.findUnique({
    where: { user_id: BigInt(userId) },
    select: { teacher_id: true, name: true },
  })
}

/**
 * Validate that the authenticated teacher owns the teaching_assignment_id
 */
async function verifyTeacherAssignmentOwnership(
  userId: string,
  userRole: string,
  teachingAssignmentId: bigint
): Promise<{ ok: boolean; message?: string; assignment?: any }> {
  const assignment = await prisma.teaching_assignments.findUnique({
    where: { teaching_assignment_id: teachingAssignmentId },
    include: {
      classes: { select: { class_id: true, name: true } },
      subjects: { select: { subject_id: true, name: true } },
    },
  })

  if (!assignment) {
    return { ok: false, message: 'Teaching assignment not found.' }
  }

  // Admins & staff have superuser rights
  if (userRole === 'admin' || userRole === 'staff') {
    return { ok: true, assignment }
  }

  const teacher = await getTeacherProfileByUserId(userId)
  if (!teacher) {
    return { ok: false, message: 'Teacher profile not found for authenticated account.' }
  }

  if (teacher.teacher_id !== assignment.teacher_id) {
    return {
      ok: false,
      message: `Forbidden: You are not assigned to teach class "${assignment.classes.name}" and subject "${assignment.subjects.name}".`,
    }
  }

  return { ok: true, assignment }
}

/**
 * GET /api/journals
 * Retrieve teaching journals for a specific teaching assignment or all assignments of the teacher
 */
journalsRouter.get(
  '/',
  requireAuth,
  requireRole('teacher', 'homeroom', 'staff', 'admin'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const userRole = (sessionUser.role || '').toLowerCase()
      const assignmentId = parseBigIntSafe(req.query.teaching_assignment_id ?? req.query.assignmentId)

      const whereClause: any = {}

      if (assignmentId) {
        const ownership = await verifyTeacherAssignmentOwnership(
          sessionUser.userId,
          userRole,
          assignmentId
        )
        if (!ownership.ok) {
          return res.status(403).json({ message: ownership.message })
        }
        whereClause.teaching_assignment_id = assignmentId
      } else if (userRole === 'teacher' || userRole === 'homeroom') {
        const teacher = await getTeacherProfileByUserId(sessionUser.userId)
        if (!teacher) {
          return res.status(403).json({ message: 'Teacher profile not found.' })
        }
        whereClause.teaching_assignments = {
          teacher_id: teacher.teacher_id,
        }
      }

      const journals = await prisma.journals.findMany({
        where: whereClause,
        include: {
          teaching_assignments: {
            include: {
              classes: { select: { class_id: true, name: true } },
              subjects: { select: { subject_id: true, name: true } },
            },
          },
        },
        orderBy: [{ journal_date: 'desc' }, { created_at: 'desc' }],
      })

      const data = journals.map((j) => ({
        journal_id: j.journal_id.toString(),
        teaching_assignment_id: j.teaching_assignment_id.toString(),
        class_name: j.teaching_assignments.classes.name,
        subject_name: j.teaching_assignments.subjects.name,
        date: j.journal_date.toISOString().split('T')[0],
        topic: j.topic,
        description: j.description,
        teacher_attendance_status: j.teacher_attendance_status,
        created_at: j.created_at,
      }))

      return res.status(200).json({ count: data.length, data })
    } catch (error) {
      console.error('Failed to get journals:', error)
      return res.status(500).json({ message: 'Internal server error while retrieving journals.' })
    }
  }
)

/**
 * POST /api/journals
 * Create a new KBM journal record with strict teacher assignment verification
 */
journalsRouter.post(
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
        date,
        journal_date,
        topic,
        description,
        teacher_attendance_status,
      } = req.body

      const assignmentId = parseBigIntSafe(teaching_assignment_id ?? teachingAssignmentId)

      if (!assignmentId) {
        return res.status(400).json({ message: 'Missing or invalid teaching_assignment_id.' })
      }

      if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ message: 'Topic is required.' })
      }

      const ownership = await verifyTeacherAssignmentOwnership(
        sessionUser.userId,
        userRole,
        assignmentId
      )

      if (!ownership.ok) {
        return res.status(403).json({ message: ownership.message })
      }

      const rawDate = date ?? journal_date ?? new Date().toISOString().split('T')[0]
      const parsedDate = new Date(rawDate)

      const journal = await prisma.journals.create({
        data: {
          teaching_assignment_id: assignmentId,
          journal_date: parsedDate,
          topic: topic.trim(),
          description: description?.toString().trim() || null,
          teacher_attendance_status: teacher_attendance_status?.toString().trim() || 'PRESENT',
        },
      })

      return res.status(201).json({
        message: 'Journal entry created successfully.',
        data: {
          journal_id: journal.journal_id.toString(),
          teaching_assignment_id: journal.teaching_assignment_id.toString(),
          date: journal.journal_date.toISOString().split('T')[0],
          topic: journal.topic,
          description: journal.description,
          created_at: journal.created_at,
        },
      })
    } catch (error) {
      console.error('Failed to create journal:', error)
      return res.status(500).json({ message: 'Internal server error while creating journal.' })
    }
  }
)

/**
 * PUT /api/journals/:journalId
 * Update an existing journal entry
 */
journalsRouter.put(
  '/:journalId',
  requireAuth,
  requireRole('teacher', 'homeroom', 'staff', 'admin'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const userRole = (sessionUser.role || '').toLowerCase()
      const journalId = parseBigIntSafe(req.params.journalId)

      if (!journalId) {
        return res.status(400).json({ message: 'Invalid journal ID.' })
      }

      const existingJournal = await prisma.journals.findUnique({
        where: { journal_id: journalId },
      })

      if (!existingJournal) {
        return res.status(404).json({ message: 'Journal entry not found.' })
      }

      const ownership = await verifyTeacherAssignmentOwnership(
        sessionUser.userId,
        userRole,
        existingJournal.teaching_assignment_id
      )

      if (!ownership.ok) {
        return res.status(403).json({ message: ownership.message })
      }

      const { topic, description, teacher_attendance_status, date } = req.body

      const updated = await prisma.journals.update({
        where: { journal_id: journalId },
        data: {
          topic: topic ? topic.toString().trim() : existingJournal.topic,
          description: description !== undefined ? description?.toString().trim() || null : existingJournal.description,
          teacher_attendance_status: teacher_attendance_status !== undefined ? teacher_attendance_status : existingJournal.teacher_attendance_status,
          journal_date: date ? new Date(date) : existingJournal.journal_date,
        },
      })

      return res.status(200).json({
        message: 'Journal updated successfully.',
        data: {
          journal_id: updated.journal_id.toString(),
          teaching_assignment_id: updated.teaching_assignment_id.toString(),
          date: updated.journal_date.toISOString().split('T')[0],
          topic: updated.topic,
          description: updated.description,
        },
      })
    } catch (error) {
      console.error('Failed to update journal:', error)
      return res.status(500).json({ message: 'Internal server error while updating journal.' })
    }
  }
)

/**
 * DELETE /api/journals/:journalId
 * Delete a journal entry
 */
journalsRouter.delete(
  '/:journalId',
  requireAuth,
  requireRole('teacher', 'homeroom', 'staff', 'admin'),
  async (req: Request, res: Response) => {
    try {
      const sessionUser = req.user!
      const userRole = (sessionUser.role || '').toLowerCase()
      const journalId = parseBigIntSafe(req.params.journalId)

      if (!journalId) {
        return res.status(400).json({ message: 'Invalid journal ID.' })
      }

      const existingJournal = await prisma.journals.findUnique({
        where: { journal_id: journalId },
      })

      if (!existingJournal) {
        return res.status(404).json({ message: 'Journal entry not found.' })
      }

      const ownership = await verifyTeacherAssignmentOwnership(
        sessionUser.userId,
        userRole,
        existingJournal.teaching_assignment_id
      )

      if (!ownership.ok) {
        return res.status(403).json({ message: ownership.message })
      }

      await prisma.journals.delete({
        where: { journal_id: journalId },
      })

      return res.status(200).json({ message: 'Journal entry deleted successfully.' })
    } catch (error) {
      console.error('Failed to delete journal:', error)
      return res.status(500).json({ message: 'Internal server error while deleting journal.' })
    }
  }
)

export default journalsRouter
