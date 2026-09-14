import { describe, expect, it } from 'vitest'
import { PHASES, STAGES, resolveStages, stageAction, stagesDone } from './initiativeStages'

/** The stage ids, in the order the tracker draws them. */
const IDS = STAGES.map((stage) => stage.id)

function statusOf(files: string[]): Record<string, string> {
  return Object.fromEntries(resolveStages(files).map((state) => [state.id, state.status]))
}

function artifactOf(files: string[]): Record<string, string | null> {
  return Object.fromEntries(resolveStages(files).map((state) => [state.id, state.artifact]))
}

describe('resolveStages', () => {
  it('points at the first REQUIRED stage on a demand with nothing in it', () => {
    const states = resolveStages([])
    // Not `research`: the first two stages are optional, and nobody is behind
    // on a demand for not having brainstormed one that arrived fully written.
    expect(states.find((state) => state.status === 'active')?.id).toBe('prd')
    expect(states.filter((state) => state.status === 'active')).toHaveLength(1)
  })

  it('never points at an optional stage, whatever is missing before it', () => {
    for (const files of [[], ['prd.md'], ['prd.md', 'arquitetura.md']]) {
      const active = resolveStages(files).find((state) => state.status === 'active')
      expect(active?.optional).toBe(false)
    }
  })

  it('marks a stage done from the artifact it produced, and names the file', () => {
    const [research] = resolveStages(['pesquisa-dominio.md'])
    expect(research.status).toBe('done')
    expect(research.artifact).toBe('pesquisa-dominio.md')
  })

  it("recognises BMAD's English filenames and the team's Portuguese ones alike", () => {
    expect(statusOf(['domain-research.md']).research).toBe('done')
    expect(statusOf(['pesquisa-de-dominio.md']).research).toBe('done')
    expect(statusOf(['architecture.md']).architecture).toBe('done')
    expect(statusOf(['arquitetura.md']).architecture).toBe('done')
    expect(statusOf(['epicos.md']).epics).toBe('done')
    expect(statusOf(['epics.md']).epics).toBe('done')
  })

  it('counts stories from a folder with something in it, not from a file', () => {
    expect(statusOf(['historias/h-1.md']).stories).toBe('done')
    expect(statusOf(['stories/story-1.md']).stories).toBe('done')
    expect(statusOf(['historias.md']).stories).toBe('pending')
  })

  it('finds an artifact BMAD wrote into a subfolder', () => {
    expect(statusOf(['saida/prd.md']).prd).toBe('done')
  })

  it('leaves exactly one stage active — the first unfinished required one', () => {
    const states = resolveStages(['prd.md', 'brainstorming.md'])
    expect(states.filter((state) => state.status === 'active')).toHaveLength(1)
    expect(states.find((state) => state.status === 'active')?.id).toBe('architecture')
  })

  it('still credits a stage that ran out of order; it just does not get to be the arrow', () => {
    const states = statusOf(['architecture.md'])
    expect(states.architecture).toBe('done')
    expect(states.prd).toBe('active')
    expect(states['test-design']).toBe('pending')
  })

  // These two are about *matching*, so they read the artifact rather than the
  // status: PRD is the first required stage, so a file it does not match leaves
  // it `active` (the arrow) rather than `pending`, and asserting on the status
  // would be asserting on where the arrow landed instead.
  it('does not mistake a name that merely contains a stage word', () => {
    expect(artifactOf(['notas-sobre-o-prd.md']).prd).toBeNull()
    expect(artifactOf(['prd-v2.md']).prd).toBe('prd-v2.md')
  })

  it('ignores a non-markdown file with the right stem', () => {
    expect(artifactOf(['prd.docx']).prd).toBeNull()
  })

  it("takes bmad-ux's DESIGN.md for the UX stage, and the team's own spellings too", () => {
    expect(statusOf(['DESIGN.md']).ux).toBe('done')
    expect(statusOf(['ux-design.md']).ux).toBe('done')
    expect(statusOf(['especificacao-ux.md']).ux).toBe('done')
  })

  it('keeps the Portuguese test-design name away from the UX stage', () => {
    // Both stages answer to the word "design", and `design-de-testes.md` is the
    // name a Portuguese-speaking team gives the test plan. Matching it as UX
    // would light a row for work nobody did — two stages, one file.
    const states = statusOf(['design-de-testes.md'])
    expect(states['test-design']).toBe('done')
    expect(states.ux).toBe('pending')
  })

  it('counts what is finished', () => {
    expect(stagesDone(resolveStages([]))).toBe(0)
    expect(stagesDone(resolveStages(['prd.md', 'arquitetura.md']))).toBe(2)
  })
})

describe('stageAction', () => {
  it('launches the skill as a slash command, so the transcript shows what ran', () => {
    const action = stageAction('bmad-prd', 'Portal de Cobrança', 'docs/iniciativas/R2/portal')
    expect(action.key).toBe('bmad-prd')
    expect(action.kind).toBe('workflow')
    expect(action.command.prompt?.startsWith('/bmad-prd ')).toBe(true)
  })

  it('carries the folder, which is the one thing the skill cannot work out for itself', () => {
    const action = stageAction('bmad-prd', 'Portal', 'docs/iniciativas/R2/portal')
    expect(action.command.prompt).toContain('docs/iniciativas/R2/portal')
    expect(action.command.prompt).toContain('Portal')
  })

  it('asks for the folder’s artifacts ON DEMAND, not as an upfront read', () => {
    const action = stageAction('bmad-prd', 'Testes', 'docs/iniciativas/R1/testes')
    // A stage that opens every artifact before it starts spends the context
    // window on documents it may never need. The choice belongs to the skill,
    // which is the only thing that knows what it is about to do.
    expect(action.command.prompt).toContain('sob demanda quando necessário')
    expect(action.command.prompt).not.toContain('grave a saída')
  })

  it('keeps the invocation on one line so the command and its argument stay together', () => {
    const action = stageAction('bmad-architecture', 'Novo checkout', 'docs/iniciativas/R1/checkout')
    expect(action.command.prompt).not.toContain('\n')
  })
})

describe('the catalogue itself', () => {
  it('offers the eight stages, in the order they are worked', () => {
    expect(IDS).toEqual([
      'research',
      'brainstorm',
      'prd',
      'ux',
      'architecture',
      'test-design',
      'epics',
      'stories'
    ])
  })

  it('groups them into the four phases, without reordering them', () => {
    expect(STAGES.map((stage) => stage.phase)).toEqual([
      'analysis',
      'analysis',
      'planning',
      'planning',
      'solution',
      'solution',
      'solution',
      'implementation'
    ])
  })

  it('declares every phase it uses, so no stage can land in a chapter that never draws', () => {
    for (const stage of STAGES) expect(PHASES).toContain(stage.phase)
  })

  it('marks exactly the three stages a demand is free to skip', () => {
    expect(STAGES.filter((stage) => stage.optional).map((stage) => stage.id)).toEqual([
      'research',
      'brainstorm',
      'ux'
    ])
  })

  it('points every stage at a real BMAD skill name', () => {
    for (const stage of STAGES) expect(stage.skill.startsWith('bmad-')).toBe(true)
  })
})
