import { describe, expect, it } from 'vitest'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { readRelatorio } from './relatorioFormato'

/**
 * Design Studio — the report skills, run for real (criterion 11, Landing 16).
 *
 * The sample data are raw weighted rows, not ranked Dores; the skill's script
 * groups, ranks and picks the Evidências. So the claim is about the script:
 * over the sample data, the Dor the briefing seeded lands in the top five of a
 * ranking of at least six — among the noise around it.
 */

const RESOURCES = join(__dirname, '..', '..', '..', 'resources', 'design-studio')

/** Runs a Fonte's script, from a fresh Produto folder, the way the agent does. */
function runSkill(
  produtoId: string,
  produto: string,
  fonte: string
): ReturnType<typeof spawnSync> & { saida: string } {
  const cwd = join(mkdtempSync(join(tmpdir(), 'hive-skill-')), produto)
  mkdirSync(join(cwd, 'relatorios', fonte), { recursive: true })
  const saida = join('relatorios', fonte, '.2026-10-04-90d.md.parcial')
  const result = spawnSync(
    process.execPath,
    [
      join(RESOURCES, 'skills', `relatorio-${fonte}`, 'scripts', 'relatorio.mjs'),
      '--dados',
      join(RESOURCES, 'dados-de-exemplo', produtoId, `${fonte}.json`),
      '--saida',
      saida,
      '--agente',
      'Claude',
      '--modelo',
      'sonnet'
    ],
    { cwd, encoding: 'utf-8' }
  )
  return Object.assign(result, { saida: join(cwd, saida) })
}

describe('the report skills over the sample data', () => {
  it.each([
    [
      'Likert de Extrato',
      'extrato',
      'Extrato',
      'likert',
      'Não consigo ver o histórico maior que 90 dias'
    ],
    [
      'Voz do Cliente de Câmbio',
      'cambio',
      'Câmbio',
      'voz',
      'Minha transação de câmbio estornou e não recebi nenhuma notificação'
    ],
    [
      'FullStory de Câmbio',
      'cambio',
      'Câmbio',
      'fullstory',
      'Rage click no botão Confirmar remessa'
    ]
  ])(
    'C11: %s ranks the seeded Dor in the top five, among at least six',
    (_par, produtoId, produto, fonte, titulo) => {
      const result = runSkill(produtoId, produto, fonte)
      expect(result.status, String(result.stderr)).toBe(0)

      const leitura = readRelatorio(
        readFileSync(result.saida, 'utf-8'),
        `${produto}/relatorios/${fonte}/x.md`
      )
      expect(leitura.ok).toBe(true)
      if (!leitura.ok) return
      const { dores } = leitura.relatorio
      expect(dores.length).toBeGreaterThanOrEqual(6)
      // The ranking is by volume, rank 1 first.
      expect(dores.map((dor) => dor.rank)).toEqual(dores.map((_, i) => i + 1))
      for (let i = 1; i < dores.length; i += 1) {
        expect(dores[i - 1].volume).toBeGreaterThanOrEqual(dores[i].volume)
      }
      const seeded = dores.find((dor) => dor.titulo === titulo)
      expect(seeded, `"${titulo}" not in the ranking`).toBeDefined()
      expect(seeded!.rank).toBeLessThanOrEqual(5)

      if (fonte === 'fullstory') {
        expect(seeded!.tela).toBe('Confirmar')
        expect(seeded!.sinal).toBe('Rage click')
        expect(seeded!.evidencias.length).toBeGreaterThan(0)
        for (const evidencia of seeded!.evidencias) {
          expect(evidencia.elemento).toBe('Botão “Confirmar remessa”')
          expect(evidencia.sinal).toBe('Rage click')
        }
      }
    }
  )

  it.each(['likert', 'voz', 'fullstory'])(
    'every Produto × %s comes out in the format, with the Evidências in its shape',
    (fonte) => {
      for (const [produtoId, produto] of [
        ['cambio', 'Câmbio'],
        ['extrato', 'Extrato'],
        ['pix', 'Pix']
      ]) {
        const result = runSkill(produtoId, produto, fonte)
        expect(result.status, String(result.stderr)).toBe(0)
        const leitura = readRelatorio(readFileSync(result.saida, 'utf-8'), 'x')
        expect(leitura.ok, `${produto}/${fonte}`).toBe(true)
        if (!leitura.ok) continue
        const r = leitura.relatorio
        expect(r.produto).toBe(produto)
        expect(r.fonte).toBe(fonte)
        expect(r.periodo.dias).toBe(90)
        expect(r.geradoPor).toEqual({ agente: 'Claude', modelo: 'sonnet' })
        expect(r.narrativa.length).toBeGreaterThanOrEqual(2)
        expect(r.categorias.length).toBeGreaterThan(0)
        const evidencia = r.dores[0].evidencias[0]
        if (fonte === 'likert')
          expect(evidencia).toMatchObject({ nota: expect.any(Number), texto: expect.any(String) })
        if (fonte === 'voz') {
          expect(evidencia.trechos?.length).toBeGreaterThan(0)
          expect(evidencia.motivo).toEqual(expect.any(String))
          expect(r.dores[0].rechamada).toEqual(expect.any(Number))
        }
        if (fonte === 'fullstory')
          expect(evidencia).toMatchObject({
            dispositivo: expect.any(String),
            momento: expect.any(String)
          })
        // The last step is announced: the draft is written.
        expect(JSON.parse(readFileSync(`${result.saida}.progresso`, 'utf-8'))).toEqual({ passo: 4 })
      }
    }
  )

  it('refuses to write outside the Produto’s relatorios folder', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'hive-skill-'))
    const result = spawnSync(
      process.execPath,
      [
        join(RESOURCES, 'skills', 'relatorio-likert', 'scripts', 'relatorio.mjs'),
        '--dados',
        join(RESOURCES, 'dados-de-exemplo', 'pix', 'likert.json'),
        '--saida',
        join('..', 'fora.md')
      ],
      { cwd, encoding: 'utf-8' }
    )
    expect(result.status).toBe(2)
    expect(existsSync(join(cwd, '..', 'fora.md'))).toBe(false)
  })

  it('keeps the three skills’ shared core byte-for-byte the same', () => {
    const copies = ['likert', 'voz', 'fullstory'].map((fonte) =>
      readFileSync(join(RESOURCES, 'skills', `relatorio-${fonte}`, 'scripts', 'comum.mjs'), 'utf-8')
    )
    expect(copies[1]).toBe(copies[0])
    expect(copies[2]).toBe(copies[0])
  })
})
