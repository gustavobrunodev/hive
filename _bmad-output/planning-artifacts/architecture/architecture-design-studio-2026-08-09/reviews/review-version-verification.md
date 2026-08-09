---
name: 'Version & Reality-Check Verification — Design Studio Architecture Spine'
type: review
reviews: '_bmad-output/planning-artifacts/architecture/architecture-design-studio-2026-08-09/ARCHITECTURE-SPINE.md'
created: '2026-08-09'
method: 'WebSearch/WebFetch against npm registry + GitHub API; Read/Grep against hive-desktop/src'
---

# Review — Version & Reality-Check Verification

**Scope:** every technical claim in `ARCHITECTURE-SPINE.md` that reads as a fact (about an external package or about the real Hive Desktop codebase) was checked against a primary source — the npm registry, the GitHub API, the Web Awesome docs site, or the actual file in `hive-desktop/src`. Findings below are grouped by what was checked, whether it held up, and what to do about it.

## 1. Stack section — `@awesome.me/webawesome`

| Claim in spine | Verification method | Result |
| --- | --- | --- |
| Latest version `^3.11` | `curl https://registry.npmjs.org/@awesome.me/webawesome` (primary source, not WebSearch summary) | **Confirmed.** `dist-tags.latest = 3.11.0`, published 2026-07-30T16:12:41Z — 10 days before the spine's 2026-08-09 date, consistent with "Verified 2026-08-09." |
| MIT license | Same npm registry query (`license` field on both package root and version manifest) + GitHub API `repos/shoelace-style/webawesome` → `license.spdx_id` | **Confirmed** both ways: `MIT`. |
| Built on Lit | npm registry `dependencies` field of the 3.11.0 manifest | **Confirmed.** `lit: "^3.2.1"` is a direct (non-optional, non-dev) dependency, alongside `@lit/context`, `@lit/react`, `@lit-labs/ssr`. WebFetch of the docs pages themselves couldn't confirm this (the rendered/summarized docs pages don't state their own implementation stack), so the npm manifest is the load-bearing evidence here — good that it's independently conclusive. |
| Shoelace is archived, Web Awesome is the renamed successor | GitHub API `repos/shoelace-style/shoelace` and `repos/shoelace-style/webawesome` | **Confirmed.** `shoelace-style/shoelace`: `archived: true`, description "Shoelace is now Web Awesome. Come see what's new!", last push 2026-05-14. `shoelace-style/webawesome`: `archived: false`, actively updated (2026-08-07), MIT-licensed, description "Build better with Web Awesome... from Font Awesome." |
| "Do not install `@shoelace-style/shoelace`" | Same as above | **Confirmed correct advice** — that repo is archived and the package name is superseded. |
| Paid Pro tier exists but "only gates extra icon/theme packs, not the core component catalog v1 needs" | WebFetch of `webawesome.com/purchase`, `webawesome.com/docs/components/`, and `webawesome.com/docs/components/date-picker/` | **Inaccurate — flagged below (Finding A).** Pro gates 16 actual components, not just icons/themes. |

**Verdict on Stack section:** the version, license, Lit foundation, and Shoelace-archival claims are all independently confirmed against primary sources (npm registry + GitHub API), not just trusted from the spine's own "Verified" annotation. The one claim that does **not** hold up is the characterization of what the Pro tier gates.

### Finding A — Pro tier claim is materially inaccurate (Medium-High severity)

The spine states: *"A paid Pro tier exists but only gates extra icon/theme packs, not the core component catalog v1 needs."*

Independent verification (`webawesome.com/docs/components/`, cross-checked via WebSearch and a direct fetch of the Date Picker component page) shows the Pro tier gates **16 components**, not icon/theme packs:

- **Form/input primitives:** Combobox, Date Input, Date Picker, File Input
- **Data:** Data Grid
- **Charts (all of them):** Bar, Bubble, Doughnut, Line, Pie, Polar Area, Radar, Scatter, Sparkline
- **Media:** Video, Video Playlist

The Date Picker page explicitly reads: *"Pro — Included with Web Awesome Pro"* with a "Get Date Picker with Web Awesome Pro!" CTA — this is a hard gate, not a degraded-but-usable free variant.

