---
name: harness-engineer
description: Evaluate and improve a project's coding-agent *harness* — its guides (feedforward controls that steer the agent before it acts) and sensors (feedback controls that let it self-correct after). Researches the repo, maps existing controls by direction, execution, and category, finds gaps, redundancies, and conflicts, and wires the highest-leverage fixes at the right timing (in-session, pre-commit, CI, continuous). Use whenever the user wants to assess, audit, design, strengthen, or optimize their agent harness or says "harness engineering"; add sensors / feedback loops (linters with self-correction messages, type/dependency/architecture checks, coverage, mutation testing, AI review, secret scanning); decide when/where a check runs; or make a repo more self-correcting and "agent-proof" with less review — even when only describing the symptom ("the agent repeats the same mistake", "I spend too long reviewing AI PRs"). For authoring rule files alone (AGENTS.md/CLAUDE.md/.cursor), defer to agent-rules-architect.
---

# Harness Engineer

Evaluate and improve a project's **coding-agent harness** — the system of
**guides** (feedforward controls that steer the agent *before* it acts) and
**sensors** (feedback controls that let it self-correct *after* it acts). A good
harness raises the chance the agent gets it right the first time and catches the
rest before a human has to, so review toil drops and trust in the output goes up.

The deliverable is a **Harness Assessment**: an evidence-based map of the
project's current controls, the gaps / redundancies / conflicts in them, and a
prioritized, concrete plan to improve them — followed (with the user's go-ahead)
by wiring the highest-leverage improvements in at the right point in the
lifecycle.

This skill is grounded in Birgitta Böckeler's *"Harness engineering for coding
agent users"* and its follow-up on maintainability sensors. The core ideas live
in `references/harness-model.md` — read it early; the rest of this file assumes it.

## The mental model in one screen

- **Agent = Model + Harness.** You can't change the model much, but you can build
  an *outer harness* around it. That's where your leverage is.
- **Two control directions — you need both:**
  - **Guides (feedforward)** anticipate mistakes and steer before they happen —
    an `AGENTS.md` rule, a skill, a scaffold/bootstrap script, a codemod.
  - **Sensors (feedback)** observe the result and feed back so the agent
    self-corrects — a linter, type checker, test suite, architecture rule, AI
    review. Feedforward-only keeps repeating mistakes it never measures;
    feedback-only keeps re-deriving rules it was never told.
- **Two execution types, very different economics:**
  - **Computational** — deterministic, fast, cheap (tests, linters, type checkers,
    structural rules). Run them often, even on every change.
  - **Inferential** — semantic, slower, non-deterministic, costlier (AI review,
    "LLM as judge"). Reserve for judgment that computational tools can't make.
- **Three things a harness regulates** — *name which you mean*, harnessability
  varies across them:
  - **Maintainability** (internal quality) — the most tractable today.
  - **Architecture fitness** (perf, security, observability… fitness functions).
  - **Behaviour** (does it do the *right* thing?) — the hardest; be honest about limits.
- **Timing — "keep quality left."** Put each control as far left as its cost
  allows. Cheap/deterministic → in-session & pre-commit. Expensive/inferential →
  CI & scheduled. Slow drift → continuous "janitor" passes.
- **The steering loop is the human's real job.** When a mistake recurs, improve a
  guide or sensor so it's less likely next time. The goal isn't to remove the
  human — it's to *direct human attention where it matters most*.

## What makes a harness *good* (not just big)

More controls is not better. The follow-up experiments are blunt about this: a
new rule set surfaces "a mix of irrelevant things and things that actually
matter," and noise can send an agent "into a spiral of over-engineered
refactorings." Sensors can also conflict (max-function-length pushing complexity
into ever-deeper prop chains). So every guide and sensor must earn its place:

- It targets a **real, observed failure mode**, not an imagined one.
- Its signal is **high-precision** — low false-positive, *or* it teaches the agent
  how to judge (see self-correction messages in the catalog).
- It runs **as far left as its cost allows**, and is **gating only where the cost
  of being wrong justifies blocking**.
- It doesn't **contradict** another control or **duplicate** what one already covers.

When in doubt, sharpen or remove a control rather than add one. A harness that
fires constant noise is worse than a smaller one the agent trusts. This mirrors
the evidence behind `agent-rules-architect`: *less, but sharper, wins.*

## Non-negotiables in every assessment

These five hold on every run, no matter the prompt. They are precisely where a
capable model left to itself drifts — so do not skip them:

