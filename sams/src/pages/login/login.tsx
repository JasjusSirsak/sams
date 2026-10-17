'use client'

import { LoginForm } from '@/components/auth/login-form'

const HIGHLIGHTS = [
  { title: 'Daily attendance', desc: 'Present, permission, and sick in one click.' },
  { title: 'Grades & teaching journal', desc: 'Monitor learning progress per class.' },
  { title: 'School agenda', desc: "Don't miss important schedules." },
]

export default function LoginPage() {
  return (
    <main className="flex min-h-screen bg-slate-50">
      {/* Left panel — branding (desktop only) */}
      <aside className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 p-12 lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/10" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-lg font-bold text-white">S</div>
          <div>
            <p className="text-lg font-bold tracking-tight text-white">SAMS</p>
            <p className="text-xs text-blue-100">School Administration &amp; Management System</p>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold leading-snug text-white">Welcome back</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-blue-100">
            Attendance, grades, journals, and school agenda — all organized in one place.
          </p>
          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-200" />
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-blue-100">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-blue-200">© 2026 SAMS</p>
      </aside>

      {/* Right panel — form */}
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-lg font-bold text-white">S</div>
            <p className="text-lg font-bold tracking-tight text-slate-900">SAMS</p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Sign in to your account</h2>
          <p className="mt-1.5 text-sm text-slate-500">Enter your credentials to continue to the dashboard.</p>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  )
}