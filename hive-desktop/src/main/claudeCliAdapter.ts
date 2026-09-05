import { homedir } from 'os'
import type { ProcessRunner } from './processRunner'
import type {
  AgentAdapter,
  AgentAdapterDeps,
  AgentCapabilities,
  CapabilityContext,
  SessionOpts,
  ShellBinding,
  ShellContext
} from './agentAdapter'
import type { ShellInfo } from './shellCatalog'
import { createCliAgentSession } from './cliAdapterCore'
import {
  CLAUDE_ALIAS_CATALOG,
  CLAUDE_COMPACTION,
  CLAUDE_EFFORTS,
  CLAUDE_PINNED_CATALOG,
  detectClaudeCapabilities
} from './claudeModelCatalog'
import { CLI_DEFAULT_ID } from './modelCatalog'
import { bedrockTurnEnv, detectBedrockSetup } from './awsBedrock'
import { diagnoseClaudeFailure } from './awsDiagnose'

/**
 * The Claude Code adapter (T13, C1): drives the real `claude` CLI via the
 * injected `ProcessRunner`. The spawn/stream/parse/interrupt engine is shared
 * across all CLI adapters in `cliAdapterCore.ts` (multi-agent); this module
 * holds only what is *Claude-specific*: its curated capabilities and its argv.
 *
 * --- CLI invocation flags: verified vs. best-guess ---
 *
 * VERIFIED against a real `claude` binary (v2.1.206) and a live `-p` run
 * driving the real `bmad-prd` skill end-to-end (produced a real
 * `_bmad-output/.../prd.md`):
 *   - `claude -p "<prompt>"` — non-interactive "print mode": run one turn
 *     against the given prompt, stream/print the result, then exit.
 *   - `--model <id>` — selects the model. `--help` recommends aliases
 *     (`opus`/`sonnet`/`haiku`/`fable`) over pinned full model ids.
 *   - `--effort <level>` — confirmed real, values `low|medium|high|xhigh|max`.
 *   - `--permission-mode acceptEdits` — **required** for any workflow that
 *     writes files: `-p` with no permission-mode flag silently refuses
 *     tool-driven writes. `acceptEdits` covers Write/Edit (not Bash).
 *   - `--output-format stream-json --include-partial-messages --verbose` —
 *     structured output that exposes the CLI's `session_id` (the `--resume`
 *     handle) and true token-level streaming. The shared parser falls back to
 *     raw-token passthrough for any non-JSON line, so an older CLI degrades to
 *     opaque-text behavior.
 *   - `-r, --resume [sessionId]` — resume a conversation by session id
 *     (works with --print).
 *   - `--permission-prompt-tool <mcp tool>` + `--mcp-config <path>` — the
 *     supported way to answer permission prompts in print mode: the CLI calls
 *     the named MCP tool and blocks the turn on its verdict instead of
 *     silently refusing the call. Hive hosts that tool itself (see
 *     `approvalService.ts`), which is what turns "the agent needs permission"
 *     into a real interaction rather than a stalled turn. The flag takes a
 *     **file path**, never the inline JSON it also accepts: on Windows an
 *     argument carrying both quotes and a space is re-split between the
 *     shell and the npm `.cmd` shim, which failed every session with
 *     "Invalid MCP configuration: MCP config file not found". The whole
 *     account is in `approvalService.ts`'s header.
 */

const CLAUDE_COMMAND = 'claude'

/**
 * The context window every current Claude model exposes through the CLI, in
 * tokens (session-usage) — the meter's denominator *before the first turn
 * answers*, which is the only window in which it is the best number available.
 *
 * The CLI does state its own ceiling, but only in hindsight: every `result`
 * line carries `modelUsage[model].contextWindow` (verified on 2.1.226:
 * `200000` for haiku), and `cliAdapterCore` forwards it so the meter switches
 * to the real figure as soon as a turn reports. This constant covers the gap —
 * and the case where a configured window (`sonnet[1m]`) differs from the
 * curated one, which is precisely why the reported figure outranks it.
 */
const CLAUDE_CONTEXT_WINDOW = 200_000

