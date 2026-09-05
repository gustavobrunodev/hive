import { createElement, useMemo } from 'react'
import type { MouseEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { t } from '../i18n'
import { resolveCommand, splitCommandMentions, type SkillOracle } from '../chat/commandMentions'
import { resolvePath, splitFilePaths, type PathOracle } from '../chat/filePaths'
import { FileTypeIcon } from './fileIcons'
import { SlashIcon } from './icons'

/**
 * `.md` file preview (task T1, design.md §5 "Markdown renderer" — UX-R7) and
 * the agent's replies in the transcript.
 *
 * Wraps `react-markdown` + `remark-gfm` so BMAD-produced artifacts (PRDs,
 * specs, task lists) — which commonly use tables, nested lists, links, and
 * task lists — render faithfully. This replaces an earlier hand-rolled
 * line-based transform (see git history) that only covered a small subset
 * of CommonMark and had no support for tables/links/nested lists.
 *
 * Deliberately **no** `rehype-raw`: embedded raw HTML in markdown source is
 * never rendered, so workspace artifacts can't inject arbitrary DOM into the
 * app shell (context.md C2).
 */
export interface MarkdownProps {
  /** Raw markdown source to render (data, not UI copy — exempt from the i18n/noInlineStrings guard). */
  source: string
  /**
   * Turns file paths the text names into links that open that file
   * (`chat/filePaths.ts`). Both are required together: the oracle says which
   * paths are real, the callback is what a click does. Absent — the `.md`
   * preview, release notes — and every path stays plain text, exactly as before.
   */
  files?: PathOracle
  onOpenPath?: (path: string, line?: number) => void
  /**
   * Turns a `/skill-name` a reply mentions into a button that runs it
   * (`chat/commandMentions.ts`). Both required together, same reasoning as
   * `files`/`onOpenPath`: the oracle says which names are real skills, the
   * callback launches one exactly like picking it from the slash menu.
   */
  skills?: SkillOracle
  onRunCommand?: (key: string) => void
}

/**
 * Links (UX-R7.3): never let a markdown link navigate the renderer SPA.
 * Instead hand the href to the main process via the `window.hive.openExternal`
 * bridge (T3), which itself only forwards `http(s):`/`mailto:` URLs to
 * `shell.openExternal` — anything else (including `javascript:`) is rejected
 * before it ever reaches the OS.
 */
function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, href?: string): void {
  event.preventDefault()
  if (href) void window.hive.openExternal(href)
}

/**
 * A block element that remembers where it came from.
 *
 * `data-line` is the source line that produced this block, and it is the only
 * thing the edit ⇄ preview toggle can steer by: the two surfaces lay the same
 * document out at completely different heights, so a scroll *position* means
 * nothing across the crossing while a *line* means the same on both sides.
 * See `explorer/scrollSync.ts`, which reads these back.
 *
 * The attribute is inert otherwise — it changes no rendering and no semantics.
 */
function anchored<Tag extends keyof React.JSX.IntrinsicElements>(tag: Tag) {
  return function Anchored({
    node,
    ...props
  }: React.JSX.IntrinsicElements[Tag] & {
    node?: { position?: { start?: { line?: number } } }
  }): React.JSX.Element {
    return createElement(tag, { ...props, 'data-line': node?.position?.start?.line })
  }
}

/**
 * Every block-level element the renderer can emit. Inline elements are
 * deliberately left out: an anchor inside a paragraph is not a scroll target,
 * and stamping every `<em>` would put thousands of attributes in a long
 * document to no purpose.
 */
const BLOCK_COMPONENTS: Components = {
  h1: anchored('h1'),
  h2: anchored('h2'),
  h3: anchored('h3'),
  h4: anchored('h4'),
  h5: anchored('h5'),
  h6: anchored('h6'),
  p: anchored('p'),
  li: anchored('li'),
  pre: anchored('pre'),
  blockquote: anchored('blockquote'),
  table: anchored('table'),
  hr: anchored('hr')
}

// ---------------------------------------------------------------------------
// File links (agent replies)
// ---------------------------------------------------------------------------

/** The minimum of a hast node this pass reads. Structural, so no `hast` dependency is taken on. */
interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

/** Elements whose text is not prose and must never be rewritten. */
const OPAQUE = new Set(['pre', 'a', 'script', 'style'])

