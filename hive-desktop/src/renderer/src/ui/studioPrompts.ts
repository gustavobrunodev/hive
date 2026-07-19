/**
 * Prompt composition for the Skill Studio (skill-studio) — the briefings the
 * studio hands to the BMAD builder skills through the normal chat-turn path.
 *
 * Everything the studio "does" is a conversation: creating a skill launches
 * `/bmad-workflow-builder`, creating an agent launches `/bmad-agent-builder`,
 * and evals go through `/bmad-eval-runner` — the same skills a CLI user
 * would drive by hand, so the transcript stays honest about what ran. The
 * first line of each prompt is the slash invocation (Claude Code resolves a
 * leading-slash prompt as a skill invocation — the roleCatalog contract);
 * the lines after it are the briefing the builder opens the floor with.
 *
 * These strings are *sent to the agent* (conversation content, pt-BR per the
 * BMAD install's communication language), not UI chrome — labels/buttons
 * around them stay in `i18n/pt-BR.ts` as usual.
 */

/** Structural mirror of `main/agentAdapter.ts`'s `WorkflowCommand` (renderer-side, same convention as `ActionRail`'s `RoleAction`). */
export interface StudioCommand {
  key: string
  prompt: string
}

/** What the studio's create form collects before handing off to a builder. */
export interface SkillDraft {
  kind: 'skill' | 'agent'
  /** Human name ("Revisor de Release Notes", "Clara"). */
  name: string
  /** The user's free-form goal/idea — the heart of the briefing. */
  idea: string
  /** Agent only: the specialist's first name; falls back to `name`. */
  persona?: string
  /** Whether the briefing asks the builder to also generate starter evals. */
  withEvals: boolean
}

/**
 * Directory-safe slug from a human name: lowercased, accents folded, spaces
 * to hyphens, anything else dropped. "Revisor de Notas" → "revisor-de-notas".
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The eval-format instruction shared by creation and add-evals briefings. */
function evalsInstruction(slug: string): string {
  return (
    `Ao final, gere também um conjunto inicial de evals em ` +
    `\`.claude/skills/${slug}/evals/cases.json\`, no formato do bmad-eval-runner: ` +
    `um array de casos com \`id\`, \`input\` realista e \`rubric\` com expectativas ` +
    `discriminantes (uma saída errada não pode passar).`
  )
}

/**
 * The creation briefing: skill drafts go to `bmad-workflow-builder`, agent
 * drafts to `bmad-agent-builder`. Both explicitly pin the install location
 * to `.claude/skills/<slug>/` — that's where Claude Code resolves skills
 * from, and where the studio's scanner (main/skillStudio.ts) rediscovers
 * the creation for the gallery, the shortcut catalog, and the slash menu.
 */
export function buildCreationCommand(draft: SkillDraft): StudioCommand {
  const slug = slugify(draft.name) || 'nova-skill'
  const lines: string[] = []

  if (draft.kind === 'agent') {
    const persona = draft.persona?.trim() || draft.name.trim()
    lines.push(
      '/bmad-agent-builder',
      '',
      `Crie um novo agente chamado "${persona}" (Agent Skill, diretório \`${slug}\`).`,
      '',
      `Especialidade: ${draft.idea.trim()}`,
      '',
      `Crie o agente em \`.claude/skills/${slug}/\` (SKILL.md com frontmatter \`name\` e \`description\`). ` +
        `A \`description\` deve incluir a frase "Use when the user asks to talk to ${persona}" — ` +
        `é assim que o Hive reconhece o agente e oferece "Conversar com ${persona}" nos atalhos.`
    )
  } else {
    lines.push(
      '/bmad-workflow-builder',
      '',
      `Crie uma nova skill chamada "${draft.name.trim()}" (diretório \`${slug}\`).`,
      '',
      `Objetivo: ${draft.idea.trim()}`,
      '',
      `Crie a skill em \`.claude/skills/${slug}/\` (SKILL.md com frontmatter \`name\` e ` +
        `\`description\`; a descrição deve deixar claro quando a skill é ativada).`
    )
  }

  if (draft.withEvals) {
    lines.push('', evalsInstruction(slug))
  }

  return {
    key: draft.kind === 'agent' ? 'bmad-agent-builder' : 'bmad-workflow-builder',
    prompt: lines.join('\n')
  }
}

/** Runs an existing skill's evals: `/bmad-eval-runner <skill path>` — the runner's own positional-arg contract. */
export function buildEvalRunCommand(skill: { relPath: string }): StudioCommand {
  return {
    key: 'bmad-eval-runner',
    prompt: `/bmad-eval-runner ${skill.relPath}`
  }
}

/** Adds evals to an existing skill (it has none yet) via the workflow builder's Edit intent, without touching behavior. */
export function buildEvalCreateCommand(skill: { key: string; relPath: string }): StudioCommand {
  return {
    key: 'bmad-workflow-builder',
    prompt: [
      '/bmad-workflow-builder',
      '',
      `Edite a skill existente em \`${skill.relPath}\`: apenas adicione evals, sem alterar o comportamento da skill.`,
      '',
      evalsInstruction(skill.key)
    ].join('\n')
  }
}
