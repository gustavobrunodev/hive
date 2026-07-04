import * as React from "react"
import * as S from "@ds-stories/src/components/Label/Label.stories"

function compose(S: any, key: string) {
  const meta: any = S.default ?? {}
  const st: any = S[key]
  const args: any = { ...(meta.args ?? {}), ...(st && st.args ? st.args : {}) }
  const at: any = { ...(meta.argTypes ?? {}), ...(st && st.argTypes ? st.argTypes : {}) }
  for (const k of Object.keys(args)) {
    const m = at[k] && at[k].mapping
    if (m && typeof m === "object" && args[k] in m) args[k] = m[args[k]]
  }
  const title: string = typeof meta.title === "string" ? meta.title : ""
  const ctx: any = {
    args, name: key, title, kind: title, id: "", componentId: "",
    globals: {}, viewMode: "story",
    parameters: (st && st.parameters) ?? meta.parameters ?? {},
  }
  let render: (() => any) | null = null
  if (st && typeof st.render === "function") render = () => st.render(args, ctx)
  else if (typeof st === "function") render = () => st(args, ctx)
  else if (typeof meta.render === "function") render = () => meta.render(args, ctx)
  else {
    const C = (st && st.component) || meta.component
    if (C) render = () => React.createElement(C, args)
  }
  if (!render) return () => null
  const decorators: any[] = ([] as any[]).concat((st && st.decorators) ?? []).concat(meta.decorators ?? [])
  return decorators.reduce((inner: any, dec: any) => () => {
    const out = dec(inner, ctx)
    return out === undefined ? inner() : out
  }, render)
}

// Same fix as the owned Input.tsx preview: Label's stories embed an Input
// (width: 100% by design, unconstrained here), and storybook's
// `layout: "centered"` shrink-wrap has no equivalent in the capture harness.
// Bounding at 320px mirrors Field's own stories.
function centered(Story: React.ComponentType) {
  return (
    <div style={{ width: "fit-content" }}>
      <Story />
    </div>
  )
}

const ComposedDefault = compose(S, "Default")
const ComposedRequired = compose(S, "Required")

export const Default = () => centered(ComposedDefault)
export const Required = () => centered(ComposedRequired)
