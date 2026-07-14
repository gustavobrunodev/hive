# Context — Chat Controls (gray-area decisions)

Decisions locked before design, some from the user's discuss answers
(2026-07-13), some resolved by the agent from the architecture:

- **CC-C1 — "Pause" = interrupt the current turn.** The adapter spawns one
  one-shot `claude -p` process per turn and exposes no stdin (claudeCliAdapter.ts
  / processRunner.ts). There is no persistent generation to pause-and-resume, so
  "pausar o chat" is realized as **stop/interrupt the in-flight turn** (kill the
  active process via the already-present `AgentService.stop()`), preserving
  partial streamed text. Agent-resolved from the architecture; a true resumable
  session is a deferred pty-backed extension.

- **CC-C2 — Interrupt keeps partial output.** Whatever already streamed becomes
  a finished assistant message; a user-initiated stop is a normal outcome, not an
  `error`. Rationale: discarding already-shown text is surprising and loses work.

- **CC-C3 — Slash menu is triggered by a leading `/`.** Matches the ubiquitous
  editor/Slack/Notion convention. Fed by BMAD workspace metadata
  (`bmad-help.csv`), **not** a Claude-specific surface, so the menu stays
  agent-agnostic (CC-R3). The Claude CLI's native slash commands are unavailable
  in `-p` mode (documented in design.md), so the app must supply its own.

- **CC-C4 — Discovery reuses `workflowCatalog`.** A new `skills.list(workspace)`
  IPC surfaces the full discovered skill list (the curated-five catalog is a
  subset). No new parsing engine — extend the existing CSV path.
