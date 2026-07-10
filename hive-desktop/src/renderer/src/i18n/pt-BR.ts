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
    chooseWorkspaceCta: 'Escolher workspace'
  },
  explorer: {
    treeLoading: 'Carregando arquivos…',
    treeErrorTitle: 'Não foi possível carregar os arquivos',
    treeErrorDescription: 'Tente novamente ou verifique se o workspace ainda existe.',
    treeEmptyTitle: 'Nenhum arquivo ainda',
    treeEmptyDescription: 'Os arquivos criados no workspace vão aparecer aqui.',
    treeAriaLabel: 'Arquivos do workspace',
    viewerEmptyTitle: 'Nenhum arquivo selecionado',
    viewerEmptyDescription: 'Selecione um arquivo na árvore ao lado para visualizar o conteúdo.',
    viewerLoading: 'Carregando conteúdo…',
    viewerErrorTitle: 'Não foi possível abrir o arquivo',
    viewerErrorDescription: 'Tente selecionar o arquivo novamente.',
    copyLabel: 'Copiar',
    copiedLabel: 'Copiado'
  },
  guidedInstall: {
    title: 'Preparando seu workspace',
    description: 'Estamos instalando o BMAD no workspace escolhido. Isso leva só um instante.',
    progressLabel: 'Instalando…',
    errorTitle: 'Não foi possível concluir a instalação',
    errorDescriptionFallback: 'Algo deu errado durante a instalação do BMAD.',
    retryCta: 'Tentar novamente'
  },
  updateGate: {
    title: 'Atualizando o BMAD',
    description: 'Verificando se há atualizações do BMAD para este workspace.',
    progressLabel: 'Atualizando…',
    errorTitle: 'Não foi possível atualizar o BMAD',
    errorDescriptionFallback: 'Algo deu errado durante a atualização do BMAD.',
    retryCta: 'Tentar novamente',
    continueAnywayCta: 'Continuar mesmo assim'
  },
  chat: {
    promptPlaceholder: 'Escreva uma mensagem…',
    sendLabel: 'Enviar',
    typingLabel: 'O agente está respondendo',
    modelLabel: 'Modelo',
    effortLabel: 'Esforço',
    jumpToLatestLabel: 'Ir para a última mensagem',
    errorMessage: (message: string) => `Não foi possível concluir a resposta: ${message}`,
    loadingCapabilities: 'Carregando opções do agente…'
  },
  intentGrid: {
    title: 'O que você quer fazer hoje?',
    description: 'Escolha um ponto de partida guiado pelo BMAD.',
    plannedBadge: 'Em breve'
  },
  workUI: {
    resizeHandleLabel: 'Redimensionar painéis'
  }
} as const

/**
 * Intent labels keyed by `WorkflowEntry.key` (workflowCatalog.ts) — our
 * chrome's button labels, not agent/BMAD-produced content, so R1.6 applies:
 * pt-BR, not `WorkflowEntry.label`'s English catalog value. Kept as a
 * sibling export (not nested inside `ptBR`) rather than a `Record<string,
 * string>` leaf inside it: `t()`'s `PathsOf` type walks every leaf of
 * `ptBR` to build its literal path union, and an open-ended string-indexed
 * record leaf would widen that union to plain `string`, silently defeating
 * `t()`'s compile-time key-checking for every other call site. Resolved via
 * the dedicated `intentLabel()` helper below instead.
 */
const intentLabelsPtBR: Record<string, string> = {
  prd: 'Criar um PRD',
  'domain-research': 'Pesquisa de domínio',
  brainstorm: 'Brainstorm',
  architecture: 'Arquitetura',
  story: 'Criar uma história'
}

/** Resolves an intent's pt-BR label by `WorkflowEntry.key`, falling back to the key itself for an unrecognized/discovered-at-runtime entry. */
export function intentLabel(key: string): string {
  return intentLabelsPtBR[key] ?? key
}