function capabilities(): AgentCapabilities {
  // The floor: what the CLI accepts regardless of how it is configured. The
  // *measured* answer — which models this machine's account, provider and
  // settings actually put on the table — comes from `detectCapabilities`
  // below; this stays synchronous so anything that only needs a shape (a
  // turn's flag check, a test) gets one without touching disk.
  return {
    models: [
      {
        id: CLI_DEFAULT_ID,
        label: 'Automático',
        descriptionKey: 'cliDefault',
        traits: ['cli-default'],
        group: 'default',
        source: 'catalog',
        contextWindow: CLAUDE_CONTEXT_WINDOW
      },
      ...CLAUDE_ALIAS_CATALOG,
      ...CLAUDE_PINNED_CATALOG
    ],
    efforts: [
      {
        id: CLI_DEFAULT_ID,
        label: 'Automático',
        descriptionKey: 'effort.cliDefault',
        traits: ['cli-default'],
        group: 'default',
        source: 'catalog'
      },
      ...CLAUDE_EFFORTS
    ],
    // R6.5/T16: attached/referenced file paths are folded into the turn's
    // prompt — the CLI reads the files itself via its Read tool.
    supportsAttachments: true,
    provider: { id: 'anthropic', detail: null },
    modelSource: 'catalog',
    compaction: CLAUDE_COMPACTION
  }
}

/**
 * How the Claude Code CLI honours a chosen shell (agent-terminal AT-R4).
 *
 * Not guessed — read out of the shipped binary (`claude 2.1.226`), because the
 * rules are narrow enough that guessing produces a setting that silently does
 * nothing. The four functions that decide, verbatim from that build:
 *
 * ```js
 * function LY(){ let e=process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL
 *   if(Jt()!=="windows") return _r(e)
 *   if(md(e)) return !1              // "0"/"false" → PowerShell tool OFF
 *   if(_r(e)) return !0              // "1"/"true"  → PowerShell tool ON
 *   if(Cne()===null) return !0       // no Git Bash → PowerShell tool ON
 *   return nt("tengu_cobalt_ridge",!1) }   // …otherwise a REMOTE FEATURE GATE
 * function Jf(){ return Jt()!=="windows" || Cne()!==null }   // bash available
 * function Sba(){ …if(!Jf()) return "Shell: PowerShell"
 *   if(LY()) return "Shell: PowerShell (primary); Bash tool also available…" }
 * ```
 *
 * That last line is printed into the CLI's own `# Environment` block, and it
 * is word for word what the bug report quoted back: "PowerShell como shell
 * primário, com Bash também disponível". The cause is the branch above it —
 * with `CLAUDE_CODE_USE_POWERSHELL_TOOL` **unset**, the answer comes from a
 * gate Hive doesn't control, so picking cmd or Git Bash changed nothing. The
 * fix is to never leave it unset: every Windows binding below writes `0` or
 * `1` explicitly.
 *
 * The rest of the rules:
 *
 *  - **POSIX**: `CLAUDE_CODE_SHELL` is accepted only when the path *contains*
 *    `bash` or `zsh` and is executable; anything else is logged as
 *    "not a valid bash/zsh path, falling back to detection" and dropped. So
 *    fish/sh/dash can't be honoured — but they can be *pinned* to a bash or
 *    zsh that exists here, which beats letting the CLI's own scan decide.
 *  - **Windows**: `Bash` runs through Git Bash. `CLAUDE_CODE_GIT_BASH_PATH` is
 *    honoured when its basename is `bash.exe`/`sh.exe`/`bash`/`sh` **and the
 *    file exists** (`Cne`), which is why the pin below always carries a path
 *    detection actually found. There is no cmd executor at all.
 *  - **The one thing never to write**: `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` on a
 *    machine with no Git Bash. The CLI checks that pair at startup and calls
 *    `process.exit(1)` ("Claude Code on Windows requires a shell tool"). Every
 *    `0` below is guarded by a Git Bash this machine really has.
 */
export function claudeShellBinding(shell: ShellInfo, context: ShellContext): ShellBinding {
  return context.platform === 'win32'
    ? windowsBinding(shell, context.available)
    : posixBinding(shell, context.available)
}

/**
 * Windows. Three outcomes and no fourth: Git Bash (the CLI's real executor),
 * PowerShell (its preview tool), or a pin to one of those two — because cmd,
 * the platform default, is not something this CLI can run a command in.
 */
