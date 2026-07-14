---
name: agent-rules-architect
description: Research a codebase and author or improve AI coding-agent rules using an evidence-based, minimal architecture — a lean always-loaded AGENTS.md for project-wide essentials plus categorized, progressively-disclosed rule files under docs/ that load only when relevant. Use this whenever the user wants to create, set up, write, improve, audit, refactor, slim down, or optimize AGENTS.md, CLAUDE.md, .cursorrules or .cursor/rules, agent/AI instructions, coding-agent context files, or "make a repo work well with AI" — for tools like Cursor, Claude Code, Codex, Copilot, Gemini CLI, or OpenCode — even if they never name the file (e.g. "my agent keeps running the wrong test command", "give my repo context for AI", or "why does the AI ignore our conventions").
---

# Agent Rules Architect

Author or improve the rule files that tell AI coding agents how to work in a
repository. The deliverable is a two-layer system: a **minimal, always-loaded
`AGENTS.md`** plus **categorized rule files under `docs/` that are loaded only
when a task needs them**. The whole design exists to give an agent the right
context at the lowest possible token and attention cost.

## The one idea that drives everything: less is more

This is counterintuitive, so internalize it before writing a single line.
Rigorous evaluation (ETH Zurich, ICLR 2026; GitHub's analysis of 2,500+ repos)
found that repository context files frequently **fail to help and often hurt**:

- LLM-generated context files reduced task success by ~3% on average.
- Human-written files improved success only ~4% — and only when minimal.
- Either way, inference cost rose **20%+** because the agent explores, tests,
  and reasons more to honor instructions it didn't need.

The cause is almost always the same: **bloat and redundancy**. The agent can
already read the code, the manifests, and the README. Every line that repeats
what it can infer is pure cost — it crowds the context window, dilutes the
high-signal rules, and triggers wasteful work.

So the job here is not "document the project." A teammate-style overview makes
things *worse*. The job is to find the **few non-obvious, high-leverage signals**
that prevent real mistakes, state them with surgical precision, and keep
everything else out of the always-loaded layer. When in doubt, leave it out.

Read `references/principles-and-evidence.md` for the full evidence, the failure
modes, and the mental models — consult it whenever you're unsure whether
something earns its place.

## Why two layers (and why this beats one big file)

The evidence condemns *always-loaded* bloat. It does **not** condemn having
detailed knowledge available — only paying for it on every task. That gap is
exactly what progressive disclosure closes:

- **`AGENTS.md` — the always-loaded layer.** Only what applies to *most* tasks
  and that the agent genuinely cannot infer. Target **under ~150 lines**. If
  it's longer than the README, it's too long. This is the layer the evidence
  says to keep ruthlessly small.
- **`docs/` — the on-demand layer.** Specialized rules (a domain area, a tricky
  subsystem, a workflow) live in their own files and are pulled in *only* when
  the task matches. `AGENTS.md` carries a short index pointing to them, so the
  agent knows they exist (cheap) but pays for the content only when relevant.

This lets you capture deep project knowledge without taxing every task — the
deep stuff sits dormant until needed.

## Workflow

Work through these in order. Most of the value is in steps 1–3: research and
ruthless triage. Writing is the easy part.

### 1. Frame the job

Determine:
- **Create vs. improve.** If rule files already exist (`AGENTS.md`, `CLAUDE.md`,
  `.cursorrules`, `.cursor/rules/`, `.github/copilot-instructions.md`), this is
  almost always an *improve/trim* job — read them first and treat extraction of
  bloat as a primary goal, not just addition.
- **Target tool(s).** AGENTS.md + `docs/` is portable across every major agent
  and is the default. If the user targets a specific tool (Cursor, Claude Code,
  Codex…), you can add a native auto-loading layer — see
  `references/tool-compatibility.md`.
- **Language.** Default to **Brazilian Portuguese (pt-BR)** for every rule file
  you author or improve — headings, prose, and index triggers in `AGENTS.md`,
  nested `AGENTS.md`, and all `docs/` files. Keep commands, code snippets,
  paths, flags, and identifiers verbatim — those aren't translated. If the repo
  already has rule files written in a different language, preserve that
  language when *improving* them (don't silently translate existing content —
  ask the user first). Switch away from pt-BR only on explicit user request.

### 2. Research the project — the most important step

You cannot write minimal, accurate rules by guessing. Discover the *real*
commands and conventions, and — critically — **what documentation already
exists**, so you never duplicate it. Guessed commands and copied docs are the
top causes of the negative effect above.

At minimum, establish: the stack and versions; the exact build/test/lint/format
commands (and how to run a *single* test); what the linter/formatter already
enforces (so you don't restate it); hard boundaries (generated dirs, secrets,
vendored code); and any genuinely non-obvious architectural constraints.

Also establish two structural signals that change *where* rules get written:

- **E2E test frameworks.** Detect Playwright, Cypress, Selenium/WebdriverIO,
  Puppeteer, TestCafe, etc. (config files, dependencies — see the checklist in
  `research-playbook.md`). If present, e2e testing is a standing candidate for
  its own `docs/e2e-testing.md` (or the project's existing name for it) — see
  step 5.
- **Module divergence.** In a monorepo/multi-app layout, note any package or
  module whose commands, stack, or conventions genuinely differ from the rest.
  These are candidates for their own nested `AGENTS.md` — see step 3.

Follow `references/research-playbook.md` for ecosystem-by-ecosystem detection
(where to look, which files to read, which commands to verify). Prefer reading
config and CI files over assuming. Verify commands actually exist before writing
them down.

### 3. Triage: is it a rule at all, and which layer?

For every candidate instruction, apply **the inference test**:

> Can the agent figure this out by reading the code, the manifests, or the
> existing docs? If yes — cut it.

What survives the test then gets sorted:

- **Goes in `AGENTS.md`** if it applies to *most* tasks: core commands, hard
  boundaries ("never touch / never commit"), one or two project-wide
  conventions that differ from defaults, and a stack line the agent can't
  cheaply infer.
- **Goes in a `docs/` file** if it's specialized: rules for one subsystem,
  framework, or workflow that only matter for a slice of tasks. Detail that's
  important but rarely relevant belongs here, not in the always-loaded layer.
- **Goes in a nested `AGENTS.md` inside the module's own folder** if it's
  specific to one package/app/module and would be wrong or irrelevant
  elsewhere in the repo (e.g. `apps/mobile/AGENTS.md` uses different commands
  or conventions than `apps/api/`). Keep the root `AGENTS.md` to what's
  genuinely shared; don't nest preemptively — only when a module's rules
  actually diverge from the rest. See "Nesting & monorepos" in
  `references/agents-md-guide.md`.

The litmus test for the split: *"On a random task in this repo, would the agent
need this?"* Mostly-yes → `AGENTS.md`. Sometimes, and shared across modules →
`docs/`. Sometimes, and specific to one module → that module's own nested
`AGENTS.md`. The healthiest root `AGENTS.md` is small with a clear index into
richer `docs/` and, where they diverge, its own nested files per module.

### 4. Write the minimal AGENTS.md

Plain Markdown at the repo root. Favor the high-value sections (commands,
testing, boundaries, the few non-default conventions, a one-line stack), each as
tight as possible. Use exact copy-pasteable commands *with flags*, not tool
names. Prefer a 3–10 line code snippet over a paragraph of prose. Pair every
"don't" with a "do." Omit anything inferable.

See `references/agents-md-guide.md` for the format, section-by-section guidance,
sizing/nesting rules, and the size cap some tools enforce. Use
`assets/AGENTS.md.template` as a starting skeleton and the files in
`assets/examples/` as calibrated references.

### 5. Build the categorized docs/ layer and its index

Create one file per category under `docs/` (e.g. `docs/testing.md`,
`docs/database.md`, `docs/api.md`). Categorize by what makes a clean *trigger* —
usually a subsystem, technology, directory, or task type — so the agent can tell
at a glance when each applies. Then add a short, imperatively-worded index to
`AGENTS.md` so the files get discovered and loaded on demand.

**E2E tests as a standing category.** If step 2 detected an e2e framework
(Playwright, Cypress, Selenium/WebdriverIO, Puppeteer, TestCafe, …), treat e2e
conventions as their own category — same create-vs-improve discipline as
everything else: if a matching rule file already exists (`docs/e2e-testing.md`,
`docs/e2e.md`, or wherever the project already documents this), audit and
sharpen it rather than duplicating; if none exists, create it from scratch
using the same inference test and minimalism as any other `docs/` file. Typical
non-obvious content: how to run it locally/headless and against which target
(dev server vs. deployed env), required setup (seed data, auth bypass, mock
server), selector convention (e.g. `data-testid`), and flakiness/retry policy.
Never restate what the framework's own config already declares.

`references/progressive-rules.md` covers categorization strategy, how to phrase
index pointers so loading is reliable, when to split or merge files, how to
reference existing human docs instead of copying them, and how to wire native
auto-loading on tools that support it (e.g. Cursor globs).

### 6. Validate and trim

Run the audit before declaring done (use this skill's own path for the script):

```bash
python3 <skill-dir>/scripts/audit_rules.py <repo-path>
```

It flags the evidence-based failure modes: oversized always-loaded content,
vague non-actionable language, likely redundancy with the README, broken `docs/`
pointers, and missing/just-mentioned commands. Treat every flag as a prompt to
*cut or sharpen*, then re-run. Also sanity-check that the commands you wrote
actually run, and read the result once more asking of each line: "does this earn
its place?"

## Anti-patterns (cut on sight)

- Architectural essays, tech intros, or "what this project is" prose — the agent
  reads code faster than it reads your description of it.
- Restating what the linter/formatter already enforces.
- Copy-pasting README/CONTRIBUTING content (duplication is the #1 measured cause
  of harm — link to it instead).
- Vague guidance ("write clean code", "follow best practices") with no
  executable meaning.
- A giant always-loaded file "to be safe." Safety here is *smallness*.
- Inventing rules nobody asked for. Add rules to fix observed, repeated
  mistakes — not hypothetical ones.

## Reference files

Load these as the workflow directs; don't read them all up front.

- `references/principles-and-evidence.md` — the research, why minimalism wins,
  failure modes, and the decision heuristics. Read when triaging.
- `references/research-playbook.md` — how to discover stack, commands, and
  conventions per ecosystem, and how to spot existing docs to avoid duplicating.
- `references/agents-md-guide.md` — AGENTS.md format, high-value sections,
  sizing, monorepo nesting, size caps, do/don't examples.
- `references/progressive-rules.md` — designing the `docs/` layer: categorization,
  the AGENTS.md index, reliable pointers, native auto-loading per tool.
- `references/tool-compatibility.md` — Cursor/Claude Code/Codex/Copilot/OpenCode
  specifics, file precedence, and migration from legacy formats.

Assets: `assets/AGENTS.md.template`, `assets/docs-rule.template.md`, and
`assets/examples/` (calibrated AGENTS.md samples, all in pt-BR — including
`docs-e2e-testing.example.md` for the e2e category). Script:
`scripts/audit_rules.py`.