/**
 * A rehype pass that replaces every workspace file path in the rendered text
 * with an anchor the app owns.
 *
 * A rehype pass rather than a React-side pass over `children`, because by the
 * time components see their children the text has already been split across
 * `<em>`, `<strong>` and friends, and a path that straddles one of those is
 * unrecoverable. In the tree it is still one text node.
 *
 * Two things it is careful about, both found by looking at the rendered result
 * rather than at the code:
 *
 *  - **`<pre>` is skipped whole.** A fenced block is a listing, and turning
 *    half the tokens inside a diff into buttons is noise, not help.
 *  - **An inline `<code>` that is nothing but a path is *replaced*, not
 *    descended into.** Agents write paths as code more often than not, and
 *    wrapping the link inside the code element put a tinted plate inside a
 *    tinted plate — and compounded the two `0.85em` rules, so the same control
 *    rendered at 12.75px in prose and 10.84px in a code span, in one reply.
 */
function rehypeFilePaths(oracle: PathOracle) {
  return (tree: HastNode): void => {
    walk(tree)
    function walk(node: HastNode): void {
      const children = node.children
      if (!children || children.length === 0) return
      if (node.type === 'element' && OPAQUE.has(node.tagName ?? '')) return
      const next: HastNode[] = []
      let changed = false
      for (const child of children) {
        const whole = wholeCodePath(child, oracle)
        if (whole !== null) {
          changed = true
          next.push(whole)
          continue
        }
        if (child.type !== 'text' || typeof child.value !== 'string') {
          walk(child)
          next.push(child)
          continue
        }
        const segments = splitFilePaths(child.value, oracle)
        if (segments.length === 1 && segments[0].kind === 'text') {
          next.push(child)
          continue
        }
        changed = true
        for (const segment of segments) {
          next.push(
            segment.kind === 'text'
              ? { type: 'text', value: segment.text }
              : pathAnchor(segment.text, segment.path, segment.line)
          )
        }
      }
      if (changed) node.children = next
    }
  }
}

/**
 * An inline `<code>` whose entire content is one path → the link that replaces
 * it. `null` for anything else, including a code span that merely *contains* a
 * path (`cat src/main/index.ts`), which keeps its plate and is split inside.
 */
function wholeCodePath(node: HastNode, oracle: PathOracle): HastNode | null {
  if (node.type !== 'element' || node.tagName !== 'code') return null
  const only = node.children?.length === 1 ? node.children[0] : null
  if (!only || only.type !== 'text' || typeof only.value !== 'string') return null
  const text = only.value.trim()
  const resolved = resolvePath(text, oracle)
  return resolved === null ? null : pathAnchor(text, resolved.path, resolved.line)
}

/** The anchor node the `a` component turns into a `FileLink`. */
function pathAnchor(label: string, path: string, line?: number): HastNode {
  return {
    type: 'element',
    tagName: 'a',
    properties: {
      // Not `href`: this opens a pane in the app, and a real href would make
      // it a navigation the SPA has to intercept and cancel.
      dataHivePath: path,
      ...(line === undefined ? {} : { dataHiveLine: String(line) })
    },
    children: [{ type: 'text', value: label }]
  }
}

