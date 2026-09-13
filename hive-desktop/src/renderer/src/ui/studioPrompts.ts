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
 * the lines after it are the briefing the builder acts on.
 *
 * ## Why the briefing has to say "don't ask me again"
 *
 * The studio's whole promise is that the form is the first half of the
 * conversation. What shipped instead: the user filled in the name and the
 * goal, hit "Criar com o Construtor", and the builder answered
 *
 *   > Hi Gustavo — I'm ready to build, edit, or analyze a skill. What's on
 *   > your mind? Share as much as you have: the goal, …
 *
 * for a goal that was two lines above it (measured — the transcript is in
 * `chat-history`). The cause is not transport: the text after the slash line
 * **does** reach the agent, verified against the real `claude` 2.1.226 by
 * invoking a skill that echoes its own arguments, which came back verbatim.
 *
 * The cause is that both builders' activation runs an "Open the floor" step —
 * *"invite the user to share everything they have in mind"* — qualified only
 * by *"skip if the invocation already carries enough to act on"*. A briefing
 * that merely contains the idea leaves that judgement to the model, and the
 * model followed the script. So every creation briefing now **names the
 * intent** (the step above it is "Detect intent"), **declares itself the idea
 * dump**, and **closes the floor by name** — three sentences that turn the
 * builders' own escape hatch from a guess into an instruction.
 *
 * What it deliberately does not do is pass `--headless`. The builders take it,
 * and it would also close the floor — by making the whole build
 * non-interactive, which is the opposite of what this surface promises ("o
 * construtor assume o chat para lapidar os detalhes com você"). The
 * conversation stays; only the question that was already answered goes away.
 *
 * These strings are *sent to the agent* (conversation content, pt-BR per the
 * BMAD install's communication language), not UI chrome — labels/buttons
 * around them stay in `i18n/pt-BR.ts` as usual.
 */

/** Structural mirror of `main/agentAdapter.ts`'s `WorkflowCommand` (renderer-side, same convention as `sidebarNav`'s `RoleAction`). */
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
 * The line that closes the builders' "Open the floor" step.
 *
 * Both builders' activation step 4 invites the user to dump everything they
 * have in mind, "skip[ping] if the invocation already carries enough to act
 * on". This says so in as many words, because leaving it implicit is what made
 * the builder ask for a goal the form had already collected. It also names the
 * intent — the step *above* it is "Detect intent" — and says what to do
 * instead, so closing one question does not read as "stop talking to me": the
 * conversation continues at the beat where the builder confirms the shape and
 * proposes what the idea implies.
 */
function briefingIsTheIdea(what: string): string {
  return (
    `Intenção: criar (Build). Este briefing É o despejo de ideia da ativação — ` +
    `ele vem de um formulário que o usuário já preencheu no Estúdio de skills do Hive. ` +
    `**Não abra a mesa ("Open the floor") e não peça a ideia de novo**: o ${what} ` +
    `está acima. Siga direto para confirmar a forma, propor o que a ideia implica ` +
    `e construir, perguntando só o que o briefing não responde.`
  )
}

/**
 * The creation briefing: skill drafts go to `bmad-workflow-builder`, agent
 * drafts to `bmad-agent-builder`. Both explicitly pin the install location
 * to `.claude/skills/<slug>/` — that's where Claude Code resolves skills
 * from, and where the studio's scanner (main/skillStudio.ts) rediscovers
 * the creation for the gallery, the shortcut catalog, and the slash menu.
 *
 * The closing line is `briefingIsTheIdea`, and the module header explains why
 * a briefing that merely *contains* the idea was not enough.
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

  lines.push('', briefingIsTheIdea(draft.kind === 'agent' ? 'que ele faz' : 'objetivo'))

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

/**
 * Adds evals to an existing skill (it has none yet) via the workflow builder's
 * Edit intent, without touching behavior.
 *
 * Same closing line as a creation, for the same reason: this invocation names
 * the skill, the change and the format, so there is nothing left to open the
 * floor for.
 */
export function buildEvalCreateCommand(skill: { key: string; relPath: string }): StudioCommand {
  return {
    key: 'bmad-workflow-builder',
    prompt: [
      '/bmad-workflow-builder',
      '',
      `Edite a skill existente em \`${skill.relPath}\`: apenas adicione evals, sem alterar o comportamento da skill.`,
      '',
      evalsInstruction(skill.key),
      '',
      `Intenção: editar (Edit). Este briefing É o despejo de ideia da ativação — ` +
        `**não abra a mesa ("Open the floor") e não pergunte no que focar**: a mudança ` +
        `está acima. Leia só a parte da skill que ela toca e siga.`
    ].join('\n')
  }
}
