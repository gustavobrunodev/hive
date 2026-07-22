# Context — npm Distribution & Self-Update

User decisions captured during Specify's discuss phase (2026-07-21). These
resolve the gray areas that shaped the spec/design.

---

## ND-C1 — Mechanism: the npm registry is both the version source AND the payload host

The app is published to npm. A running install **discovers** new versions by
reading the registry packument, **downloads** the new installer from the
registry tarball, **runs** it, and relaunches. No external release server, no
GitHub Releases, no S3.

**Why:** This is the user's explicit ask — one place (npm) is the source of
truth and the distribution channel.

**Verified constraints that shape it (2026-07-21):**

- **CDN-served installers are out.** jsDelivr caps individual files at
  **20–50 MB** (packages at 150 MB) and unpkg is similar. Our installer is
  ~90 MB, so `cdn.jsdelivr.net/npm/...` cannot serve it. We must fetch the raw
  registry tarball URL (`https://registry.npmjs.org/<pkg>/-/<pkg>-<v>.tgz`),
  which has no such cap.
- **npm's hard limit is the _packument_ (metadata): 100 MB, uncompressed,
  accumulating across every published version.** This is why binaries go in
  **separate per-platform packages** (the esbuild/swc pattern) and the main
  package stays metadata-light — otherwise releases start failing after N
  versions.
- **`electron-updater` cannot consume npm directly.** Its `Provider` contract
  (`getLatestVersion()` + `resolveFiles()`) resolves URLs that it downloads and
  treats as the **raw installer** with a sha512. An npm tarball is a `.tgz`
  wrapper, so the download/unwrap step has to be ours. (Confirmed in the
  installed `electron-updater@6.8.9`: `provider: "custom"` with an injectable
  `updateProvider` class **does** exist and would cover discovery — but not the
  `.tgz` unwrap, so it buys us nothing here.)

## ND-C2 — Package identity: public, scoped to the user's personal npm account

`@<npm-user>/hive-desktop`, **public**. Platform payloads are sibling public
packages: `@<npm-user>/hive-desktop-win-x64`, `-darwin-arm64`, `-darwin-x64`,
`-linux-x64`.

**Why:** A scoped name is free, unclaimable by others, and ties the package to
the personal account. **Public is a hard requirement, not a preference** — a
private package requires an auth token on the client to install, and a desktop
app cannot ship the user's npm credentials. Both `hive-desktop` and
`@gustavobgt/hive-desktop` were verified free (HTTP 404) on 2026-07-21.

**OPEN — blocks publish only (ND-B1):** the actual npm username is not yet
known (`npm whoami` → 401, not authenticated in this environment). Every
requirement below is parameterized on it; the updater can be built and tested
against a fake registry without it.

## ND-C3 — Automation: auto-check + elegant notice, and the user may always decline

The app checks on launch and periodically. When a version is found, it surfaces
a **non-blocking** notice. One click downloads, applies and relaunches.

**The user must be able to refuse and keep working** — explicitly requested.
Nothing is ever downloaded or installed without consent, no modal traps the
app, and a declined version stays declined (skip-this-version is persisted, not
re-nagged on the next launch).

**Why:** "Automatic" here means *discovery* is automatic, not that the app
takes control of the machine. The existing `updateService.ts` was already
deliberately user-driven; this keeps that principle and only removes the chore
of remembering to check.

## ND-C4 — Payload: the full platform installer (~90 MB), not a hot-swapped bundle

Each release publishes the real electron-builder installer (NSIS `.exe` / `.dmg`
/ `.AppImage`) inside the per-platform package. Updating runs that installer.

**Why (measured, 2026-07-21):** the app's own code (`out/`) is only **4.2 MB**
while the Electron runtime is **284 MB** unpacked — so a "light" 4 MB update
that swaps just the JS bundle was genuinely tempting. It was **rejected**: it
cannot update the Electron runtime or native deps, and it collides head-on with
**asar integrity validation (Electron 39) and macOS code signing**, both of
which reject a mutated app bundle. That would force loading app code from a
`userData` directory — real added complexity and a real added security surface.
The full installer is heavier but always correct and has no such landmine.

