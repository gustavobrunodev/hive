import { describe, expect, it } from 'vitest'
import { createPathOracle, resolvePath, splitFilePaths } from './filePaths'

const FILES = [
  'src/main/agentService.ts',
  'src/main/agentService.test.ts',
  'src/renderer/src/chat/Chat.tsx',
  'src/renderer/src/ui/index.ts',
  'src/main/index.ts',
  'package.json',
  'docs/visual-validation.md'
]

const oracle = createPathOracle('/home/u/hive', FILES)

/** Just the openable pieces, as `label → path` — what a reader sees and what a click does. */
function links(text: string): Array<[string, string, number | undefined]> {
  return splitFilePaths(text, oracle)
    .filter((segment) => segment.kind === 'path')
    .map((segment) => [segment.text, segment.path, segment.line])
}

describe('createPathOracle', () => {
  it('resolves a workspace-relative path', () => {
    expect(oracle.has('src/main/agentService.ts')).toBe('src/main/agentService.ts')
    expect(oracle.has('./src/main/agentService.ts')).toBe('src/main/agentService.ts')
  })

  it('resolves an absolute path inside the workspace, and only inside it', () => {
    // The CLIs report absolute paths constantly; the editor addresses files
    // relative to the workspace, and this is where the two meet.
    expect(oracle.has('/home/u/hive/src/main/index.ts')).toBe('src/main/index.ts')
    expect(oracle.has('/etc/passwd')).toBeNull()
    expect(oracle.has('/home/u/other/src/main/index.ts')).toBeNull()
  })

  it('accepts Windows separators, because that is what the CLIs write there', () => {
    expect(oracle.has('src\\main\\agentService.ts')).toBe('src/main/agentService.ts')
  })

  it('resolves a bare filename only when exactly one file has it', () => {
    expect(oracle.has('package.json')).toBe('package.json')
    // Two files are named `index.ts`. A link that might open the wrong file is
    // not a link — this is the case that makes guessing unacceptable.
    expect(oracle.has('index.ts')).toBeNull()
  })

  it('answers null for anything not on disk', () => {
    expect(oracle.has('src/main/imaginary.ts')).toBeNull()
    expect(oracle.has('')).toBeNull()
  })
})

describe('resolvePath', () => {
  it('peels a compiler-style location off, and keeps the line', () => {
    expect(resolvePath('src/main/index.ts:42', oracle)).toEqual({
      path: 'src/main/index.ts',
      line: 42
    })
    expect(resolvePath('src/main/index.ts:42:7', oracle)).toEqual({
      path: 'src/main/index.ts',
      line: 42
    })
  })

  it('does not read a Windows drive letter as a line number', () => {
    const windows = createPathOracle('C:/dev/hive', ['src/a.ts'])
    expect(resolvePath('C:\\dev\\hive\\src\\a.ts', windows)).toEqual({ path: 'src/a.ts' })
  })
})

describe('splitFilePaths', () => {
  it('links the paths in a sentence and leaves the sentence alone', () => {
    const segments = splitFilePaths('Criei src/main/index.ts e ajustei package.json.', oracle)
    expect(segments).toEqual([
      { kind: 'text', text: 'Criei ' },
      { kind: 'path', text: 'src/main/index.ts', path: 'src/main/index.ts' },
      { kind: 'text', text: ' e ajustei ' },
      { kind: 'path', text: 'package.json', path: 'package.json' },
      { kind: 'text', text: '.' }
    ])
  })

  it('gives back one text segment when nothing resolved, so nothing re-renders', () => {
    const text = 'Nada aqui é um arquivo: v1.2.3, README, node_modules.'
    expect(splitFilePaths(text, oracle)).toEqual([{ kind: 'text', text }])
  })

  // The two failure modes of guessing, both of which the oracle makes impossible.
  it('never links something that only looks like a path', () => {
    expect(links('Atualizei para a versão 4.1.3 do pacote hive-desktop.')).toEqual([])
    expect(links('Veja o arquivo src/main/naoExiste.ts')).toEqual([])
  })

  it('leaves the sentence punctuation to the sentence', () => {
    expect(links('Mexi em src/main/index.ts, package.json e docs/visual-validation.md.')).toEqual([
      ['src/main/index.ts', 'src/main/index.ts', undefined],
      ['package.json', 'package.json', undefined],
      ['docs/visual-validation.md', 'docs/visual-validation.md', undefined]
    ])
  })

  it('keeps the location the agent wrote as the label, and opens the file', () => {
    expect(links('O erro está em src/main/index.ts:42.')).toEqual([
      ['src/main/index.ts:42', 'src/main/index.ts', 42]
    ])
  })

  it('links a path inside parentheses and brackets', () => {
    expect(links('(veja src/main/index.ts) e [package.json]')).toEqual([
      ['src/main/index.ts', 'src/main/index.ts', undefined],
      ['package.json', 'package.json', undefined]
    ])
  })

  it('links an absolute path the CLI reported', () => {
    expect(links('Escrevi /home/u/hive/src/renderer/src/chat/Chat.tsx agora.')).toEqual([
      ['/home/u/hive/src/renderer/src/chat/Chat.tsx', 'src/renderer/src/chat/Chat.tsx', undefined]
    ])
  })

  it('links nothing at all before the file list has loaded', () => {
    // An empty oracle is "not loaded yet", and the honest render of that is
    // plain text — not a button that would open nothing.
    const empty = createPathOracle('/home/u/hive', [])
    expect(splitFilePaths('Criei src/main/index.ts', empty)).toEqual([
      { kind: 'text', text: 'Criei src/main/index.ts' }
    ])
  })
})
