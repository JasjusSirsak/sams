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
export const TOKEN_EXPIRY_SECONDS = 8 * 60 * 60 // 8 hours session (standard work/school shift)

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

export function generateSessionToken(payload: JwtSessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY_SECONDS,
  })
}

export function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production'

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRY_SECONDS * 1000,
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

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtSessionPayload

    // Verify current account status in the database (prevents disabled accounts from accessing resources)
    const user = await prisma.users.findUnique({
      where: { user_id: BigInt(decoded.userId) },
      select: { is_active: true, role_id: true, roles: { select: { name: true } } },
    })

    if (!user || !user.is_active) {
      clearAuthCookie(res)
      return res.status(401).json({
        message: 'Your account has been deactivated or does not exist.',
      })
    }

    req.user = decoded
    return next()
  } catch (error) {
    clearAuthCookie(res)
    return res.status(401).json({
      message: 'Session has expired or is invalid. Please log in again.',
    })
  }
}

/**
 * Middleware to enforce Role-Based Access Control (RBAC).
 * Ensures that the authenticated user possesses one of the allowed roles.
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