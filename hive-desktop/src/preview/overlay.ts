import { NODE_ID_ATTRIBUTE } from './dom'

/**
 * Design Studio (M18) — T3.6. The selection chrome, drawn inside the frame.
 *
 * It is drawn here rather than in the renderer because this side is the only
 * one that has the geometry: the parent sees an opaque box scaled by a
 * transform, not the boxes of 40 Components inside it.
 *
 * **The overlay lives outside the stage, as a sibling.** Selection is transient
 * state that never enters the document (spec: "o preset de viewport ou a
 * seleção … SHALL NOT entrar no log de undo"), and the export renders the same
 * tree — so a chrome node inside the stage would be a node the reconciler has
 * to special-case and the exported Bundle would carry. Keeping it outside makes
 * both problems not exist.
 */

export const OVERLAY_ID = 'hive-overlay'

/**
 * The accent, literal rather than tokenised: the frame is its own document and
 * never loads the app's theme, so `--accent` would resolve to nothing here.
 * Kept in sync by hand with `--coral` in the design system's `tokens.css`.
 */
const ACCENT = '#cc7958'

const STYLE = `
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483647;
}
#${OVERLAY_ID} .hive-box {
  position: fixed;
  display: none;
  box-sizing: border-box;
  transition: opacity 120ms ease-out;
}
#${OVERLAY_ID} .hive-hover {
  border: 1px solid color-mix(in oklab, ${ACCENT} 50%, transparent);
}
#${OVERLAY_ID} .hive-selected {
  border: 2px solid ${ACCENT};
}
#${OVERLAY_ID} .hive-chip {
  position: fixed;
  display: none;
  padding: 2px 6px;
  border-radius: 4px 4px 0 0;
  background: ${ACCENT};
  color: #fff;
  font: 500 11px/1.4 ui-sans-serif, system-ui, sans-serif;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  #${OVERLAY_ID} .hive-box {
    transition: none;
  }
}
`

/**
 * The deepest Component under a click.
 *
 * `composedPath()[0]` is the true innermost target and **crosses shadow
 * roots**, which is what makes clicking a nested Component work with no mode
 * switch (DS-R5): the first entry is usually a node inside some component's
 * shadow tree, so the path is walked outward to the first element that carries
 * a node id. The overlay is `pointer-events: none`, so it is never in the path.
 */
export function nodeIdFromPath(path: readonly EventTarget[]): string | null {
  for (const target of path) {
    if (!(target instanceof Element)) continue
    const id = target.getAttribute(NODE_ID_ATTRIBUTE)
    if (id !== null) return id
  }
  return null
}

export interface SelectionOverlay {
  /** Attaches the overlay as a sibling of the stage. */
  mount(): void
  /** Outlines an element as hovered, or clears the hover with `null`. */
  hover(element: Element | null): void
  /** Outlines an element as selected (2px + tag chip), or clears it. */
  select(element: Element | null): void
  /** Re-measures both outlines — after a render, a resize or a scroll. */
  refresh(): void
  dispose(): void
}

function place(box: HTMLElement, element: Element | null): void {
  if (!element) {
    box.style.display = 'none'
    return
  }
  const rect = element.getBoundingClientRect()
  box.style.display = 'block'
  box.style.left = `${rect.left}px`
  box.style.top = `${rect.top}px`
  box.style.width = `${rect.width}px`
  box.style.height = `${rect.height}px`
}

export function createSelectionOverlay(doc: Document): SelectionOverlay {
  const style = doc.createElement('style')
  style.textContent = STYLE

  const root = doc.createElement('div')
  root.id = OVERLAY_ID

  const hoverBox = doc.createElement('div')
  hoverBox.className = 'hive-box hive-hover'
  const selectedBox = doc.createElement('div')
  selectedBox.className = 'hive-box hive-selected'
  const chip = doc.createElement('div')
  chip.className = 'hive-chip'
  root.append(hoverBox, selectedBox, chip)

  let hovered: Element | null = null
  let selected: Element | null = null

  function drawSelection(): void {
    place(selectedBox, selected)
    if (!selected) {
      chip.style.display = 'none'
      return
    }
    const rect = selected.getBoundingClientRect()
    // `textContent`, never markup — the tag is data (AD-4).
    chip.textContent = selected.tagName.toLowerCase()
    chip.style.display = 'block'
    chip.style.left = `${rect.left}px`
    // Flips inside the element when it is flush against the top of the frame,
    // so the chip never leaves the viewport.
    chip.style.top = rect.top >= 18 ? `${rect.top - 18}px` : `${rect.top}px`
  }

  return {
    mount() {
      doc.head.appendChild(style)
      doc.body.appendChild(root)
    },
    hover(element) {
      hovered = element
      place(hoverBox, hovered)
    },
    select(element) {
      selected = element
      drawSelection()
    },
    refresh() {
      place(hoverBox, hovered)
      drawSelection()
    },
    dispose() {
      style.remove()
      root.remove()
      hovered = null
      selected = null
    }
  }
}
