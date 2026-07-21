# Tasks — npm Distribution & In-App Self-Update

**Feature:** `npm-distribution` · **Spec:** [spec.md](spec.md) · **Design:** [design.md](design.md)
**Status:** 📝 Planned (2026-07-21)

Convention: each task is one atomic commit. `npm run verify` (typecheck + lint +
test) must be green before committing. Per-file coverage gate ≥90% on changed
files (ND-R7.2). Node 22.22.1 required — `source ~/.nvm/nvm.sh && nvm use` in the
**same** command (STATE lesson: `nvm use` does not persist across tool calls).

---

## Phase 0 — De-risk

### T1 — Spike: prove the registry assumptions [blocking]

**Refs:** ND-R2.1, design §2, Risk "custom field not preserved"
Against the **real** registry, using any existing scoped public package as a
probe, confirm: (a) `GET /<pkg>/latest` returns the full version object;
(b) a **custom top-level `package.json` field survives publication** into that
object; (c) `dist.tarball` + `dist.integrity` are present and the tarball is
fetchable unauthenticated; (d) scoped names need `%2F` encoding.

**Verify:** a short throwaway script prints the evidence for each of (a)–(d).
If (b) fails, adopt the design's stated fallback (`hive-update.json` inside the
platform package) **before** T3 — do not build on an unproven assumption.
**Output:** findings appended to `.specs/project/STATE.md` Lessons.
**Commit:** none (spike) — record findings only.

---

## Phase 1 — Main process

### T2 — Dependencies + publish metadata

**Refs:** ND-R1.1, ND-R1.4, design §2
Add `tar` + `semver` (+ `@types/semver`). Remove `"private": true`; add
`publishConfig.access=public`, `description`, `license`, `repository`,
`homepage`, `keywords`, an explicit `files` allow-list, and the `hiveRelease`
placeholder. Package **name stays parameterized** until ND-B1 resolves.

**Verify:** `npm run typecheck` clean; `npm publish --dry-run` lists **only**
the intended files — no `src/`, `.specs/`, `node_modules/`, `.env`, or workspace
artifacts (ND-R1.5).

### T3 — `main/npmRegistry.ts` — discovery

**Refs:** ND-R2.1, ND-R2.2, ND-R2.4
Pure module, injected `RegistryClient`, no Electron import. `platformKey`,
`fetchLatestRelease`, `fetchPayload`, `isNewer` (semver).

**Verify:** unit tests over fixtures, **no network**: newer / older / equal /
prerelease; missing `hiveRelease`; unknown platform; malformed JSON; 404; 5xx;
timeout. Every failure degrades to "no update", never throws (ND-R2.4).
Coverage ≥90%.

### T4 — Download, verify, extract

**Refs:** ND-R3.1–ND-R3.5
Stream tarball → staging dir while hashing sha512; compare to `dist.integrity`;
extract via `tar`; locate installer through `hive-update.json`. Cancellable;
staging cleanup on success/cancel/startup.

**Verify:** tests for happy path, **integrity mismatch** (distinct error kind,
artifact deleted), cancel mid-stream (no partial file), stale-dir cleanup,
progress events carry `transferred`/`total`. Coverage ≥90%.

### T5 — `main/updateApply.ts` — per-OS apply

**Refs:** ND-R4.2, ND-R4.3, ND-C6
Windows NSIS strategy (spawn detached + `unref` + `app.quit()`); no strategy
elsewhere ⇒ `canApply:false`.

**Verify:** fake-spawn tests assert detached/unref/quit **ordering**; non-Windows
asserts **no spawn** and `canApply:false`. Coverage ≥90%.

### T6 — Rewire `main/updateService.ts` onto npm

**Refs:** ND-C5, ND-R2.3, ND-R2.5, ND-R4.4, ND-R4.5
Keep `UpdateService`/`UpdateEvent`/`AppInfo` names; add `verifying`/`applying`
events, `error.kind`, `bytes`/`notes`/`transferred`/`total`, `canApply`,
`lastCheckedAt`, `cancel()`. `check(explicit)` — silent on background failure,
reporting on explicit.

**Verify:** event-ordering tests with fakes; background failure emits **nothing**;
explicit failure emits `error`; apply never fires without an explicit call
(ND-R4.5). Coverage ≥90%.

### T7 — `ConfigStore.skippedUpdateVersion`

**Refs:** ND-R5.4
Additive nullable field + accessor.

**Verify:** persists across reload; unset by default; existing config files
without the key load cleanly (back-compat). Coverage ≥90%.

### T8 — IPC + preload surface

**Refs:** ND-R3.4, ND-R4.3, ND-R5.4
`update:cancel`, `update:reveal`, `profile`-style skip persistence; `app:info`
extended. Preload: `cancelUpdate`, `revealInstaller`, `skipVersion`.

**Verify:** preload + `main/index.ts` tests; `npm run typecheck` clean.
Per-file coverage held on both gated files.

### T9 — Remove `electron-updater`

**Refs:** ND-C5
Drop the dependency, the import, and the now-obsolete
`vi.mock('electron-updater', …)` in `main/index.test.ts`.

**Verify:** full suite green **without** the mock; `grep -r electron-updater src/`
returns nothing; `npm run build` clean.

---

## Phase 2 — Interface (impeccable, product register)

### T10 — pt-BR copy

