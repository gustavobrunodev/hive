# Frontend MCP set (React & Angular)

The org's baseline MCP servers for any **frontend** project (React or Angular):
**Figma**, **Playwright**, **Chrome DevTools**. Install the set **once per
project**, not once per framework — a repo with both a React and an Angular app
still gets one copy of each server.

All three are configured in the project's `.mcp.json` under `mcpServers`. Check
presence by the server key before adding; if the key already exists, skip it.

> **Credentials are never literals.** Any credential-shaped value in an MCP
> config goes in as `${ENV_VAR}` interpolation — this is harness check **HYG-08**
> and it applies to every MCP you add, not just Figma. A literal key is a leak
> waiting for a `git add .`; a fake placeholder like `YOUR-KEY` is only marginally
> better, because it invites someone to paste the real one in its place.

## Detect if already configured (per server, skip if present)

- Open the project `.mcp.json` (or the agent's MCP config).
- Skip any server whose key is already present:
  `Framelink MCP for Figma`, `playwright`, `chrome-devtools`.

## 1. Figma — Framelink MCP (`figma-developer-mcp`)

Design-to-code: reads Figma frames/nodes so the agent implements from the real
design instead of guessing. **Needs a Figma API key** — reference it through
`${FIGMA_API_KEY}`; never write the token itself into the file.

**macOS / Linux:**

```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=${FIGMA_API_KEY}", "--stdio"]
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "figma-developer-mcp", "--figma-api-key=${FIGMA_API_KEY}", "--stdio"]
    }
  }
}
```

Some agents prefer an explicit `env` block over argv interpolation — same rule
applies, the value stays a `${…}` reference:

```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--stdio"],
      "env": { "FIGMA_API_KEY": "${FIGMA_API_KEY}" }
    }
  }
}
```

Then tell the user to export `FIGMA_API_KEY` (their Figma personal access token)
in their shell or `.env` — and confirm `.env` is gitignored (HYG-02). Report the
server as "needs `FIGMA_API_KEY` exported before it works."

## 2. Playwright — `@playwright/mcp`

Drives a real browser for E2E navigation, DOM snapshots, screenshots, and
network inspection. This is the org's baseline **browser/testing** MCP — prefer it
over a separate Playwright *skill* (avoid duplicating the same capability).

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

> If this project already pins a Chromium executable (as some repos do via
> `--executable-path`), keep the existing block rather than overwriting it — it's
> already present, so idempotency says skip.

## 3. Chrome DevTools — `chrome-devtools-mcp`

Live debugging against a running Chrome: performance traces, console, network,
and DOM in the actual browser. Complements Playwright (scripted automation) with
interactive DevTools access — the org's baseline **performance/debug** MCP.

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

## Install (only the missing keys)

Merge only the missing server blocks into the project `.mcp.json` (don't clobber
servers already there). Inside `/build-harness`, propose each addition as a step
to confirm. After adding, report which servers need an env var before they work
(Figma → `FIGMA_API_KEY`) versus which are ready to use (Playwright, Chrome
DevTools).

If the project already has an `.mcp.json` with a **literal** credential in it,
that's an HYG-08 finding: replace the literal with `${ENV_VAR}`, tell the user to
export it, and treat the old value as compromised — it's in git history.