1. **Answer the question, scope ruthlessly.** Tie every recommendation to the
   stated goal or an *observed* failure. Out-of-scope controls get **one deferred
   line with a reason**, never a long catalog. A 15-item "sensor menu" is a
   failure, not thoroughness.
2. **Classify every control on all axes** — direction (feedforward/feedback),
   **execution (computational vs. inferential)**, category, and timing. Naming the
   computational/inferential split is mandatory: it's what justifies *where* a
   control runs and *whether* it gates.
3. **Delegate all rule-file authoring** (`AGENTS.md` / `CLAUDE.md` /
   `.cursor/rules`) to `agent-rules-architect`. Decide *what* the guide must say
   and *where* it's wired, but do not hand-roll or re-derive the rules here.
4. **Check the hygiene floor, always.** Three baseline controls are exempt from
   rule 1 — their absence *is* the observed failure, and each is cheap enough that
   scope is never a reason to skip them. Report each as pass/fail in the
   assessment; see `references/sensors-catalog.md` §L for detection and fixes.

   | ID | Control | Why it's unconditional |
   | --- | --- | --- |
   | **CI-04** | Pre-commit tooling installed (husky + lint-staged, pre-commit, lefthook) | The earliest feedback loop there is — fast checks running *before a commit exists*. |
   | **HYG-02** | `.gitignore` covers `.env` **and** `.env.*` | Stops an agent staging credentials by accident; blast radius is immutable history. |
   | **HYG-08** | MCP config references credentials via `${ENV_VAR}`, never literals | Keeps secrets out of the repo and makes tool access a deliberate, reviewable choice. |

   Fixing them is in scope by default; only the *how* needs confirming. If the
   project genuinely has no MCP servers, report HYG-08 as "no MCP config found"
   rather than fabricating one to pass.
5. **End with honest limits — including intent.** Sensors verify *form* and catch
   *regressions*; they do not verify *correctness*. A test (AI- or human-written)
   can assert the **wrong** behaviour and still pass — and still kill mutants — so
   human review of *intent* never goes away. State plainly what the harness does
   **not** cover; a good harness redirects human attention, it doesn't remove it.

## Relationship to `agent-rules-architect`

The **guides layer** — authoring and trimming `AGENTS.md`, `CLAUDE.md`,
`.cursor/rules`, `docs/` — is owned by the **`agent-rules-architect`** skill,
which encodes the research on minimal, non-redundant rules. This skill is the
**system view**: it decides *which* guides and sensors the harness needs, *where
each runs*, and *how they fit together*, then **delegates the actual rule-file
writing** to `agent-rules-architect` (find it under `.agents/skills/`,
`.claude/skills/`, or `.opencode/skills/`). When the work reduces to "write/clean
up the rules," hand off. When it's "design or evaluate the whole control system,"
stay here.

## Workflow

Most of the value is in steps 2–4 (research, assessment, prioritization). Writing
configs is the easy part. Read `references/assessment-playbook.md` for the method.

### 1. Frame the job

Establish:
- **Evaluate vs. improve.** If controls already exist, this is mostly an *audit +
  targeted strengthening* job — inventory first, don't pile on.
- **Goal & pain.** What does success look like? Which recurring agent mistakes or
  review pains prompted this? Tie the work to those, not a generic checklist.
- **Which regulation categories are in scope** (maintainability is the default
  win; ask whether architecture-fitness or behaviour matter here).
- **Harnessability.** Typed language? Clear module boundaries? Framework
  conventions? Greenfield vs. legacy? This sets *what controls are even available
  to build* and where they'll be hardest. See `references/harness-model.md`.
- **Target agent(s)/tools** (Cursor, Claude Code, Codex, Copilot…) — affects how
  guides and timing get wired. See
  `agent-rules-architect/references/tool-compatibility.md`.

### 2. Research & inventory the current harness — the most important step

You can't assess controls you haven't found. Run the inventory script first; it's
fast, deterministic, and stdlib-only:

```bash
python3 <skill-dir>/scripts/harness_inventory.py <repo-path>
```

It detects the stack and existing controls (linters, formatters, type checkers,
test/coverage/mutation config, dependency & architecture rules, SAST & secret
scanning, pre-commit hooks, CI steps, agent rule files), runs the **hygiene floor
checks (CI-04, HYG-02, HYG-08)** by ID, and prints a first-cut **coverage matrix**
with obvious gaps. Then read the key configs and CI yourself
to confirm *what each control actually enforces*, whether its output is
**LLM-friendly**, and **where in the lifecycle it runs today**. Follow
`references/assessment-playbook.md`, and reuse `agent-rules-architect`'s
`research-playbook.md` for stack/command discovery.

