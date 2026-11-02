import { AgendaTimeline } from '@/components/agenda/agenda-timeline'
import { PageHeader } from '@/components/ui-kit'
import { useApp } from '@/lib/app-context'
import StaffAgendaManagement from '@/pages/staff/agenda-management-page'

export default function AgendaPage() {
  const { role } = useApp()
  if (role === 'staff') return <StaffAgendaManagement />

  return (
    <>
      <PageHeader title="Agenda" subtitle="Upcoming school and academic activities" />
      <AgendaTimeline />
    </>
  )
}
