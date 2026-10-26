import type { Role } from './data'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const dayName = (d: Date) => DAYS[d.getDay()]
export const shortDay = (d: Date) => DAYS[d.getDay()].slice(0, 3)
export const formatLong = (d: Date) => `${dayName(d)}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
export const formatShort = (d: Date) => `${shortDay(d)}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`

export function toKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Good morning'
  if (h < 15) return 'Good afternoon'
  if (h < 18) return 'Good evening'
  return 'Good night'
}

// Daily 40% + Midterm 30% + Final 30%
export function finalScore(g: { daily: number | null; midterm: number | null; final: number | null }) {
  if (g.daily == null || g.midterm == null || g.final == null) return null
  return Math.round(g.daily * 0.4 + g.midterm * 0.3 + g.final * 0.3)
}

export function average(values: number[]) {
  if (values.length === 0) return 0
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// Which pages each role may open. UX only — the backend must still authorize.
export const ACCESS: Record<string, Role[]> = {
  '/': ['student', 'parent', 'teacher', 'admin', 'staff'],
  '/approvals': ['teacher'],
  '/attendance': ['student', 'parent', 'teacher'],
  '/grades': ['student', 'parent', 'teacher'],
  '/students': ['teacher'],
  '/agenda': ['student', 'parent', 'teacher'],
  '/admin/classes': ['admin', 'staff'],
  '/admin/subjects': ['admin', 'staff'],
  '/admin/academic-periods': ['admin', 'staff'],
  '/admin/teachers': ['admin'],
  '/admin/students': ['admin'], 
}

export const canAccess = (role: Role, href: string, isHomeroom = false) =>
  (ACCESS[href] ?? []).includes(role) && (href !== '/approvals' || isHomeroom)

export function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
