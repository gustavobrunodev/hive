import React, { useRef } from "react"
import { act, render } from "@testing-library/react"
import { cx } from "./cx"
import { escalaBonita, passoDosRotulos } from "./escala"
import { formatarNumero, porcentagem } from "./numeros"
import { useLarguraDoConteiner } from "./useLarguraDoConteiner"

describe("utils", () => {
  it("cx descarta falsos", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b")
  })

  it("números em pt-BR e porcentagem", () => {
    expect(formatarNumero(1796)).toBe("1.796")
    expect(porcentagem(388, 2592)).toBe(15)
    expect(porcentagem(1, 0)).toBe(0)
  })

  it.each([
    [33, 10, 40],
    [1796, 500, 2000],
    [9, 2.5, 10],
    [0, 1, 1],
    [120, 50, 150],
  ])("escalaBonita(%s) passo %s topo %s", (max, passo, topo) => {
    expect(escalaBonita(max)).toEqual({ passo, topo })
  })

  it("passoDosRotulos deixa ~52px por rótulo", () => {
    expect(passoDosRotulos(13, 416)).toBe(2)
    expect(passoDosRotulos(13, 900)).toBe(1)
    expect(passoDosRotulos(13, 60)).toBe(7)
  })
})

describe("useLarguraDoConteiner", () => {
  function Sonda({ fixa }: { fixa?: number }) {
    const ref = useRef<HTMLDivElement>(null)
    const largura = useLarguraDoConteiner(ref, fixa, 300)
    return React.createElement("div", { ref, "data-largura": largura })
  }

  it("usa a largura fixa sem medir", () => {
    const { container } = render(React.createElement(Sonda, { fixa: 640 }))
    expect(container.firstChild).toHaveAttribute("data-largura", "640")
  })

  it("mede com ResizeObserver e ignora medidas vazias", () => {
    const original = globalThis.ResizeObserver
    let avisar: ResizeObserverCallback = () => {}
    const desconectar = vi.fn()
    globalThis.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        avisar = cb
      }
      observe() {}
      unobserve() {}
      disconnect = desconectar
    } as unknown as typeof ResizeObserver
    const { container, unmount } = render(React.createElement(Sonda))
    expect(container.firstChild).toHaveAttribute("data-largura", "300")
    act(() => avisar([{ contentRect: { width: 0 } } as ResizeObserverEntry], {} as ResizeObserver))
    expect(container.firstChild).toHaveAttribute("data-largura", "300")
    act(() => avisar([{ contentRect: { width: 811.6 } } as ResizeObserverEntry], {} as ResizeObserver))
    expect(container.firstChild).toHaveAttribute("data-largura", "812")
    unmount()
    expect(desconectar).toHaveBeenCalled()
    globalThis.ResizeObserver = original
  })

  it("sem ResizeObserver fica no padrão", () => {
    const original = globalThis.ResizeObserver
    // @ts-expect-error simulando ambiente sem ResizeObserver
    delete globalThis.ResizeObserver
    const { container } = render(React.createElement(Sonda))
    expect(container.firstChild).toHaveAttribute("data-largura", "300")
    globalThis.ResizeObserver = original
  })
})
