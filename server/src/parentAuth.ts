import type { Request, Response, NextFunction } from 'express'
import prisma from './db'

/**
 * Safely parse BigInt from string/number
 */
export function parseBigIntSafe(val: unknown): bigint | null {
  if (typeof val === 'bigint') return val > 0n ? val : null
  if (typeof val === 'number') {
    return Number.isSafeInteger(val) && val > 0 ? BigInt(val) : null
  }
  if (typeof val !== 'string' || !/^[1-9]\d*$/.test(val)) return null

  try {
    return BigInt(val)
  } catch {
    return null
  }
}

/**
 * Middleware: requireParentRole
 * Ensures that the authenticated user has the 'parent' role (or localized equivalents).
 */
export function requireParentRole(req: Request, res: Response, next: NextFunction) {
  const sessionUser = req.user

  if (!sessionUser) {
    return res.status(401).json({
      message: 'Authentication required. Session not found.',
    })
  }

  const userRole = (sessionUser.role || '').toLowerCase()
  const isParent = ['parent', 'orang tua', 'wali murid'].includes(userRole)

  if (!isParent) {
    return res.status(403).json({
      message: 'Forbidden. Only parent accounts are authorized to access this resource.',
    })
  }

  return next()
}

/**
 * Middleware: verifyParentStudentAccess
 * Verifies that the authenticated parent user has authorized access to the requested student_id
 * via the parent_students relationship table.
 * Administrative/teacher roles are allowed pass-through if required.
 */
export async function verifyParentStudentAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionUser = req.user

    if (!sessionUser) {
      return res.status(401).json({
        message: 'Authentication required. Session not found.',
      })
    }

    const userRole = (sessionUser.role || '').toLowerCase()

    // Administrative roles pass-through
    if (['admin', 'staff', 'teacher'].includes(userRole)) {
      return next()
    }

    // Role must be parent
    if (!['parent', 'orang tua', 'wali murid'].includes(userRole)) {
      return res.status(403).json({
        message: 'Access denied. You are not authorized to access this student data.',
      })
    }

    // Retrieve target student_id from params, query, or body
    const rawStudentId =
      req.params.studentId ??
      req.params.student_id ??
      req.query.studentId ??
      req.query.student_id ??
      req.body?.studentId ??
      req.body?.student_id

    const targetStudentId = parseBigIntSafe(rawStudentId)

    if (!targetStudentId) {
      return res.status(400).json({
        message: 'The student_id parameter is missing or invalid.',
      })
    }

    // 1. Find parent profile linked to this user_id
    const parent = await prisma.parents.findUnique({
      where: { user_id: BigInt(sessionUser.userId) },
      select: { parent_id: true },
    })

    if (!parent) {
      return res.status(403).json({
        message: 'Access denied. Parent profile not found.',
      })
    }

    // 2. Query parent_students bridge table
    const parentStudentRelation = await prisma.parent_students.findUnique({
      where: {
        parent_id_student_id: {
          parent_id: parent.parent_id,
          student_id: targetStudentId,
        },
      },
    })

    if (!parentStudentRelation) {
      return res.status(403).json({
        message: 'Access denied. You are not authorized to access this student data.',
      })
    }

    return next()
  } catch (error) {
    console.error('Error in verifyParentStudentAccess:', error)
    return res.status(500).json({
      message: 'Internal server error while verifying parent-student access.',
    })
  }
}
