import { describe, expect, it } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  DATA_ROOT_DIR,
  documentsDir,
  ensureProdutoFolders,
  resolveDataRoot,
  resolveResourcesDir
} from './dataRoot'
import { readCatalogo, readVolumes } from './catalogo'

/**
 * Design Studio — where the module's data lives (Landing 3 and 11).
 *
 * `<raiz>` is the person's Documents folder plus `Design Studio`. The E2E
 * points it somewhere disposable through `HIVE_E2E_DOCUMENTS`, which — same
 * shape as the scripted-agent seam — takes BOTH conditions: the launcher's
 * `HIVE_E2E=1` and the variable itself. The matrix below is that pair, each
 * alone, and neither.
 */

const DOCUMENTS = join('/home', 'marina', 'Documentos')
const E2E_DOCUMENTS = join('/tmp', 'hive-e2e-docs')

describe('designStudio data root', () => {
  it('names the module folder with its display name, space included', () => {
    expect(DATA_ROOT_DIR).toBe('Design Studio')
  })

  it('lives in the Documents folder in production', () => {
    expect(resolveDataRoot(DOCUMENTS, {})).toBe(join(DOCUMENTS, 'Design Studio'))
  })

  it('takes the E2E Documents folder only with the launcher flag on', () => {
    const env = { HIVE_E2E: '1', HIVE_E2E_DOCUMENTS: E2E_DOCUMENTS }
    expect(documentsDir(DOCUMENTS, env)).toBe(E2E_DOCUMENTS)
    // The variable replaces the Documents folder, not the root: the E2E still
    // walks the production shape, `Design Studio` segment and all.
    expect(resolveDataRoot(DOCUMENTS, env)).toBe(join(E2E_DOCUMENTS, 'Design Studio'))
  })

  it('ignores a stray HIVE_E2E_DOCUMENTS without the flag', () => {
    for (const flag of [undefined, '0', 'true']) {
      const env = { HIVE_E2E: flag, HIVE_E2E_DOCUMENTS: E2E_DOCUMENTS }
      expect(resolveDataRoot(DOCUMENTS, env)).toBe(join(DOCUMENTS, 'Design Studio'))
    }
  })

  it('stays on the real Documents when the flag has nothing to redirect to', () => {
    expect(resolveDataRoot(DOCUMENTS, { HIVE_E2E: '1' })).toBe(join(DOCUMENTS, 'Design Studio'))
    expect(resolveDataRoot(DOCUMENTS, { HIVE_E2E: '1', HIVE_E2E_DOCUMENTS: '' })).toBe(
      join(DOCUMENTS, 'Design Studio')
    )
  })

  it('redirects to a folder that does not exist yet — never back to the real Documents', () => {
    const missing = join(E2E_DOCUMENTS, 'ainda-nao-existe')
    expect(resolveDataRoot(DOCUMENTS, { HIVE_E2E: '1', HIVE_E2E_DOCUMENTS: missing })).toBe(
      join(missing, 'Design Studio')
    )
  })

  it('reads process.env when no environment is handed in', () => {
    const before = { flag: process.env.HIVE_E2E, docs: process.env.HIVE_E2E_DOCUMENTS }
    try {
      process.env.HIVE_E2E = '1'
      process.env.HIVE_E2E_DOCUMENTS = E2E_DOCUMENTS
      expect(resolveDataRoot(DOCUMENTS)).toBe(join(E2E_DOCUMENTS, 'Design Studio'))
    } finally {
      if (before.flag === undefined) delete process.env.HIVE_E2E
      else process.env.HIVE_E2E = before.flag
      if (before.docs === undefined) delete process.env.HIVE_E2E_DOCUMENTS
      else process.env.HIVE_E2E_DOCUMENTS = before.docs
    }
  })
})

/**
 * Design Studio — the first opening of the module, and the resources it ships
 * with (criterion 10, Landing 6 and 16).
 */
const APP_ROOT = join(__dirname, '..', '..', '..')

/** Every file under `dir`, relative, with `/`. */
function filesUnder(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    return statSync(full).isDirectory() ? filesUnder(full, rel) : [rel]
  })
}

const TELAS: Array<[string, number, string]> = [
  ['Câmbio', 0, 'Simular'],
  ['Câmbio', 1, 'Revisar'],
  ['Câmbio', 2, 'Beneficiário'],
  ['Câmbio', 3, 'Confirmar'],
  ['Câmbio', 4, 'Acompanhar'],
  ['Câmbio', 5, 'Comprovante'],
  ['Extrato', 0, 'Extrato'],
  ['Extrato', 1, 'Período'],
  ['Extrato', 2, 'Busca'],
  ['Extrato', 3, 'Detalhe'],
  ['Extrato', 4, 'Comprovante'],
  ['Extrato', 5, 'Exportar'],
  ['Pix', 0, 'Área Pix'],
  ['Pix', 1, 'Colar chave'],
  ['Pix', 2, 'Valor'],
  ['Pix', 3, 'Confirmar'],
  ['Pix', 4, 'Agendados'],
  ['Pix', 5, 'Minhas chaves']
]

