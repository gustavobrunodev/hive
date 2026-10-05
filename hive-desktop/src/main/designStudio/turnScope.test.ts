import { describe, expect, it } from 'vitest'
import { join } from 'path'
import type { TurnScope } from '../agentAdapter'
import { decideScoped, isListedCommand, isWithin, splitCommand } from './turnScope'

/**
 * Design Studio — the one rule that answers a scoped turn's permission
 * questions (decision 2, Landing 13). Pure, so every line of the table — and
 * every way a path can try to leave its root — is a case here.
 */

const RAIZ = '/home/marina/Documentos/Design Studio'
const PRODUTO = join(RAIZ, 'Câmbio')
const RECURSOS = '/opt/Hive/resources/app.asar.unpacked/resources/design-studio'
const SCRIPT = join(RECURSOS, 'skills', 'relatorio-likert', 'scripts', 'relatorio.mjs')

const SCOPE: TurnScope = {
  cwd: PRODUTO,
  readRoots: [RAIZ, RECURSOS],
  writeRoots: [join(PRODUTO, 'relatorios')],
  commands: [`node "${SCRIPT}"`]
}

describe('decideScoped', () => {
  it.each([
    [
      'read inside readRoots',
      { kind: 'read', path: join(RAIZ, 'Pix', 'relatorios', 'voz', 'a.md') },
      'allow'
    ],
    ['read outside readRoots', { kind: 'read', path: '/etc/passwd' }, 'deny'],
    [
      'write inside writeRoots',
      { kind: 'write', path: join(PRODUTO, 'relatorios', 'likert', 'x.md') },
      'allow'
    ],
    ['write outside writeRoots', { kind: 'write', path: join(PRODUTO, 'notas.md') }, 'deny'],
    [
      'command on the closed list',
      { kind: 'command', command: `node "${SCRIPT}" --dados a.json` },
      'allow'
    ],
    ['command off the closed list', { kind: 'command', command: 'ls -la' }, 'deny'],
    ['another tool', { kind: 'other', tool: 'WebFetch' }, 'deny']
  ] as const)('C45a: %s → %s', (_line, request, expected) => {
    expect(decideScoped(SCOPE, request)).toBe(expected)
  })

  it.each([
    // `..` that climbs out of the write root lands in the Produto, then in <raiz>.
    ['.. out of the write root', join(PRODUTO, 'relatorios', '..', 'escapou.md'), 'deny'],
    ['.. out of <raiz>', join(PRODUTO, 'relatorios', '..', '..', '..', 'Desktop', 'x.md'), 'deny'],
    // A relative path is judged where it lands: against `cwd`, the Produto.
    ['relative, resolved against cwd, inside', 'relatorios/likert/2026-10-04-90d.md', 'allow'],
    ['relative, resolved against cwd, outside', 'notas.md', 'deny'],
    ['relative .. that leaves the Produto', '../Pix/relatorios/x.md', 'deny'],
    // A sibling whose name only *starts* like the root is not inside it.
    ['sibling with the root as a name prefix', `${join(PRODUTO, 'relatorios')}-copia/x.md`, 'deny'],
    // Backslashes cannot smuggle a `..` past the resolver.
    ['backslash .. out of the root', 'relatorios\\..\\..\\fora.md', 'deny'],
    ['the root itself', join(PRODUTO, 'relatorios'), 'allow'],
    ['an empty path', '', 'deny']
  ])('C45a: write edge — %s → %s', (_case, path, expected) => {
    expect(decideScoped(SCOPE, { kind: 'write', path })).toBe(expected)
  })

  it.each([
    [
      'a read of the skill itself',
      join(RECURSOS, 'skills', 'relatorio-likert', 'SKILL.md'),
      'allow'
    ],
    ['a relative read inside the Produto', 'relatorios', 'allow'],
    ['a relative read of another Produto', '../Extrato', 'allow'],
    ['a relative read above <raiz>', '../../segredo.txt', 'deny']
  ])('C45a: read edge — %s → %s', (_case, path, expected) => {
    expect(decideScoped(SCOPE, { kind: 'read', path })).toBe(expected)
  })

  it.each([
    ['the script, quoted', `node "${SCRIPT}"`, 'allow'],
    ['the script, single-quoted, with arguments', `node '${SCRIPT}' --saida "x y.md"`, 'allow'],
    ['node.exe running the script', `node.exe "${SCRIPT}"`, 'allow'],
    [
      'the script by a relative path from cwd',
      `node "../../../../../opt/Hive/resources/app.asar.unpacked/resources/design-studio/skills/relatorio-likert/scripts/relatorio.mjs"`,
      'allow'
    ],
    ['node running another script', `node "${join(RECURSOS, 'outro.mjs')}"`, 'deny'],
    ['node with no script', 'node -e "1"', 'deny'],
    ['the script chained to another command', `node "${SCRIPT}" && rm -rf ~`, 'deny'],
    ['the script piped', `node "${SCRIPT}" | sh`, 'deny'],
    ['the script with a redirection', `node "${SCRIPT}" > /etc/x`, 'deny'],
    ['a substitution in an argument', `node "${SCRIPT}" --saida "$(whoami)"`, 'deny'],
    ['a backtick substitution', `node "${SCRIPT}" \`id\``, 'deny'],
    ['a second line', `node "${SCRIPT}"\nrm -rf ~`, 'deny'],
    ['cd before the script', `cd /tmp; node "${SCRIPT}"`, 'deny'],
    ['an unclosed quote', `node "${SCRIPT}`, 'deny'],
    ['bash running the script', `bash "${SCRIPT}"`, 'deny']
  ])('C45a: command edge — %s → %s', (_case, command, expected) => {
    expect(decideScoped(SCOPE, { kind: 'command', command })).toBe(expected)
  })
})

