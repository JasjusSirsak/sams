import { createContext, useContext, useEffect, useState, type MouseEvent, type ReactNode } from 'react'

type NavState = {
  pathname: string
  search: string
  push: (to: string) => void
  replace: (to: string) => void
}

const NavContext = createContext<NavState | null>(null)

export function NavProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(() => window.location.pathname || '/')
  const [search, setSearch] = useState(() => window.location.search)

  function syncLocation() {
    setPathname(window.location.pathname || '/')
    setSearch(window.location.search)
  }

  useEffect(() => {
    window.addEventListener('popstate', syncLocation)
    return () => window.removeEventListener('popstate', syncLocation)
  }, [])

  function push(to: string) {
    window.history.pushState({}, '', to)
    syncLocation()
  }

  function replace(to: string) {
    window.history.replaceState({}, '', to)
    syncLocation()
  }

  return <NavContext.Provider value={{ pathname, search, push, replace }}>{children}</NavContext.Provider>
}

function useNav() {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('Navigation hooks must be used inside NavProvider')
  return ctx
}

export function usePathname() {
  return useNav().pathname
}

export function useSearchParams() {
  return new URLSearchParams(useNav().search)
}

export function useRouter() {
  const { push, replace } = useNav()
  return { push, replace }
}

type LinkProps = {
  href: string
  children: ReactNode
  onClick?: () => void
  className?: string
  'aria-current'?: 'page'
}

export function Link({ href, children, onClick, className, ...rest }: LinkProps) {
  const { push } = useNav()

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    push(href)
    onClick?.()
  }

  return (
    <a href={href} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
