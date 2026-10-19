import { Link } from '@/lib/nav'
import { PageHeader, buttonSecondary } from '@/components/ui-kit'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <PageHeader title="404 · Page not found" subtitle="The page you requested does not exist." />
      <Link href="/" className={buttonSecondary}>
        Go to dashboard
      </Link>
    </div>
  )
}
