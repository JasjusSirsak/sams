'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { INITIAL_PENDING, type Approval, type AttendanceStatus, type PendingRequest, type Role } from './data'

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
}

const AppContext = createContext<AppState | null>(null)

const SELF_ID = 'self'

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('student')
  const [dark, setDark] = useState(false)
  const [childId, setChildId] = useState('raka')
  const [query, setQuery] = useState('')
  const [today, setToday] = useState<TodayRecord | null>(null)
  const [pending, setPending] = useState<PendingRequest[]>(INITIAL_PENDING)
  const [reviewed, setReviewed] = useState<ReviewedRequest[]>([])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  function submitToday(record: Omit<TodayRecord, 'approval'>) {
    const needsApproval = record.status === 'izin' || record.status === 'sakit'
    setToday({ ...record, approval: needsApproval ? 'pending' : 'approved' })
    if (needsApproval) {
      // The student's own request shows up in the homeroom teacher's queue.
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
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

// The student whose data is shown: the student themself, or the parent's selected child.
export function useActiveStudentId() {
  const { role, childId } = useApp()
  return role === 'student' ? 'raka' : childId
}
