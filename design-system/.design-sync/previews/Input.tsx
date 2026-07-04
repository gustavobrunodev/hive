import * as React from "react"
import * as S from "@ds-stories/src/components/Input/Input.stories"

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

// Storybook's `layout: "centered"` parameter shrink-wraps the story to its
// content's intrinsic width; the design-sync capture harness has no
// equivalent (it screenshots the full viewport), so `Input`'s intentional
// `width: 100%` (dist/ds-bundle.css — Field/Select constrain width via their
// own wrapper, Input doesn't by design) stretches full-bleed here instead of
// shrink-wrapping like storybook. Bounding at 320px mirrors the width Field's
// own stories already give their embedded Input/Select controls.
function centered(Story: React.ComponentType) {
  return (
    <div style={{ width: "fit-content" }}>
      <Story />
    </div>
  )
}

const ComposedDefault = compose(S, "Default")
const ComposedFocused = compose(S, "Focused")
const ComposedWithError = compose(S, "WithError")
const ComposedDisabled = compose(S, "Disabled")
const ComposedWithStartIcon = compose(S, "WithStartIcon")

export const Default = () => centered(ComposedDefault)
export const Focused = () => centered(ComposedFocused)
export const WithError = () => centered(ComposedWithError)
export const Disabled = () => centered(ComposedDisabled)
export const WithStartIcon = () => centered(ComposedWithStartIcon)
