# Stack — Design Studio

| Name | Version |
| --- | --- |
| `@awesome.me/webawesome` | ^3.11.0 (MIT license, `lit ^3.2.1` dependency). **Note:** Shoelace is archived as of 2026 (`shoelace-style/shoelace` repo: `archived: true`) — do not install `@shoelace-style/shoelace`; the successor package is `@awesome.me/webawesome`. A paid Pro tier gates a documented set of components (Combobox, Date Picker, File Input, Data Grid, chart types, "Patterns") plus extra icon/theme packs — **not** just icons/themes as first assumed. The components confirmed v1-needed (card, tabs, badge, dialog, dropdown, tooltip, basic form inputs) are confirmed free, but re-check any new component against the Pro list before it's added to the catalog (CAP-13). Verified against the npm registry and GitHub 2026-08-09. |

Everything else (Electron main/preload/renderer, React shell, TypeScript) is the existing Hive Desktop stack — unchanged by this module.

`hive-desktop/resources/` (already `asarUnpack`'d per `electron-builder.yml`) gains the Web Awesome bundle at build time — the same mechanism the app already uses for build-time static assets read directly off disk by the main process, distinct from `whisperProtocol.ts`'s runtime-downloaded Whisper models.
