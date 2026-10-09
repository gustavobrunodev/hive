import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { mentionQueryAt, openMentionAt } from '../../chat/composerMentions'

/**
 * The field's `@` (criterion 6): an `@` token at the caret opens the list of
 * Dores, and choosing one takes the token out of the text and cites the Dor
 * instead. The token rules are the Hive composer's own (`composerMentions.ts`)
 * — the source is the Produto's Dores, not the workspace's files.
 */

/** An option's id in the `@` list, for the field's `aria-activedescendant`. */
export function opcaoId(lista: string, index: number): string {
  return `${lista}-${index}`
}

export interface Arroba {
  aberta: boolean
  /** What was typed after the `@`. */
  consulta: string
  destaque: number
  setDestaque: (index: number) => void
  fechar: () => void
  /** Types an `@` at the caret, as "Citar uma Dor" does. */
  abrir: () => void
  /** Takes the open token out of the text — the chosen Dor is cited, not written. */
  consumir: () => void
  /** Re-reads the caret and re-arms the list after an edit. */
  aoEditar: () => void
  /**
   * The list's keys, from the field's capture phase: arrows move, Enter picks,
   * Esc closes. `true` when the key was the list's, so the field does not send.
   */
  teclado: (event: KeyboardEvent<HTMLElement>, total: number, escolher: (i: number) => void) => void
}

export function useArroba(
  texto: string,
  setTexto: (texto: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>
): Arroba {
  const [caret, setCaret] = useState(0)
  const [fechada, setFechada] = useState(false)
  const [destaque, setDestaque] = useState(0)
  const caretPendente = useRef<number | null>(null)

  const token = mentionQueryAt(texto, Math.min(caret, texto.length))
  const aberta = token !== null && !fechada

  const aoEditar = useCallback(() => {
    setFechada(false)
    setDestaque(0)
    const node = textareaRef.current
    if (node) setCaret(node.selectionStart ?? node.value.length)
  }, [textareaRef])

  const abrir = useCallback(() => {
    const node = textareaRef.current
    const em = node ? (node.selectionStart ?? texto.length) : texto.length
    const proximo = openMentionAt(texto, em)
    caretPendente.current = proximo.caret
    setFechada(false)
    setDestaque(0)
    setTexto(proximo.value)
  }, [texto, setTexto, textareaRef])

  const consumir = useCallback(() => {
    if (token === null) return
    const fim = Math.min(caret, texto.length)
    const semToken = texto.slice(0, token.start) + texto.slice(fim)
    caretPendente.current = token.start
    setDestaque(0)
    setTexto(semToken)
  }, [token, caret, texto, setTexto])

  // The caret lands after the commit that carries the new text.
  useEffect(() => {
    const alvo = caretPendente.current
    if (alvo === null) return
    caretPendente.current = null
    const node = textareaRef.current
    if (node) {
      node.focus()
      node.setSelectionRange(alvo, alvo)
    }
    setCaret(alvo)
  }, [texto, textareaRef])

  const fechar = useCallback(() => setFechada(true), [])

  const teclado = useCallback(
    (event: KeyboardEvent<HTMLElement>, total: number, escolher: (i: number) => void) => {
      if (!aberta) return
      const passos: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
      if (event.key in passos && total > 0) {
        event.preventDefault()
        event.stopPropagation()
        setDestaque((atual) => (atual + passos[event.key] + total) % total)
        return
      }
      if (event.key === 'Enter' && !event.shiftKey && total > 0) {
        event.preventDefault()
        event.stopPropagation()
        escolher(Math.min(destaque, total - 1))
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setFechada(true)
      }
    },
    [aberta, destaque]
  )

  return {
    aberta,
    consulta: token?.query ?? '',
    destaque,
    setDestaque,
    fechar,
    abrir,
    consumir,
    aoEditar,
    teclado
  }
}