describe('the first opening of the module', () => {
  const resources = resolveResourcesDir({
    isPackaged: false,
    resourcesPath: '/nada',
    appPath: APP_ROOT
  })
  const catalogo = readCatalogo(resources)

  it('C10a: an empty <raiz> gets the Câmbio, Extrato and Pix folders, and no file under */relatorios', () => {
    const root = join(mkdtempSync(join(tmpdir(), 'hive-ds-raiz-')), 'Design Studio')
    ensureProdutoFolders(root, catalogo.produtos)
    expect(readdirSync(root).sort()).toEqual(['Câmbio', 'Extrato', 'Pix'])
    for (const produto of ['Câmbio', 'Extrato', 'Pix']) {
      expect(statSync(join(root, produto)).isDirectory()).toBe(true)
      expect(filesUnder(join(root, produto))).toEqual([])
    }
    // Opening again changes nothing.
    ensureProdutoFolders(root, catalogo.produtos)
    expect(readdirSync(root).sort()).toEqual(['Câmbio', 'Extrato', 'Pix'])
  })

  it('C10a: the catalog brings exactly the three Produtos, in order', () => {
    expect(catalogo.produtos.map((produto) => produto.nome)).toEqual(['Câmbio', 'Extrato', 'Pix'])
    expect(catalogo.produtos.map((produto) => produto.telas.length)).toEqual([6, 6, 6])
  })

  it.each(TELAS)('C10a: %s, screen %i of the journey is %s', (produto, index, tela) => {
    expect(catalogo.produtos.find((entry) => entry.nome === produto)?.telas[index]).toBe(tela)
  })

  it('leaves a Produto it cannot create for the next opening', () => {
    const base = mkdtempSync(join(tmpdir(), 'hive-ds-raiz-'))
    writeFileSync(join(base, 'arquivo'), 'x')
    expect(() => ensureProdutoFolders(join(base, 'arquivo'), catalogo.produtos)).not.toThrow()
  })

  it('refuses a catalog file in another format', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-ds-catalogo-'))
    writeFileSync(
      join(dir, 'catalogo.json'),
      JSON.stringify({ formato: 'catalogo/2', produtos: [] })
    )
    expect(() => readCatalogo(dir)).toThrow(/catalogo\/1/)
  })
})

describe('the module resources', () => {
  /** What every assembly must carry: the catalog, nine data files and three skills. */
  const EXPECTED = [
    'catalogo.json',
    ...['cambio', 'extrato', 'pix'].flatMap((produto) =>
      ['likert', 'voz', 'fullstory'].map((fonte) => `dados-de-exemplo/${produto}/${fonte}.json`)
    ),
    ...['likert', 'voz', 'fullstory'].flatMap((fonte) => [
      `skills/relatorio-${fonte}/SKILL.md`,
      `skills/relatorio-${fonte}/scripts/relatorio.mjs`,
      `skills/relatorio-${fonte}/scripts/comum.mjs`
    ])
  ].sort()

  it('C10b: resolves inside app.asar.unpacked when packaged, and under the app root otherwise', () => {
    const resourcesPath = join('/opt', 'Hive', 'resources')
    expect(
      resolveResourcesDir({
        isPackaged: true,
        resourcesPath,
        appPath: join(resourcesPath, 'app.asar')
      })
    ).toBe(join(resourcesPath, 'app.asar.unpacked', 'resources', 'design-studio'))
    expect(resolveResourcesDir({ isPackaged: false, resourcesPath, appPath: APP_ROOT })).toBe(
      join(APP_ROOT, 'resources', 'design-studio')
    )
  })

  it('C10b: the unpackaged directory carries the catalog, the 9 data files and the 3 skills', () => {
    const dir = resolveResourcesDir({
      isPackaged: false,
      resourcesPath: '/nada',
      appPath: APP_ROOT
    })
    expect(filesUnder(dir).sort()).toEqual(EXPECTED)
  })

  it('C10b: the packaged directory carries the same — resources/** is packed and unpacked out of the asar', () => {
    // The packaged tree is electron-builder's copy of `<app>/resources/**`
    // into `app.asar.unpacked/resources/**`; both lists have to name it, on
    // every platform block, or the packaged directory is empty.
    const builder = readFileSync(join(APP_ROOT, 'electron-builder.yml'), 'utf-8')
    const files = builder.match(/^ {2,4}- 'resources\/\*\*'$/gm) ?? []
    expect(files.length).toBeGreaterThanOrEqual(1)
    expect(builder).toMatch(/^asarUnpack:\n {2}- resources\/\*\*$/m)
    for (const file of EXPECTED)
      expect(existsSync(join(APP_ROOT, 'resources', 'design-studio', file))).toBe(true)
  })
})

describe('the sample data volumes', () => {
  it('reads the volume every data file declares, by Produto name and Fonte', () => {
    const resources = resolveResourcesDir({
      isPackaged: false,
      resourcesPath: '/nada',
      appPath: APP_ROOT
    })
    const volumes = readVolumes(resources, readCatalogo(resources))
    expect(volumes['Extrato']).toEqual({ likert: 18240, voz: 4870, fullstory: 212400 })
    expect(volumes['Câmbio']?.voz).toBe(3205)
  })

  it('counts nothing for a file that is missing or declares no volume', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-ds-volumes-'))
    const catalogo = readCatalogo(
      resolveResourcesDir({ isPackaged: false, resourcesPath: '/nada', appPath: APP_ROOT })
    )
    mkdirSync(join(dir, 'dados-de-exemplo', 'pix'), { recursive: true })
    writeFileSync(
      join(dir, 'dados-de-exemplo', 'pix', 'voz.json'),
      JSON.stringify({ formato: 'x' })
    )
    const volumes = readVolumes(dir, catalogo)
    expect(volumes['Pix']).toEqual({})
    expect(volumes['Câmbio']).toEqual({})
  })
})
