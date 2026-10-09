'use client'

import { useApp } from '@/lib/app-context'
import { canAccess } from '@/lib/helpers'
import { ApprovalList } from '@/components/attendance/approval-list'
import { Forbidden, PageHeader } from '@/components/ui-kit'

export default function ApprovalsPage() {
  const { role } = useApp()
  if (!canAccess(role, '/approvals')) return <Forbidden />

  return (
    <>
      <PageHeader title="Attendance approvals" subtitle="Review sick (Sakit) and permission (Izin) requests from your class." />
      <ApprovalList showReviewed />
    </>
  )
}
