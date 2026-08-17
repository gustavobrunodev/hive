#!/usr/bin/env node
// The stand-in agent CLI behind the R-06/P0-003 seam (src/main/e2eAgentSeam.ts).
// `withScriptedAgentCli` redirects the registry's spawns here with the real
// adapter's argv and cwd, so this file is spawned exactly as `claude` would be.
//
// It is a *CLI*, not a mock: it speaks the Anthropic `--output-format
// stream-json` line shapes `cliAdapterCore.ts` parses, and it really writes
// files into the workspace. That is what keeps the parser, the tool_use
// attribution, the review checkpoint and the explorer's fs watcher inside the
// test instead of stubbed out of it.
//
// Behavior comes from the JSON file at HIVE_E2E_AGENT_SCRIPT:
//   sessionId   string   — session id to announce (drives `--resume` learning)
//   chunks      string[] — text deltas, streamed in order
//   writes      [{path, content}] — files written relative to cwd (the workspace)
//   delayMs     number   — pause before each chunk (interrupt/streaming tests)
//   writeDelayMs number  — pause after each write's tool_use, so the step has
//                          a duration the per-step clock can report
//   hang        boolean  — never exit after the chunks (for interrupt tests)
//   exitCode    number   — process exit code (non-zero → the adapter's `error`)
//   stderr      string   — written to stderr (the tail the adapter appends)
//   mcpServers  [{name,status}] — the turn's MCP roster, and `mcpTools` the
//                          `mcp__<server>__<tool>` names that go with it, both
//                          on the init line exactly as the real CLI reports
//                          them (mcp-visibility). Omitted → no roster at all,
//                          which is what a CLI build without them looks like.
//   usage       object   — token accounting, emitted on an `assistant` message
//                          AND on the closing `result` line, exactly as the
//                          real CLI reports it (session-usage). Fields are the
//                          wire names: input_tokens, output_tokens,
//                          cache_read_input_tokens, cache_creation_input_tokens,
//                          plus total_cost_usd / duration_ms / duration_api_ms
//                          on the result line.
//   requests    object[] — a multi-step turn: one per API call the turn made,
//                          each printed as its own `assistant` snapshot, with
//                          the `result` line carrying their SUM (which is what
//                          the real CLI does, and why occupancy must be read
//                          off the last snapshot). A request may carry a
//                          `sidechain` usage — a subagent's own conversation,
//                          printed with `parent_tool_use_id` set.
//   contextWindow number — the ceiling the CLI reports for itself, on the
//                          result line's `modelUsage` (`--model sonnet[1m]`
//                          moves it without changing the model id).
// Every invocation is appended as one JSON line to HIVE_E2E_AGENT_LOG, so a
// test can assert on disk *what the app actually asked the agent to do*.

const fs = require('fs')
const path = require('path')

const argv = process.argv.slice(2)
const replaced = process.env.HIVE_E2E_AGENT_COMMAND ?? 'unknown'

/**
 * The `result` line's prompt counts, the way the real CLI computes them: summed
 * over every request the turn made (sidechains included — the parent bills
 * them), with the turn's generated total taken from the script.
 */
function sumRequests(requests, totals) {
  const fields = ['input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']
  const sums = {}
  for (const field of fields) {
    sums[field] = requests.reduce(
      (total, request) => total + (request[field] ?? 0) + (request.sidechain?.[field] ?? 0),
      0
    )
  }
  return { ...sums, output_tokens: totals.output_tokens ?? 0 }
}

function log(entry) {
  const logPath = process.env.HIVE_E2E_AGENT_LOG
  if (!logPath) return
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf-8')
}

// Availability detection (`agentRegistry.probe`) spawns `<binary> --version`.
// Answering it keeps the seam honest end to end: under the seam the picker sees
// the agent as installed, which is the state the journey under test assumes.
if (argv.includes('--version')) {
  log({ kind: 'version', command: replaced })
  process.stdout.write(`hive-e2e-agent 1.0.0 (${replaced})\n`)
  process.exit(0)
}

const scriptPath = process.env.HIVE_E2E_AGENT_SCRIPT
const script =
  scriptPath && fs.existsSync(scriptPath) ? JSON.parse(fs.readFileSync(scriptPath, 'utf-8')) : {}

