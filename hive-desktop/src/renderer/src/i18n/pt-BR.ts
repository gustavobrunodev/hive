/**
 * Single source of truth for Hive Desktop's UI chrome copy (pt-BR).
 *
 * Scope (design.md §4.1, R1.6): labels, buttons, placeholders, intent prompts,
 * empty/loading/error states, tooltips, toasts, onboarding — our chrome only.
 * Agent replies and BMAD-produced artifacts are OUT of scope: their language
 * is governed by the agent/workflow, not the UI.
 *
 * Components must never inline UI copy — reference keys from here via `t()`
 * (see ./index.ts) instead. Keeps copy consistent, reviewable in one place,
 * and leaves the door open for another locale later without touching
 * components.
 */
export const ptBR = {
  app: {
    title: 'Hive Desktop',
    placeholderDescription:
      'Sistema de design conectado — conteúdo temporário, substituído em tarefas futuras.'
  },
  theme: {
    dark: 'escuro',
    light: 'claro',
    toggle: (current: string) => `Alternar tema (atual: ${current})`
  },
  common: {
    loading: 'Carregando…',
    emptyState: 'Nada por aqui ainda.',
    errorGeneric: 'Algo deu errado. Tente novamente.'
  },
  onboarding: {
    checkingWorkspace: 'Verificando workspace…',
    pickerTitle: 'Nenhum workspace selecionado',
    pickerDescription:
      'Escolha uma pasta no seu computador para usar como workspace do Hive Desktop. É lá que os artefatos do BMAD e dos agentes serão salvos.',
    chooseWorkspaceCta: 'Escolher workspace',
    workspaceReadyDescription: (path: string) => `Workspace: ${path}`
  }
} as const
