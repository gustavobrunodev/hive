import { OutputBlock } from '@hive/design-system'
import { t, toolParamLabel } from '../i18n'
import { copyText } from '../ui/clipboard'
import type { ToolActivity, ToolOutput, ToolParam } from './toolActivity'

/**
 * What a step was called with, and what it answered (agent-tool-details).
 *
 * ## The dead end this removes
 *
 * Every activity row said *that* something happened — `Rodou npm run verify ·
 * 12s` — and nothing else. The command was cut at the first line and 96
 * characters; the result was never shown at all. So the two questions a person
 * actually has when an agent is working on their repo — **what exactly did it
 * run**, and **what came back** — had no answer anywhere in the app. A
 * failed command and a passing one drew the same row.
 *
 * Only file edits escaped this, because `PatchSnippet` reconstructs their
 * diff. Everything else — the shell, the searches, the web fetches, every MCP
 * call — was a status line with nothing behind it.
 *
 * ## The shape
 *
 * Two sections, in the order they happen: **Chamada**, then **Resultado**.
 * That ordering is not decoration — it is the causality, and a panel that led
 * with the answer would make the reader scroll back for the question.
 *
 * The call is not dumped as JSON. Its headline argument (the command, the
 * pattern, the instruction) is promoted to a full-width block — with a shell
 * prompt in front of it when it *is* a shell command — and the short scalars
 * fall into a two-column list underneath. Argument names are said in pt-BR,
 * with the CLI's own field name kept as the row's tooltip, because that is the
 * word the user would search for.
 *
 * ## Three states, not one
 *
 * A running step shows its call and a **skeleton** where the result will be:
 * the panel is honest about waiting instead of pretending to be empty. A
 * settled step shows the result. A *failed* step shows it in the danger tone,
 * because for a failure the output **is** the error message — the single most
 * useful thing in this whole panel, and the thing the row could never say.
 */

/** Lines of a result shown before it offers to grow. About a screenful in a transcript. */
const RESULT_LINES = 12

/** Lines of a long argument (a prompt, a file body) shown before the same offer. */
const PARAM_LINES = 8

/** Tools whose headline argument is literally a shell command, so it gets a prompt glyph. */
const SHELL_TOOLS = new Set(['Bash', 'BashOutput', 'KillShell'])

/**
 * A short argument's value, as a person reads it.
 *
 * Only booleans are rewritten, and only when they are the whole value: the CLI
 * writes `true`, and someone scanning a transcript should not have to translate
 * a literal to learn whether the command ran in the background. Everything else
 * — a path, a number, a regex — travels verbatim, because a value we reword is
 * a value that no longer matches what was actually sent.
 */
function displayValue(value: string): string {
  if (value === 'true') return t('details.yes')
  if (value === 'false') return t('details.no')
  return value
}

interface ToolDetailsProps {
  activity: ToolActivity
  /** DOM id, so the row's disclosure can own this region via `aria-controls`. */
  id: string
  /** The row's own words, for the region's accessible name. */
  label: string
}

export function ToolDetails({ activity, id, label }: ToolDetailsProps): React.JSX.Element | null {
  const params = callParams(activity)
  const running = activity.state === 'running'
  const output = activity.output

  // A row that only ever had a diff renders nothing here — the snippet above
  // already is its record, and an empty panel under it would read as a second
  // section that failed to load.
  if (params.length === 0 && output === undefined && !running) return null

  return (
    <div
      className="wb-tdetail"
      id={id}
      role="group"
      aria-label={t('details.panelAria', label)}
      data-failed={activity.state === 'failed' || undefined}
    >
      {params.length > 0 && <CallSection params={params} tool={activity.name} />}
      {(running || output !== undefined) && (
        <ResultSection output={output} running={running} failed={activity.state === 'failed'} />
      )}
    </div>
  )
}

