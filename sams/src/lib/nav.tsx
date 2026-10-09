import { createContext, useContext, useEffect, useState, type MouseEvent, type ReactNode } from 'react'

type NavState = {
  pathname: string
  push: (to: string) => void
}

const NavContext = createContext<NavState | null>(null)

export function NavProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(() => window.location.pathname || '/')

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname || '/')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function push(to: string) {
    window.history.pushState({}, '', to)
    setPathname(to)
  }

  return <NavContext.Provider value={{ pathname, push }}>{children}</NavContext.Provider>
}

function useNav() {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('Navigation hooks must be used inside NavProvider')
  return ctx
}

export function usePathname() {
  return useNav().pathname
}

export function useRouter() {
  const { push } = useNav()
  return { push }
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
