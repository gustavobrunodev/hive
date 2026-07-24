# Spec — Git Management (Controle de versão completo, estilo VS Code/Cursor)

**Feature dir:** `.specs/features/git-management/`
**Milestone:** new **M10 — Source Control** (ROADMAP.md).
**Scope:** Large/Complex (new main `GitService` + IPC + preload bridge + a
view-switching sidebar refactor + a new Source Control renderer surface +
new `DiffView`/`StatusBar` DS-adjacent components + new test infra against a
real throwaway git repo).

---

## Problem Statement

Hive Desktop lets a squad member create and edit BMAD artifacts (PRDs,
architecture docs, stories) in-app, but the moment they need to **version**
that work — see what changed, stage it, write a commit, switch a branch, pull
a teammate's update, resolve a conflict — they have to leave the app for a
terminal or a second editor. That breaks the product thesis ("a user with no
terminal knowledge…") exactly where engineering discipline matters most, and
it fractures the deep-work session the app is built for. Cursor, VS Code and
Claude Desktop all treat source control as a first-class, always-a-click-away
surface; Hive should too.

## Goals

- [ ] **G1 — Zero-terminal git.** A user reviews, stages, commits, branches,
      syncs, resolves conflicts, and stashes entirely inside Hive, never
      opening a terminal — measured by the full loop being demoable in-app.
- [ ] **G2 — Earned familiarity.** A user fluent in VS Code/Cursor source
      control sits down and it just works (same grouping, same gestures, same
      inline-commit box, same status-bar branch pill) — no re-learning.
- [ ] **G3 — Truthful, never destructive-by-surprise.** Every irreversible
      action (discard, clean, force ops) is explicit and confirmed; real git
      errors (auth, conflicts, lock) surface verbatim with guidance rather
      than being swallowed.
- [ ] **G4 — In-context awareness.** Change state is ambient: file
      decorations in the explorer, per-line gutter marks in the editor, and a
      status bar that always shows branch + sync state — without opening the
      SCM view.

## Out of Scope

Explicitly excluded to prevent scope creep. Natural next features, not this one.

| Feature | Reason |
| --- | --- |
| In-app credential/token entry & storage | Decision D-GIT-1: remotes use the **system** git credential helper / SSH keys only. No secrets are typed into or stored by Hive. |
| Per-hunk / per-line staging & discard | Real capability, but a large sub-surface; P1 stages/discards whole files. Deferred to P2 (GIT-P2). |
| Git blame / inline authorship annotations | Read-only enrichment, orthogonal to the write loop. P3. |
| Branch **graph** visualization (commit DAG) | History ships as a linear timeline in P1; the graph is a heavy viz. P3. |
| Interactive rebase, cherry-pick, revert-commit UI | Advanced rewriting; P1 covers the everyday loop. Basic revert → P2. |
| Tags create/list/push | Not part of the core review→commit→sync loop. P2. |
| Submodules, LFS, worktrees, sparse-checkout | Niche; out for the foreseeable roadmap. |
| GitHub/GitLab PR & issue integration | A provider integration (auth, API) — its own feature, not local git. |
| Multi-root / multiple repos in one window | Single active workspace = single repo, matching `WorkspaceService`. |
| Commit signing **setup** | Hive respects existing git signing config; it doesn't configure GPG/SSH signing. |

---

## User Stories

### P1: Source Control home & change review ⭐ MVP

**User Story**: As a squad member, I want a Source Control view I can flip to
from the activity rail that shows everything that changed in my workspace,
grouped and decorated like VS Code, so I can see the state of my work at a
glance without a terminal.

**Why P1**: This is the vertical slice's spine — repo awareness + the change
list are the surface everything else hangs off. Without it nothing else has a
home.

**Acceptance Criteria**:

1. WHEN the workspace is a git repo THEN the activity rail SHALL show a
   **Source Control** entry that swaps the left sidebar between the Explorer
   (file tree) and the Source Control view, one at a time (GIT-R13).
2. WHEN the workspace is **not** a git repo THEN the Source Control view SHALL
   show a teaching empty state with an **"Inicializar repositório"** action
   that runs `git init` and re-detects (GIT-R1).
3. WHEN there are changes THEN they SHALL be grouped into **Conflitos de
   merge**, **Alterações prontas** (staged) and **Alterações** (unstaged +
   untracked), each with a count, each row showing the path, a status glyph
   (M/A/D/R/U/C/!) and its semantic color (GIT-R2).
4. WHEN the working tree changes on disk (agent write, external edit, git op)
   THEN the change list, counts, and the rail's change badge SHALL refresh
   without a manual reload (GIT-R2.4).
5. WHEN the working tree is clean THEN the view SHALL show a calm "Nenhuma
   alteração" empty state naming the current branch (GIT-R2.5).
6. WHEN a file has a git status THEN its **explorer tree row** SHALL carry the
   matching status color + badge letter (ignored files dimmed; folders roll up
   a change dot) (GIT-R11).

**Independent Test**: Open a workspace that is a repo with dirty files → flip
to Source Control from the rail → see grouped, decorated changes and matching
explorer decorations; open a non-repo workspace → see the init empty state,
click it → repo initializes.

---

### P1: Stage, discard & commit

**User Story**: As a squad member, I want to stage or discard changes and write
a commit inline, so I can record my work in coherent units without leaving the
app.

**Why P1**: The review→commit half of the loop; the whole point of seeing
changes is to act on them.

**Acceptance Criteria**:

1. WHEN I hover/focus a change row THEN inline actions SHALL offer **Stage**
   (unstaged) or **Unstage** (staged) and **Discard**, with group-level
   **Stage all / Unstage all / Discard all** on the section headers (GIT-R3).
2. WHEN I discard a tracked file's changes THEN the system SHALL confirm first
   and restore it to HEAD; WHEN I discard an untracked file THEN it SHALL be
   sent to the OS trash (recoverable), never hard-deleted (GIT-R3.3).
3. WHEN I type a message and press **Commit** (or Ctrl/Cmd+Enter) THEN the
   staged changes SHALL be committed and the input cleared (GIT-R5).
4. WHEN nothing is staged but there are changes and I press Commit THEN the
   system SHALL offer **"Preparar tudo e commitar"** (VS Code parity), not
   fail silently (GIT-R5.3).
5. WHEN I choose **amend** THEN the commit SHALL amend the previous one,
   pre-filling its message (GIT-R5.4).
6. WHEN the commit message is empty and nothing forces a message THEN Commit
   SHALL be disabled with a clear reason (GIT-R5.5).

**Independent Test**: Stage a file, write a message, commit → `git log` shows
it, list clears; discard an unstaged edit → file reverts; discard an untracked
file → it lands in the OS trash.

---

### P1: Diff review (viewer + editor gutter)

**User Story**: As a squad member, I want to click a changed file and read a
clear diff, and to see per-line change marks while I edit, so I know exactly
what I'm about to commit.

**Why P1**: You can't responsibly stage/commit what you can't see.

**Acceptance Criteria**:

1. WHEN I click a change row THEN a **diff tab** SHALL open in the editor pane
   (labeled "arquivo (working tree)" / "(staged)"), showing add/remove/context
   lines with old/new line numbers and hunk headers (GIT-R4).
2. WHEN viewing a diff THEN I SHALL be able to toggle **unified ⇄ side-by-side**
   (GIT-R4.2).
3. WHEN the changed file is binary/image THEN the diff SHALL show a
   binary/"before → after" affordance rather than garbled text (GIT-R4.3).
4. WHEN a tracked file is open in the editor with uncommitted line changes
   THEN the editor **gutter** SHALL mark added/modified/deleted lines
   (computed against HEAD), updating live as I type (GIT-R11.2).

**Independent Test**: Edit a file, open its diff → added/removed lines render
correctly, side-by-side toggle works; the same file open in the editor shows
matching gutter marks.

---

### P1: Branching

**User Story**: As a squad member, I want to see my current branch and create,
switch, rename, and delete branches from a picker, so I can organize work
without a terminal.

**Why P1**: Branch-per-task is table stakes; the whole team convention depends
on it.

**Acceptance Criteria**:

1. WHEN I open the branch picker (status-bar branch pill or SCM header) THEN a
   quick-pick SHALL list local + remote branches, filterable, with **create**
   and **checkout** actions (GIT-R6).
2. WHEN I switch branches with unsaved editor edits or a dirty tree that would
   be overwritten THEN the system SHALL guard (reuse the three-way unsaved
   dialog; surface git's checkout refusal rather than force) (GIT-R6.3).
3. WHEN I create a branch THEN it SHALL branch from the current HEAD and check
   out; WHEN I rename/delete THEN it SHALL apply with confirmation for delete
   (GIT-R6.4).
4. WHEN HEAD is detached THEN the branch indicator SHALL say so and offer to
   create a branch here (GIT-R6.5).

**Independent Test**: Create `feat/x` from the picker → HEAD moves, status bar
updates; switch back to `main`; delete `feat/x` with confirmation.

---

### P1: Remote sync (system credentials)

**User Story**: As a squad member, I want to fetch, pull, push, and sync using
the credentials already on my machine, and see how far ahead/behind I am, so I
stay in step with my team.

**Why P1**: "Complete git like VS Code/Cursor" includes remotes; a local-only
tool is a toy.

**Acceptance Criteria**:

1. WHEN the current branch has an upstream THEN the status bar + SCM header
   SHALL show **↑ahead ↓behind** and offer **Sync** (pull then push), plus
   discrete **Fetch/Pull/Push** actions (GIT-R7).
2. WHEN the current branch has no upstream THEN the action SHALL be **"Publicar
   branch"** (`push -u`) (GIT-R7.3).
3. WHEN a remote op needs credentials Hive doesn't manage THEN the system SHALL
   rely on the OS git credential helper/SSH and, on failure, surface git's real
   error message with guidance — never a silent fail, never an in-app password
   prompt (GIT-R7.4, D-GIT-1).
4. WHEN there is no remote configured THEN sync actions SHALL be disabled with
   an explanatory state (GIT-R7.5).
5. WHEN a sync/pull/push is running THEN the status bar SHALL show progress and
   the result (success toast / error) SHALL be reported (GIT-R7.6).

**Independent Test** (with a local bare remote as origin): make a commit → push
→ bare repo has it; simulate behind → pull brings it in; ahead/behind counts
track correctly.

---

### P1: Commit history (timeline)

**User Story**: As a squad member, I want to browse the repo's commit history
and a single file's history, and open any commit's diff, so I can understand
how an artifact evolved.

**Why P1**: Reviewing history is half of why version control exists; selected
for P1.

**Acceptance Criteria**:

1. WHEN I open **Histórico** THEN a timeline SHALL list commits (short hash,
   subject, author, relative date), newest first, with **load more** (GIT-R8).
2. WHEN I select a commit THEN its changed files SHALL list and selecting one
   SHALL open that commit's diff in the diff viewer (GIT-R8.2).
3. WHEN I right-click a file (explorer or change row) and choose **Ver
   histórico** THEN the timeline SHALL scope to that file's commits (GIT-R8.3).

**Independent Test**: Make three commits → history lists them newest-first;
open one → see its diff; view a single file's history → only its commits show.

---

### P1: Merge conflict resolution

**User Story**: As a squad member, I want conflicted files called out and a
guided way to accept current/incoming/both, so a pull or merge conflict doesn't
force me back to the terminal.

**Why P1**: Conflicts are exactly the moment a non-CLI user gets stuck;
selected for P1.

**Acceptance Criteria**:

1. WHEN a merge/pull leaves conflicts THEN conflicted files SHALL appear under
   **Conflitos de merge** with a conflict glyph (GIT-R9).
2. WHEN I open a conflicted file THEN a conflict view SHALL present each
   conflict block with **Aceitar atual / Aceitar recebido / Aceitar ambos**
   and a compare affordance (GIT-R9.2).
3. WHEN all markers in a file are resolved THEN the system SHALL let me mark it
   resolved (stage), and offer **Continuar** / **Abortar** for the whole
   merge (GIT-R9.3).

**Independent Test**: Create a two-branch conflict, merge → file appears under
Conflitos; accept incoming on each block → markers gone → stage → continue
merge completes.

---

### P1: Stash

**User Story**: As a squad member, I want to stash my uncommitted work and
restore it later, so I can switch context without committing half-done work.

**Why P1**: Selected for P1; pairs naturally with branch switching.

**Acceptance Criteria**:

1. WHEN I choose **Stash** THEN uncommitted changes SHALL be stashed (optional
   message; option to include untracked), and the tree returns clean (GIT-R10).
2. WHEN I open the stash list THEN each stash SHALL offer **Aplicar / Pop /
   Descartar** (GIT-R10.2).
3. WHEN applying a stash conflicts THEN the conflict SHALL route into the same
   conflict-resolution surface (GIT-R9 reuse) (GIT-R10.3).

**Independent Test**: Edit files → Stash → tree clean, stash listed; Pop → edits
return and stash removed.

---

### P1: Status bar

**User Story**: As a squad member, I want a persistent bottom status bar with my
branch and sync state, so version state is always visible and one click away.

**Why P1**: The always-present anchor that makes git ambient; VS Code/Cursor
parity.

**Acceptance Criteria**:

1. WHEN the workspace is a repo THEN a bottom **status bar** SHALL show the
   current branch (click → branch picker), ↑↓ sync counts (click → sync),
   and a changes count (click → Source Control view) (GIT-R12).
2. WHEN a git operation is in flight THEN the status bar SHALL show a spinner +
   label; WHEN it finishes THEN state SHALL update within one refresh
   (GIT-R12.2).
3. WHEN the workspace is not a repo THEN the status bar SHALL show an
   **"Inicializar repositório"** affordance instead of branch state (GIT-R12.3).

**Independent Test**: Branch/sync/changes all reflect reality and each click
routes to the right surface; run a fetch → spinner shows then clears.

---

## Non-functional / cross-cutting requirements

### GIT-R14 — Correctness, security & quality gates (acceptance)

- **GIT-R14.1** Every git command runs with `cwd` = the active workspace and is
  **contained** to it; no command targets a path outside the workspace root.
- **GIT-R14.2** Git operations are **serialized** through a per-repo queue so
  concurrent invocations never race the index/`index.lock`; a busy repo queues
  rather than corrupts.
- **GIT-R14.3** No credentials, tokens, or remote URLs-with-secrets are logged.
- **GIT-R14.4** All pre-existing suites stay green (no regression).
- **GIT-R14.5** **≥90%** coverage (statements, branches, lines, functions) for
  every file created/changed by this feature (per-file thresholds).
- **GIT-R14.6** **E2E** (Playwright driving the real Electron app against a
  throwaway git repo + a local bare remote) exercises detect→stage→commit→diff→
  branch→push→pull→conflict→stash, asserting on-disk/`git` state.
- **GIT-R14.7** **Playwright-MCP visual validation** of every SCM state in dark
  and light: empty/clean, dirty (all groups), diff (unified + side-by-side),
  conflict, history, stash, status bar, and explorer decorations.
- **GIT-R14.8** All UI copy is pt-BR via `t()` — no inline literals (enforced by
  the existing `noInlineStrings` test).

---

## Edge Cases

- WHEN the workspace path is inside a parent git repo (`.git` above the root)
  THEN git ops SHALL operate on the enclosing repo (git resolves it from `cwd`),
  and detection SHALL treat the workspace as version-controlled (GIT-R1.4).
- WHEN a git command fails (non-zero exit) THEN stderr SHALL be surfaced as a
  user-facing, i18n-wrapped error with the raw detail available — never
  swallowed (GIT-R14; ties to G3).
- WHEN the repo is huge (thousands of changed files) THEN the change list SHALL
  virtualize/scroll without freezing the UI (GIT-R2 perf).
- WHEN a diff is enormous (generated file) THEN the viewer SHALL cap/late-load
  rather than block the renderer (GIT-R4 perf).
- WHEN `git` is somehow unavailable on the machine THEN the SCM surfaces SHALL
  degrade to a clear "git não encontrado" state, not crash (GIT-R1.5).
- WHEN the workspace switches THEN all git state SHALL reset and re-detect for
  the new path (reuse the workspace-switch teardown) (GIT-R1.3).
- WHEN a file is both staged and has further unstaged edits THEN it SHALL appear
  in **both** Staged and Changes with the correct per-side diff (GIT-R2.6).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| GIT-R1 Repo detect/init/lifecycle | P1: SCM home | Design | Verified |
| GIT-R2 Status & change list | P1: SCM home | Design | Verified |
| GIT-R3 Stage/unstage/discard | P1: Stage & commit | Design | Verified |
| GIT-R4 Diff viewer | P1: Diff review | Design | Verified |
| GIT-R5 Commit (+amend/stage-all) | P1: Stage & commit | Design | Verified |
| GIT-R6 Branches | P1: Branching | Design | Verified |
| GIT-R7 Remote sync | P1: Remote sync | Design | Verified |
| GIT-R8 Commit history | P1: History | Design | Verified |
| GIT-R9 Conflict resolution | P1: Conflicts | Design | Verified |
| GIT-R10 Stash | P1: Stash | Design | Verified |
| GIT-R11 Decorations + gutter | P1: SCM home / Diff | Design | Verified |
| GIT-R12 Status bar | P1: Status bar | Design | Verified |
| GIT-R13 Sidebar view switch | P1: SCM home | Design | Verified |
| GIT-R14 Correctness/security/gates | All (acceptance) | Design | Verified |

**ID format:** `GIT-R[NUMBER]` (dotted sub-points per repo convention, e.g.
`GIT-R3.3`).
**Status values:** Pending → In Design → In Tasks → Implementing → Verified.
**Coverage:** 14 requirement groups, all P1; mapping to atomic tasks in
`tasks.md`.

---

## Success Criteria

- [x] A user completes review → stage → commit → push, and pull → resolve
      conflict → continue, entirely in-app (no terminal) — G1.
- [x] A VS Code/Cursor user needs zero instruction to find and use staging,
      commit, branch pill, and sync — G2.
- [x] Every irreversible action is confirmed; a forced/failed remote op shows
      git's real error, not a swallowed one — G3.
- [x] Branch + sync state and per-file change state are visible without opening
      the SCM view (status bar + explorer decorations + editor gutter) — G4.
- [x] GIT-R14 gates met: no regression, ≥90% per-file coverage, real-repo E2E,
      Playwright-MCP visual pass (dark+light, every state).
