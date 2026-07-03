# Frontend MCP set (React & Angular)

The org's baseline MCP servers for any **frontend** project (React or Angular):
**Figma**, **Playwright**, **Chrome DevTools**. Install the set **once per
project**, not once per framework — a repo with both a React and an Angular app
still gets one copy of each server.

All three are configured in the project's `.mcp.json` under `mcpServers`. Check
presence by the server key before adding; if the key already exists, skip it.

## Detect if already configured (per server, skip if present)

- Open the project `.mcp.json` (or the agent's MCP config).
- Skip any server whose key is already present:
  `Framelink MCP for Figma`, `playwright`, `chrome-devtools`.

## 1. Figma — Framelink MCP (`figma-developer-mcp`)

Design-to-code: reads Figma frames/nodes so the agent implements from the real
design instead of guessing. **Needs a Figma API key** — write a placeholder and
tell the user to supply their own; never commit a real key.

**macOS / Linux:**

```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR-KEY", "--stdio"]
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
      "args": ["/c", "npx", "-y", "figma-developer-mcp", "--figma-api-key=YOUR-KEY", "--stdio"]
    }
  }
}
```

Replace `YOUR-KEY` with the developer's Figma personal access token (or wire it
through an env var per the agent's secret-handling convention). Leave the
placeholder until the user provides one — report it as "needs a Figma API key
before it works."

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
to confirm. After adding, report which servers need a secret before they work
(Figma) versus which are ready to use (Playwright, Chrome DevTools).
