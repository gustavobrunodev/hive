# Hive Design System — sync notes

## Shape switch: package → storybook (2026-07-04)
Since the last sync (package shape, 2026-07-01), the repo completed a full
"storybook-documentation" feature (`.specs/features/storybook-documentation/`):
every component was rewritten from untyped JSX to typed TSX with real
`.d.ts`-worthy prop interfaces, and all 61 components now have real
`.stories.tsx` files plus MDX docs pages (Introduction/Tokens/Theming/
Accessibility) and sidebar ordering. This sync switches `cfg.shape` from
`"package"` to `"storybook"` to use those stories as the fidelity oracle
instead of hand-authored previews.

Consequences applied this run:
- **Dropped `cfg.componentSrcMap` and `cfg.dtsPropsFor` entirely.** Both were
  built for the old JSX source (paths like `src/components/Button/Button.jsx`
  no longer exist — every component is `.tsx` now) and hand-derived prop
  bodies that predate real types. Auto-extraction via ts-morph should now
  produce accurate `.d.ts` files from the real TypeScript interfaces; only
  re-add entries if `[DTS_PARSE]`/`[ZERO_MATCH]` fire for a specific component.
- **Dropped the old `cfg.overrides` cardMode entries** (`CaseGrid`,
  `ModeSplit`, `SkillGrid`, `Flow`, `Step`, `Steps`, `Sub`, `Substeps`,
  `ValueGrid`) — these were sub-export aliases from old multi-export files
  (`Table.jsx`, `Timeline.jsx`) that no longer exist as separate names in the
  typed rewrite. Re-derive `cardMode`/`skip` overrides fresh from this run's
  `[GRID_OVERFLOW]`/`[PORTAL?]` findings against the current component set.
- **Archived the 39 old package-shape authored previews** to
  `.design-sync/.archive/previews-package-shape-2026-07-01/` (git-mv, full
  history preserved) and started `.design-sync/previews/` empty. This was
  necessary, not just cleanup: 21 of those files shared a name with a real
  current component (Button, Badge, Panel, Terminal, SkillCard, ValueCard,
  CaseCard, ModeBlock, Nav, Footer, DotsBackground, Reveal, SectionHeading,
  Callout, Chip, PinChip, CodeBlock, BrandMark, Logo, SteppedList, Table) —
  left in place, the storybook shape's "owned preview wins over generated"
  rule would have silently shadowed the new real story-compiled previews with
  stale hand-invented JSX for exactly the components this switch is meant to
  make higher-fidelity.
- The Google Fonts snapshot (`.design-sync/fonts/google-fonts.css`,
  `cfg.extraFonts`) and `cfg.cssEntry: "dist/ds-bundle.css"` still apply — the
  brand-font and CSS-extraction setup is unrelated to the source shape.

## Pre-existing repo facts (still true)
- **`HarnessMark`** has its own hand-rolled `window.__dsPreview`-style preview
  file (`src/components/HarnessMark/HarnessMark.preview.tsx`) and a
  `HarnessMark.prompt.md`, predating this skill's storybook-shape workflow —
  looks like an earlier manual/parallel exploration of the same idea. It also
  has a real `.stories.tsx`, so the storybook-shape converter uses that
  normally; `.storybook/main.ts`'s stories glob explicitly excludes
  `.design-sync/**` and `*.preview.tsx` files so they never collide with real
  CSF3 stories. Left as-is — not part of this sync's output.
- **`Logo`'s `mark="full"` only exists in `tone="color"`** — no black/white
  sibling SVG. Requesting `mark="full"` with `tone="black"`/`"white"` silently
  falls back to the simple mark. Not a bug.

