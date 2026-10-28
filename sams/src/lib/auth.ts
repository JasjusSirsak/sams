import apiClient, { parseApiError, type ApiErrorResponse } from './apiClient'
import type { Role } from './data'

// ── Types ──────────────────────────────────────

export interface LoginCredentials {
  identity: string // email or username
  password: string
}

// Frontend user model for state and UI
export interface User {
  id: number
  name: string
  role: Role
  className?: string | null
  isHomeroom?: boolean
  homeroomClassId?: string | null
}

// Compatibility alias if any component references AuthUser
export type AuthUser = User

export interface AuthResponse {
  user: {
    id: number | string
    name: string
    role: string
    class_name?: string | null
    isHomeroom: boolean
    homeroomClassId: string | null
  }
}

export type ApiError = ApiErrorResponse

// ── Role mapping ──────────────────────────────

// Normalize role name from backend/input → valid frontend Role union
const ROLE_MAP: Record<string, Role> = {
  student: 'student',
  parent: 'parent',
  teacher: 'teacher',
  homeroom: 'teacher',
  admin: 'admin',
  staff: 'staff',
}

export function toRole(raw: string): Role {
  const normalized = (raw ?? '').trim().toLowerCase()
  return ROLE_MAP[normalized] ?? 'student'
}

export function normalizeUser(raw: AuthResponse['user']): User {
  return {
    id: Number(raw.id),
    name: raw.name,
    role: toRole(raw.role),
    className: raw.class_name ?? null,
    isHomeroom: raw.isHomeroom === true,
    homeroomClassId: raw.homeroomClassId ?? null,
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('sams_token')
  localStorage.removeItem('sams_user')
}

// ── Auth Service API ───────────────────────────

/**
 * Authenticate login via POST /api/auth/login endpoint
 */
export async function login(credentials: LoginCredentials): Promise<User> {
  try {
    const res = await apiClient.post<AuthResponse>('/auth/login', credentials)
    return normalizeUser(res.data.user)
  } catch (err) {
    throw parseApiError(err)
  }
}

/**
 * Fetch active user profile via GET /api/auth/me endpoint
 */
export async function getCurrentUser(): Promise<User> {
  try {
    const res = await apiClient.get<{ user: AuthResponse['user'] }>('/auth/me')
    return normalizeUser(res.data.user)
  } catch (err) {
    throw parseApiError(err)
  }
}

/**
 * Validate current session:
 * The server cookie is the only proof of authentication; cached profiles are never trusted.
 */
export async function checkSession(): Promise<User | null> {
  clearSession()
  try {
    return await getCurrentUser()
  } catch {
    clearSession()
    return null
  }
}

/**
 * Revoke the server-side refresh session and clear any legacy local authentication data.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout')
  } finally {
    clearSession()
  }
}