68 components remain free (Accordion, Button, Card, Dialog, Input, Select, Table-adjacent primitives, Tree, etc.), so the core layout/typography/form-control vocabulary is intact. But Date Picker, File Input, and Combobox are exactly the kind of component a generic "Spec de UX → generated Telas" tool (FR-2) is likely to need for ordinary app screens (a form with a date field, a file upload, a searchable select), and Data Grid/charts are common for dashboard-style specs. This directly touches:

- **FR-13** (Catálogo de Componentes) — the catalog `DesignSystemAdapter.catalog()` exposes is smaller than "the core component catalog v1 needs" implies.
- **AD-10** (`CapabilityViolation`) — if a Spec de UX or chat request calls for a date picker, the Skill/Inspector will hit the rejection path (AD-10) on a very ordinary ask, not an edge case.

**Recommendation:** re-verify against the actual PRD FR-13/§ catalog scope (not available to this review) whether any planned v1 Tela or the addendum's examples require Combobox/Date Picker/File Input/Data Grid/charts. If so, the Stack section's claim needs correcting and the risk needs to move from "dismissed" to "explicitly accepted or mitigated" (e.g., budget for Pro, or scope v1 Telas to avoid these components). If not, soften the claim from "only gates extra icon/theme packs" (factually wrong) to something like "gates a defined set of advanced components (charts, combobox, date/file inputs, data grid) that v1's target Telas are confirmed not to need" — but that confirmation needs to actually happen against the PRD, not be asserted.

### Minor note — npm scope collision (Low severity, informational)

A GitHub discussion (`shoelace-style/webawesome#1907`) flags that the `@awesome.me` npm scope is shared with Font Awesome's own packages, which breaks for teams routing that scope through a private npm proxy/registry (can't have two different upstream configs for the same scope). This doesn't affect Hive Desktop's own install (public npm, no proxy currently in play per the codebase), so it's not a blocker — but worth a one-line footnote in the Stack section for whoever runs `npm install` in a corporate-proxy environment later.

## 2. Spot checks against the real Hive Desktop codebase

Seven claims were checked directly against source files (more than the 3 requested), each with file:line evidence.

### `whisperProtocol.ts` — privileged scheme registration pattern (AD-5)

**Spine claim:** *"mirroring `whisperProtocol.ts`'s registration: `standard/secure/corsEnabled: true`, `bypassCSP: false`"*

**Checked:** `/home/gustavobgt/user-harness/hive/hive-desktop/src/main/whisperProtocol.ts:33-43`

```ts
export const WHISPER_SCHEME_PRIVILEGES = {
  scheme: WHISPER_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
    bypassCSP: false
  }
} as const
```

**Result: exact match.** `standard: true`, `secure: true`, `corsEnabled: true`, `bypassCSP: false` are all present verbatim.

### `HtmlPreview.tsx` — iframe sandbox attributes and known `srcDoc` limitation (AD-5)

**Spine claim:** *"repeating `HtmlPreview.tsx`'s known limitation (no base URL in `srcDoc` → relative assets 404)"*

**Checked:** `/home/gustavobgt/user-harness/hive/hive-desktop/src/renderer/src/explorer/HtmlPreview.tsx:20-22, 33-38`

```
Known limitation (UX-R8.3): `srcdoc` has no base URL, so relative asset
references (`./style.css`, `./img.png`) 404. A local-server-backed preview
is deferred to a future task.
...
sandbox="allow-scripts"
srcDoc={source}
```

**Result: exact match**, down to the mechanism description (no base URL → relative assets 404) and the `sandbox="allow-scripts"` value the spine contrasts its own `hive-studio://` approach against.

### `chatHistoryStore.ts` — persistence shape (AD-7)

**Spine claim:** *"following `chatHistoryStore.ts`'s disk-is-source-of-truth / write-temp-then-rename pattern"*

**Checked:** `/home/gustavobgt/user-harness/hive/hive-desktop/src/main/chatHistoryStore.ts:20-31` (doc comment) and `:226-243` (`writeSession`)

