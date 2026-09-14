import { describe, expect, it } from 'vitest'
import {
  INITIATIVES_ROOT,
  INITIATIVE_COLORS,
  buildManifest,
  compareReleases,
  defaultColorFor,
  groupInitiatives,
  isInitiativeColor,
  initiativePath,
  initiativeSlug,
  readInitiatives,
  readManifest,
  titleFromSlug,
  type TreeNodeLike
} from './initiatives'

/** A directory node, shaped like `window.hive.listTree`'s. */
function dir(name: string, path: string, children: TreeNodeLike[] = []): TreeNodeLike {
  return { name, path, type: 'directory', children }
}

function file(name: string, path: string): TreeNodeLike {
  return { name, path, type: 'file' }
}

const R2 = `${INITIATIVES_ROOT}/R2`

/** `docs/iniciativas/R2/portal-de-cobranca` with a PRD and two stories. */
function sampleTree(): TreeNodeLike[] {
  return [
    dir('R2', R2, [
      dir('portal-de-cobranca', `${R2}/portal-de-cobranca`, [
        file('prd.md', `${R2}/portal-de-cobranca/prd.md`),
        file('iniciativa.json', `${R2}/portal-de-cobranca/iniciativa.json`),
        dir('historias', `${R2}/portal-de-cobranca/historias`, [
          file('h-1.md', `${R2}/portal-de-cobranca/historias/h-1.md`),
          file('h-2.md', `${R2}/portal-de-cobranca/historias/h-2.md`)
        ])
      ])
    ])
  ]
}

describe('readInitiatives', () => {
  it('reads a demand two levels down and flattens its files relative to it', () => {
    const [initiative] = readInitiatives(sampleTree(), {}, 2026)
    expect(initiative.path).toBe(`${R2}/portal-de-cobranca`)
    expect(initiative.slug).toBe('portal-de-cobranca')
    expect(initiative.release).toBe('R2')
    expect(initiative.files).toEqual([
      'prd.md',
      'iniciativa.json',
      'historias/h-1.md',
      'historias/h-2.md'
    ])
  })

  it('names a folder after itself and dates it to the current year when there is no manifest', () => {
    const [initiative] = readInitiatives(sampleTree(), {}, 2026)
    expect(initiative.title).toBe('Portal De Cobranca')
    expect(initiative.year).toBe(2026)
  })

  it('prefers the manifest, which is the only place the accents and the year survive', () => {
    const [initiative] = readInitiatives(
      sampleTree(),
      { [`${R2}/portal-de-cobranca`]: { title: 'Portal de Cobrança', year: 2025 } },
      2026
    )
    expect(initiative.title).toBe('Portal de Cobrança')
    expect(initiative.year).toBe(2025)
  })

  it('ignores files sitting where a release or a demand should be', () => {
    const tree = [
      file('README.md', `${INITIATIVES_ROOT}/README.md`),
      dir('R1', `${INITIATIVES_ROOT}/R1`, [file('notas.md', `${INITIATIVES_ROOT}/R1/notas.md`)])
    ]
    expect(readInitiatives(tree, {}, 2026)).toEqual([])
  })

  it('keeps an empty demand folder — it is an initiative that has produced nothing yet', () => {
    const tree = [dir('R1', `${INITIATIVES_ROOT}/R1`, [dir('nova', `${INITIATIVES_ROOT}/R1/nova`)])]
    const [initiative] = readInitiatives(tree, {}, 2026)
    expect(initiative.files).toEqual([])
  })

  it('survives a node with no children key at all, which is how an empty directory can arrive', () => {
    const bare = (name: string, path: string): TreeNodeLike => ({ name, path, type: 'directory' })
    expect(readInitiatives([bare('R1', `${INITIATIVES_ROOT}/R1`)], {}, 2026)).toEqual([])

    const release = dir('R1', `${INITIATIVES_ROOT}/R1`, [
      bare('nova', `${INITIATIVES_ROOT}/R1/nova`)
    ])
    expect(readInitiatives([release], {}, 2026)[0].files).toEqual([])
  })
})

describe('groupInitiatives', () => {
  it('puts the newest year first and runs its releases forward', () => {
    const tree = [
      dir('R10', `${INITIATIVES_ROOT}/R10`, [dir('z', `${INITIATIVES_ROOT}/R10/z`)]),
      dir('R2', `${INITIATIVES_ROOT}/R2`, [dir('a', `${INITIATIVES_ROOT}/R2/a`)]),
      dir('R1', `${INITIATIVES_ROOT}/R1`, [dir('old', `${INITIATIVES_ROOT}/R1/old`)])
    ]
    const years = groupInitiatives(
      readInitiatives(tree, { [`${INITIATIVES_ROOT}/R1/old`]: { year: 2025 } }, 2026)
    )
    expect(years.map((group) => group.year)).toEqual([2026, 2025])
    expect(years[0].releases.map((release) => release.release)).toEqual(['R2', 'R10'])
  })

  it('sorts demands inside a release alphabetically, by title and not by slug', () => {
    const tree = [
      dir('R1', `${INITIATIVES_ROOT}/R1`, [
        dir('zebra', `${INITIATIVES_ROOT}/R1/zebra`),
        dir('alfa', `${INITIATIVES_ROOT}/R1/alfa`)
      ])
    ]
    const years = groupInitiatives(
      readInitiatives(tree, { [`${INITIATIVES_ROOT}/R1/zebra`]: { title: 'Abertura' } }, 2026)
    )
    expect(years[0].releases[0].initiatives.map((entry) => entry.title)).toEqual([
      'Abertura',
      'Alfa'
    ])
  })
})

