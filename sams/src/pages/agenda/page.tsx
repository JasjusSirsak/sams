import { AgendaTimeline } from '@/components/agenda/agenda-timeline'
import { PageHeader } from '@/components/ui-kit'

export default function AgendaPage() {
  return (
    <>
      <PageHeader title="Agenda" subtitle="Upcoming school and academic activities" />
      <AgendaTimeline />
    </>
  )
}