```ts
function writeSession(workspace: string, session: StoredChatSession): void {
  const dir = workspaceDir(workspace)
  mkdirSync(dir, { recursive: true })
  const finalPath = join(dir, `${session.id}.json`)
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmpPath, JSON.stringify(session, null, 2), 'utf-8')
  try {
    renameSync(tmpPath, finalPath)
  } ...
```

**Result: exact match.** One JSON file per session, `disk is the single source of truth (no in-memory cache)`, write-temp-then-rename verbatim as described.

### `AgentAdapter`/`AgentRegistry` supporting Claude/Devin/Copilot (AD-9)

**Spine claim:** *"breaking when the session's configured agent is the Devin or GitHub Copilot CLI adapter — both already implemented behind the same contract."*

**Checked:** directory listing of `hive-desktop/src/main/`:

```
agentAdapter.ts        # the AgentAdapter contract
agentRegistry.ts        # createAgentRegistry — the registry AD-9 refers to
claudeCliAdapter.ts (+ .test.ts)
devinCliAdapter.ts (+ .test.ts)
copilotCliAdapter.ts (+ .test.ts)
```

`agentService.ts:9` imports `AgentRegistry` from `./agentRegistry`; `index.ts:426` calls `createAgentRegistry(...)`.

**Result: confirmed.** All three adapters exist as separate, tested modules implementing the same `AgentAdapter` interface (`agentAdapter.ts:382-387`), and a registry composes them. Note: `agentAdapter.ts`'s own doc comment (lines 1-15) is stale — it still says "MVP: `ClaudeCliAdapter`... Future adapters (e.g. a Devin CLI adapter, per C1)" as if Devin support were still hypothetical, even though `devinCliAdapter.ts` and `copilotCliAdapter.ts` already exist as siblings. That's a pre-existing doc-comment staleness in the codebase itself, not an error introduced by the spine — the spine's claim is actually more accurate than that stale comment.

### `EditorTabKind` union (AD-1)

**Spine claim:** *"registers a new `EditorTabKind` (`'design-studio'`)... following the precedent already set by `diff`/`commit`/`conflict`/`review` kinds."*

**Checked:** `/home/gustavobgt/user-harness/hive/hive-desktop/src/renderer/src/ui/useEditorTabs.ts:6`

```ts
export type EditorTabKind = 'file' | 'diff' | 'conflict' | 'commit' | 'review'
```

