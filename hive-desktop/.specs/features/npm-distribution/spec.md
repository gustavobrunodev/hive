# Feature Spec — npm Distribution & In-App Self-Update

**Milestone:** M6 (Polish & packaging) · **Feature slug:** `npm-distribution` · **Scope:** Large
**Status:** 📝 Planned (2026-07-21)

---

## Summary

Ship Hive Desktop to the **public npm registry** under the user's personal
account, and make a running install able to **discover, download and apply new
versions by itself** — from the registry, inside the app, with no terminal and
no external release server.

Today the app is `"private": true`, has never been published, and its update
path (`electron-updater`) points at a placeholder feed
(`https://example.com/auto-updates`), so "Verificar atualizações" errors in any
packaged build. This feature makes the npm registry both the **version source**
and the **payload host** (context.md ND-C1), replaces the update backing behind
the existing `UpdateService` contract (ND-C5), and rebuilds the update
experience as a surface the user actually enjoys meeting.

## Goals (traceability to PROJECT goals)

- Advances **G1 (Zero-terminal BMAD)** — the app updates *itself*; the user
  never runs `npm i -g` or downloads an installer from a browser.
- Advances **G5 (Impeccable UX)** — the update moment is designed, not a
  system dialog: it informs, never interrupts, and is always refusable.

## Non-Goals (v1 of this feature)

- **macOS / Linux install execution.** Discovery, download and verification are
  platform-agnostic; only the Windows/NSIS *apply* step ships (ND-C6). Other
  platforms reach "downloaded" and offer a manual open.
- **Delta / differential updates.** Every update is the full platform installer
  (~90 MB). electron-updater's blockmap deltas are not available on this path.
- **Code signing & notarization.** Unsigned builds, as today (`notarize: false`).
  Signing is a prerequisite for a real macOS path, tracked as a deferred idea.
- **Rollback / downgrade to a previous version** from inside the app.
- **Beta / canary channels.** Only the `latest` dist-tag is consulted.
- **Publishing the app as a runnable npm CLI** (`npx hive-desktop`). npm is the
  distribution *channel* for installers, not a launch mechanism.
- **Private packages.** Structurally impossible for unattended install (ND-C2).

---

## Requirements

### ND-R1 — npm publication

> **Superseded in part (2026-07-22, context.md ND-C7):** the real npm
> registry rejected the platform installer's real ~297 MB tarball with a
> genuine `413 Payload Too Large` on the first real publish attempt. ND-R1.3
> and ND-R3.1 below describe the **original, now-replaced** mechanism (a
> separate per-platform npm package hosting the installer) — the actual
> payload host is now a **GitHub Release**; npm keeps ND-R1.1/R1.2/R1.4-R1.6
> and all of ND-R2 exactly as written (still the version source). See
> design.md §2A for the current mechanism.

- **ND-R1.1** The main package is published **public** as
  `@<npm-user>/hive-desktop`; `"private": true` is removed from
  [package.json](../../../package.json) and replaced with
  `"publishConfig": { "access": "public" }`.
- **ND-R1.2** The main package carries **no installer binaries**. It publishes
  a small, explicit `files` whitelist and an accurate `version`, so the
  registry **packument stays far below npm's 100 MB metadata cap** as versions
  accumulate (ND-C1).
- **ND-R1.3** Platform payloads are published as **separate public packages**,
  one per target: `@<npm-user>/hive-desktop-win-x64` (v1), with
  `-darwin-arm64`, `-darwin-x64`, `-linux-x64` reserved for later. Each
  contains exactly one electron-builder installer plus a machine-readable
  descriptor (version, platform, arch, file name, sha512, byte size).
- **ND-R1.4** Package metadata is complete and honest: `description`,
  `license`, `repository`, `homepage`, `keywords`, `engines`, `author`,
  `os`/`cpu` fields on platform packages.