describe('the pieces of the rule', () => {
  it('splits a command line the way a POSIX shell does', () => {
    expect(splitCommand(`node "a b.mjs" 'c d' e\\ f`, 'linux')).toEqual([
      'node',
      'a b.mjs',
      'c d',
      'e f'
    ])
    expect(splitCommand('node  "x\\"y"  ', 'linux')).toEqual(['node', 'x"y'])
    expect(splitCommand('node ""', 'linux')).toEqual(['node', ''])
  })

  it('keeps a Windows path whole: backslash is a separator there, not an escape', () => {
    expect(splitCommand('node C:\\Hive\\relatorio.mjs', 'win32')).toEqual([
      'node',
      'C:\\Hive\\relatorio.mjs'
    ])
    expect(splitCommand('node "C:\\Program Files\\Hive\\r.mjs"', 'win32')).toEqual([
      'node',
      'C:\\Program Files\\Hive\\r.mjs'
    ])
  })

  it('reads single quotes literally, even an operator inside them', () => {
    expect(splitCommand("node 'a;b|c'", 'linux')).toEqual(['node', 'a;b|c'])
  })

  it('ignores case on Windows, both for the program and the path', () => {
    const scope: TurnScope = { ...SCOPE, commands: [`node "${SCRIPT}"`] }
    expect(isListedCommand(scope, `NODE "${SCRIPT.toUpperCase()}"`, 'win32')).toBe(true)
    expect(isListedCommand(scope, `NODE "${SCRIPT}"`, 'linux')).toBe(false)
  })

  it('judges containment after resolving, and only by whole segments', () => {
    expect(isWithin('/a/b', '/a/b/c', '/')).toBe(true)
    expect(isWithin('/a/b/', '/a/b/c', '/')).toBe(true)
    expect(isWithin('/a/b', '/a/bc', '/')).toBe(false)
    expect(isWithin('/a/b', 'c', '/a/b')).toBe(true)
    expect(isWithin('/A/B', '/a/b/c', '/', 'win32')).toBe(true)
  })

  it('denies an entry on the closed list that is not itself a command', () => {
    expect(isListedCommand({ ...SCOPE, commands: ['node'] }, `node "${SCRIPT}"`)).toBe(false)
    expect(isListedCommand({ ...SCOPE, commands: ['node "$(x)"'] }, `node "${SCRIPT}"`)).toBe(false)
  })
})
