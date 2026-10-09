import { TODAY } from '@/lib/data'
import { formatLong, greeting } from '@/lib/helpers'

export function Hero({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl bg-hero text-white">
      <img
        src="/images/hero-illustration.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-right opacity-40 sm:opacity-100"
      />
      <div className="relative px-6 py-8 sm:px-8 sm:py-10">
        <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{formatLong(TODAY)}</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl" suppressHydrationWarning>
          {greeting()}, {name.split(' ')[0]}!
        </h1>
        <p className="mt-2 text-sm text-white/85">{subtitle}</p>
      </div>
    </section>
  )
}