## Solo-phase findings (this run)
- **`cfg.titleMap: {"Timeline": "Step"}`** — the `Timeline.tsx` module exports
  6 components (`Flow`, `SpineLabel`, `Steps`, `Step`, `Substeps`, `Sub`) but
  its story file's `meta.title` is `"Navigation/Timeline"` with
  `meta.component: Step` — no single export is literally named `Timeline`, so
  discovery needs the explicit map. The `FullFlow` story composes all six
  together; the other three stories (`HighlightedStep`/`DefaultStep`/
  `LastStep`) exercise `Step` alone.
- **`cfg.overrides` cardMode fixes applied** (from `[GRID_OVERFLOW]` on the
  first validate): `PromptInput`, `SkillCard`, `Field`, `Nav`, `Step`,
  `Command` → `cardMode: "column"` (stories wider than a grid cell); `Select`
  → `cardMode: "single", primaryStory: "Default"` (portal/fixed-position
  content escaping the cell).
- **`[ASSETS_BLOCKED]` on `Avatar`'s "Broken image → fallback" story is
  expected, not a sandbox problem.** That story's `src` is deliberately
  `https://broken.invalid/does-not-exist.png` — it's testing the fallback UI,
  not a real asset dependency. Confirmed both panels rendered the real
  `https://i.pravatar.cc/128?img=12` photo in the "With Image" story
  identically, so the sandbox does have real egress; only the intentionally-
  unreachable host "failed". No action needed on future re-syncs unless a
  *different*, unintentional host starts appearing in that warning.
- Solo set (Button, Dialog, Avatar, CodeBlock) initially all graded `match` —
  but see the card-background bug below: Button's `Ghost` story was wrongly
  sibling-trusted without opening the image, and was actually broken until
  the fix landed.

## [GENERAL] Card background vs dark theme (found in wave 1, fixed this run)
Every ghost-variant button and translucent/theme-tuned surface (Alert, Toast,
Badge, Empty, AlertDialog/Sheet/DropdownMenu/Popover/ContextMenu ghost
triggers) rendered illegible — light-on-white, near-invisible — in the
compiled preview card while storybook rendered them fine. Found independently
by 3 of 4 wave-1 subagents (overlays/feedback/brand batches), which is what
made it unmistakably systemic rather than per-component.

**Root cause**: `.ds-sync/lib/emit.mjs`'s card HTML template hardcodes
`body{background:#fff}` inline in `<head>`, which wins the CSS cascade (same
specificity, later in source) over the DS's own `body{background:var(--bg)}`
rule from `dist/ds-bundle.css`. The bundled `withTheme` decorator still sets
`data-theme="dark"` on `document.documentElement`, flipping `--ink`/`--muted`
etc. to their light-on-dark values — so ghost/translucent elements that rely
on the ambient page background instead of an explicit opaque fill of their
own ended up with dark-theme ink on a white page. `emit.mjs` is explicitly
off-limits to fork (app-contract surface, self-check reads its structure),
and there's no `cfg.*` override for this (checked the whole field table).

**Fix applied** (`.design-sync/entries/card-backdrop.tsx`, wired via
`cfg.extraEntries` + `cfg.provider: {"component": "CardBackdrop"}`): a small
owned component that paints a full-bleed `var(--bg)` panel behind every
mounted preview. Two non-obvious pitfalls hit while building this fix — both
now documented in the component's own header comment, worth re-reading before
touching it:
1. The backdrop must be `position: absolute; inset: 0`, **not** `fixed`.
   `position: fixed` seemed natural (paint behind everything) but validate's
   `[GRID_OVERFLOW]` "escape" detector flags ANY visible `position:fixed`
   element regardless of whether it actually escapes its cell — it mis-flagged
   all 61 components at once. `absolute` works identically here because
   `.ds-cell`/`.ds-single` already have `transform: translateZ(0)` (emit.mjs),
   which makes them the containing block for an absolutely-positioned
   descendant too — no extra wrapper needed, and it's invisible to that
   fixed-only heuristic.