## ND-C5 — The existing `updateService.ts` contract is kept; only its backing changes

`UpdateEvent` (`checking → available → progress → downloaded → error`),
`UpdateService` and `AppInfo` already describe this flow exactly. The
electron-updater backing is replaced by an npm-registry backing **behind the
same contract**, so IPC, preload and the renderer keep working and are only
*extended* (new fields for size / release notes / dismissal).

`electron-updater` stops being the update path. Its dependency (and the
mandatory `vi.mock('electron-updater', …)` trap in `main/index.test.ts`) is
removed once the new path is green.

**Why:** The existing contract is already the right shape; rewriting it would
churn four layers for nothing. Injected-dependency style (the `DialogLike` /
`McpProbe` precedent) is preserved so the new service stays unit-testable
against a fake registry with no network.

## ND-C6 — Windows (NSIS) is the fully-implemented install path in v1

The download/verify/extract stages are platform-agnostic. The final
**"run the installer and relaunch"** stage is platform-specific and ships
**Windows-first**, behind a small strategy interface so macOS/Linux drop in
later without rework. Non-Windows platforms report an honest "download ready,
open it manually" state rather than a silent failure.

**Why:** The user runs Windows (WSL2 host) — that is the platform that actually
needs to work. macOS `.dmg` mounting + signature preservation and Linux
`deb`/`snap` privilege escalation are each their own project; AppImage is the
easy one and is the natural second. Agent-resolved from the environment, not a
user preference — revisit when a second platform has real users.

## ND-C7 — SUPERSEDES ND-C1: payload host moves from npm to GitHub Releases

The first real `npm publish` of the platform package (2026-07-22, after ND-B1
resolved and the user authenticated) failed with a genuine
`npm error code E413 — 413 Payload Too Large` from the live registry —
confirmed clean, nothing published (both package names still 404 immediately
after). ND-C1's "the raw registry tarball URL has no such cap" was an
**untested assumption**: T1's spike only verified *downloading* a small
existing package, never *uploading* a large one. This is the first time that
assumption was actually exercised, and it failed on the very first attempt.

A second, compounding fact surfaced at the same time: the real installer is
**~297 MB**, not the ~92 MB this feature's sizing (ND-C4) was built around —
traced to `@anthropic-ai/claude-code` (added by a later, unrelated feature)
bundling the full Claude Code CLI binary (~250 MB alone). Even a materially
higher npm limit than what was hit might not have been enough.

**Decision (user, 2026-07-22):** keep npm as the **version source** (ND-C1's
`GET /<pkg>/latest` + custom `hiveRelease` field — this part was never in
question and works exactly as designed) but move the **payload host** to a
**GitHub Release** on `gustavobrunodev/hive`. This is design.md's own
pre-approved fallback ("If npm objects... swapping to GitHub Releases is a
contained change") — chosen over shrinking the installer to fit under
whatever npm's real (undocumented) limit turns out to be, since that limit
isn't published anywhere and might move; GitHub Releases have a documented,
generous ceiling (empirically confirmed ~2 GB via a real `electron/electron`
release asset) that comfortably outlives any plausible future installer size.
Full technical detail (new module shapes, the revised `hiveRelease` schema,
the simplified download flow with no more tar extraction) is design.md §2A.

**New blocker — ND-B2 (OPEN, 2026-07-22):** creating a real GitHub Release
and uploading assets to it needs a GitHub token (`gh auth login` or a PAT with
`repo`/`contents:write` scope on `gustavobrunodev/hive`) — this environment
has no `gh` CLI installed and no token in the environment. Everything except
the actual release-creation + asset-upload step can be built and verified
without it (the read side — resolving a release by tag and downloading an
asset — needs no auth at all for a public repo, already verified live).
