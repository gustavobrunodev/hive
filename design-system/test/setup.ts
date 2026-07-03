import "@testing-library/jest-dom/vitest"

// jsdom doesn't implement ResizeObserver. Radix (ScrollArea/Select) and
// useAutosizeTextarea both feature-detect it (`typeof ResizeObserver !==
// "undefined"`), so a minimal no-op stand-in is enough to exercise those
// code paths under test.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver
}

// jsdom ships window.matchMedia as undefined by default; useReveal and
// upcoming Radix-backed components (reduced-motion checks) call it
// unconditionally. Individual tests still override it per-case when they
// need to control `.matches`, so this only needs to be a safe default.
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

// jsdom doesn't implement scrollIntoView (used by Radix Select/ScrollArea
// and list-style components to keep the active item in view).
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

// jsdom doesn't implement the Pointer Events capture API. Radix Select
// (and other pointer-driven primitives) call these unconditionally on
// pointerdown/pointerup, so a no-op/false stand-in is enough to exercise
// those code paths under test.
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function hasPointerCapture() {
      return false
    }
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function setPointerCapture() {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function releasePointerCapture() {}
  }
}