/** One resolved path, as a control that opens it. */
function FileLink({
  path,
  line,
  label,
  onOpen
}: {
  path: string
  line?: number
  label: string
  onOpen: (path: string, line?: number) => void
}): React.JSX.Element {
  return (
    <button type="button" className="wb-pathlink" onClick={() => onOpen(path, line)} title={path}>
      <FileTypeIcon path={path} size={12} />
      <span className="wb-pathlink-text">{label}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Command mentions (agent replies)
// ---------------------------------------------------------------------------

/**
 * A rehype pass that replaces every real skill mention in the rendered text
 * with an anchor the app owns. Structurally the mirror of `rehypeFilePaths`
 * (same opaque set, same whole-code-span special case) — see that function's
 * comment for why the tree needs a rehype pass rather than a React-side one,
 * and why a fenced block is skipped whole.
 */
function rehypeCommandMentions(oracle: SkillOracle) {
  return (tree: HastNode): void => {
    walk(tree)
    function walk(node: HastNode): void {
      const children = node.children
      if (!children || children.length === 0) return
      if (node.type === 'element' && OPAQUE.has(node.tagName ?? '')) return
      const next: HastNode[] = []
      let changed = false
      for (const child of children) {
        const whole = wholeCodeCommand(child, oracle)
        if (whole !== null) {
          changed = true
          next.push(whole)
          continue
        }
        if (child.type !== 'text' || typeof child.value !== 'string') {
          walk(child)
          next.push(child)
          continue
        }
        const segments = splitCommandMentions(child.value, oracle)
        if (segments.length === 1 && segments[0].kind === 'text') {
          next.push(child)
          continue
        }
        changed = true
        for (const segment of segments) {
          next.push(
            segment.kind === 'text'
              ? { type: 'text', value: segment.text }
              : commandAnchor(segment.key)
          )
        }
      }
      if (changed) node.children = next
    }
  }
}

/**
 * An inline `<code>` whose entire content is one skill name → the button that
 * replaces it. `null` for anything else, including a code span that merely
 * *contains* a mention, which keeps its plate and is split inside.
 */
function wholeCodeCommand(node: HastNode, oracle: SkillOracle): HastNode | null {
  if (node.type !== 'element' || node.tagName !== 'code') return null
  const only = node.children?.length === 1 ? node.children[0] : null
  if (!only || only.type !== 'text' || typeof only.value !== 'string') return null
  const key = resolveCommand(only.value.trim(), oracle)
  return key === null ? null : commandAnchor(key)
}

/**
 * The anchor node the `a` component turns into a `CommandChip`. Always
 * labelled `/key` — the canonical spelling — regardless of how the agent
 * wrote it (a bare code span may have dropped the slash).
 */
function commandAnchor(key: string): HastNode {
  return {
    type: 'element',
    tagName: 'a',
    properties: {
      // Not `href`, same reasoning as `pathAnchor`: this launches a skill in
      // the app rather than navigating anywhere.
      dataHiveCommand: key
    },
    children: [{ type: 'text', value: `/${key}` }]
  }
}

/** One recognized skill mention, as a control that runs it. */
function CommandChip({
  commandKey,
  label,
  onRun
}: {
  commandKey: string
  label: string
  onRun: (key: string) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="wb-cmdlink"
      onClick={() => onRun(commandKey)}
      title={t('chat.runCommandTitle', commandKey)}
    >
      <SlashIcon size={12} aria-hidden="true" />
      <span className="wb-cmdlink-text">{label}</span>
    </button>
  )
}

/**
 * Anchors, in one place. Three kinds arrive here and they behave nothing
 * alike: the ones `rehypeFilePaths` planted (a path in this workspace → open
 * the editor), the ones `rehypeCommandMentions` planted (a skill this
 * workspace has → run it), and the ones the author wrote (a URL → hand it to
 * the OS).
 */
interface AnchorProps {
  href?: string
  children?: React.ReactNode
  'data-hive-path'?: string
  'data-hive-line'?: string
  'data-hive-command'?: string
}

function anchorFor(
  onOpenPath: ((path: string, line?: number) => void) | undefined,
  onRunCommand: ((key: string) => void) | undefined
): (props: AnchorProps) => React.JSX.Element {
  return function MarkdownAnchor(props: AnchorProps): React.JSX.Element {
    const { href, children } = props
    const path = props['data-hive-path']
    const line = props['data-hive-line']
    const command = props['data-hive-command']
    if (path !== undefined && onOpenPath !== undefined) {
      return (
        <FileLink
          path={path}
          {...(line === undefined ? {} : { line: Number(line) })}
          label={typeof children === 'string' ? children : path}
          onOpen={onOpenPath}
        />
      )
    }
    if (command !== undefined && onRunCommand !== undefined) {
      return (
        <CommandChip
          commandKey={command}
          label={typeof children === 'string' ? children : `/${command}`}
          onRun={onRunCommand}
        />
      )
    }
    return (
      <a href={href} onClick={(event) => handleLinkClick(event, href)}>
        {children}
      </a>
    )
  }
}

export function Markdown({
  source,
  files,
  onOpenPath,
  skills,
  onRunCommand
}: MarkdownProps): React.JSX.Element {
  const linkingFiles = files !== undefined && onOpenPath !== undefined
  const linkingCommands = skills !== undefined && onRunCommand !== undefined

  const components = useMemo<Components>(
    () => ({ ...BLOCK_COMPONENTS, a: anchorFor(onOpenPath, onRunCommand) }),
    [onOpenPath, onRunCommand]
  )

  const rehypePlugins = useMemo(() => {
    const plugins: Array<() => (tree: HastNode) => void> = []
    if (linkingFiles && files) plugins.push(() => rehypeFilePaths(files))
    if (linkingCommands && skills) plugins.push(() => rehypeCommandMentions(skills))
    return plugins
  }, [linkingFiles, files, linkingCommands, skills])

  return (
    <div className="hds-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}

export default Markdown
