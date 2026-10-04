import "@testing-library/jest-dom/vitest"

// jsdom não tem ResizeObserver; o GraficoDeLinha mede o contêiner com ele e
// cai numa largura padrão quando não existe. Este substituto não mede nada:
// os testes que precisam de largura passam `largura` explícita.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverSubstituto {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverSubstituto as unknown as typeof ResizeObserver
}

// jsdom também não implementa matchMedia (usado para prefers-reduced-motion).
if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  window.matchMedia = function matchMedia(query: string): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  }
}

// jsdom não tem PointerEvent: sem ele, fireEvent.pointerMove chega sem clientX.
if (typeof window !== "undefined" && typeof window.PointerEvent === "undefined") {
  class PointerEventSubstituto extends MouseEvent {
    pointerId: number
    constructor(tipo: string, init: PointerEventInit = {}) {
      super(tipo, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
  window.PointerEvent = PointerEventSubstituto as unknown as typeof PointerEvent
}
