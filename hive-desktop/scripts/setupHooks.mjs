/**
 * Points git at the monorepo's committed hooks directory, so the pre-commit
 * check needs no per-clone setup step anyone can forget. Run from `prepare`,
 * i.e. after every `npm install` here.
 *
 * Everything about this is best-effort: `prepare` also fires during `npm
 * publish` and in environments with no git repo at all (a tarball unpacked
 * into a plain directory). None of those should fail an install, so every
 * failure path exits 0 with a note rather than throwing.
 */
import { execFileSync } from 'node:child_process'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

try {
  // Fails when there's no repo — nothing to wire up, and that's fine.
  git(['rev-parse', '--git-dir'])
} catch {
  process.exit(0)
}

try {
  const current = (() => {
    try {
      return git(['config', '--local', '--get', 'core.hooksPath'])
    } catch {
      return ''
    }
  })()

  // Don't stomp a developer's deliberate choice of a different hooks dir.
  if (current && current !== '.githooks') {
    console.log(`[hooks] core.hooksPath is already "${current}" — leaving it alone.`)
    process.exit(0)
  }

  git(['config', '--local', 'core.hooksPath', '.githooks'])
} catch (error) {
  console.log(`[hooks] could not set core.hooksPath (${error.message}) — skipping.`)
}
