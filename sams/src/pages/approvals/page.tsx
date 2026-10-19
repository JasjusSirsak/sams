'use client'

import { ApprovalList } from '@/components/attendance/approval-list'
import { PageHeader } from '@/components/ui-kit'

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader title="Attendance approvals" subtitle="Review sick and permission requests from your class." />
      <ApprovalList showReviewed />
    </>
  )
}