- **ND-R1.5** No secret, token, local path, or workspace artifact is ever
  published. The `files` whitelist is allow-list based (never `.npmignore`
  subtraction), and a **dry-run inspection of the exact tarball contents** is a
  required gate before the first real publish.
- **ND-R1.6** A single repeatable release command builds, versions, publishes
  the platform package(s) then the main package, in that order — so the main
  package's advertised version never points at a payload that does not exist
  yet.

### ND-R2 — Version discovery

- **ND-R2.1** The app queries the public registry packument over HTTPS with
  **no authentication** and reads the `latest` dist-tag.
- **ND-R2.2** It compares the discovered version against `app.getVersion()`
  using **semver ordering**, not string comparison — a build must never offer a
  downgrade or re-offer its own version.
- **ND-R2.3** Discovery runs **automatically on launch** and on a periodic
  interval thereafter, plus on explicit user request (ND-R6.2).
- **ND-R2.4** Discovery is **time-boxed** and **fails silently** in the
  background: offline, DNS failure, registry 5xx, malformed payload and
  timeouts must never produce a visible error, a blocked launch, or a crash.
  An error is only ever shown for a check the user **explicitly** asked for.
- **ND-R2.5** Launch-time discovery must not delay, block, or reorder the
  existing onboarding/work-UI startup path in any way.

### ND-R3 — Download

> **ND-R3.1 superseded (2026-07-22, ND-C7)** — see the note above ND-R1 and
> design.md §2A. ND-R3.2-R3.5 are unaffected (still true, mechanism-agnostic).

- **ND-R3.1** ~~The app resolves the tarball URL for **its own platform+arch**
  from the platform package's registry metadata and downloads it directly from
  `registry.npmjs.org` (never a CDN — ND-C1).~~ Now: resolves the installer's
  `browser_download_url` for its own platform+arch from a GitHub Release's
  asset list (design.md §2A).
- **ND-R3.2** Download progress is streamed as a percentage, with enough
  information for the UI to show transferred/total bytes.