describe('compareReleases', () => {
  it('orders R10 after R9, which string order gets wrong', () => {
    expect(['R10', 'R9', 'R1'].sort(compareReleases)).toEqual(['R1', 'R9', 'R10'])
  })

  it('keeps an unnumbered release rather than dropping it, after the numbered ones', () => {
    expect(compareReleases('R2', 'hotfix')).toBeLessThan(0)
    expect(compareReleases('hotfix', 'R2')).toBeGreaterThan(0)
    expect(['hotfix', 'R2'].sort(compareReleases)).toEqual(['R2', 'hotfix'])
  })

  it('orders two unnumbered releases by name', () => {
    expect(compareReleases('alfa', 'zebra')).toBeLessThan(0)
    expect(compareReleases('zebra', 'alfa')).toBeGreaterThan(0)
  })

  it('is case-insensitive about the R, since a folder name is whatever was typed', () => {
    expect(compareReleases('r1', 'R2')).toBeLessThan(0)
  })
})

describe('readManifest', () => {
  it('reads the fields it recognises', () => {
    expect(
      readManifest('{"title":"Portal","year":2026,"release":"R2","createdAt":"2026-09-10"}')
    ).toEqual({
      title: 'Portal',
      year: 2026,
      release: 'R2',
      createdAt: '2026-09-10'
    })
  })

  it('costs a bad field that field and nothing else', () => {
    expect(readManifest('{"title":"Portal","year":"dois mil"}')).toEqual({ title: 'Portal' })
  })

  it('survives a file that is not JSON at all', () => {
    expect(readManifest('# não é json')).toEqual({})
    expect(readManifest('[]')).toEqual({})
  })

  it('drops a blank title instead of letting it win over the folder name', () => {
    expect(readManifest('{"title":"   ","year":2026}')).toEqual({ year: 2026 })
  })
})

describe('paths', () => {
  it('folds accents and spaces into a directory-safe slug', () => {
    expect(initiativeSlug('Portal de Cobrança')).toBe('portal-de-cobranca')
    expect(initiativeSlug('!!!')).toBe('')
  })

  it('reads a slug back as words for a folder nobody created through the app', () => {
    expect(titleFromSlug('novo-checkout')).toBe('Novo Checkout')
  })

  it('places a demand under its release', () => {
    expect(initiativePath('R2', 'novo-checkout')).toBe(`${INITIATIVES_ROOT}/R2/novo-checkout`)
  })

  it('stamps the manifest it writes', () => {
    const manifest = buildManifest('Portal', 2026, 'R2', new Date('2026-09-10T12:00:00Z'))
    expect(manifest).toEqual({
      title: 'Portal',
      year: 2026,
      release: 'R2',
      createdAt: '2026-09-10T12:00:00.000Z',
      // A demand is born with a hue so its conversations are already
      // distinguishable in the history before anyone opens a colour picker.
      color: defaultColorFor('portal')
    })
  })

  it('honours a colour the form picked over the one derived from the name', () => {
    const manifest = buildManifest('Portal', 2026, 'R2', new Date('2026-09-10T12:00:00Z'), 'rose')
    expect(manifest.color).toBe('rose')
  })
})

describe('badge colours', () => {
  it('gives a folder that never picked one a stable hue, derived from its name', () => {
    expect(defaultColorFor('portal-de-cobranca')).toBe(defaultColorFor('portal-de-cobranca'))
    expect(INITIATIVE_COLORS).toContain(defaultColorFor('portal-de-cobranca'))
  })

  it('spreads those defaults across the palette, which is the only reason they are coloured', () => {
    const slugs = ['alpha', 'beta', 'gama', 'delta', 'epsilon', 'zeta', 'eta', 'teta', 'iota']
    // Not "all six" — a hash over nine names need not hit every bucket. The
    // property that matters is that it does not collapse to one.
    expect(new Set(slugs.map(defaultColorFor)).size).toBeGreaterThan(2)
  })

  it('reads a stored colour back', () => {
    expect(readManifest(JSON.stringify({ color: 'amber' })).color).toBe('amber')
  })

  it('drops a colour name nothing defines, rather than resolving to an empty var()', () => {
    expect(readManifest(JSON.stringify({ color: 'fucsia' })).color).toBeUndefined()
    expect(readManifest(JSON.stringify({ color: 7 })).color).toBeUndefined()
  })

  it('recognises exactly the palette', () => {
    expect(isInitiativeColor('violet')).toBe(true)
    expect(isInitiativeColor('mauve')).toBe(false)
    expect(isInitiativeColor(undefined)).toBe(false)
  })

  it('carries the folder’s hue onto the initiative it reads', () => {
    const tree = [dir('R2', 'docs/iniciativas/R2', [dir('portal', 'docs/iniciativas/R2/portal')])]
    const [read] = readInitiatives(tree, { 'docs/iniciativas/R2/portal': { color: 'sky' } }, 2026)
    expect(read.color).toBe('sky')
  })

  it('falls back to the derived hue for a folder with no manifest', () => {
    const tree = [dir('R2', 'docs/iniciativas/R2', [dir('portal', 'docs/iniciativas/R2/portal')])]
    const [read] = readInitiatives(tree, {}, 2026)
    expect(read.color).toBe(defaultColorFor('portal'))
  })
})
