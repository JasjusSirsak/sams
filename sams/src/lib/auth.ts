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
  token: string
  user: {
    id: number | string
    name: string
    role: string
    class_name?: string | null
    isHomeroom: boolean
    homeroomClassId: string | null
  }
}

export interface LoginResult {
  token: string
  user: User
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
  wali: 'teacher',
  'wali kelas': 'teacher',
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

// ── Local Session (Storage) ────────────────────

const TOKEN_KEY = 'sams_token'
const USER_KEY = 'sams_user'

export function saveSession(token: string, user: User) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Omit<User, 'role'> & { role: string }
    return {
      ...stored,
      role: toRole(stored.role),
      isHomeroom: stored.isHomeroom === true,
      homeroomClassId: stored.homeroomClassId ?? null,
    }
  } catch {
    return null
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ── Auth Service API ───────────────────────────

/**
 * Authenticate login via POST /api/auth/login endpoint
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  try {
  const res = await apiClient.post<AuthResponse>('/auth/login', credentials)
    const normalizedUser = normalizeUser(res.data.user)
    return { token: res.data.token, user: normalizedUser }
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
 * Retrieves local token and verifies it with server via getCurrentUser().
 * If token is missing or invalid, clears local session.
 */
export async function checkSession(): Promise<User | null> {
  const token = getStoredToken()
  if (!token) {
    clearSession()
    return null
  }

  try {
    const user = await getCurrentUser()
    saveSession(token, user)
    return user
  } catch {
    // A cached assignment must never grant homeroom-only UI access.
    const fallbackUser = getStoredUser()
    return fallbackUser ? { ...fallbackUser, isHomeroom: false, homeroomClassId: null } : null
  }
}

/**
 * Log out from active session and clear local storage
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout')
  } catch {
    // Ignore network failures during logout
  } finally {
    clearSession()
  }
}