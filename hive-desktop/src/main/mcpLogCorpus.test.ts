import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { claudeCacheRoot } from './mcpLogService'
import { parseLogChunk, type McpLogKind } from './mcpLogParse'

/**
 * A corpus check, not a unit test: run the classifier over whatever real
 * Claude Code CLI logs exist on this machine and assert the table still
 * recognises the overwhelming majority of them.
 *
 * The unit tests in `mcpLogParse.test.ts` pin each sentence individually; this
 * one guards the thing they can't — that a CLI release hasn't quietly reworded
 * its logs into a wall of unclassified `notice` lines. It self-skips wherever
 * the cache is absent (CI, a fresh clone), so it never fails for lack of data.
 */

/** Every `mcp-logs-*` directory under the real CLI cache, across all workspaces. */
function corpusDirs(root: string, budget: number): string[] {
  if (!existsSync(root)) return []
  const dirs: string[] = []
  for (const workspace of readdirSync(root)) {
    const workspaceDir = join(root, workspace)
    if (!statSync(workspaceDir).isDirectory()) continue
    for (const name of readdirSync(workspaceDir)) {
      if (name.startsWith('mcp-logs-')) dirs.push(join(workspaceDir, name))
      if (dirs.length >= budget) return dirs
    }
  }
  return dirs
}

describe('MCP log classification against the real CLI corpus', () => {
  const dirs = corpusDirs(claudeCacheRoot(), 40)

  it.skipIf(dirs.length === 0)('recognises at least 90% of real log lines', () => {
    const counts = new Map<McpLogKind, number>()
    let total = 0

    for (const dir of dirs) {
      const files = readdirSync(dir)
        .filter((name) => name.endsWith('.jsonl'))
        .slice(-12)
      for (const file of files) {
        const path = join(dir, file)
        const entries = parseLogChunk(readFileSync(path, 'utf8'), {
          server: dir.slice(dir.lastIndexOf('mcp-logs-') + 'mcp-logs-'.length),
          file: path,
          startLine: 0,
          fallbackAt: 0
        })
        for (const entry of entries) {
          total += 1
          counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1)
        }
      }
    }

    // Nothing to assert against if this machine's cache happens to be empty.
    if (total === 0) return

    const unclassified = counts.get('notice') ?? 0
    expect(unclassified / total).toBeLessThan(0.02)
    // The two shapes the console is built around must both be present.
    expect(counts.get('tool-call') ?? 0).toBeGreaterThan(0)
    expect(counts.get('connected') ?? 0).toBeGreaterThan(0)
  })
})
