import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Keep floating controls inside the pane below them, including during a resize. */
export function useNavbarBounds(pane: string, sidebarOpen: boolean): RefObject<HTMLDivElement> {
  const shell = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const host = shell.current
    const target = host?.querySelector<HTMLElement>('[data-navtop]')
    if (!host || !target) return
    const measure = (): void => {
      const right = target.getBoundingClientRect().right - host.getBoundingClientRect().left
      host.style.setProperty('--wb-navbar-width', `${right}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    return () => observer.disconnect()
  }, [pane, sidebarOpen])
  return shell
}
