import axios from 'axios'
import apiClient from './apiClient'
import type { Role } from './data'

// ── Ttpe ──────────────────────────────────────

export interface LoginPayload {
  identity: string // email or username
  password: string
}

// `role` on frontend only for UI/navigasi (canAccess).
// Otorisasi actually still need be verivicate in backend.
export interface AuthUser {
  id: number
  name: string
  role: Role
  className?: string | null
}

export interface LoginResult {
  token: string
  user: AuthUser
}

export interface ApiError {
  status: number
  message: string
}

//I need to make sure this one is the same as my backend's endpoint
interface LoginResponse {
  token: string
  user: {
    id: number | string
    name: string
    role: string
    class_name?: string | null
  }
}

// ── Role mapping ──────────────────────────────

//Normalize role name from backend (tabel roles) → union Role frontend.
// adjust map seeds with Role value in ./data
const ROLE_MAP: Record<string, Role> = {
  student: 'student',
  parent: 'parent',
  teacher: 'teacher',
  staff: 'staff',
  admin: 'admin',
}

function toRole(raw: string): Role {
  // fallback only for UI — backend still deciding the otorisasi
  return ROLE_MAP[(raw ?? '').toLowerCase()] ?? 'student'
}

function normalizeUser(raw: LoginResponse['user']): AuthUser {
  return {
    id: Number(raw.id),
    name: raw.name,
    role: toRole(raw.role),
    className: raw.class_name ?? null,
  }
}

// ── API ──────────────────────────────────────

export async function login(payload: LoginPayload): Promise<LoginResult> {
  try {
    const res = await apiClient.post<LoginResponse>('/auth/login', payload)
    return { token: res.data.token, user: normalizeUser(res.data.user) }
  } catch (err) {
    throw toApiError(err)
  }
}

// Invalidasi token in server (if backend provide it tho) + Clear the local session.
export async function logout() {
  try {
    await apiClient.post('/auth/logout')
  } catch {
    //still clean the local session even when the respond faild
  }
  clearSession()
}

// ── Sesi lokal ───────────────────────────────

const TOKEN_KEY = 'sams_token'
const USER_KEY = 'sams_user'

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as AuthUser | null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ── Error mapping ────────────────────────────

// change Axios error → family friendly for frontend form :)
export function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status

    if (status === 401) return { status, message: 'Incorrect email/username or password.' }
    if (status === 403) return { status, message: 'The account does not have access to SAMS. }
    if (status !== undefined && status >= 500)
      return { status, message: 'A server error occurred. Please try again in a moment.' }
    if (!err.response)
      return { status: 0, message: 'Unable to connect to the server. Check your connection.' }

    const message = (err.response.data as { message?: unknown } | undefined)?.message
    if (typeof message === 'string') return { status: status ?? 400, message }

    return { status: status ?? 400, message: 'Invalid request.' }
  }
  return { status: 0, message: 'An unexpected error occurred. Please try again.' }
}