- **ND-R3.3** The downloaded installer is **verified against a sha512**
  (ND-C7: our own, computed by the release script and published in
  `hive-update.json` — GitHub Releases have no built-in content hash the way
  npm's `dist.integrity` was, so this replaces rather than reuses it) before
  anything is executed. A mismatch aborts, deletes the artifact, and reports a
  distinct integrity error — it is never silently retried or ignored.
- **ND-R3.4** The download is **cancellable**, and cancelling leaves no partial
  artifact behind.
- **ND-R3.5** Downloads land in a dedicated staging directory under `userData`,
  and stale artifacts from previous attempts are cleaned up.

### ND-R4 — Apply & relaunch

- **ND-R4.1** ~~The verified tarball is extracted and the installer located via
  the descriptor from ND-R1.3.~~ Now (ND-C7): the verified download **is**
  the installer directly (a raw `.exe`, not a tarball) — no extraction step.
- **ND-R4.2** On **Windows**, applying runs the NSIS installer and quits the
  app so it can replace the installation; the app comes back up on the new
  version (ND-C6).
- **ND-R4.3** On platforms without an implemented apply step, the flow stops at
  "downloaded" and offers to **reveal the installer** in the OS file manager,
  stating plainly that it must be run manually.
- **ND-R4.4** Any failure to apply produces an actionable error — never a
  half-updated install, and never a silent no-op. The downloaded installer is
  kept so the user can run it manually.
- **ND-R4.5** Applying is **only ever triggered by an explicit user action**
  (ND-C3). No update is applied on quit, on idle, or in the background.

### ND-R5 — Consent & automation policy

- **ND-R5.1** Discovering a version **never** downloads it automatically.
  Download requires an explicit action.
- **ND-R5.2** The availability notice is **non-blocking**: it must not be a
  modal, must not steal focus, must not obstruct the composer or the work UI,
  and the app stays fully usable while it is shown and while a download runs.
- **ND-R5.3** The user can **dismiss** the notice and keep working. Dismissal
  is honored for the session.
- **ND-R5.4** The user can **skip a specific version**; that version is
  persisted as skipped and is **never re-announced**, including across
  restarts. A newer version than the skipped one is announced normally.
- **ND-R5.5** A skipped or dismissed version remains reachable on demand from
  the update surface (ND-R6.2) — declining must not strand the user.

### ND-R6 — Interface (shaped by `impeccable`, per D3/G5)

- **ND-R6.1** An **update notice** surface announces an available version
  without interrupting: it names the version, gives a sense of size/duration,
  offers the primary action, and offers refusal (dismiss + skip) with equal
  clarity — refusal is a first-class choice, not a hidden one.
- **ND-R6.2** A dedicated **update surface** (evolving today's
  [AppSettingsSheet.tsx](../../../src/renderer/src/ui/AppSettingsSheet.tsx))
  is the persistent home of the flow: current version, last-checked, an
  explicit check action, and the download/apply controls.
- **ND-R6.3** Every state in the machine is designed, with no dead ends:
  `idle · checking · up-to-date · available · downloading · verifying ·
  downloaded · applying · error · unsupported(dev)`. Progress is real, not
  indeterminate theatre.
- **ND-R6.4** **Release notes** for the offered version are shown when the
  package provides them, so the user can make an informed choice.
- **ND-R6.5** Accessible: `role="status"` for live transitions, keyboard
  operability, DS `:focus-visible` rings on every interactive element (per the
  STATE lesson on presentational-as-button), AA contrast, and full
  `prefers-reduced-motion` honoring for any animation.
- **ND-R6.6** Correct in **dark and light** themes, using DS tokens only — no
  hardcoded colors.
- **ND-R6.7** All copy in **pt-BR**, centralized in
  [i18n/pt-BR.ts](../../../src/renderer/src/i18n/pt-BR.ts) via `t()` (D10 — no
  inline literals). Copy is plain and non-alarming; an available update is an
  invitation, never a warning.
- **ND-R6.8** In dev/unpacked builds (`updatesSupported: false`) the surface
  explains honestly instead of offering a control that cannot work — the
  existing behavior, preserved.

### ND-R7 — Quality gates

- **ND-R7.1** No regression: the full unit/component suite stays green and
  `npm run typecheck` stays clean.
- **ND-R7.2** **≥90% coverage per changed file** (statements/branches/
  functions/lines), the project's established per-file gate.
- **ND-R7.3** The updater is unit-tested **against a fake registry and a fake
  filesystem/process layer** — no network, no real npm, no real installer
  execution in the suite. Integrity-mismatch, offline, timeout, malformed
  packument, cancellation and skip-version are each covered explicitly.
- **ND-R7.4** The publish pipeline is validated by a **`npm publish --dry-run`
  tarball-content inspection** (ND-R1.5) before any real publish.
- **ND-R7.5** Visual validation of every UI state in **dark and light** via the
  project's Playwright-MCP recipe (static renderer build + injected
  `window.hive` mock, scenario-switched by query param) — the established
  approach, since Playwright MCP cannot attach to the real Electron renderer
  (STATE.md T14 lesson).

---

## Acceptance

A packaged Windows install of version *N*, with version *N+1* published to npm:

1. Launches normally, and shortly after shows a calm, non-blocking notice that
   *N+1* is available, with release notes and size.
2. Can be **dismissed** — the app is fully usable, and the notice does not
   return that session.
3. Can be **skipped** — and *N+1* is never announced again, even after
   restarting; but is still reachable from the update surface.
4. On accepting: downloads with real progress, verifies sha512, runs the
   installer, and the app comes back up reporting version *N+1*.
5. With the network off, none of this ever produces a visible error or a
   delayed launch.

## Open items

- **ND-B1 (blocks publish only):** the npm username for the scope, and an
  authenticated `npm login` / automation token. Everything except the actual
  `npm publish` can be built and verified without it.
