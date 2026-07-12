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
    pickerTitle: 'Bem-vindo ao Hive',
    pickerDescription:
      'Escolha uma pasta no seu computador para ser o seu workspace — é nela que o BMAD e os agentes vão trabalhar e salvar os artefatos do seu projeto.',
    pickerNote: 'Na primeira vez, o BMAD será instalado automaticamente no workspace escolhido.',
    chooseWorkspaceCta: 'Escolher workspace'
  },
  explorer: {
    paneTitle: 'Arquivos',
    treeLoading: 'Carregando arquivos…',
    treeErrorTitle: 'Não foi possível carregar os arquivos',
    treeErrorDescription: 'Tente novamente ou verifique se o workspace ainda existe.',
    treeEmptyTitle: 'Nenhum arquivo ainda',
    treeEmptyDescription: 'Os arquivos criados no workspace vão aparecer aqui.',
    treeAriaLabel: 'Arquivos do workspace',
    viewerCloseLabel: 'Fechar arquivo',
    viewerLoading: 'Carregando conteúdo…',
    viewerErrorTitle: 'Não foi possível abrir o arquivo',
    viewerErrorDescription: 'Tente selecionar o arquivo novamente.',
    copyLabel: 'Copiar conteúdo',
    copiedLabel: 'Copiado',

    // T8 — create/rename/delete/move/import actions (FM-R1, R3, R4, R5, R7)
    newFileLabel: 'Novo arquivo',
    newFolderLabel: 'Nova pasta',
    newItemPlaceholder: 'Nome do arquivo ou pasta',
    renamePlaceholder: 'Novo nome',
    rowMenuLabel: (name: string) => `Mais ações para ${name}`,
    menuNewFile: 'Novo arquivo',
    menuNewFolder: 'Nova pasta',
    menuRename: 'Renomear',
    menuDelete: 'Excluir',
    deleteDialogTitle: 'Mover para a Lixeira?',
    deleteDialogDescription: (name: string) =>
      `"${name}" será movido para a lixeira do sistema. Você pode recuperá-lo por lá.`,
    // T9 — bulk delete (UX-R5.1): confirm dialog wording for a >1 selection.
    deleteManyDescription: (count: number) =>
      `${count} itens serão movidos para a lixeira do sistema. Você pode recuperá-los por lá.`,
    deleteConfirmCta: 'Mover para a lixeira',
    deleteCancelCta: 'Cancelar',
    conflictDialogTitle: 'Já existe um item com esse nome',
    conflictDialogDescription: (name: string) =>
      `Já existe um item chamado "${name}" neste local. O que você quer fazer?`,
    conflictOverwriteCta: 'Substituir',
    conflictRenameCta: 'Renomear',
    conflictCancelCta: 'Cancelar',
    actionErrorMessage: 'Não foi possível concluir a ação. Tente novamente.',

    // T9 — editor edit/save/dirty/STALE (FM-R2)
    editLabel: 'Editar',
    viewLabel: 'Visualizar',
    editorAriaLabel: 'Conteúdo do arquivo',
    dirtyLabel: 'Alterações não salvas',
    saveCta: 'Salvar',
    discardCta: 'Descartar',
    staleDialogTitle: 'O arquivo mudou no disco',
    staleDialogDescription:
      'Alguém (ou algum agente) alterou este arquivo desde que você o abriu. O que você quer fazer?',
    staleReloadCta: 'Recarregar',
    staleOverwriteCta: 'Sobrescrever',
    unsavedGuardTitle: 'Alterações não salvas',
    unsavedGuardDescription: 'Este arquivo tem alterações não salvas. O que você quer fazer?',
    unsavedGuardCancelCta: 'Cancelar',
    unsavedGuardConfirmCta: 'Descartar alterações',
    unsavedGuardSaveCta: 'Salvar',

    // T4 — HTML live preview (UX-R8)
    htmlPreviewLabel: 'Pré-visualização do HTML'
  },
  guidedInstall: {
    title: 'Preparando seu workspace',
    description: 'Estamos instalando o BMAD no workspace escolhido. Isso leva só um instante.',
    progressLabel: 'Instalando…',
    errorTitle: 'Não foi possível concluir a instalação',
    errorDescriptionFallback: 'Algo deu errado durante a instalação do BMAD.',
    retryCta: 'Tentar novamente',
    // Guided configuration form shown before the install runs (BUG 1): the
    // CLI's interactive questions abstracted into the app's own visual flow.
    form: {
      title: 'Configurar o BMAD',
      description:
        'Escolha o que instalar e como os agentes devem se comunicar. Você pode reinstalar depois para ajustar.',
      modulesLegend: 'Módulos',
      modulesHint: 'O BMad Core é sempre instalado. Selecione os módulos adicionais que quiser.',
      identityLegend: 'Sobre você',
      userNameLabel: 'Como os agentes devem te chamar?',
      userNamePlaceholder: 'Seu nome ou o nome do time',
      communicationLanguageLabel: 'Idioma da conversa com os agentes',
      documentOutputLanguageLabel: 'Idioma dos documentos gerados',
      skillLevelLabel: 'Seu nível de experiência em desenvolvimento',
      skillLevelHint: 'Afeta como os agentes explicam conceitos no chat.',
      modulesRequiredError: 'Selecione ao menos um módulo para continuar.',
      submitCta: 'Instalar BMAD'
    }
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
    loadingCapabilities: 'Carregando opções do agente…',
    composerHint: 'Enter envia · Shift+Enter quebra a linha'
  },
  intentGrid: {
    title: 'O que você quer fazer hoje?',
    description: 'Escreva sua mensagem ou comece por um fluxo guiado do BMAD.',
    plannedBadge: 'Em breve'
  },
  workUI: {
    resizeHandleLabel: 'Redimensionar painéis',
    workspaceChipTitle: (path: string) => `Workspace ativo: ${path}`,
    /** T7 (WS-R1.2/R7.1): workspace chip menu — "Abrir pasta…" entry. */
    openFolder: 'Abrir pasta…',
    /** T7 (WS-R1.2/R1.3/R7.1): workspace chip menu — Recentes section heading. */
    recents: 'Recentes'
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
  'domain-research': 'Pesquisar um domínio',
  brainstorm: 'Fazer um brainstorm',
  architecture: 'Definir a arquitetura',
  story: 'Criar uma história'
}

/** Resolves an intent's pt-BR label by `WorkflowEntry.key`, falling back to the key itself for an unrecognized/discovered-at-runtime entry. */
export function intentLabel(key: string): string {
  return intentLabelsPtBR[key] ?? key
}