function windowsBinding(shell: ShellInfo, available: ShellInfo[]): ShellBinding {
  const gitBash = available.find((entry) => entry.id === 'git-bash') ?? null

  if (shell.id === 'git-bash') {
    return {
      support: 'native',
      note: 'windows-git-bash',
      runsIn: shell.id,
      // The `0` is the load-bearing half. Without it the CLI keeps its
      // PowerShell tool on (gate `tengu_cobalt_ridge`) and reports PowerShell
      // as primary even while running this bash — the reported bug.
      env: { CLAUDE_CODE_GIT_BASH_PATH: shell.path, CLAUDE_CODE_USE_POWERSHELL_TOOL: '0' }
    }
  }
  if (shell.family === 'powershell') {
    return {
      support: 'native',
      note: 'powershell-preview',
      runsIn: shell.id,
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: '1' }
    }
  }
  // cmd. The launch still happens here (that part is real); the commands
  // cannot, so they are pinned somewhere this machine actually has.
  if (gitBash) {
    return {
      support: 'fallback',
      note: 'cmd-no-executor',
      runsIn: gitBash.id,
      env: { CLAUDE_CODE_GIT_BASH_PATH: gitBash.path, CLAUDE_CODE_USE_POWERSHELL_TOOL: '0' }
    }
  }
  const powershell = available.find((entry) => entry.family === 'powershell') ?? null
  return {
    // No Git Bash on this machine: PowerShell is the only executor left, and
    // saying so — with the note that offers to fix it — beats a silent landing.
    support: 'fallback',
    note: 'install-git-bash',
    runsIn: powershell?.id ?? null,
    env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: '1' }
  }
}

/** POSIX (macOS and Linux). `CLAUDE_CODE_SHELL` takes bash or zsh, and nothing else. */
function posixBinding(shell: ShellInfo, available: ShellInfo[]): ShellBinding {
  if (shell.family === 'bash' || shell.family === 'zsh') {
    return { support: 'native', runsIn: shell.id, env: { CLAUDE_CODE_SHELL: shell.path } }
  }
  // fish / sh / dash / ksh. The CLI would run its own scan and land on some
  // bash or zsh anyway — pinning the one we detected makes that visible and
  // repeatable instead of leaving it to a search order nobody can see.
  const pinned =
    available.find((entry) => entry.family === 'zsh') ??
    available.find((entry) => entry.family === 'bash') ??
    null
  return pinned
    ? {
        support: 'fallback',
        note: 'posix-bash-zsh-only',
        runsIn: pinned.id,
        env: { CLAUDE_CODE_SHELL: pinned.path }
      }
    : { support: 'launch-only', note: 'posix-bash-zsh-only', runsIn: null, env: {} }
}

/**
 * Creates the `ClaudeCliAdapter`. `processRunner` is injected
 * (constructor/factory-injection, matching `createConfigStore`/
 * `createWorkspaceService`) so this module is fully testable against
 * `createFakeProcessRunner()`.
 *
 * `deps.permissionPrompt` (agent-approvals) is optional on purpose: without it
 * the adapter behaves exactly as before (edits auto-accepted, everything else
 * refused by the CLI), so nothing that constructs an adapter without a live
 * approval bridge — tests, the availability probe — has to know about one.
 */
