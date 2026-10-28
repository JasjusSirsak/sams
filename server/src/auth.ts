// server/src/auth.ts
import 'dotenv/config'
import type { Request, Response, NextFunction } from 'express'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
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
export const REFRESH_COOKIE_NAME = 'sams_refresh'

function positiveIntegerSetting(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive integer.`)
  }
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe positive integer.`)
  }
  return parsed
}

export const ACCESS_TOKEN_TTL_MINUTES = positiveIntegerSetting('ACCESS_TOKEN_TTL_MINUTES', 15)
export const REFRESH_IDLE_TTL_DAYS = positiveIntegerSetting('REFRESH_IDLE_TTL_DAYS', 7)
export const REFRESH_ABSOLUTE_TTL_DAYS = positiveIntegerSetting('REFRESH_ABSOLUTE_TTL_DAYS', 30)
export const ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_MINUTES * 60
const DAY_MS = 24 * 60 * 60 * 1000

const appOriginValue =
  process.env.APP_ORIGIN ??
  (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5173')
if (!appOriginValue) {
  throw new Error('APP_ORIGIN must be configured in production.')
}

let APP_ORIGIN: string
try {
  const parsedOrigin = new URL(appOriginValue)
  if (
    parsedOrigin.origin !== appOriginValue ||
    !['http:', 'https:'].includes(parsedOrigin.protocol) ||
    (process.env.NODE_ENV === 'production' && parsedOrigin.protocol !== 'https:')
  ) {
    throw new Error()
  }
  APP_ORIGIN = parsedOrigin.origin
} catch {
  throw new Error('APP_ORIGIN must be a valid origin without a path.')
}

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
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS })
  const decoded = jwt.decode(token) as JwtSessionPayload & { exp: number }
  const exp = decoded.exp
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

export function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  const isProd = process.env.NODE_ENV === 'production'
  const maxAgeMs = Math.max(0, expiresAt.getTime() - Date.now())

  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: maxAgeMs,
    path: '/api/auth',
  })
}

export function clearAuthCookies(res: Response) {
  const isProd = process.env.NODE_ENV === 'production'
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  })
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth',
  })
}

export function clearAccessCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production'
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  })
}

export function createRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

export function isValidRefreshToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createRefreshSession(userId: bigint): Promise<{ token: string; expiresAt: Date }> {
  const now = new Date()
  const absoluteExpiresAt = new Date(now.getTime() + REFRESH_ABSOLUTE_TTL_DAYS * DAY_MS)
  const expiresAt = new Date(
    Math.min(now.getTime() + REFRESH_IDLE_TTL_DAYS * DAY_MS, absoluteExpiresAt.getTime())
  )
  const familyId = randomUUID()
  const token = createRefreshToken()

  await prisma.refresh_sessions.deleteMany({
    where: { absolute_expires_at: { lte: now } },
  })
  await prisma.refresh_sessions.create({
    data: {
      family_id: familyId,
      user_id: userId,
      token_hash: hashRefreshToken(token),
      created_at: now,
      idle_expires_at: expiresAt,
      absolute_expires_at: absoluteExpiresAt,
    },
  })

  return { token, expiresAt }
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.get('origin') !== APP_ORIGIN) {
    return res.status(403).json({
      success: false,
      code: 'CSRF_REJECTED',
      message: 'Request origin is not allowed.',
    })
  }
  return next()
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
    clearAccessCookie(res)
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
      if (user) {
        await prisma.refresh_sessions.updateMany({
          where: { user_id: user.user_id, revoked_at: null },
          data: { revoked_at: new Date() },
        })
      }
      clearAuthCookies(res)
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