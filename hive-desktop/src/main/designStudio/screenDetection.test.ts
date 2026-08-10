import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { SCREEN_PROBES, detectScreens } from './screenDetection'

/**
 * design-studio T4.2 / DS-R1 AC-2/3, risk R-8.
 *
 * The two fixtures below are **real UX Specs from this repository** — the
 * `bmad-ux` skill's own EXPERIENCE.md examples, which are the canonical shape
 * of the artifact the Studio reads. Calibrating against invented markdown is
 * exactly how R-8 comes true: a heuristic that passes on samples written to
 * match it, and finds zero Telas in the first real Spec a user opens.
 */
const UX_ASSETS = join(__dirname, '../../../../.claude/skills/bmad-ux/assets')

function realSpec(name: string): string {
  return readFileSync(join(UX_ASSETS, name), 'utf-8')
}

describe('detectScreens — real UX Specs from the repository (R-8)', () => {
  it('reads the surfaces off the shadcn EXPERIENCE.md Information Architecture table', () => {
    const result = detectScreens(realSpec('experience-example-shadcn.md'))

    expect(result.screens.map((screen) => screen.title)).toEqual([
      'Today',
      'Projects',
      'Project detail',
      'Search',
      'Settings'
    ])
    expect(result.screens.every((screen) => screen.probe === 'iaTable')).toBe(true)
  })

  it('reads the surfaces off the mobile EXPERIENCE.md, ignoring the Spec is another product', () => {
    const result = detectScreens(realSpec('experience-example-mobile.md'))

    expect(result.screens.map((screen) => screen.title)).toEqual([
      'Today',
      'Library',
      'Entry detail',
      'Settings'
    ])
  })

  it('gives every Tela a distinct id derived from its title', () => {
    const result = detectScreens(realSpec('experience-example-mobile.md'))

    expect(result.screens.map((screen) => screen.screenId)).toEqual([
      'today',
      'library',
      'entry-detail',
      'settings'
    ])
  })

  it('finds no Tela in a Spec that is not a UX Spec at all, and says what it looked for', () => {
    const result = detectScreens(realSpec('color-themes.md'))

    expect(result.screens).toEqual([])
    expect(result.probed).toEqual(SCREEN_PROBES)
  })
})

describe('detectScreens — explicit Tela headings (DS-R1 AC-2)', () => {
  it('lists all three Telas of a Spec that names them in headings', () => {
    const result = detectScreens(
      ['# Spec', '## Tela — Login', 'texto', '## Tela — Cadastro', '### Screen: Sucesso'].join('\n')
    )

    expect(result.screens.map((screen) => screen.title)).toEqual(['Login', 'Cadastro', 'Sucesso'])
    expect(result.screens.map((screen) => screen.probe)).toEqual([
      'screenHeading',
      'screenHeading',
      'screenHeading'
    ])
  })

  it('keeps the keyword when the heading carries no separator, so "## Tela 3" is not called "3"', () => {
    expect(detectScreens('## Tela 3').screens[0].title).toBe('Tela 3')
  })

  it('does not read a bare "## Telas" section header as a Tela of its own', () => {
    const result = detectScreens(['## Telas', '', '| Surface | Purpose |', '|---|---|'].join('\n'))

    expect(result.screens).toEqual([])
  })

  it('prefers explicit headings over the IA table when a Spec has both', () => {
    const result = detectScreens(
      [
        '## Information Architecture',
        '| Surface | Purpose |',
        '|---|---|',
        '| Home | landing |',
        '## Tela — Login'
      ].join('\n')
    )

    expect(result.screens.map((screen) => screen.title)).toEqual(['Login'])
  })

  it('strips the markdown a title is wrapped in', () => {
    expect(detectScreens('## Tela — `wa-page` **Login**').screens[0].title).toBe('wa-page Login')
  })

  it('ignores a Tela heading that only appears inside a fenced code block', () => {
    const result = detectScreens(['```md', '## Tela — Exemplo', '```', 'prosa'].join('\n'))

    expect(result.screens).toEqual([])
  })

  it('deduplicates ids when two Telas share a title', () => {
    const result = detectScreens(['## Tela — Login', '## Tela — Login'].join('\n'))

    expect(result.screens.map((screen) => screen.screenId)).toEqual(['login', 'login-2'])
  })

  it('falls back to a usable id when a title has no id-able characters', () => {
    expect(detectScreens('## Tela — ✳︎').screens[0].screenId).toBe('tela')
  })
})

describe('detectScreens — the Information Architecture table', () => {
  it('reads a pt-BR table whose first column is "Tela"', () => {
    const result = detectScreens(
      [
        '## Arquitetura da Informação',
        '| Tela | Alcançada de | Propósito |',
        '| --- | --- | --- |',
        '| Início | Abertura | Ponto de entrada |',
        '| Configurações | Menu | Conta e tema |'
      ].join('\n')
    )

    expect(result.screens.map((screen) => screen.title)).toEqual(['Início', 'Configurações'])
    expect(result.screens.map((screen) => screen.screenId)).toEqual(['inicio', 'configuracoes'])
  })

  it('ignores tables whose first column is not a surface column', () => {
    const result = detectScreens(
      ["| Do | Don't |", '| --- | --- |', '| "Saved." | "✓ Auto-saved" |'].join('\n')
    )

    expect(result.screens).toEqual([])
  })

  it('stops reading rows once the table ends, so the next table is judged on its own header', () => {
    const result = detectScreens(
      [
        '| Surface | Purpose |',
        '| --- | --- |',
        '| Home | landing |',
        '',
        "| Do | Don't |",
        '| --- | --- |',
        '| "Saved." | "✓" |'
      ].join('\n')
    )

    expect(result.screens.map((screen) => screen.title)).toEqual(['Home'])
  })

  it('skips a row whose first cell is empty rather than inventing a nameless Tela', () => {
    const result = detectScreens(
      ['| Surface | Purpose |', '| --- | --- |', '|  | orphan |', '| Home | landing |'].join('\n')
    )

    expect(result.screens.map((screen) => screen.title)).toEqual(['Home'])
  })
})