**Refs:** ND-R6.7
New `update.*` namespace in `i18n/pt-BR.ts`. Invitation register, never alarm.
No inline literals anywhere in Phase 2 (D10).

**Verify:** `pt-BR.ts` coverage stays 100%; no string literals in the new
components (review + lint).

### T11 — `ui/UpdateNotice.tsx` + styles

**Refs:** ND-R6.1, ND-R6.3, ND-R6.5, ND-R6.6, ND-R5.2, ND-R5.3, design §5 Tier 2
Composed from DS **Toast primitives** with `duration={Infinity}`, bottom-left
viewport above the gear. Morphs in place across `available → downloading →
verifying → downloaded → error` with **reserved height** (no layout shift).
Mount `ToastProvider`/`ToastViewport` if not already mounted.

**Verify:** RTL tests render every state; dismiss is session-scoped; skip calls
through; **no modal semantics** and focus is never stolen; `prefers-reduced-
motion` path asserted. Contrast of `--faint` meta lines checked in both themes.
Coverage ≥90%.

### T12 — Ambient update dot on the rail gear

**Refs:** ND-R5.5, design §5 Tier 1
6px `--accent` dot on the app-settings gear while an update is pending; survives
dismissal; clears on skip/apply.

**Verify:** tests for pending/dismissed (dot stays) vs skipped/applied (dot
clears); non-color-only cue via `aria-label`. `ActionRail` coverage held.

### T13 — `UpdateCenter` — redesign `AppSettingsSheet`

**Refs:** ND-R6.2, ND-R6.3, ND-R6.4, ND-R6.8, ND-R5.5, design §5 Tier 3
Identity + last-checked status line + morphing version block + release notes
(`react-markdown` + `.wb-md` in `ScrollArea`/`Accordion`) + skipped-version
recovery + preserved dev note.

**Verify:** RTL over all ten states incl. `unsupported`; skipped version is
recoverable (ND-R5.5); notes render markdown safely. Coverage ≥90%.

### T14 — Auto-check policy wiring

**Refs:** ND-R2.3, ND-R2.5, ND-R5.1, ND-R5.3, ND-R5.4
Launch check + periodic interval; announce only if newer than current **and**
newer than `skippedUpdateVersion` and not dismissed this session. Never
auto-downloads (ND-R5.1).

**Verify:** tests assert startup path is **not delayed or reordered**
(ND-R2.5); skipped/dismissed suppression; no download without explicit action.
`App.tsx`/`WorkUI.tsx` coverage held.

### T15 — Visual validation (Playwright MCP)

**Refs:** ND-R7.5
Drive the static renderer build with an injected `window.hive` mock,
scenario-switched by query param, capturing **dark and light** for: available,
downloading, verifying, downloaded, error, up-to-date, skipped-recovery, dev.

**Verify:** screenshots in `.playwright-mcp/`; fix any contrast/alignment/
overflow defect found — **the pass is not "screenshots taken", it is "defects
found and fixed"** (the T20/impeccable precedent). Record findings in STATE.

---

## Phase 3 — Release

### T16 — `scripts/release.mjs`

**Refs:** ND-R1.3, ND-R1.6, ND-R1.5
Verify → build → assemble platform package → publish **platform first, main
last**. Refuses a dirty tree or missing `npm whoami`. `--dry-run` prints exact
tarball contents.

**Verify:** `--dry-run` end-to-end produces a correct platform package
containing exactly one installer + `hive-update.json`, and a main package with
no binaries; publish order asserted.

### T17 — First publish to npm ⛔ blocked by ND-B1

**Refs:** ND-R1.1, ND-R1.3
Needs the npm username and an authenticated `npm login`/token.

**Verify:** both packages resolve publicly and unauthenticated;
`GET /<pkg>/latest` returns the expected `hiveRelease`; a clean machine can
install the platform tarball.

### T18 — Real-Windows end-to-end verification [manual]

**Refs:** ND-R4.2, Acceptance 1–5, Risk "Electron/WSL2"
Install version *N* on real Windows, publish *N+1*, confirm the full journey:
notice → decline works → skip persists across restart → accept → download →
verify → install → relaunches reporting *N+1*. Plus: network off ⇒ no error, no
launch delay.

**Verify:** the five Acceptance criteria in spec.md, observed on real hardware.
This cannot be validated in WSL2 — it is the release gate.

### T19 — Closeout

Per-file coverage report on every changed file; mark `tasks.md` complete;
update ROADMAP M6 and STATE with decisions/lessons.

---

## Optional / deferred

- **PRODUCT.md for `impeccable`.** `context.mjs` still reports `NO_PRODUCT_MD`
  (D16). Authoring one would replace the identity-preservation workaround with
  real project context for every future UI task. Not blocking.
- **macOS/Linux apply strategies** (ND-C6) — one module each, no redesign.
- **Code signing / notarization** — prerequisite for a real macOS path.

## Dependency graph

```
T1 ──► T2 ──► T3 ──► T4 ──► T6 ──► T8 ──► T9
                     T5 ──►─┘        │
                     T7 ──►──────────┘
                                     ▼
              T10 ──► T11 ──► T12 ──► T13 ──► T14 ──► T15
                                                       │
                                     T16 ──► T17 ──► T18 ──► T19
```

T3/T5/T7 can proceed in parallel after T2. T10 can start any time.
T17 is blocked on ND-B1; T18 is blocked on T17.
