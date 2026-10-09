import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMountedLayers } from '../ui/useMountedLayers'
import { HOME_ROUTE, type DesignPage, type DesignRoute } from './routes'

/** A module conversation as the bridge lists it: a history row plus the Produto it belongs to. */
export type ModuleConversation = Awaited<
  ReturnType<Window['hive']['designStudio']['conversations']>
>[number]

/** Everything both halves of the module read — the navigation in the sidebar and the pages in the work area. */
export interface DesignStudioStore {
  route: DesignRoute
  navigate: (route: DesignRoute) => void
  /** Pages ever shown. They stay mounted, so leaving one costs nothing (criterion 4). */
  mountedPages: readonly DesignPage[]
  /**
   * The route each mounted page was last shown with. A page out of sight still
   * renders — it is a hidden layer, not a gone one — and a Relatório or a
   * conversation has to know which one it is while it waits.
   */
  pageRoutes: Readonly<Partial<Record<DesignPage, DesignRoute>>>
  /** The module's conversations, unsorted — `null` until the first listing lands. */
  conversations: readonly ModuleConversation[] | null
  /** When that listing landed: the render-stable "now" its relative times are read against. */
  loadedAt: number
  /** Reads the listing again — a conversation was started or answered inside the module. */
  recarregar: () => void
  /** The module is in front — what puts the caret in the home's field on arrival (task 1, criterion 1). */
  ativo: boolean
}

/**
 * The Design Studio's own state, held by the workbench above both halves.
 *
 * Held there — not inside the module's work layer — because the navigation
 * lives in the sidebar and the pages in the work pane, and the two have to
 * agree on where the person is. Being above the layer is also what keeps the
 * route when the person goes to the transcript and comes back (criterion 4);
 * a restart is a new mount, so the module reopens on its home (criterion 5).
 *
 * `active` is "the module is in front". The conversations are read on every
 * arrival rather than once: a conversation can be started, renamed or answered
 * while the module is away, and "Recentes" is only worth something if it is
 * current when it is looked at.
 */
export function useDesignStudio(active: boolean): DesignStudioStore {
  const [route, setRoute] = useState<DesignRoute>(HOME_ROUTE)
  const [pageRoutes, setPageRoutes] = useState<Partial<Record<DesignPage, DesignRoute>>>({
    [HOME_ROUTE.pagina]: HOME_ROUTE
  })
  const mountedPages = useMountedLayers<DesignPage>(route.pagina)
  const [listing, setListing] = useState<{
    conversations: readonly ModuleConversation[] | null
    loadedAt: number
  }>({ conversations: null, loadedAt: 0 })

  const [leitura, setLeitura] = useState(0)
  const recarregar = useCallback(() => setLeitura((n) => n + 1), [])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    window.hive.designStudio
      .conversations()
      .then((conversations) => {
        if (!cancelled) setListing({ conversations, loadedAt: Date.now() })
      })
      // A read that fails keeps what was there. Local disk failing is not "no
      // conversations", and saying so would be the one wrong answer.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [active, leitura])

  const navigate = useCallback((next: DesignRoute) => {
    setRoute(next)
    setPageRoutes((current) => ({ ...current, [next.pagina]: next }))
  }, [])

  // One object per change, not per render: both halves of the module take it
  // as a prop, and the workbench re-renders for reasons that have nothing to
  // do with the module.
  return useMemo(
    () => ({
      route,
      navigate,
      mountedPages,
      pageRoutes,
      conversations: listing.conversations,
      loadedAt: listing.loadedAt,
      recarregar,
      ativo: active
    }),
    [route, navigate, mountedPages, pageRoutes, listing, recarregar, active]
  )
}
