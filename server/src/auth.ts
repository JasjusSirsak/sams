// server/src/auth.ts
import 'dotenv/config'
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from './db'

// 1. Fail-fast guard: Never allow hardcoded secret fallback & enforce minimum 32 characters length
const JWT_SECRET_VALUE = process.env.JWT_SECRET
if (!JWT_SECRET_VALUE || JWT_SECRET_VALUE.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is missing or less than 32 characters! The server cannot start securely.'
  )
}

export const JWT_SECRET: string = JWT_SECRET_VALUE
export const AUTH_COOKIE_NAME = 'sams_session'

// ============================================================
// SESSION POLICY — ABSOLUTE EXPIRY (WIB)
// ============================================================
const TZ_OFFSET_HOURS = 7 // WIB

// completion time per role (24-hour format, WIB)
const END_OF_DAY_HOUR: Record<string, number> = {
  student: 15,
  teacher: 16,
  admin: 17,
  staff: 17,
  parent: 23, // It’s not a work schedule; rhis role free to choose.
}
const DEFAULT_END_HOUR = 17
const MIN_TTL_SECONDS = 30 * 60 // at least 30 minutes, so that the afternoon login doesn't immediately die
/** 
* Calculate the Unix timestamp (seconds) when the session should die, 
* based on role & finished work hours in WIB. 
*/
export function computeSessionExp(role: string, now = new Date()): number {
  const endHour = END_OF_DAY_HOUR[role] ?? DEFAULT_END_HOUR

// shift to WIB, set time is complete, shift back to UTC
  const wib = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600_000)
  wib.setUTCHours(endHour, 0, 0, 0)
  let expMs = wib.getTime() - TZ_OFFSET_HOURS * 3600_000

  // if it has passed or is too close, provide the minimum allocation
  if (expMs - now.getTime() < MIN_TTL_SECONDS * 1000) {
    expMs = now.getTime() + MIN_TTL_SECONDS * 1000
  }
  return Math.floor(expMs / 1000)
}

// ============================================================

export interface JwtSessionPayload {
  userId: string
  username: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtSessionPayload
    }
  }
}

export function generateSessionToken(payload: JwtSessionPayload): { token: string; exp: number } {
  const exp = computeSessionExp(payload.role)
  // Without `expiresIn` — `exp` is already an absolute claim in the payload.
  const token = jwt.sign({ ...payload, exp }, JWT_SECRET)
  return { token, exp }
}

export function setAuthCookie(res: Response, token: string, exp: number) {
  const isProd = process.env.NODE_ENV === 'production'

// maxAge = relative duration (ms) from now to exp. 
// Math.max(0, ...) so that it is never negative if there is a delay.
  const maxAgeMs = Math.max(0, exp * 1000 - Date.now())

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: maxAgeMs,
    path: '/',
  })
}

export function clearAuthCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production'

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  })
}

function normalizeRoleName(roleName: string): string {
  const role = roleName.trim().toLowerCase()
  if (['teacher', 'homeroom'].includes(role)) return 'teacher'
  if (['student'].includes(role)) return 'student'
  if (['parent', 'guardian'].includes(role)) return 'parent'
  return role
}

/**
 * Authentication middleware with real-time database active account check & token verification
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.[AUTH_COOKIE_NAME]

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    return res.status(401).json({
      message: 'Authentication required. Session not found.',
    })
  }

  let decoded: JwtSessionPayload
  let userId: bigint
  try {
   // jwt.verify automatically rejects tokens whose `exp` claims have passed.
    decoded = jwt.verify(token, JWT_SECRET) as JwtSessionPayload
    userId = BigInt(decoded.userId)
  } catch {
    clearAuthCookie(res)
    return res.status(401).json({
      message: 'Session has expired or is invalid. Please log in again.',
    })
  }

  try {
    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        role_id: true,
        is_active: true,
        roles: { select: { name: true } },
      },
    })
    if (!user || !user.is_active) {
      clearAuthCookie(res)
      return res.status(401).json({
        message: 'Your account has been deactivated or does not exist.',
      })
    }

    req.user = {
      ...decoded,
      userId: user.user_id.toString(),
      role: normalizeRoleName(user.roles.name),
    }
  } catch (error) {
    return next(error)
  }

  return next()
}

/**
 * Middleware to enforce Role-Based Access Control (RBAC).
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required. Session not found.',
      })
    }

    const userRole = (req.user.role || '').toLowerCase()
    const isAllowed = allowedRoles.map((r) => r.toLowerCase()).includes(userRole)

    if (!isAllowed) {
      return res.status(403).json({
        message: 'Forbidden. You do not have permission to access this resource.',
      })
    }

    return next()
  }
}