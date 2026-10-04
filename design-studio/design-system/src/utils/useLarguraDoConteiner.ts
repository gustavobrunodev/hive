import { useEffect, useState, type RefObject } from "react"

/**
 * Largura do contêiner, medida com ResizeObserver. Com `fixa`, usa ela e não mede.
 * Sem ResizeObserver (ou antes da primeira medida) devolve `padrao`.
 */
export function useLarguraDoConteiner(ref: RefObject<HTMLElement | null>, fixa?: number, padrao = 520): number {
  const [medida, setMedida] = useState(padrao)
  useEffect(() => {
    if (fixa !== undefined || !ref.current || typeof ResizeObserver === "undefined") return
    const observador = new ResizeObserver((entradas) => {
      const largura = entradas[0]?.contentRect.width
      if (largura && largura > 0) setMedida(Math.round(largura))
    })
    observador.observe(ref.current)
    return () => observador.disconnect()
  }, [ref, fixa])
  return fixa ?? medida
}