const promptIndex = argv.indexOf('-p')
const prompt = promptIndex >= 0 ? argv[promptIndex + 1] : null
// agent-terminal: the environment the turn was actually given. Only the
// variables the terminal choice is supposed to set — enough for a test to
// assert that picking a shell reached the CLI, and nothing that could leak a
// developer's real environment into an assertion.
const shellEnv = {
  SHELL: process.env.SHELL ?? null,
  CLAUDE_CODE_SHELL: process.env.CLAUDE_CODE_SHELL ?? null,
  CLAUDE_CODE_GIT_BASH_PATH: process.env.CLAUDE_CODE_GIT_BASH_PATH ?? null,
  CLAUDE_CODE_USE_POWERSHELL_TOOL: process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL ?? null
}
log({ kind: 'turn', command: replaced, prompt, argv, cwd: process.cwd(), shellEnv })

function emit(line) {
  process.stdout.write(`${JSON.stringify(line)}\n`)
}

const sessionId = script.sessionId ?? 'e2e-session'
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function run() {
  // A `session_id` on any line is what `handleStdoutLine` learns and re-emits
  // as the `session` event the app persists for `--resume`. The same line
  // carries the turn's MCP roster (mcp-visibility) when the script declares
  // one — `mcp_servers` and the `mcp__*` entries of `tools`, wire names and
  // all, so `readMcpRoster` parses the real shape rather than a convenience.
  emit({
    type: 'system',
    subtype: 'init',
    session_id: sessionId,
    ...(script.mcpServers ? { mcp_servers: script.mcpServers, tools: script.mcpTools ?? [] } : {})
  })

  for (const chunk of script.chunks ?? []) {
    if (script.delayMs) await delay(script.delayMs)
    emit({
      type: 'stream_event',
      session_id: sessionId,
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: chunk } }
    })
  }

  for (const write of script.writes ?? []) {
    const target = path.resolve(process.cwd(), write.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, write.content ?? '', 'utf-8')
    // The same `tool_use` block the real CLI reports for a Write, absolute
    // path and all — this is what feeds change attribution (ACR-C7).
    emit({
      type: 'assistant',
      session_id: sessionId,
      message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: target } }] }
    })
    // A step with real duration: the stand-in reports no `tool_result`, so
    // without this the row starts and settles within the same instant and the
    // per-step clock (which only shows past a second) has nothing to show.
    if (script.writeDelayMs) await delay(script.writeDelayMs)
  }

  // session-usage: the same two places the real CLI reports tokens — a live
  // snapshot on a completed assistant message, then the authoritative totals
  // on the `result` line, which is also where cost and duration live.
  //
  // `requests` is the multi-step shape, and the difference matters: a turn that
  // makes N API calls prints N snapshots, each the occupancy at that instant,
  // and ONE result line whose prompt counts are their SUM. A single-request
  // script can't tell a parser that reads occupancy off the snapshot from one
  // that reads it off the sums, because there they're the same number.
  const model = script.model ?? 'claude-opus-5'
  if (script.usage || script.requests) {
    const { total_cost_usd, duration_ms, duration_api_ms, ...tokens } = script.usage ?? {}
    const requests = script.requests ?? [tokens]
    for (const usage of requests) {
      emit({
        type: 'assistant',
        session_id: sessionId,
        parent_tool_use_id: null,
        message: { model, content: [], usage }
      })
      // A subagent's own conversation, interleaved exactly as the real CLI
      // prints it: same shape, its own window, tagged as a sidechain.
      if (usage.sidechain) {
        emit({
          type: 'assistant',
          session_id: sessionId,
          parent_tool_use_id: 'toolu_sidechain',
          message: { model, content: [], usage: usage.sidechain }
        })
      }
    }
    emit({
      type: 'result',
      subtype: 'success',
      session_id: sessionId,
      // The sums, as the CLI reports them: every request's prompt tokens added
      // together, plus the turn's own generated total.
      usage: script.requests ? sumRequests(script.requests, tokens) : tokens,
      modelUsage: script.contextWindow
        ? { [model]: { contextWindow: script.contextWindow } }
        : undefined,
      total_cost_usd,
      duration_ms,
      duration_api_ms
    })
  }

  if (script.stderr) process.stderr.write(script.stderr)

  // `hang` keeps the process alive with nothing left to say — the state an
  // interrupt test needs (partial output already delivered, turn still open).
  if (script.hang) {
    setInterval(() => {}, 1000)
    return
  }
  // No process.exit(): let the loop drain so every queued stdout chunk is
  // actually flushed down the pipe before the exit is observed.
  process.exitCode = script.exitCode ?? 0
}

void run()
