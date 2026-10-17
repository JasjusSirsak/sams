'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { INITIAL_PENDING, type Approval, type AttendanceStatus, type PendingRequest, type Role } from './data'
import {
  checkSession,
  getStoredUser,
  login as apiLogin,
  logout as apiLogout,
  saveSession,
  type LoginCredentials,
  type User,
} from './auth'

export type TodayRecord = {
  status: AttendanceStatus
  note: string
  evidence: string | null
  approval: Approval
  time: string
}

export type ReviewedRequest = PendingRequest & { decision: 'approved' | 'rejected' }

type AppState = {
  role: Role
  setRole: (r: Role) => void
  dark: boolean
  toggleDark: () => void
  childId: string
  setChildId: (id: string) => void
  query: string
  setQuery: (q: string) => void
  today: TodayRecord | null
  submitToday: (r: Omit<TodayRecord, 'approval'>) => void
  resetToday: () => void
  pending: PendingRequest[]
  reviewed: ReviewedRequest[]
  decide: (id: string, decision: 'approved' | 'rejected') => void
  // ── Auth State ──
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  // Legacy alias for compatibility
  isAuthed: boolean
  login: (credentials: LoginCredentials) => Promise<User>
  logout: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  // Manual setter for backward compatibility
  signIn: (user: User) => void
  signOut: () => void
}

const AppContext = createContext<AppState | null>(null)

const SELF_ID = 'self'

export function AppProvider({ children }: { children: ReactNode }) {
  // Get initial stored user synchronously if present in localStorage (reduces flicker)
  const initialUser = typeof window !== 'undefined' ? getStoredUser() : null

  const [user, setUser] = useState<User | null>(initialUser)
  const [role, setRole] = useState<Role>(initialUser?.role ?? 'student')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const [dark, setDark] = useState(false)
  const [childId, setChildId] = useState('raka')
  const [query, setQuery] = useState('')
  const [today, setToday] = useState<TodayRecord | null>(null)
  const [pending, setPending] = useState<PendingRequest[]>(INITIAL_PENDING)
  const [reviewed, setReviewed] = useState<ReviewedRequest[]>([])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Verify session on mount
  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      try {
        const verifiedUser = await checkSession()
        if (isMounted) {
          if (verifiedUser) {
            setUser(verifiedUser)
            setRole(verifiedUser.role)
          } else {
            setUser(null)
          }
        }
      } catch {
        if (isMounted) {
          // fallback to local stored user
          const stored = getStoredUser()
          setUser(stored)
          if (stored) setRole(stored.role)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    return () => {
      isMounted = false
    }
  }, [])

  async function checkAuthStatus() {
    setIsLoading(true)
    try {
      const verifiedUser = await checkSession()
      setUser(verifiedUser)
      if (verifiedUser) {
        setRole(verifiedUser.role)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function login(credentials: LoginCredentials): Promise<User> {
    setIsLoading(true)
    try {
      const result = await apiLogin(credentials)
      saveSession(result.token, result.user)
      setUser(result.user)
      setRole(result.user.role)
      return result.user
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    setIsLoading(true)
    try {
      await apiLogout()
      setUser(null)
      setRole('student')
    } finally {
      setIsLoading(false)
    }
  }

  // Backward-compatible methods
  function signIn(u: User) {
    setUser(u)
    setRole(u.role)
  }

  function signOut() {
    void logout()
  }

  function submitToday(record: Omit<TodayRecord, 'approval'>) {
    const needsApproval = record.status === 'izin' || record.status === 'sakit'
    setToday({ ...record, approval: needsApproval ? 'pending' : 'approved' })
    if (needsApproval) {
      setPending((list) => [
        {
          id: SELF_ID,
          student: 'Raka Pratama',
          nis: '2024101',
          status: record.status as 'izin' | 'sakit',
          date: 'Wed, 7 Oct',
          note: record.note,
          evidence: record.evidence ?? '',
        },
        ...list.filter((p) => p.id !== SELF_ID),
      ])
    }
  }

  function resetToday() {
    setToday(null)
    setPending((list) => list.filter((p) => p.id !== SELF_ID))
    setReviewed((list) => list.filter((p) => p.id !== SELF_ID))
  }

  function decide(id: string, decision: 'approved' | 'rejected') {
    const item = pending.find((p) => p.id === id)
    if (!item) return
    setPending((list) => list.filter((p) => p.id !== id))
    setReviewed((list) => [{ ...item, decision }, ...list])
    if (id === SELF_ID) {
      setToday((t) => (t ? { ...t, approval: decision, status: decision === 'rejected' ? 'alfa' : t.status } : t))
    }
  }

  const isAuthenticated = user !== null

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        dark,
        toggleDark: () => setDark((d) => !d),
        childId,
        setChildId,
        query,
        setQuery,
        today,
        submitToday,
        resetToday,
        pending,
        reviewed,
        decide,
        // Auth State & Handlers
        user,
        isAuthenticated,
        isLoading,
        isAuthed: isAuthenticated,
        login,
        logout,
        checkAuthStatus,
        signIn,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// Export alias AuthProvider for clarity on auth domain
export const AuthProvider = AppProvider

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider / AuthProvider')
  return ctx
}

// Alias hook useAuth
export const useAuth = useApp

// The student whose data is shown: the student themself, or the parent's selected child.
export function useActiveStudentId() {
  const { role, childId } = useApp()
  return role === 'student' ? 'raka' : childId
}