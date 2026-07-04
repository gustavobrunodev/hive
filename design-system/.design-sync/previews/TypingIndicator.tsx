import * as React from 'react';
import * as S from "@ds-stories/src/components/TypingIndicator/TypingIndicator.stories";

// TypingIndicator's story parameters set `layout: "centered"` — storybook
// shrink-wraps the canvas to the component's intrinsic (inline-flex) width.
// The preview card has no such wrapping, so the component stretches
// full-bleed across the card. `width:"fit-content"` reproduces storybook's
// shrink-wrap without hardcoding a pixel guess (same knob used for Textarea).
function withFitContent(Comp: any) {
  return function FitContent() {
    return React.createElement('div', { style: { width: 'fit-content' } }, React.createElement(Comp));
  };
}

function compose(S: any, key: string) {
  const meta: any = S.default ?? {};
  const st: any = S[key];
  const args: any = { ...(meta.args ?? {}), ...(st && st.args ? st.args : {}) };
  // Storybook resolves argTypes.mapping (control value -> real arg) before
  // rendering; mirror that so mapped args don't render raw.
  const at: any = { ...(meta.argTypes ?? {}), ...(st && st.argTypes ? st.argTypes : {}) };
  for (const k of Object.keys(args)) {
    const m = at[k] && at[k].mapping;
    if (m && typeof m === 'object' && args[k] in m) args[k] = m[args[k]];
  }
  const title: string = typeof meta.title === 'string' ? meta.title : '';
  const ctx: any = {
    args, name: key, title, kind: title, id: '', componentId: '',
    globals: {}, viewMode: 'story',
    parameters: (st && st.parameters) ?? meta.parameters ?? {},
  };
  let render: (() => any) | null = null;
  if (st && typeof st.render === 'function') render = () => st.render(args, ctx);
  else if (typeof st === 'function') render = () => st(args, ctx);
  else if (typeof meta.render === 'function') render = () => meta.render(args, ctx);
  else {
    const C = (st && st.component) || meta.component;
    if (C) render = () => React.createElement(C, args);
  }
  if (!render) return () => null;
  // [].concat: a single function is legal CSF decorator shorthand. A
  // decorator returning undefined (stubbed addon) falls through to the inner
  // render — otherwise one unrecognized addon blanks the cell silently.
  const decorators: any[] = ([] as any[]).concat((st && st.decorators) ?? []).concat(meta.decorators ?? []);
  return decorators.reduce((inner: any, dec: any) => () => {
    const out = dec(inner, ctx);
    return out === undefined ? inner() : out;
  }, render);
}

export const Default = /* Default */ withFitContent(compose(S, "Default"));
export const StableFrame = /* Stable Frame */ withFitContent(compose(S, "StableFrame"));
export const CustomLabel = /* Custom Label */ withFitContent(compose(S, "CustomLabel"));
export const ReducedMotion = /* Reduced Motion */ withFitContent(compose(S, "ReducedMotion"));
