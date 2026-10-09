// Mock service layer. Later, swap these bodies for Axios calls to the Express API,
// e.g. `return apiClient.post('/attendance', payload)`.

function delay<T>(data: T, ms = 700): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export function submitAttendance(payload: { status: string; note: string; evidence: string | null }) {
  return delay({ ok: true, ...payload })
}

export function saveGrades(classId: string, rows: unknown[]) {
  return delay({ ok: true, classId, count: rows.length }, 900)
}

export function reviewRequest(id: string, decision: 'approved' | 'rejected') {
  return delay({ ok: true, id, decision }, 500)
}

export function generateReport(className: string) {
  return delay({ file: `${className.replace(/\s+/g, '-')}-Semester-1.pdf` }, 1200)
}
