# Context — Explorer & Editor UX (user decisions for gray areas)

Captured 2026-07-11 via the discuss step of tlc-spec-driven. These resolve the
ambiguous forks in the 7 requested improvements before design.

---

## C1 — Default open mode for editable files (F1 × F6/F7)

**Decision: open in RAW EDIT by default, with a toggle to the formatted
preview.** F1 ("ao abrir o arquivo já ser editável") is taken literally — every
text file opens in the editable `<textarea>` immediately, no pencil-click.
Markdown/HTML preview (F6/F7) is a *toggle on top of* that default, not the
default. `Ctrl+S` saves from edit mode.

**Rejected:** preview-first (contradicts F1's "já editável"); split
editor+preview (more surface/complexity than asked, revisit later if wanted).

## C2 — Markdown renderer (F6)

**Decision: adopt `react-markdown` + `remark-gfm`** (real dependencies) rather
than extending the hand-rolled `ui/markdown.tsx`. BMAD artifacts (PRDs, specs,
story lists) use tables, links, nested lists, and task lists — the hand-rolled
line parser (its own header comment flags this exact limit) can't render them
faithfully. The hand-rolled renderer is replaced, not kept in parallel.

**Rejected:** extending the hand-rolled parser (lower fidelity, more edge-case
maintenance we own).

## C3 — Bulk-action scope for multi-selection (F3/F4)

**Decision: full OS-like — the multi-selection drives BULK DELETE and BULK
MOVE (drag).** Selecting N items and pressing delete trashes all N behind one
confirmation; dragging any selected item moves the whole selection into the
target folder. This supersedes the original file-management spec's explicit
"single-item selection" non-goal.

**Rejected:** delete-only bulk (asymmetric, surprising); visual-only selection
(selection with no action is a dead affordance).

## C4 — HTML "live server" rendering (F7)

**Decision: sandboxed `<iframe>` rendering the file's HTML, auto-reloading when
the file changes on disk** (reuse the existing `watchWorkspace` signal). No real
local HTTP server. Accepted limitation, surfaced to the user: relative asset
references (own `./style.css`, `./app.js`, images) may not resolve under
`srcdoc`; scripts run under a locked-down `sandbox` allowlist.

**Rejected:** local static HTTP server + live-reload (resolves relative assets
but adds a port/lifecycle/security surface — deferred as a follow-up if users
hit the relative-asset limit); scripts-disabled snapshot (less "live" than the
"live server" ask implies).

---

## Cross-cutting rules (from the user, apply to every task)

- **R-A — Validate visuals with Playwright MCP.** Any visual change (open mode,
  selection highlight, resizable divider, markdown/HTML preview) is checked in
  the running app via the Playwright MCP, not asserted blind. (The former
  render-blocker — STATE.md's React-duplication crash — was resolved 2026-07-11,
  so the app reaches the work UI and these checks can run.)
- **R-B — Extend/create DS components freely when UX needs it.** The DS `Tree`
  will be extended to pass modifier keys (Ctrl/Shift) to its selection logic;
  experience wins over staying inside the current component surface.