**Result: confirmed.** All four named kinds (`diff`, `commit`, `conflict`, `review`) exist in the current union alongside `file`; `'design-studio'` would be a same-shape addition. (The spine lists them in a different order than the source — `diff/commit/conflict/review` vs. source's `diff/conflict/commit/review` — cosmetic only, not a factual error.)

### `SidebarView` union (AD-1)

**Spine claim:** *"the `SidebarView` union (`'explorer' | 'scm' | 'review' | 'brain'`)"*

**Checked:** `/home/gustavobgt/user-harness/hive/hive-desktop/src/renderer/src/ui/ActionRail.tsx:26`

```ts
export type SidebarView = 'explorer' | 'scm' | 'review' | 'brain'
```

**Result: exact, verbatim match**, including order.

### `@hive/design-system` being React-based

**Spine claim (implicit, via "renderer/src shell, React shell" being the existing stack; Design Paradigm section positions the DS adapter as the only thing that would ever touch a non-React package):**

**Checked:** `/home/gustavobgt/user-harness/hive/design-system/package.json:21-24, 38-39`

```json
"peerDependencies": {
  "react": ">=18",
  "react-dom": ">=18"
},
...
"react": "^18.3.1",
"react-dom": "^18.3.1",
```

Plus `@testing-library/react`, `@storybook/react-vite` in devDependencies.

**Result: confirmed.** `@hive/design-system` is a React component library (peer-deps on React 18+), which is exactly why the spine's AD-4 (DS-adapter-as-only-seam) matters: Web Awesome is a Lit/web-components library, a different rendering model than the existing React-based `@hive/design-system`, so isolating it behind one adapter (rather than importing it ad hoc into five React surfaces) is the right call — not a stylistic preference but a necessity given the two libraries use different component models.

### Bonus checks (beyond the required 3)

- **CSP `<meta>` tag "one-directive-at-a-time" convention for `hive-model:`** — `/home/gustavobgt/user-harness/hive/hive-desktop/src/renderer/index.html:19`: `connect-src 'self' hive-model:` — confirmed `hive-model:` is added to exactly one directive (`connect-src`), not broadly to `default-src`. This supports AD-5's explicit call-out that `hive-studio://` will need *more* directives extended (`frame-src`/`default-src`, plus `img-src`/`style-src`/`script-src`) because, unlike Whisper's pure-data scheme, the DS bundle ships icons/fonts/CSS/scripts — a materially different (and correctly reasoned) CSP footprint.
- **IPC `<namespace>:<action>` convention** — `/home/gustavobgt/user-harness/hive/hive-desktop/src/preload/index.ts:310-325` shows `mcp:list`, `mcp:add`, `mcp:update`, etc., mirrored as `window.hive.mcp.*`; same flat-namespace shape the spine proposes for `designStudio:*`. Confirmed.
- **Dialog pattern for MCP/Skill Studio (AD-1's contrast case)** — `grep -l Dialog` over `renderer/src/ui/*.tsx` returns `McpManager.tsx` and `SkillStudio.tsx`. Confirmed both surfaces do use a dialog, supporting AD-1's claim that the dialog pattern (as opposed to editor-tab) is the precedent Design Studio explicitly rejects.

## 3. Other named technologies/APIs — coverage check

Everything named in the spine besides `@awesome.me/webawesome` is either (a) an existing internal Hive Desktop module, all spot-checked above, or (b) explicitly "unchanged, existing stack" (Electron main/preload/renderer, React, TypeScript) with no new version claim attached — the spine correctly doesn't assert new version numbers for these, so there's nothing to independently re-verify beyond what's already relied on elsewhere in the codebase. No other external package, API, or SaaS product is named with a version or capability claim in this spine (the "Figma Agent" reference in Deferred is a forward-looking external contract, explicitly marked unconfirmed by the spine itself — appropriately hedged, not asserted as fact).

## Summary table

| # | Claim | Status |
| --- | --- | --- |
| 1 | `@awesome.me/webawesome` version `^3.11` | Confirmed (npm registry: 3.11.0) |
| 2 | MIT license | Confirmed (npm + GitHub API) |
| 3 | Built on Lit | Confirmed (npm dependency manifest: `lit ^3.2.1`) |
| 4 | Shoelace archived, Web Awesome is successor package | Confirmed (GitHub API: `archived: true` w/ redirect description) |
| 5 | Pro tier "only gates icon/theme packs" | **Inaccurate — Finding A.** Gates 16 components incl. Date Picker, Combobox, File Input, Data Grid, all charts |
| 6 | `whisperProtocol.ts` scheme privileges | Confirmed, exact match |
| 7 | `HtmlPreview.tsx` sandbox + `srcDoc` limitation | Confirmed, exact match |
| 8 | `chatHistoryStore.ts` persistence shape | Confirmed, exact match |
| 9 | Claude/Devin/Copilot adapters all exist | Confirmed (3 separate adapter files + registry) |
| 10 | `EditorTabKind` precedent (`diff`/`commit`/`conflict`/`review`) | Confirmed (cosmetic order difference only) |
| 11 | `SidebarView` union shape | Confirmed, verbatim |
| 12 | `@hive/design-system` is React-based | Confirmed (peer deps + devDeps) |
| 13 | `hive-model:` CSP one-directive convention | Confirmed |
| 14 | IPC `<namespace>:<action>` convention | Confirmed |
| 15 | MCP/Skill Studio use dialog pattern | Confirmed |

**Bottom line:** 14 of 15 checked claims hold up against primary sources or the actual codebase. The one that doesn't — the Pro-tier characterization in the Stack section — is presented with a "Verified 2026-08-09" annotation that overstates the actual verification; it should be corrected or the risk it dismisses should be explicitly re-opened against the PRD's real FR-13 scope.
