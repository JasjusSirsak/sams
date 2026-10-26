import { Router, type Request, type Response } from 'express'
import argon2 from 'argon2'
import prisma from './db'
import { generateSessionToken, setAuthCookie, clearAuthCookie, requireAuth } from './auth'
import { getActivePeriod } from './services/academicPeriod'

const authRouter = Router()

/**
 * Helper to map database roles and retrieve user profile info
 */
async function buildUserProfile(user: {
  user_id: bigint
  username: string
  role_id: bigint
  roles: { name: string }
  teachers: { teacher_id: bigint; name: string } | null
  students: {
    student_id: bigint
    name: string
    student_enrollments?: { classes: { name: string } }[]
  } | null
  parents: {
    parent_id: bigint
    name: string
  } | null
  staff: {
    staff_id: bigint
    name: string
  } | null
}) {
  const rawRole = (user.roles?.name || '').toLowerCase()
  let mappedRole = rawRole
  let displayName = user.username
  let className: string | null = null

  if (rawRole === 'teacher' || rawRole === 'homeroom') {
    mappedRole = 'teacher'
    if (user.teachers) {
      displayName = user.teachers.name
    }
  } else if (rawRole === 'student') {
    mappedRole = 'student'
    if (user.students) {
      displayName = user.students.name
      if (user.students.student_enrollments && user.students.student_enrollments.length > 0) {
        className = user.students.student_enrollments[0]?.classes?.name ?? null
      }
    }
  } else if (rawRole === 'parent' || rawRole === 'guardian') {
    mappedRole = 'parent'
    if (user.parents) {
      displayName = user.parents.name
    }
  } else if (user.staff) {
    displayName = user.staff.name
  }

  return {
    id: user.user_id.toString(),
    name: displayName,
    role: mappedRole,
    class_name: className,
  }
}

async function getActiveHomeroomAssignment(userId: bigint) {
  const period = await getActivePeriod()
  if (!period) return null

  return prisma.homeroom_assignments.findFirst({
    where: {
      teachers: { user_id: userId },
      academic_period_id: period.academic_period_id,
    },
    orderBy: { academic_periods: { start_date: 'desc' } },
    select: {
      class_id: true,
      classes: { select: { name: true } },
    },
  })
}

async function buildAuthenticatedProfile(user: Parameters<typeof buildUserProfile>[0]) {
  const profile = await buildUserProfile(user)
  const assignment =
    profile.role === 'teacher' ? await getActiveHomeroomAssignment(user.user_id) : null

  return {
    ...profile,
    class_name: assignment?.classes.name ?? profile.class_name,
    isHomeroom: assignment !== null,
    homeroomClassId: assignment?.class_id.toString() ?? null,
  }
}

// Dummy hash for constant-time comparison when user does not exist
// Pre-computed Argon2id hash of a random dummy string to prevent timing side-channel attacks
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$dHVtbXlzYWx0c3RyaW5n$1a9p9Xz3r+hLqYvK6Qn4iC8H7aXzQ2r8/xLmNoPqRsT'

/**
 * POST /api/auth/login
 * Verify username/email & password, check active status, and set HttpOnly cookie
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { identity, username, password } = req.body

    const loginIdentifier = (identity || username || '').trim()
    const rawPassword = typeof password === 'string' ? password : ''

    if (!loginIdentifier || !rawPassword) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Username or email and password are required.',
      })
    }

    // Find user by username (case-insensitive)
    const user = await prisma.users.findFirst({
      where: {
        username: {
          equals: loginIdentifier,
          mode: 'insensitive',
        },
      },
      include: {
        roles: true,
        teachers: {
          select: { teacher_id: true, name: true },
        },
        students: {
          include: {
            student_enrollments: {
              include: {
                classes: true,
              },
            },
          },
        },
        parents: true,
        staff: true,
      },
    })

    // If user is not found, verify against dummy hash to ensure constant-time response (timing attack mitigation)
    const targetHash = user?.password_hash || DUMMY_HASH
    let isMatch = false
    try {
      isMatch = await argon2.verify(targetHash, rawPassword)
    } catch (err) {
      console.error('Password verification failure:', err)
      isMatch = false
    }

    // User enumeration prevention: identical status & body for not found or wrong password
    if (!user || !isMatch) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect username or password.',
      })
    }

    // Check account status - safe message without leaking internal details
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect username or password.',
      })
    }

    // Prepare user profile
    const profile = await buildAuthenticatedProfile(user)

    // Generate JWT token
    const { token, exp } = generateSessionToken({
      userId: user.user_id.toString(),
      username: user.username,
      role: profile.role,
    })

    // Set HttpOnly cookie die with token
    setAuthCookie(res, token, exp)

    // Send successful response
    // Token is also included in body for the frontend Bearer-token interceptor
    // The HttpOnly cookie remains the primary auth mechanism
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: profile,
    })
  } catch (error) {
    console.error('Error during login:', error)
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Something went wrong on the server. Please try again.',
    })
  }
})

/**
 * GET /api/auth/me
 * Retrieves profile of currently authenticated user from cookie or Bearer token
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionUser = req.user
    if (!sessionUser) {
      return res.status(401).json({ message: 'Invalid session.' })
    }

    const user = await prisma.users.findUnique({
      where: {
        user_id: BigInt(sessionUser.userId),
      },
      include: {
        roles: true,
        teachers: {
          select: { teacher_id: true, name: true },
        },
        students: {
          include: {
            student_enrollments: {
              include: {
                classes: true,
              },
            },
          },
        },
        parents: true,
        staff: true,
      },
    })

    if (!user) {
      clearAuthCookie(res)
      return res.status(401).json({ message: 'User not found.' })
    }

    if (!user.is_active) {
      clearAuthCookie(res)
      return res.status(403).json({ message: 'Account has been deactivated.' })
    }

    const profile = await buildAuthenticatedProfile(user)

    return res.status(200).json({
      user: profile,
    })
  } catch (error) {
    console.error('Error in /auth/me:', error)
    return res.status(500).json({ message: 'Failed to verify user session.' })
  }
})

/**
 * POST /api/auth/logout
 * Clears HttpOnly cookie and terminates session
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res)
  return res.status(200).json({
    message: 'Logout successful.',
  })
})

export default authRouter
