# Design — npm Distribution & In-App Self-Update

**Feature:** `npm-distribution` · **Spec:** [spec.md](spec.md) · **Context:** [context.md](context.md)
**Status:** 📝 Planned (2026-07-21)

---

## 1. Shape of the solution

Three separable layers, each independently testable:

```
 PUBLISH (build-time)          DISCOVER + FETCH (main)         DECIDE (renderer)
┌──────────────────────┐     ┌───────────────────────────┐   ┌────────────────────┐
│ electron-builder     │     │ npmRegistry  (pure HTTP)  │   │ ambient dot (rail) │
│   ↓ installer        │ ──► │ updateService (contract)  │──►│ UpdateNotice       │
│ platform pkg + main  │     │ updateApply  (per-OS)     │   │ UpdateCenter       │
└──────────────────────┘     └───────────────────────────┘   └────────────────────┘
       npm registry  ◄──────────── single source of truth ────────────►
```

The renderer never talks to the network. The main process never decides policy
(when to announce, what was skipped) — it reports facts; the renderer and
`ConfigStore` own consent.

## 2. Registry protocol (ND-R2, ND-R3)

**Two unauthenticated GETs, no CDN** (context.md ND-C1):

1. `GET https://registry.npmjs.org/<main-pkg>/latest`
   Returns the **full version object** for the `latest` dist-tag — small, single
   document. Crucially, npm preserves **custom `package.json` fields** in it, so
   one request yields version *and* release metadata:

   ```jsonc
   {
     "version": "0.2.0",
     "hiveRelease": {                    // our custom field, published as-is
       "notes": "### Novidades\n- …",    // markdown
       "platforms": { "win32-x64": "@user/hive-desktop-win-x64" }
     }
   }
   ```

   > Use `/latest`, **not** the full packument: the packument grows with every
   > version and the abbreviated form (`application/vnd.npm.install-v1+json`)
   > strips custom fields. Scoped names must be URL-encoded: `@user%2Fpkg`.

2. `GET https://registry.npmjs.org/<platform-pkg>/<version>`
   Returns `dist.tarball` (the direct, uncapped registry URL) and
   `dist.integrity` (an SRI `sha512-<base64>` string).

**Verification (ND-R3.3):** stream the tarball to disk while hashing with
`node:crypto` `createHash('sha512')`, then compare base64 against
`dist.integrity`. No `ssri` dependency needed. A mismatch deletes the artifact
and raises a **distinct** `integrity` error — never retried silently.

