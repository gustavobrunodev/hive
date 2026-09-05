import { describe, expect, it } from 'vitest'
import { createSkillOracle } from './commandMentions'
import {
  BUILT_IN_COMMANDS,
  commandTokenAt,
  completeCommand,
  filterSlashCommands,
  knownCommandToken,
  resolveComposerIntent,
  slashCatalog,
  slashQueryOf
} from './slashCommands'

const SKILLS = [
  { key: 'bmad-prd', label: 'Criar PRD', description: 'Requisitos do produto' },
  { key: 'bmad-ux', label: 'Criar UX', description: 'Especificação de interface' },
  { key: 'bmad-code-review', label: 'Revisar código', description: 'Revisão adversarial' }
]

const oracle = createSkillOracle(SKILLS)

describe('slashQueryOf', () => {
  it('opens on a leading slash and tracks what follows it', () => {
    expect(slashQueryOf('/')).toBe('')
    expect(slashQueryOf('/bmad')).toBe('bmad')
  })

  // The narrowness is the feature: a command palette opening over someone's
  // prose is worse than one that misses an edge case.
  it('stays shut for a slash that is not an invocation', () => {
    expect(slashQueryOf('veja src/main.ts')).toBeNull()
    expect(slashQueryOf('03/09')).toBeNull()
    expect(slashQueryOf('/bmad-prd quero uma PRD')).toBeNull()
    expect(slashQueryOf('')).toBeNull()
  })
})

describe('slashCatalog', () => {
  it('leads with the built-ins, then the workspace skills', () => {
    const catalog = slashCatalog(SKILLS)
    expect(catalog[0].kind).toBe('builtin')
    expect(catalog[0].key).toBe('compact')
    expect(catalog.slice(1).every((command) => command.kind === 'skill')).toBe(true)
    expect(catalog).toHaveLength(BUILT_IN_COMMANDS.length + SKILLS.length)
  })

  // A command the agent cannot run is not offered: a row that answers with an
  // error is worse than a row that isn't there.
  it('drops the compaction row for an agent that has no such command', () => {
    const catalog = slashCatalog(SKILLS, { compaction: false })
    expect(catalog.some((command) => command.key === 'compact')).toBe(false)
    expect(catalog).toHaveLength(SKILLS.length)
  })
})

describe('filterSlashCommands', () => {
  const catalog = slashCatalog(SKILLS)

  it('lists everything for a bare slash and nothing for a closed menu', () => {
    expect(filterSlashCommands(catalog, '')).toHaveLength(catalog.length)
    expect(filterSlashCommands(catalog, null)).toEqual([])
  })

  it('ranks a prefix above a substring above a description hit', () => {
    const ranked = filterSlashCommands(catalog, 'ux').map((command) => command.key)
    // `bmad-ux` ends with the needle (substring), and nothing prefixes it.
    expect(ranked[0]).toBe('bmad-ux')
  })

  // The reason descriptions are matched at all: the skill that *does* PRDs is
  // findable by what it does, not only by how it is spelled.
  it('finds a skill by its description when the key says nothing', () => {
    expect(filterSlashCommands(catalog, 'adversarial').map((c) => c.key)).toEqual([
      'bmad-code-review'
    ])
  })

  // A built-in leading the catalog must not outrank a skill the query actually
  // prefixes — the lead is an ordering default, not a thumb on the scale.
  it('lets a prefixed skill beat a built-in that merely contains the needle', () => {
    const withTrap = slashCatalog([{ key: 'pac', label: 'Pac', description: 'nada' }])
    expect(filterSlashCommands(withTrap, 'pac')[0].key).toBe('pac')
  })

  it('answers nothing for a query that matches nothing', () => {
    expect(filterSlashCommands(catalog, 'naoexiste')).toEqual([])
  })
})

describe('commandTokenAt', () => {
  it('finds the leading command and whatever rides its line', () => {
    expect(commandTokenAt('/bmad-prd Eu quero uma PRD')).toEqual({
      name: 'bmad-prd',
      start: 0,
      end: 9,
      args: 'Eu quero uma PRD'
    })
  })

  it('finds a bare command with no arguments', () => {
    expect(commandTokenAt('/compact')).toEqual({ name: 'compact', start: 0, end: 8, args: '' })
  })

  it('stops at the first line, so prose underneath is not swallowed', () => {
    const token = commandTokenAt('/compact foco em decisões\ne mais texto abaixo')
    expect(token?.args).toBe('foco em decisões')
  })

  it('is null for prose, including a slash that starts a path', () => {
    expect(commandTokenAt('bom dia')).toBeNull()
    expect(commandTokenAt('//comment')).toBeNull()
    expect(commandTokenAt('/bmad-prd/extra')).toBeNull()
  })
})

describe('completeCommand', () => {
  it('replaces the open query and leaves the caret past a trailing space', () => {
    expect(completeCommand('/ux', 'bmad-ux')).toEqual({ value: '/bmad-ux ', caret: 9 })
  })

  it('keeps text already typed past the token, without doubling the space', () => {
    expect(completeCommand('/ux  quero uma tela', 'bmad-ux')).toEqual({
      value: '/bmad-ux quero uma tela',
      caret: 9
    })
  })

  it('keeps later lines intact', () => {
    expect(completeCommand('/pr\nsegunda linha', 'bmad-prd').value).toBe(
      '/bmad-prd \nsegunda linha'
    )
  })
})

describe('resolveComposerIntent', () => {
  it('reads a known skill as the invocation it is, arguments included', () => {
    expect(resolveComposerIntent('/bmad-prd quero uma PRD', oracle)).toEqual({
      kind: 'skill',
      key: 'bmad-prd',
      text: '/bmad-prd quero uma PRD'
    })
  })

  it('reads the built-in as the app’s own act, carrying its focus text', () => {
    expect(resolveComposerIntent('/compact foque na arquitetura', oracle)).toEqual({
      kind: 'builtin',
      key: 'compact',
      args: 'foque na arquitetura',
      text: '/compact foque na arquitetura'
    })
  })

  // The oracle decides, never the shape of the text — so someone can still
  // talk *about* a command that isn't installed.
  it('treats an unresolvable command as an ordinary message', () => {
    expect(resolveComposerIntent('/bmda-prd', oracle)).toEqual({ kind: 'message' })
    expect(resolveComposerIntent('bom dia', oracle)).toEqual({ kind: 'message' })
  })

  it('falls back to a message when the agent has no compaction command', () => {
    expect(resolveComposerIntent('/compact', oracle, { compaction: false })).toEqual({
      kind: 'message'
    })
  })
})

describe('knownCommandToken', () => {
  it('marks only a command that really exists', () => {
    expect(knownCommandToken('/bmad-prd algo', oracle)?.name).toBe('bmad-prd')
    expect(knownCommandToken('/compact', oracle)?.name).toBe('compact')
    expect(knownCommandToken('/bmda-prd', oracle)).toBeNull()
    expect(knownCommandToken('sem comando', oracle)).toBeNull()
  })

  it('drops the built-in when the agent cannot compact', () => {
    expect(knownCommandToken('/compact', oracle, { compaction: false })).toBeNull()
  })
})