### 3. Assess — map controls onto the harness, find the gaps

Place every control on the map: **direction** (feedforward/feedback) ×
**execution** (computational/inferential) × **category** (maintainability /
architecture / behaviour) × **timing** (in-session / pre-commit / CI / continuous
/ runtime). Then look for:

- **Coverage gaps** — a failure mode with no guide *and* no sensor (e.g. clear
  layers but no architecture rules; AI-generated, assertion-light tests but no
  mutation testing).
- **Direction imbalance** — many guides, no sensors (mistakes recur), or sensors
  with no guides (rules constantly re-derived).
- **Timing misplacement** — an expensive inferential check gating every commit, or
  a cheap deterministic one only running nightly.
- **Redundancy & conflict** — two controls covering the same thing, or pulling in
  opposite directions.
- **Signal quality** — sensors whose output isn't optimized for self-correction.
  This is the highest-ROI, most-overlooked fix; see the catalog.

Capture this with `assets/harness-assessment.template.md`.

### 4. Prioritize improvements

Rank by **leverage ÷ cost**, favoring: fixes to *observed* failures; the cheapest
control that catches the most; "keep-quality-left" moves; and turning
existing-but-mute sensors into agent-readable ones. Prefer a few high-signal
changes over a sweep. For each recommendation, state: *what, why (which failure it
prevents), type, category, where it runs, gating or not, concrete implementation,
and effort.*

**Failing hygiene-floor checks rank above everything else** — they're the
cheapest fixes on the list and two of the three are security-shaped. A `.env`
line and a hook config cost minutes; put them first regardless of what else the
assessment found.

### 5. Implement (with the user's go-ahead)

Apply the agreed items smallest-step first, keeping quality left:

- **Add/strengthen sensors** with config tuned for AI failure modes and —
  crucially — **self-correction messages** ("a good kind of prompt injection")
  that tell the agent how to fix the issue or when to suppress it *with a stated
  reason*. See `references/sensors-catalog.md`.
- **Author/adjust guides** by handing the rule-file work to `agent-rules-architect`.
- **Wire the timing**: encode *when* each sensor runs — in agent rules ("after
  editing `server/**`, run `npm run lint:dep`"), in pre-commit / pre-push hooks
  (heuristically, by changed files), and in CI (gating vs. reporting). See
  `references/timing-and-placement.md`.
- Treat heavy installs and CI changes as **proposed steps to confirm**, not silent
  edits.

### 6. Close the steering loop

Leave the project able to *evolve* its harness: note what to watch, how to add a
control when a new failure recurs, how to retire noisy ones, and how to keep
guides and sensors from drifting apart. Re-run the inventory script to confirm the
new coverage.

## Anti-patterns (cut on sight)

- **Harness theater** — piling on tools that fire noise nobody acts on; it breeds
  a false sense of quality and over-engineering spirals.
- **Mute sensors** — a linter/test whose output the agent can't act on. Add a
  self-correction message or it's only half a sensor.
- **Everything gates everything** — slow/inferential checks blocking every commit.
  Keep quality left *by cost*, not by blocking indiscriminately.
- **Feedforward-only / feedback-only** — guides without sensors (or the reverse)
  is a broken loop.
- **Duplicating the guides skill** — re-deriving `AGENTS.md` rules here instead of
  delegating to `agent-rules-architect`.
- **Imagined failures** — controls for mistakes that never happen. Harden against
  observed ones.

## Reference files

Load as the workflow directs; don't read them all up front.

- `references/harness-model.md` — the full mental model: guides/sensors,
  computational/inferential, regulation categories, timing, harnessability, the
  human's role, and what each control type can and can't catch. Read early.
- `references/sensors-catalog.md` — concrete sensors by concern and ecosystem:
  what each catches, computational vs. inferential, cost, when to run, example
  config, and self-correction message patterns. Read when proposing/adding
  sensors — and read **§L (the hygiene floor: CI-04, HYG-02, HYG-08)** on every
  run, since those three are checked unconditionally.
- `references/timing-and-placement.md` — "keep quality left": lifecycle stages, how
  to choose placement, and how to *encode* timing in rules, hooks, and CI.
- `references/assessment-playbook.md` — how to inventory, score coverage, find
  gaps/conflicts, and prioritize. Read when assessing.

Assets: `assets/harness-assessment.template.md` (output template) and
`assets/examples/` (a calibrated example). Script: `scripts/harness_inventory.py`.