**Extraction:** npm tarballs are gzipped tars rooted at `package/`. Extract with
the `tar` package (npm's own library) into the staging dir, then locate the
installer via the descriptor.

**Staging:** `app.getPath('userData')/updates/<version>/`. Cleared on success,
on cancel, and on startup for any version ≠ the pending one (ND-R3.5).

### New dependencies

| Package | Why | Alternative rejected |
|---|---|---|
| `tar` | Extract the npm `.tgz`. npm's own implementation. | Hand-rolled tar reader — pointless risk. |
| `semver` | Correct precedence comparison (ND-R2.2). | String compare — `0.10.0 < 0.9.0` bug. |

`electron-updater` is **removed** once this path is green (ND-C5), which also
retires the mandatory `vi.mock('electron-updater', …)` trap in
`main/index.test.ts`.

## 2A. SUPERSEDED (2026-07-22): payload host is GitHub Releases, not npm

**Real-world finding:** publishing the real ~297 MB Windows installer as an npm
platform-package tarball was rejected by the live registry with a genuine
`npm error code E413 — 413 Payload Too Large` on the first real publish
attempt — confirmed clean (neither package reached the registry; verified via
a direct `GET` against both package names returning 404 afterward). §2's "no
such cap" claim (ND-C1) was an **untested assumption**: T1's spike verified
*downloading* a small existing package, never *uploading* a large one. The
installer is also **~3× larger than this design's original ~92 MB estimate**
(context.md ND-C4), traced to `@anthropic-ai/claude-code` — a dependency added
by a later, unrelated feature — bundling the full Claude Code CLI binary
(~250 MB on its own).

**New split, verified against the real GitHub API (2026-07-22):** npm stays
the **version source** (this section's `GET /<main-pkg>/latest` +
`hiveRelease` custom field — unchanged). The **payload host** becomes a
**GitHub Release** on `gustavobrunodev/hive`, not a per-platform npm package.
Verified empirically, no assumption: an unauthenticated
`GET https://api.github.com/repos/<repo>/releases/tags/<tag>` returns the
asset list (`browser_download_url` + `size` per asset), no token needed for a
public repo (60 req/hour unauthenticated — ample for a 45-minute periodic
check); release assets support **up to ~2 GB** (confirmed via a real 1.86 GB
asset on `electron/electron`'s own releases) — no practical ceiling for this
payload, ever.

**New `hiveRelease` shape** (`repo` added; `platforms` values are now asset
filenames, not npm package names):
```jsonc
{
  "notes": "…",
  "repo": "gustavobrunodev/hive",
  "platforms": { "win32-x64": "hive-desktop-0.2.0-setup.exe" }
}
```

**Resolution flow (replaces this section's step 2 above):**
1. `GET /<main-pkg>/latest` (npm, unchanged) → version + notes + `repo` + the
   asset filename for this platform.
2. `GET https://api.github.com/repos/<repo>/releases/tags/v<version>` (GitHub,
   new) → the release's asset list → the installer asset's
   `browser_download_url` + `size`, **and** a second small manifest asset
   (`hive-update.json`, uploaded alongside the installer) → parsed for the
   `sha512` (GitHub provides no built-in content hash; the release script
   computes and publishes its own, same `sha512-<base64>` SRI format as
   before — verification logic in `updateDownload.ts` is unchanged).
3. Download the installer directly — a raw `.exe`, **not** a `.tgz`. **No
   `tar` extraction step anymore**; that was purely an artifact of npm
   tarball packaging and no longer applies.
4. Hash while streaming, compare to the manifest's `sha512` — identical
   verification logic to before.

**What this simplifies:** ND-C1's whole "packument stays small, so binaries
go in separate per-platform packages" driver no longer applies — GitHub
Releases have no packument-style metadata cap at all, so there is no reason
to keep the per-platform-package indirection on the npm side.
`updateDownload.ts` sheds its tar-extraction step entirely (download + hash +
verify only); the `tar` dependency is no longer needed for this path.

**What changes in `main/`:** a new `main/githubReleases.ts` (same DI shape as
`npmRegistry.ts` — an injected `fetchJson`-shaped client) replaces
`npmRegistry.ts`'s `fetchPayload` for payload resolution. `PayloadInfo`'s
`tarballUrl` field is renamed `downloadUrl` (it is not a tarball anymore)
everywhere it's used. `npmRegistry.ts`'s `fetchLatestRelease` is otherwise
unchanged (still the version source), but `ReleaseInfo` gains a
`repo: string | null` field alongside a renamed `platformAsset` (was
`platformPackage` — it is an asset filename now, not a package name).

**What changes in the publish pipeline (`scripts/release.mjs`, §4 below):**
replaces "assemble + `npm publish` a platform package" with "create a GitHub
Release tagged `v<version>` (if it doesn't already exist) + upload the
installer + upload a freshly computed `hive-update.json` (now including
`sha512`) as release assets" via the GitHub REST API — **needs a token, a new
blocker, ND-B2**, the GitHub analogue of ND-B1. The main npm package publish
step is unchanged in spirit (small, metadata-only, still published **last** —
release order still matters: the GitHub Release must exist before the main
npm package's `latest` advertises it, same ND-R1.6 reasoning, new mechanism).

## 3. Main-process modules

> **§2A supersedes this section's payload-fetching pieces**: `fetchPayload`
> below is retired in favor of a new `main/githubReleases.ts`; `PayloadInfo`'s
> `tarballUrl` is renamed `downloadUrl`; `ReleaseInfo.platformPackage` is
> renamed `platformAsset` and gains a sibling `repo` field. `updateDownload.ts`
> drops its `tar` extraction step. Read §2A before implementing from this
> section as originally written.

### `main/npmRegistry.ts` — pure, injectable, no Electron

```ts
export interface RegistryClient { fetchJson(url: string): Promise<unknown> }

export interface ReleaseInfo {
  version: string
  notes: string | null
  platformPackage: string | null   // null ⇒ this platform has no payload
}
export interface PayloadInfo {
  tarballUrl: string
  integrity: string                // "sha512-…"
  bytes: number | null
}

export function platformKey(platform: NodeJS.Platform, arch: string): string
export async function fetchLatestRelease(c: RegistryClient, pkg: string): Promise<ReleaseInfo>
export async function fetchPayload(c: RegistryClient, pkg: string, v: string): Promise<PayloadInfo>
export function isNewer(candidate: string, current: string): boolean   // semver
```

Injected `RegistryClient` (the `DialogLike` / `McpProbe` DI precedent) keeps the
whole discovery path unit-testable against fixtures with **zero network**
(ND-R7.3). All parsing is defensive: any malformed field degrades to
"no update available", never a throw (ND-R2.4).

### `main/updateService.ts` — same public contract, npm backing (ND-C5)

The existing `UpdateService` / `UpdateEvent` / `AppInfo` exports are **kept**;
only the implementation and a few additive fields change:

```ts
export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'not-available' }
  | { type: 'available'; version: string; bytes: number | null; notes: string | null }
  | { type: 'progress'; percent: number; transferred: number; total: number }
  | { type: 'verifying' }                                     // new — a trust beat
  | { type: 'downloaded'; version: string; installerPath: string }
  | { type: 'applying' }                                      // new
  | { type: 'error'; message: string; kind: 'network' | 'integrity' | 'apply' }

export interface AppInfo {
  name: string
  version: string
  updatesSupported: boolean      // app.isPackaged (unchanged)
  canApply: boolean              // new — false on non-Windows in v1 (ND-C6)
  lastCheckedAt: number | null   // new
}
```

Additive by construction: existing renderer code keeps compiling; new fields
drive the new UI. `check()` / `download()` / `install()` keep their names.
`cancel()` is added (ND-R3.4).

Timeouts and silence: `check()` takes an `explicit: boolean`. When `false`
(launch/periodic), failures emit **nothing** — they only update
`lastCheckedAt` (ND-R2.4). When `true`, failures emit `error`.

### `main/updateApply.ts` — per-OS strategy (ND-C6)

```ts
export interface ApplyStrategy { apply(installerPath: string): Promise<void> }
```

- **Windows (v1):** spawn the NSIS installer `detached: true, stdio: 'ignore'`,
  `unref()`, then `app.quit()`. The installer replaces the install and relaunches.
- **Other platforms (v1):** no strategy → `canApply: false`. The flow stops at
  `downloaded` and the UI offers `shell.showItemInFolder(installerPath)`
  (ND-R4.3). Honest, not a silent failure.

### Consent state (ND-R5.4) — `ConfigStore`

One additive field: `skippedUpdateVersion: string | null`. Global, same scope
rationale as `role`/`agent`. Checked before announcing; a version newer than the
skipped one announces normally. Session-only dismissal lives in renderer state,
not on disk.

### IPC (additive)

`update:cancel`, `update:reveal` join the existing `update:*` handlers;
`app:info` gains the new fields. Preload surface: `window.hive.app.cancelUpdate()`,
`.revealInstaller()`, `.skipVersion(v)`.

## 4. Publish pipeline (ND-R1)

> **§2A supersedes the "platform package" mechanism below**: there is no
> platform npm package anymore. The installer + `hive-update.json` (now with
> `sha512`) are uploaded as **GitHub Release assets** instead of being
> `npm publish`'d from an assembled package directory. The main package
> (immediately below) is unchanged.

**Main package** (`@<user>/hive-desktop`) — metadata only, no binaries:

```jsonc
{
  "name": "@<user>/hive-desktop",
  "private": false,
  "publishConfig": { "access": "public" },
  "files": ["out/", "resources/", "README.md", "LICENSE"],
  "hiveRelease": { "notes": "…", "platforms": { "win32-x64": "…" } }
}
```

**Platform package** (`@<user>/hive-desktop-win-x64`) — generated, not
hand-maintained. Its `package.json` carries `os`/`cpu` and its payload is one
installer plus `hive-update.json`:

```jsonc
{ "version": "0.2.0", "platform": "win32", "arch": "x64",
  "installer": "hive-desktop-0.2.0-setup.exe", "bytes": 96123456 }
```

**Release order matters (ND-R1.6):** platform packages publish **first**, main
package **last** — the main package's `latest` is the trigger, so it must never
advertise a payload that isn't on the registry yet.

`scripts/release.mjs` performs: verify → build → assemble platform dir →
`npm publish` platform → `npm publish` main. It refuses to run on a dirty tree
or without `npm whoami`. A `--dry-run` mode prints the exact tarball contents
for the ND-R1.5 gate.

## 5. Interface

Shaped with `impeccable`, **product register** (design serves the task) on the
DS's committed brand tokens — the identity-preservation path established by D16.
Bordo surfaces, coral accent, `--ff-num` (Inter Tight) for all version/byte data.

### 5.1 Why not a modal

The product register is explicit that modals are usually laziness, and ND-R5.2
forbids blocking. An update is *never* urgent enough to seize the app. The
design instead uses **three tiers of escalating presence**, so the user meets
the update at the intensity they choose.

### Tier 1 — the ambient dot (always true, never loud)

A 6px `--accent` dot on the ActionRail's app-settings gear whenever an update is
pending. It survives dismissal — this is the ND-R5.5 guarantee that declining
never strands the user. It clears when the version is skipped or applied.

### Tier 2 — `UpdateNotice` (the announcement)

Composed from the DS **Toast primitives** (`Toast`, `ToastAction`,
`ToastViewport`) with `duration={Infinity}` — inheriting Radix's non-focus-
stealing live region and F8 reachability, without `useToast()`'s string-only
API. Anchored **bottom-left, directly above the gear**, so it visually
originates from the affordance it will collapse back into.

```
┌──────────────────────────────────────────┐
│  ▲  Nova versão disponível               │   14px/600 --ink
│                                          │
│     0.1.0  →  0.2.0                      │   --ff-num, atual --muted, nova --accent 600
│     ≈ 92 MB · cerca de 1 min             │   12px --faint
│                                          │
│     Correções no explorador e no chat.   │   13px --muted, 2 linhas máx
│     Ver novidades                        │   12px text-button → abre o centro
│                                          │
│  [ Atualizar agora ]  [ Agora não ]      │   primary accent · ghost
│                        Pular esta versão │   12px --faint text-button
└──────────────────────────────────────────┘
```

- Surface `--surface`, 1px `--border`, `--rounded-lg` (10px — the DS ceiling;
  the over-rounding tell is refused), width 340px.
- Shadow `0 2px 8px oklch(0% 0 0 / 24%)` — deliberately **8px blur**, never
  paired with a border at ≥16px (the ghost-card defect).
- **No side-stripe accent border** anywhere. Emphasis comes from the accent-
  colored target version and the primary button, nothing decorative.
- Refusal is **first-class**: "Agora não" sits beside the primary at equal size;
  "Pular esta versão" is quieter but present, never hidden in a menu (ND-R6.1).

**The card morphs in place** — it is the surface you acted on, so it is the
surface that reports back. Height is reserved so no state change shifts layout:

| State | Body | Actions |
|---|---|---|
| `downloading` | `Progress` determinate + `38,4 MB de 92,1 MB · 41%` (`--ff-num`) | Cancelar |
| `verifying` | full bar + "Verificando integridade" + first 12 chars of the sha512 in `--ff-num`/`--faint` | — |
| `downloaded` | ✓ `--success` "Pronto para instalar" + "O Hive fecha e reabre." | Reiniciar e instalar · Depois |
| `error` | message on a `--danger-bg` **background tint** (never a stripe) | Tentar de novo · Abrir instalador |

The checksum beat is deliberate: naming the verification, and showing a fragment
of the hash, converts a dead 2-second pause into the moment the app demonstrates
it is careful.

**Motion** (product register: 150–250 ms, state-conveying only):
enter `translateY(8px) scale(0.98) → 0`, opacity 0→1, **200 ms `--ease-quart`**;
exit drifts toward the gear (`translateY(6px) translateX(-4px)`), **160 ms** —
teaching where it went. `@media (prefers-reduced-motion: reduce)` replaces both
with a 120 ms crossfade, no transform.

### Tier 3 — `UpdateCenter` (the deliberate visit)

The existing left `Sheet` — same edge as its gear trigger — restructured:

1. **Identity**: logo, "Hive Desktop", version promoted to `--ff-num`.
2. **Status line**: "Verificado há 2 minutos" + a quiet refresh `IconButton`.
   Replaces today's bare "Verificar" button with something that reports.
3. **The version block**: the same state machine as the notice, roomier.
4. **Release notes**: markdown via the app's existing `react-markdown` + `.wb-md`
   styles inside a `ScrollArea`, in an `Accordion` collapsed by default (ND-R6.4).
5. **Skipped-version recovery**: if `skippedUpdateVersion` is set — "Você pulou a
   versão 0.2.0" + "Instalar mesmo assim" (ND-R5.5).
6. **Dev/unsupported**: today's honest note, preserved (ND-R6.8).

### 5.2 Accessibility & i18n

- Radix Toast gives a polite live region; state transitions additionally carry
  `role="status"`.
- `Progress` is determinate (Radix wires `aria-valuenow`); the indeterminate
  sweep is used **only** for `verifying`, where progress genuinely is unknown.
- Every interactive element gets the DS `:focus-visible` ring — per the STATE
  lesson, presentational elements made interactive don't inherit it.
- Contrast: `--faint` on `--surface` is verified ≥4.5:1 for the 12px meta lines
  in **both** themes, or promoted to `--muted`. Bytes/percent never rely on
  color alone.
- All copy in `i18n/pt-BR.ts` under a new `update.*` namespace (D10). Register:
  an invitation, never a warning — "Nova versão disponível", not "Atualização
  necessária".

## 6. Testing (ND-R7)

| Layer | Approach |
|---|---|
| `npmRegistry` | Fixture packuments through a fake `RegistryClient`: newer/older/equal, prerelease, missing `hiveRelease`, missing platform, malformed JSON, 404, timeout. |
| download/verify | Fake HTTP stream + temp dir: happy path, **integrity mismatch**, cancel mid-stream, partial cleanup. |
| `updateApply` | Fake spawn: asserts detached/unref/quit ordering; non-Windows ⇒ `canApply:false`, no spawn. |
| `updateService` | Fake registry + fake apply: full event ordering, silent-vs-explicit failure, skip-version suppression. |
| renderer | RTL over `UpdateNotice` / `UpdateCenter`: every state renders, dismiss is session-scoped, skip persists, refusal never blocks. |
| visual | Playwright **MCP** over the static renderer + injected `window.hive` mock, scenario-switched by query param, dark **and** light (ND-R7.5) — the project recipe, since MCP cannot attach to the real Electron renderer (STATE.md T14). |
| publish | `npm publish --dry-run` tarball-content inspection (ND-R7.4). |

## 7. Risks

| Risk | Mitigation |
|---|---|
| **npm ToS / registry abuse.** ~92 MB per release/platform is heavy and unconventional for npm. | Per-platform packages keep the packument small; publish cadence stays low. Flagged to the user as the known cost of ND-C1. If npm objects, the design's seam is one module (`npmRegistry`) — swapping to GitHub Releases is a contained change. |
| **Custom `hiveRelease` field not preserved** by the registry. | Verified assumption, not proven — **T1 spike validates it against the real registry before anything is built on it.** Fallback: publish `hive-release.json` inside the platform package and read it after extraction (costs one extra state, no redesign). |
| **Unsigned installer** triggers SmartScreen on Windows. | Pre-existing (`notarize:false`, no signing today). Out of scope; recorded as a deferred idea. |
| **A broken release bricks self-update** for everyone on it. | Users can always reinstall manually; the installer is kept on disk on failure (ND-R4.4). Rollback is an explicit non-goal. |
| **Electron/WSL2**: the real app cannot launch here (STATE lessons). | UI validated via the static-renderer + `window.hive` mock recipe; the apply step is unit-tested against a fake spawn and must be **manually verified on real Windows** before release — called out as its own task. |