/**
 * The arguments worth showing for this step.
 *
 * On a row that carries a diff, the diff **is** the call: its header already
 * names the file, and an argument list whose only entry repeats that path is a
 * section heading over a restatement. Everything else survives — a `MultiEdit`
 * with a `replace_all`, an `offset`, a `notebook` cell id still has something
 * to say.
 */
function callParams(activity: ToolActivity): ToolParam[] {
  const params = activity.params ?? []
  const path = activity.patch?.path
  if (path === undefined) return params
  return params.filter((param) => param.value !== path)
}

/**
 * What the agent asked the tool to do.
 *
 * Deliberately *without* a section heading. An earlier build put a "Chamada"
 * label above this, eight pixels over the block's own "Comando" — two heading
 * ranks, same weight, saying the same thing. Every block and every row already
 * names itself, and the panel as a whole is announced as "Detalhes de <passo>",
 * so the heading was structure the reader had to step over to reach the
 * command. The result keeps its label because "Resultado" is the only word here
 * that is not already on screen.
 */
function CallSection({ params, tool }: { params: ToolParam[]; tool: string }): React.JSX.Element {
  const blocks = params.filter((param) => param.block === true)
  const rows = params.filter((param) => param.block !== true)
  return (
    // A `group`, not a `<section aria-label>`: an aria-labelled section is a
    // landmark, and a transcript with forty steps would put forty landmarks in
    // the page's navigation list. A group says "these belong together" without
    // claiming to be a place you navigate to.
    <div className="wb-tdetail-sec" role="group" aria-label={t('details.callLabel')}>
      {blocks.map((param) => (
        <ParamBlock key={param.key} param={param} tool={tool} />
      ))}
      {rows.length > 0 && (
        <dl className="wb-tdetail-rows">
          {rows.map((param) => (
            <div key={param.key} className="wb-tdetail-row">
              <dt title={param.key}>{toolParamLabel(param.key)}</dt>
              <dd>{displayValue(param.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/**
 * What the tool answered.
 *
 * A running step has no result yet — and says so, rather than showing a gap
 * the reader has to interpret. Once it settles the same frame holds the
 * answer, so nothing jumps.
 */
function ResultSection({
  output,
  running,
  failed
}: {
  output?: ToolOutput
  running: boolean
  failed: boolean
}): React.JSX.Element {
  const lines = output?.lines ?? 0
  return (
    <div className="wb-tdetail-sec">
      <OutputBlock
        className="wb-tdetail-out"
        label={t('details.resultLabel')}
        meta={running ? t('details.pending') : lines > 0 ? t('details.lines', lines) : undefined}
        tone={failed ? 'danger' : 'neutral'}
        pending={running}
        text={output?.text ?? ''}
        maxLines={RESULT_LINES}
        moreLabel={(hidden) => t('details.showMore', hidden)}
        lessLabel={t('details.showLess')}
        emptyLabel={t('details.emptyResult')}
        note={
          output?.truncated !== undefined
            ? t('details.truncatedChars', output.truncated)
            : undefined
        }
        onCopy={(text) => void copyText(text)}
        copyLabel={t('details.copyCta')}
        copiedLabel={t('details.copiedCta')}
      />
    </div>
  )
}

/** One long argument, on its own — a command, a prompt, a pasted body. */
function ParamBlock({ param, tool }: { param: ToolParam; tool: string }): React.JSX.Element {
  const isCommand = param.key === 'command' && SHELL_TOOLS.has(tool)
  return (
    <OutputBlock
      className="wb-tdetail-out"
      label={<span title={param.key}>{toolParamLabel(param.key)}</span>}
      prompt={isCommand ? '$' : undefined}
      text={param.value}
      maxLines={PARAM_LINES}
      moreLabel={(hidden) => t('details.showMore', hidden)}
      lessLabel={t('details.showLess')}
      note={
        param.truncated !== undefined ? t('details.truncatedChars', param.truncated) : undefined
      }
      onCopy={(text) => void copyText(text)}
      copyLabel={t('details.copyCta')}
      copiedLabel={t('details.copiedCta')}
    />
  )
}