export function createClaudeCliAdapter(
  processRunner: ProcessRunner,
  deps?: AgentAdapterDeps
): AgentAdapter {
  const prompt = deps?.permissionPrompt
  return {
    id: 'claude-cli',
    displayName: 'Claude CLI',
    capabilities,
    // The real answer, read off this machine: the settings chain (including an
    // admin's managed settings), the provider switches that repoint the CLI at
    // Bedrock/Vertex/Foundry, and the model rows the CLI itself cached for this
    // account. See `claudeModelCatalog.ts` for what each source is worth.
    detectCapabilities: (context: CapabilityContext) =>
      Promise.resolve(
        detectClaudeCapabilities({
          env: deps?.host?.env ?? process.env,
          home: deps?.host?.home ?? homedir(),
          platform: deps?.host?.platform ?? process.platform,
          ...(deps?.host?.readJson ? { readJson: deps.host.readJson } : {}),
          ...(context.workspace ? { workspace: context.workspace } : {})
        })
      ),
    commandName: CLAUDE_COMMAND,
    shellBinding: claudeShellBinding,
    startSession: (opts: SessionOpts) =>
      createCliAgentSession(processRunner, opts, {
        command: CLAUDE_COMMAND,
        errorLabel: 'claude',
        // aws-bedrock: the gate. On a machine that isn't on Bedrock this is
        // one file read that answers "no" and the turn spawns as it always
        // did; on one that is, it is the difference between a working turn and
        // `Error running awsAuthRefresh`.
        ...(deps?.awsAuth
          ? {
              preflight: async (context) => {
                const auth = deps.awsAuth
                if (!auth) return { ok: true as const }
                let blocked = false
                const result = await auth.ensureReady(opts.workspace, () => {
                  blocked = true
                  context.emit({
                    type: 'auth',
                    provider: 'aws',
                    phase: 'waiting',
                    turnId: context.turnId
                  })
                })
                if (result.ok) {
                  // Only narrate when something actually happened: a turn that
                  // sailed through a valid session must look exactly like a
                  // turn on a machine with no AWS at all.
                  if (blocked) {
                    context.emit({
                      type: 'auth',
                      provider: 'aws',
                      phase: 'cleared',
                      turnId: context.turnId
                    })
                  }
                  return { ok: true as const }
                }
                return { ok: false as const, message: `aws-auth:${result.reason}` }
              }
            }
          : {}),
        // The dead `--resume` handle from the reported failure. Diagnosed
        // rather than string-matched here so the one place that reads CLI
        // errors stays `awsDiagnose.ts`.
        retryWithoutResume: (detail) => diagnoseClaudeFailure(detail).retryWithoutResume,
        // A cause the app can explain, reduced to a code the chat draws a
        // repair card for. Only the AWS ones: everything else the CLI says is
        // better than anything Hive could invent about it.
        describeFailure: (detail) => {
          const { cause } = diagnoseClaudeFailure(detail)
          if (cause === 'sso-expired') return 'aws-auth:sso-expired'
          if (cause === 'no-credentials') return 'aws-auth:no-credentials'
          return null
        },
        // agent-terminal: re-read per turn, so switching terminals in the
        // profile sheet reaches the very next message.
        buildEnv: () => {
          const shell = deps?.shell?.() ?? null
          const shellEnv = shell
            ? claudeShellBinding(shell, {
                available: deps?.shells?.() ?? [shell],
                platform: process.platform
              }).env
            : undefined
          // aws-bedrock: `AWS_PROFILE`, and only when Hive knows a profile the
          // spawned process wouldn't have found for itself — the desktop-launch
          // case, where the shell rc that exports it was never read. See
          // `bedrockTurnEnv`.
          const awsEnv = deps?.awsAuth
            ? bedrockTurnEnv(
                detectBedrockSetup({
                  ...(opts.workspace ? { workspace: opts.workspace } : {}),
                  preferredProfile: deps.preferredAwsProfile?.() ?? null
                })
              )
            : undefined
          if (!shellEnv && !awsEnv) return undefined
          return { ...shellEnv, ...awsEnv }
        },
        buildArgs: (turnPrompt, { model, effort, resume, turnId }) => {
          // agent-approvals: only wire the prompt tool once the bridge is
          // actually listening — a config pointing at no port would fail the
          // whole turn, which is strictly worse than today's behavior.
          // A path on disk (see the header): a JSON blob here does not survive
          // Windows' shell + `.cmd` argv layers.
          const mcpConfig = prompt?.mcpConfig(turnId) ?? null
          return [
            '-p',
            turnPrompt,
            ...(model ? ['--model', model] : []),
            ...(effort ? ['--effort', effort] : []),
            // Verified live: without a permission-mode flag, `-p` silently
            // refuses tool-driven writes. `acceptEdits` is the minimum that lets
            // BMAD skills (e.g. bmad-prd) actually write their output artifact.
            // Kept alongside the prompt tool below, which deliberately narrows
            // the ask to what `acceptEdits` does *not* cover (Bash, network,
            // MCP tools) — editing a file the user asked for stays frictionless.
            '--permission-mode',
            'acceptEdits',
            // session-history: structured output exposes the CLI's `session_id`
            // and true token streaming. `--verbose` is required for stream-json
            // with --print; `--include-partial-messages` adds text deltas.
            '--output-format',
            'stream-json',
            '--include-partial-messages',
            '--verbose',
            ...(mcpConfig && prompt
              ? ['--mcp-config', mcpConfig, '--permission-prompt-tool', prompt.promptToolName]
              : []),
            ...(resume ? ['--resume', resume] : [])
          ]
        }
      })
  }
}
