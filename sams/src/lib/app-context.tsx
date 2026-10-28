'use client'

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { type PendingRequest, type Role } from './data'
import {
  checkSession,
  login as apiLogin,
  logout as apiLogout,
  type LoginCredentials,
  type User,
} from './auth'
import { getHomeroomRequests } from './api'
import { setAuthenticationFailureHandler } from './apiClient'

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
  isHomeroom: boolean
  homeroomClassId: string | null
  // Legacy alias for compatibility
  isAuthed: boolean
  login: (credentials: LoginCredentials) => Promise<User>
  logout: () => Promise<void>
  checkAuthStatus: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>('student')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const [dark, setDark] = useState(false)
  const [childId, setChildId] = useState('')
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [reviewed, setReviewed] = useState<ReviewedRequest[]>([])
  const hasActiveHomeroomAssignment = user?.isHomeroom === true && role === 'teacher'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    return setAuthenticationFailureHandler(() => {
      setUser(null)
      setRole('student')
      setPending([])
    })
  }, [])

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
            if (!verifiedUser.isHomeroom) setPending([])
          } else {
            setUser(null)
            setPending([])
          }
        }
      } catch {
        if (isMounted) {
          setUser(null)
          setRole('student')
          setPending([])
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

  // Sync attendance requests for teachers with an active homeroom assignment.
  useEffect(() => {
    let isMounted = true
    if (!hasActiveHomeroomAssignment) return

    getHomeroomRequests({ status: 'PENDING' })
      .then((reqs) => {
        if (!isMounted) return
        const mapped: PendingRequest[] = reqs.map((r) => {
          const dateObj = new Date(r.date)
          const dateFormatted = isNaN(dateObj.getTime())
            ? r.date
            : dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
          const statusMapped = r.attendance_status === 'SICK' ? 'sick' : 'permitted'

          return {
            id: r.id || r.record_id,
            student: r.student?.name || 'Unknown Student',
            nis: r.student?.nis || '-',
            status: statusMapped,
            date: dateFormatted,
            note: r.note || '',
            hasEvidence: r.has_evidence,
            evidenceFilename: r.evidence_filename,
          }
        })
        setPending(mapped)
      })
      .catch(() => {
        if (isMounted) setPending([])
      })

    return () => {
      isMounted = false
    }
  }, [hasActiveHomeroomAssignment, user?.id])

  async function checkAuthStatus() {
    setIsLoading(true)
    try {
      const verifiedUser = await checkSession()
      setUser(verifiedUser)
      if (verifiedUser) {
        setRole(verifiedUser.role)
        setPending([])
      } else {
        setRole('student')
        setPending([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function login(credentials: LoginCredentials): Promise<User> {
    setIsLoading(true)
    try {
      const loggedInUser = await apiLogin(credentials)
      setUser(loggedInUser)
      setRole(loggedInUser.role)
      setPending([])
      return loggedInUser
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    setIsLoading(true)
    try {
      await apiLogout()
    } finally {
      setUser(null)
      setRole('student')
      setPending([])
      setIsLoading(false)
    }
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
        isHomeroom: user?.isHomeroom ?? false,
        homeroomClassId: user?.homeroomClassId ?? null,
        isAuthed: isAuthenticated,
        login,
        logout,
        checkAuthStatus,
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