2. Setting `cfg.provider` **skips bundling the `.storybook/preview.ts`
   decorators entirely** (build log: "decorator auto-detect skipped —
   cfg.provider is set") — `window.__dsDecorate` isn't superseded, it's never
   defined. This silently broke `data-theme` (fell back to the light-theme
   `@media (prefers-color-scheme: light)` block, confirmed empirically with a
   throwaway Playwright script). The fix replicates `withTheme`'s one actual
   side effect (`document.documentElement.setAttribute("data-theme","dark")`)
   directly in `CardBackdrop` instead of depending on the decorator bundle. If
   `.storybook/preview.ts` ever grows more decorators beyond `withTheme`,
   they'd need replicating here too — check before assuming carry-forward.

Verified via direct visual re-inspection of raw screenshots (not just
trusting the fix), spanning Button/Alert/Toast/Badge/Empty/AlertDialog/
ContextMenu/DropdownMenu/Popover/Sheet/Tooltip — all now match. If a future
component still reads illegible after this, suspect a NEW distinct cause, not
a regression of this one (the fix is global and content-agnostic).

## [GENERAL] Input/Label full-bleed width (found + fixed in wave 1)
`Input` and `Label` (which embeds an unwrapped `Input`) stretched full-bleed
width (~852px) in the compiled preview vs storybook's shrink-wrapped
intrinsic width (~258px). Root cause: `.hds-input{width:100%}` is intentional
(Field/Select constrain width via their own wrapper div — same pattern), and
Storybook's `layout:"centered"` parameter shrink-wraps the story via a
flex/sizing mechanism the design-sync capture harness doesn't replicate.
Confirmed not a bug in any component WITH an explicit-width ancestor (Field,
Select) — those measured pixel-identical.

**Fix applied**: owned `.design-sync/previews/{Input,Label}.tsx`, wrapping
each exported story in `<div style={{width:"fit-content"}}>`. This empirically
reproduces storybook's shrink-wrap almost exactly (measured ~260px vs
storybook's 258px) — a `maxWidth:320` guess was tried first and rejected
(visibly wider than storybook, not a real match). Any other component whose
own intrinsic-width control has no explicit-width ancestor in its stories
would hit the same symptom — same `fit-content` wrapper is the fix.

## Logo: storybook reference itself is broken (found in wave 1, config fix applied)
5 of `Logo`'s 7 stories are `sb-error` and the other 2 render broken/
overlapping raw-URL text — in the **storybook reference**, not the preview.
Root cause: `Logo.tsx` injects imported `.svg` files via
`dangerouslySetInnerHTML`; the package's own esbuild build inlines the raw
SVG markup as a string (correct), but Storybook's Vite pipeline resolves the
same `.svg` import to a file URL instead — dropping a URL string into
`dangerouslySetInnerHTML` renders literal text, collapsing to zero height
under `.hds-logo{line-height:0}` (invisible) or, where a story's own wrapper
gives it a nonzero box, painting garbled overlapping text. Confirmed via the
compiled preview (correct, using the real bundle) vs the reference screenshot
(broken) side by side. **Fixed via `cfg.overrides.Logo.skip`** for all 7
story ids — the real component is fine; only Storybook's asset resolution for
this one component is broken, so there's nothing to verify against. Not
`[GENERAL]` — no other component uses `dangerouslySetInnerHTML` for assets.

## [GENERAL] Card backdrop paints the whole card row, not just the content box (found in wave 2 — expected, not a defect)
`VisuallyHidden` and `TypingIndicator` (both small, narrow, `layout:"centered"`
components) showed an extraneous flat-color band beyond their actual visible
content in the compiled preview, absent from storybook's tightly-cropped
canvas. Root cause: `CardBackdrop` (the fix above) is a *sibling* of the
mounted story inside the card HTML (`h(CardBackdrop, {}, h(Preview))`), sized
to the outer `.ds-single`/`.ds-cell` row (block-level, full card width/height
— that row is its containing block per its own `translateZ(0)`), not to the
story's own content box. Two wave-2 batches (layout, ai-chat) independently
hit and correctly diagnosed this as the SAME cause. It's inherent to how the
backdrop fix works (every card gets a full backdrop, by design) — confirmed
NOT fixable by wrapping the inner story content in `width:"fit-content"`
(tried on both, verified via before/after diff to be a no-op, since
`CardBackdrop` sits structurally outside that inner wrapper). Graded `close`
on the affected stories rather than `match` — the actual component content is
pixel-correct, only the surrounding canvas differs, which is a legitimate
framing difference per the rubric, but conservative grading was kept since
the band is visually distinct from a normal cropping difference. No fix
needed or attempted; this is expected steady-state behavior of the backdrop.

## [GENERAL] Reference storybook missing brand `@font-face` (found + fixed in wave 2)
`.design-sync/sb-reference/iframe.html` never got the brand `@font-face`
rules (Funnel Display, Inter, Inter Tight) that the real compiled bundle has
via `cfg.extraFonts` — it only carries Storybook's own UI font (Nunito Sans).
`.storybook/preview.ts`'s comment claims "the DS's fonts already ship
`@font-face` rules reachable through this import chain" via `import
"../src/base.css"`, but `base.css` only declares the `--ff-*` custom
properties, never an actual `@font-face` — so the storybook reference (and,
per that same wrong comment, **the team's own real local Storybook too**)
renders every heading/body text in the fallback tail of the font stack
(effectively Georgia et al), not the real brand font. This is invisible
whenever fallback-vs-real metrics happen to not cross a wrap boundary (most
text), but caused a real, visible difference on `ValueCard`'s "Um único design
system" title, which wrapped to 2 lines in the (correct) compiled preview vs
1 line in the (wrong-font) reference — confirmed via `canvas.measureText` at
identical computed font shorthand: 251px real Funnel Display vs 209.8px
Georgia fallback.

**Fix applied**: injected `.design-sync/fonts/google-fonts.css`'s content
into `.design-sync/sb-reference/iframe.html` directly (a `<style>` block
before `</head>`) — this file is gitignored/regenerated build output, not a
converter script, so patching it is exactly the sanctioned remedy the
storybook shape's own `[FONT_MISSING]` guidance describes for this exact
scenario ("inject the same `@font-face` into
`.design-sync/sb-reference/iframe.html` so the oracle verifies with the real
font on both sides"). **This patch does not survive a reference rebuild** —
any future `npx storybook build -o .design-sync/sb-reference` needs the same
injection repeated before the next compare pass, or borderline-wrap
components will silently re-diverge from what's actually shipped. Re-verified
every already-graded component with heading/paragraph text after applying
this fix (SectionHeading, CaseCard, ModeBlock, SkillCard, Panel, ValueCard,
ChatMessage, MessageList, PromptInput, Attachment) — all confirmed `match`
against the corrected reference; no other component's wrap was affected.

**Separate, out-of-scope finding worth relaying to the team**: since
`.storybook/preview.ts`'s comment about this is simply incorrect, their own
real local `npm run storybook` most likely renders every brand-font heading
in a fallback font today too — worth a `.storybook/preview-head.html` (or an
equivalent `@font-face`/`<link>`) fix in the actual repo, independent of this
sync.

## Upload: bypassed resync.mjs this run, did the atomic path by hand
This project's `_ds_sync.json` anchor (fetched from the live project) was
still in the OLD **package** shape's schema (39 components, different
`keyRecipe`/`sourceKeys` scheme entirely) — a shape switch makes the anchor
structurally incompatible, not just stale. Rather than construct a synthetic
anchor to feed `resync.mjs`, did the upload manually per the base skill's own
"no usable anchor" fallback: `DesignSync(list_files)` on the live project,
diffed that list against the fresh local `ds-bundle/` tree by hand to compute
`deletes` (every old `components/general/**`/`components/<oldgroup>/**` path
— the group-directory scheme changed too, from JSX-file-derived groups to
the docs-driven groups in `design.md`), then ran the atomic sequence directly
(`finalize_plan` → sentinel → writes → deletes → sentinel re-arm →
`_ds_sync.json` last). Build (`package-build.mjs`) and validate
(`package-validate.mjs`) had already been run standalone and were clean, so
nothing about the actual bundle/verification was skipped — only the
driver-script convenience wrapper and its diff-against-anchor step were
bypassed, for a reason specific to this run (the shape switch), not a general
practice. **Future re-syncs should use `resync.mjs` normally** — this
one-time detour doesn't change anything about the driver's normal operation
on the next (same-shape) sync.

## conventions.md validation (this run)
Existing `.design-sync/conventions.md` predates the storybook-shape switch —
validated against the fresh build rather than rewritten (per the base skill's
rule: only author from scratch when the file doesn't exist yet). Found and
fixed one real drift: the semantic border tokens were renamed from
`--line`/`--line-strong` to `--border`/`--border-strong` sometime during the
JSX→TSX rewrite; the table now says `--border`/`--border-strong`. Everything
else verified clean: `CaseGrid` is real (`src/components/CaseCard/CaseCard.tsx`
— a plain `.hds-cases` grid wrapper, distinct from `CaseCard`), `Badge`'s
`variant` values, `.wrap`/`.cut`/`.cut-sm`/`.dots` classes, and every other
listed token all still exist verbatim in `src/tokens.css`/`src/base.css`.

**Left as-is, worth a dedicated follow-up**: the file's content is still
scoped to the ~20 original marketing-site components (CaseCard, Badge, the
`.cut`/dark-page-background guidance) and says nothing about the ~40 Radix-
based primitives added since (Select, Dialog, Toast, Table, Tabs, Command,
etc.) — those are real, shipped, and fully in the synced bundle, just
undocumented in this header. A full content pass covering the new component
families (their own styling idiom is prop-driven same as before, so the
overall approach still applies) would meaningfully help the design agent;
out of scope for a validation-only re-sync pass, flagging for next time.

## Re-sync risks
- **The `.design-sync/sb-reference/iframe.html` font-injection patch above is
  NOT durable.** It's a hand-edit to gitignored build output; the next
  `npx storybook build -o .design-sync/sb-reference` wipes it. Repeat the
  injection (`.design-sync/fonts/google-fonts.css`'s content into a
  `<style>` before `</head>`) every time the reference is rebuilt, BEFORE the
  next compare pass, or text-wrap-sensitive components (headings especially)
  will silently re-diverge against a fallback-font oracle. Worth scripting if
  this sync repeats often.
- **`Reveal`'s `ScrollToReveal`/`StaggeredList` stories are capped `close`,
  not fixed.** They're intentionally taller than one viewport (90vh/50vh
  scroll-trigger spacers). `.ds-sync/storybook/compare.mjs` captures the
  storybook side via full-element screenshot (any height) but the ds preview
  side via a fixed 900×700 viewport shot (`fullPage:false`), truncating
  anything below the fold — a structural asymmetry in the capture harness
  itself (`compare.mjs`, not `emit.mjs`/`bundle.mjs`, so it IS forkable, just
  not attempted this run: narrow blast radius, 1 component/2 stories). Would
  affect any future component with intentionally-tall story content the same
  way. If this recurs on more components, worth fixing `compare.mjs`'s ds-side
  capture to match the storybook side's full-element approach.
- `[DTS_PARSE]`/`[ZERO_MATCH]` on any component right after the shape switch
  most likely means the auto-extraction needs a `cfg.dtsPropsFor` override
  after all — check the real `.tsx` source before assuming it's a converter
  bug.
- The archived package-shape previews are pure history now; nothing in the
  current pipeline reads `.design-sync/.archive/`. Safe to delete outright in
  a future cleanup once nobody needs to diff against them.
