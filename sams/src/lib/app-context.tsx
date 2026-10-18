'use client'

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { type PendingRequest, type Role } from './data'
import {
  checkSession,
  getStoredUser,
  login as apiLogin,
  logout as apiLogout,
  saveSession,
  type LoginCredentials,
  type User,
} from './auth'
import { getHomeroomRequests } from './api'

export type ReviewedRequest = PendingRequest & { decision: 'approved' | 'rejected' }

type AppState = {
  role: Role
  setRole: (r: Role) => void
  dark: boolean
  toggleDark: () => void
  childId: string
  setChildId: Dispatch<SetStateAction<string>>
  query: string
  setQuery: (q: string) => void
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

export function AppProvider({ children }: { children: ReactNode }) {
  // Get initial stored user synchronously if present in localStorage (reduces flicker)
  const initialUser = typeof window !== 'undefined' ? getStoredUser() : null

  const [user, setUser] = useState<User | null>(initialUser)
  const [role, setRole] = useState<Role>(initialUser?.role ?? 'student')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const [dark, setDark] = useState(false)
  const [childId, setChildId] = useState('')
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<PendingRequest[]>([])
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

  // Sync real attendance data & homeroom pending requests
  useEffect(() => {
    let isMounted = true
    if (!user) return

    // Homeroom and teacher accounts can review attendance requests.
    if (role === 'homeroom' || role === 'teacher') {
      getHomeroomRequests({ status: 'PENDING' })
        .then((reqs) => {
          if (!isMounted) return
          const mapped: PendingRequest[] = reqs.map((r) => {
            const dateObj = new Date(r.date)
            const dateFormatted = isNaN(dateObj.getTime())
              ? r.date
              : dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
            const statusMapped = r.attendance_status === 'SICK' ? 'sakit' : 'izin'

            return {
              id: r.id || r.record_id,
              student: r.student?.name || 'Unknown Student',
              nis: r.student?.nis || '-',
              status: statusMapped,
              date: dateFormatted,
              note: r.note || '',
              evidence: r.document_url || '',
            }
          })
          setPending(mapped)
        })
        .catch(() => {
          // If homeroom query fails (e.g. teacher with no homeroom assignment), clear pending
          if (isMounted) setPending([])
        })
    }

    return () => {
      isMounted = false
    }
  }, [user, role])

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

  function decide(id: string, decision: 'approved' | 'rejected') {
    const item = pending.find((p) => p.id === id)
    if (!item) return
    setPending((list) => list.filter((p) => p.id !== id))
    setReviewed((list) => [{ ...item, decision }, ...list])
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