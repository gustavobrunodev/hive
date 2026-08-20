/**
 * Single source of truth for Hive's UI chrome copy (pt-BR).
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
/**
 * Writes a keyboard chord the way the host OS writes it.
 *
 * macOS renders modifiers as unspaced glyphs (⇧⌥C); Windows and Linux spell
 * them out with `+` separators. Only the notation changes — the chord itself
 * is the same one the Explorer binds, and the Ctrl→⌘ mapping matches what the
 * key handler does (it accepts `metaKey` wherever it accepts `ctrlKey`).
 */
function chordLabel(chord: string, platform: string): string {
  if (platform !== 'darwin') return chord
  // Apple's own order is ⌃⌥⇧⌘key regardless of how the chord was written, so
  // the parts are re-sorted rather than substituted in place: "Ctrl+Shift+C"
  // has to come out ⇧⌘C, not ⌘⇧C.
  const GLYPH: Record<string, string> = { Ctrl: '⌘', Alt: '⌥', Shift: '⇧' }
  const ORDER = ['⌃', '⌥', '⇧', '⌘']
  const parts = chord.split('+')
  const modifiers = parts
    .slice(0, -1)
    .map((part) => GLYPH[part] ?? part)
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  return `${modifiers.join('')}${parts[parts.length - 1] ?? ''}`
}

export const ptBR = {
  app: {
    title: 'Hive',
    placeholderDescription:
      'Sistema de design conectado — conteúdo temporário, substituído em tarefas futuras.'
  },
  theme: {
    pickerLabel: 'Aparência',
    pickerLabelWithCurrent: (current: string) => `Aparência (atual: ${current})`,
    dark: 'Escuro',
    darkHint: 'Grafite neutro, para horas de leitura',
    light: 'Claro',
    lightHint: 'Para ambientes bem iluminados',
    hive: 'Hive',
    hiveHint: 'Escuro, nas cores da marca'
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
    chooseWorkspaceCta: 'Escolher workspace',
    // Provisioning gate (install/update → bases de conhecimento): one continuous
    // preparation, so the screens say how many steps are left instead of
    // flashing past as three unrelated loading screens.
    stageLabel: (current: number, total: number) => `Etapa ${current} de ${total}`
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

    // file-clipboard: the cut/copy/paste group, in the order every file
    // manager puts it in.
    menuCut: 'Recortar',
    menuCopy: 'Copiar',
    menuPaste: 'Colar',

    /**
     * The keyboard hints shown at the right edge of the file menus.
     *
     * Notation rather than prose, but still per-OS: macOS writes a chord as
     * unspaced glyphs (⇧⌥C) and every other desktop spells the modifiers out
     * (Shift+Alt+C). Showing a Mac user "Ctrl+X" for a shortcut that is
     * really ⌘X is the "Electron-app jank" PRODUCT.md lists as an
     * anti-reference — the menu would be describing a key they do not have.
     */
    keyCut: (platform: string): string => chordLabel('Ctrl+X', platform),
    keyCopy: (platform: string): string => chordLabel('Ctrl+C', platform),
    keyPaste: (platform: string): string => chordLabel('Ctrl+V', platform),
    keyRename: (): string => 'F2',
    keyDelete: (platform: string): string => (platform === 'darwin' ? '⌘⌫' : 'Delete'),
    keyCopyPath: (platform: string): string => chordLabel('Shift+Alt+C', platform),
    keyCopyRelativePath: (platform: string): string =>
      `${chordLabel('Ctrl+K', platform)} ${chordLabel('Ctrl+Shift+C', platform)}`,

    /**
     * The pending-clipboard tray under the toolbar. A cut you forget about is
     * the classic file-manager trap — the rows dim, and nothing else on
     * screen says why or offers a way out. This names the pending set, names
     * where it would land, and can be dismissed.
     */
    clipboardTrayLabel: (mode: string, count: number): string =>
      mode === 'cut'
        ? count > 1
          ? `${count} itens recortados`
          : '1 item recortado'
        : count > 1
          ? `${count} itens copiados`
          : '1 item copiado',
    /**
     * What the tray actually *prints*, as opposed to what it announces.
     *
     * The rail is ~240px wide and the tray has four things to fit, so the
     * sentence above is the accessible name and this is the visible text: for
     * one entry the name itself (more useful than "1 item recortado" — it
     * says *which*), for several the count alone, since the scissors/copy
     * glyph beside it already carries the verb.
     */
    clipboardTrayCount: (name: string, count: number): string =>
      count > 1 ? `${count} itens` : name,
    /** The tray's primary action — names the folder the paste would go into. */
    clipboardPasteInto: (destination: string): string => `Colar em ${destination}`,
    clipboardClearLabel: 'Cancelar',
    /** Live-region confirmations for the clipboard verbs (the clipboard itself is silent). */
    cutFeedback: (count: number): string =>
      count > 1 ? `${count} itens recortados` : 'Item recortado',
    copyFeedback: (count: number): string =>
      count > 1 ? `${count} itens copiados` : 'Item copiado',
    pasteFeedback: (count: number): string =>
      count > 1 ? `${count} itens colados` : 'Item colado',
    /** Shown while the `Ctrl+K` half of a two-stroke chord is waiting for its second key. */
    chordPendingHint: (platform: string): string =>
      `${chordLabel('Ctrl+K', platform)} — aguardando a segunda tecla…`,

    // explorer-os-actions: the OS-parity actions on the row / empty-area menu.
    menuCopyRelativePath: 'Copiar caminho relativo',
    menuCopyPath: 'Copiar caminho',
    /**
     * Each OS names this destination itself, and calling it something else is
     * exactly the "Electron-app jank" PRODUCT.md lists as an anti-reference —
     * a Mac user looks for "Finder", a Windows user for "Explorador de
     * Arquivos". Linux has no single name for it (Nautilus, Dolphin, Thunar…),
     * so it gets the generic noun rather than a wrong brand.
     */
    menuRevealInOs: (platform: string): string =>
      platform === 'darwin'
        ? 'Mostrar no Finder'
        : platform === 'win32'
          ? 'Mostrar no Explorador de Arquivos'
          : 'Abrir no gerenciador de arquivos',
    /** The empty-area variant: there is no row to reveal, so it names the target. */
    menuRevealWorkspaceInOs: (platform: string): string =>
      platform === 'darwin'
        ? 'Abrir o workspace no Finder'
        : platform === 'win32'
          ? 'Abrir o workspace no Explorador de Arquivos'
          : 'Abrir o workspace no gerenciador de arquivos',
    /** Live-region confirmation for a copy — the clipboard is otherwise silent. */
    pathCopiedFeedback: (count: number): string =>
      count > 1 ? `${count} caminhos copiados` : 'Caminho copiado',
    revealErrorMessage: 'Não foi possível abrir no gerenciador de arquivos do sistema.',
    /** design-studio DS-R1 AC-1: the Explorer entry point, offered only on Markdown. */
    menuOpenDesignStudio: 'Abrir no Design Studio',
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

    // FM-R5 — arrastar-e-soltar do computador para o workspace (drop overlay).
    importDropTitle: 'Solte para importar',
    importDropToFolder: (name: string) => `para a pasta ${name}`,
    importDropToRoot: (name: string) => `para ${name}`,
    importDropHint: 'Os arquivos serão copiados para o workspace',

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
    htmlPreviewLabel: 'Pré-visualização do HTML',

    // Multi-tab editor pane (VS Code-style preview/pin tabs)
    tabsLabel: 'Arquivos abertos',
    closeTabLabel: (name: string) => `Fechar ${name}`,

    // Rich file viewer — docx / pptx / planilhas / pdf / imagens.
    viewer: {
      loading: 'Preparando a visualização…',
      errorTitle: 'Não foi possível abrir este arquivo',
      errorDescription: 'O arquivo pode estar corrompido ou em um formato não suportado.',
      retry: 'Tentar de novo',
      zoomIn: 'Aumentar zoom',
      zoomOut: 'Diminuir zoom',
      fit: 'Ajustar à tela',
      zoomLabel: (pct: number) => `${pct}%`,
      unsupportedTitle: 'Pré-visualização indisponível',
      unsupportedDescription:
        'Ainda não sabemos exibir este tipo de arquivo por aqui. Você pode abri-lo no aplicativo padrão do sistema.',
      openExternal: 'Abrir no app padrão',
      image: {
        actualSize: 'Tamanho real',
        fitToView: 'Ajustar à tela',
        dimensions: (w: number, h: number) => `${w} × ${h}`
      },
      pdf: {
        rendering: 'Renderizando páginas…',
        pageOf: (current: number, total: number) => `Página ${current} de ${total}`,
        prevPage: 'Página anterior',
        nextPage: 'Próxima página'
      },
      docx: {
        warnings: (count: number) =>
          count === 1
            ? '1 detalhe de formatação foi simplificado.'
            : `${count} detalhes de formatação foram simplificados.`
      },
      sheet: {
        dimensions: (rows: number, cols: number) => `${rows} linhas × ${cols} colunas`,
        truncated: (shown: number, total: number) =>
          `Mostrando as primeiras ${shown} de ${total} linhas`,
        empty: 'Esta planilha está vazia.'
      },
      slides: {
        readerNote: 'Visualização de leitura — texto e imagens dos slides',
        slideOf: (current: number, total: number) => `Slide ${current} de ${total}`,
        prev: 'Slide anterior',
        next: 'Próximo slide',
        thumbnailsLabel: 'Miniaturas dos slides',
        noText: 'Slide sem texto',
        empty: 'Nenhum slide encontrado nesta apresentação.'
      }
    }
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
  secondBrainGate: {
    title: 'Preparando as bases de conhecimento',
    description:
      'Instalando e atualizando as skills de base de conhecimento da squad para este workspace.',
    // O caption embaixo da barra diz o que está literalmente acontecendo — eco
    // do título aqui seria a mesma frase duas vezes na mesma tela.
    progressLabel: 'Instalando as skills de base de conhecimento…',
    errorTitle: 'Não foi possível preparar as bases de conhecimento',
    errorDescriptionFallback: 'Algo deu errado ao provisionar as skills de base de conhecimento.',
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
    // A launched skill can carry the material it was launched with; a long
    // one collapses so it doesn't bury the conversation it started.
    invocationMore: 'Mostrar tudo',
    invocationLess: 'Mostrar menos',
    errorMessage: (message: string) => `Não foi possível concluir a resposta: ${message}`,
    loadingCapabilities: 'Carregando opções do agente…',
    composerHint: 'Enter envia · Shift+Enter quebra a linha · / para skills · @ para arquivos',
    // chat-queue: while a turn runs the composer keeps accepting input — the
    // placeholder says where it lands, so the send button's new glyph isn't
    // the only thing announcing it.
    promptPlaceholderBusy: 'Escreva a próxima mensagem — ela entra na fila…',
    queueLabel: 'Enfileirar mensagem',
    // chat-controls CC-R1: interrupt the running response. Since chat-queue
    // this is its own control in the toolbar, not the send button's other
    // state — the primary button always commits what was typed.
    stopAria: 'Interromper a resposta do agente',
    stopTitle: 'Interromper o agente',
    // agent-selection AG-R3.3: the active-agent indicator in the composer.
    agentIndicatorAria: (agent: string) => `Agente ativo: ${agent}`,
    // multi-agent: the composer's per-conversation agent switcher.
    agentSwitcherLabel: 'Escolher agente da conversa',
    agentSwitcherAria: (agent: string) => `Agente da conversa: ${agent}. Clique para trocar.`,
    agentPickAria: (agent: string) => `Usar ${agent} nesta conversa`,
    agentMenuLabel: 'Agentes habilitados',
    agentLockedAria: (agent: string) =>
      `Esta conversa está no agente ${agent}. Para usar outro, comece uma nova conversa.`,
    agentLockedHint: 'A conversa já começou neste agente',
    agentManageCta: 'Gerenciar agentes…',
    // chat-controls CC-R2: slash-command (skills) menu.
    slashMenuLabel: 'Comandos do workspace',
    slashMenuHint: '↑ ↓ navega · Enter executa · Esc fecha',
    slashEmpty: 'Nenhum comando disponível neste workspace.',
    slashNoMatch: 'Nenhum comando encontrado.',
    // chat-attachments (R6.5/T16): file attachments + `@` workspace references.
    attachLabel: 'Anexar arquivos',
    attachTitle: 'Anexar arquivos como contexto',
    attachmentRemoveAria: (name: string) => `Remover anexo ${name}`,
    dropHint: 'Solte para anexar como contexto',
    // The staged-files tray. Its summary is the fact a user checks before
    // pressing Enter — how many files are going, and how heavy they are.
    attachmentTrayCount: (count: number) => (count === 1 ? '1 arquivo' : `${count} arquivos`),
    attachmentClear: 'Limpar',
    attachmentClearTitle: 'Remover todos os anexos',
    // Per-conversation drafts: what the user sees when a conversation hands
    // back the message and the files it had waiting.
    draftRestored: 'Rascunho desta conversa',
    mentionMenuLabel: 'Arquivos do workspace',
    mentionMenuHint: '↑ ↓ navega · Enter ou Tab insere · Esc fecha',
    // The ranked list is a page of at most 8. Saying so turns "meu arquivo não
    // está aqui" into "escreva mais um pouco".
    mentionCount: (shown: number, total: number) => `${shown} de ${total}`,
    mentionEmpty: 'Nenhum arquivo encontrado no workspace.',
    mentionNoMatch: 'Nenhum arquivo corresponde à busca.',
    // Both empty cases end the same way: the menu is a suggestion, not a mode.
    mentionEmptyHint: 'Esc fecha o menu — o texto continua como você escreveu.',
    // The shortcut strip docked next to the composer (the shortcuts'
    // always-at-hand home now that the left rail hosts workspace tools).
    // shortcut-scopes: this strip renders the `during` set only, so the name
    // says which of the two sets it is — the hero has its own.
    shortcutsLabel: 'Atalhos durante a conversa',
    // The strip's scroll paddles — they only exist while that edge is hiding
    // something, so the names say which way, not "rolar".
    shortcutsScrollBack: 'Ver atalhos anteriores',
    shortcutsScrollForward: 'Ver mais atalhos'
  },
  // agent-activity: what the agent is doing while it answers — the live feed
  // that replaced a minute of silent typing dots. Two tenses, not one: the
  // present continuous narrates work in progress, and a settled row switches
  // to the past. The tense is a state channel that survives a screenshot, a
  // screen reader and a user who can't tell a spinner from a tick.
  activity: {
    read: 'Lendo',
    edit: 'Editando',
    // agent-patch: a `Write` to a path that does not exist yet is a creation,
    // not an edit. Without this the row read "Editou … novo", which contradicts
    // itself, and the tense channel stopped being trustworthy.
    create: 'Criando',
    search: 'Buscando',
    run: 'Rodando',
    web: 'Consultando a web',
    task: 'Planejando',
    other: 'Usando',
    readDone: 'Leu',
    editDone: 'Editou',
    createDone: 'Criou',
    searchDone: 'Buscou',
    runDone: 'Rodou',
    webDone: 'Consultou',
    taskDone: 'Planejou',
    otherDone: 'Usou',
    // An adapter that reports a tool call with no name still gets a legible row.
    unnamedTool: 'ferramenta',
    // The collapsed header, once a turn has produced more steps than fit.
    stepsCount: (count: number) => (count === 1 ? '1 passo' : `${count} passos`),
    expandCta: 'Ver todos os passos',
    collapseCta: 'Recolher passos',
    // Screen-reader status for a row, so the feed is narrated, not just seen.
    runningAria: (label: string) => `${label} — em andamento`,
    okAria: (label: string) => `${label} — concluído`,
    failedAria: (label: string) => `${label} — falhou`,
    regionLabel: 'Atividade do agente'
  },
  // agent-patch: the change an editing step is applying, shown inline in the
  // transcript. Copy is deliberately terse — these render dozens of times per
  // turn, next to the code they describe, and every extra word is a word the
  // reader has to step over to get to the diff.
  patch: {
    // The diffstat. The minus is U+2212, not a hyphen: it lines up with the
    // plus at the same optical weight, which a hyphen next to a digit doesn't.
    adds: (count: number) => `+${count}`,
    dels: (count: number) => `−${count}`,
    // Said once per patch, so a screen reader gets the scale before the lines.
    bodyAria: (path: string, adds: number, dels: number) =>
      `Alterações em ${path}: ${adds} linhas adicionadas, ${dels} removidas`,
    // The op chip, only where "Editando" alone would mislead: a Write that
    // creates a file, or one that replaces every line of an existing one.
    opCreate: 'novo',
    opRewrite: 'reescrito',
    showMore: (count: number) =>
      count === 1 ? 'Mostrar mais 1 linha' : `Mostrar mais ${count} linhas`,
    showLess: 'Mostrar menos',
    // The transport cap, said out loud: a patch cut short must not look whole.
    truncated: (count: number) =>
      count === 1 ? '1 linha não exibida' : `${count} linhas não exibidas`,
    // The step failed after the patch was already on screen. Names the state
    // the diff would otherwise imply it reached.
    notApplied: 'A ferramenta falhou — esta alteração não foi aplicada.',
    openInEditor: (name: string) => `Abrir ${name} no editor`
  },
  // chat-timing: how long things took. Compact by construction — these render
  // inline, dozens per transcript, right next to the thing they measure, so
  // "1min 12s" and never "1 minuto e 12 segundos".
  timing: {
    subSecond: (tenths: string) => `${tenths}s`,
    seconds: (seconds: number) => `${seconds}s`,
    minutes: (minutes: number, seconds: number) =>
      `${minutes}min ${String(seconds).padStart(2, '0')}s`,
    hours: (hours: number, minutes: number) => `${hours}h ${String(minutes).padStart(2, '0')}min`,
    // Phase, read off the turn's own timeline. Literal, not playful: this app
    // is a workbench, and a cute verb costs a second of parsing every time it
    // changes. "Aguardando você" names who the turn is blocked on, which is
    // the only phase where the user is the one holding it up.
    phaseStarting: 'Iniciando',
    phaseThinking: 'Pensando',
    phaseWriting: 'Escrevendo',
    phaseWorking: 'Executando',
    phaseWaiting: 'Aguardando você',
    // Tokens: the live meter reports what the request *carried* (context), the
    // receipt what the turn *produced*. Two different numbers, two words.
    tokensRead: (tokens: string) => `${tokens} tokens de contexto`,
    tokensWritten: (tokens: string) => `${tokens} tokens gerados`,
    thousands: (value: string) => `${value} mil`,
    millions: (value: string) => `${value} mi`,
    cost: (amount: string) => `US$ ${amount}`,
    // The settled receipt's opening clause: what happened, in how long.
    receiptDone: (duration: string) => `Concluído em ${duration}`,
    receiptInterrupted: (duration: string) => `Interrompido após ${duration}`,
    receiptFailed: (duration: string) => `Falhou após ${duration}`
  },
  // chat-queue: messages committed while the agent was busy. The copy never
  // says "aguardando" alone — a queue that looks stuck and a queue that IS
  // stuck have to read differently, which is what `heldTitle` is for.
  queue: {
    regionLabel: 'Mensagens na fila',
    title: (count: number) => (count === 1 ? '1 mensagem na fila' : `${count} mensagens na fila`),
    heldTitle: 'Fila pausada — o turno anterior não terminou',
    clearCta: 'Limpar',
    resumeCta: 'Retomar',
    removeAria: (text: string) => `Remover da fila: ${text}`,
    removeTitle: 'Tirar da fila',
    attachmentCount: (count: number) => (count === 1 ? '· 1 anexo' : `· ${count} anexos`)
  },
  // session-usage: how full the context window is and what the conversation
  // has spent. The vocabulary is deliberately the model's own (cache, tokens)
  // — this is the detail view, and a PM who opens it wants the real numbers,
  // with one sentence saying what they mean.
  usage: {
    meterLabel: 'de contexto',
    meterPercent: (percent: number) => `${percent}%`,
    underOnePercent: '<1%',
    meterAria: (summary: string) => `Janela de contexto: ${summary} em uso. Ver detalhes.`,
    detailTitle: 'Contexto da sessão',
    ofWindow: (total: string) => `de ${total}`,
    barAria: (used: string, total: string) =>
      total === '' ? `${used} tokens em uso` : `${used} de ${total} tokens em uso`,
    segCacheRead: 'Reaproveitado do cache',
    segCacheCreation: 'Gravado no cache agora',
    segInput: 'Enviado nesta chamada',
    segFree: 'Livre',
    // Says what the bar is a picture *of* — the last request, not a running
    // total — because that is the one thing a percentage can't say by itself.
    contextNote:
      'É tudo o que o agente releu na última chamada. Toda mensagem reenvia a conversa inteira; o que ele escreve entra no contexto da próxima.',
    totalRuntime: 'Tempo de execução',
    totalApi: 'Tempo de API',
    totalTurns: 'Turnos',
    totalOutput: 'Tokens gerados',
    totalCost: 'Custo',
    tightAdvice:
      'A janela está quase cheia. Daqui pra frente o agente pode perder o começo da conversa.',
    tightCta: 'Começar uma conversa nova'
  },
  // agent-approvals: the agent asked to run something it isn't pre-authorized
  // for. Copy is deliberately concrete about *what* is being asked — a vague
  // "permitir ação?" is how people click yes to anything.
  approval: {
    titleRun: 'Rodar um comando no terminal',
    titleWeb: 'Acessar um endereço na web',
    titleEdit: 'Alterar um arquivo',
    titleRead: 'Ler um arquivo',
    titleOther: (tool: string) => `Usar a ferramenta ${tool}`,
    description: 'O agente precisa da sua autorização para continuar.',
    allowCta: 'Permitir',
    allowAlwaysCta: 'Sempre permitir',
    denyCta: 'Recusar',
    // The blanket grant. Its label says the scope out loud and its hint says
    // when it ends — a "permitir tudo" that doesn't say until when is how
    // someone hands over the shell believing they lent it for a minute.
    allowSessionCta: 'Permitir tudo nesta sessão',
    allowSessionHint: 'O agente para de perguntar até você fechar o Hive.',
    // Says where the grant goes, not just that it is remembered: a standing
    // permission is written into the agent's own settings for this workspace,
    // which is a file the user can open, read and undo.
    allowAlwaysHint: (scope: string) =>
      `Não perguntar de novo para ${scope} — salvo nas permissões do agente neste workspace`,
    detailsCta: 'Ver detalhes',
    detailsHideCta: 'Ocultar detalhes',
    keyboardHint: 'Enter permite · Esc recusa',
    allowedState: 'Permitido',
    allowedAlwaysState: 'Permitido sempre',
    allowedSessionState: 'Permitido — sessão liberada',
    deniedState: 'Recusado',
    // The footer chip: the standing reminder that nothing is being asked any
    // more, and the one click that takes it back. A blanket grant with no
    // visible state is a grant the user forgets they gave.
    sessionChipLabel: 'Autorizações liberadas nesta sessão',
    sessionChipAria: 'Autorizações liberadas nesta sessão — o agente não vai pedir permissão',
    sessionRevokeCta: 'Voltar a perguntar',
    deniedMessage: 'Recusado pelo usuário no Hive.',
    pendingAria: (title: string) => `Autorização pendente: ${title}`
  },
  intentGrid: {
    title: 'O que você quer fazer hoje?',
    /** Named greeting — used when the profile has a display name. */
    titleNamed: (name: string) => `Olá ${name}, o que você quer fazer hoje?`,
    description: 'Escreva sua mensagem ou comece por um fluxo guiado do BMAD.',
    plannedBadge: 'Em breve',
    // role-personalization RP-R4: the persona action is grouped apart from the
    // workflow pills, under this quiet label.
    personaLabel: 'Falar com um especialista'
  },
  // shortcut-customization: the "Personalizar atalhos" picker (hero + strip).
  shortcuts: {
    customizeLabel: 'Personalizar',
    customizeTitle: 'Personalizar atalhos',
    dialogDescription:
      'Escolha as skills e os agentes que ficam à mão em cada momento — ao começar uma conversa e durante ela.',
    // shortcut-scopes: the two sets, switched by the segmented control. The
    // labels name the *moment*, not the surface, because that's how someone
    // decides which list a shortcut belongs in.
    scopeAria: 'Momento da conversa',
    scopeStartLabel: 'Para iniciar',
    scopeDuringLabel: 'Durante a conversa',
    scopeStartCaption: 'Na tela inicial, antes da primeira mensagem.',
    scopeDuringCaption: 'Acima do campo de mensagem, com a conversa em andamento.',
    // The live preview above the catalog: the selection, drawn the way the
    // real surface draws it, so the difference between the two sets is
    // visible instead of explained.
    previewAria: (scope: string) => `Prévia dos atalhos: ${scope}`,
    previewEmptyStart: 'Sem atalhos aqui — a tela inicial fica só com o campo de mensagem.',
    previewEmptyDuring: 'Sem atalhos aqui — a barra acima do campo de mensagem some.',
    searchPlaceholder: 'Buscar skills e agentes…',
    searchAria: 'Buscar skills e agentes do workspace',
    agentsGroupLabel: 'Agentes',
    skillsGroupLabel: 'Skills',
    groupCount: (selected: number, total: number) => `${selected} de ${total}`,
    selectedCount: (count: number) =>
      count === 0
        ? 'Nenhum atalho selecionado'
        : count === 1
          ? '1 atalho selecionado'
          : `${count} atalhos selecionados`,
    roleDefaultBadge: 'Padrão do papel',
    customBadge: 'Personalizado',
    // "do papel" is carried by the badge directly above this button, and the
    // shorter label is what keeps the footer's four items on one line once a
    // scope is customized (the restore action only exists in that state).
    restoreDefaultsCta: 'Restaurar padrão',
    doneCta: 'Concluído',
    noMatch: 'Nada encontrado com esse nome.',
    emptyCatalog:
      'Nenhuma skill do BMAD foi encontrada neste workspace. Instale ou atualize o BMAD para personalizar os atalhos.',
    toggleAria: (label: string) => `Alternar atalho: ${label}`,
    // First customization starts from the role defaults already ON — the
    // sheet explains that editing detaches the selection from the role.
    editingDefaultsHint:
      'Você está partindo dos atalhos padrão do seu papel. Qualquer mudança cria a sua seleção personalizada.',
    // skill-studio: user creations get their own group at the top of the
    // picker, plus a way into the studio for whoever hasn't created yet.
    createdGroupLabel: 'Criadas por você',
    // Short on purpose: with the scope split the footer also carries the
    // per-scope "Restaurar padrão do papel", and the three actions plus the
    // live count have to sit on one line at the dialog's width.
    openStudioCta: 'Criar no Estúdio'
  },
  // skill-studio: the "Estúdio de skills" — create skills/agents with the
  // BMAD builders, generate/run evals, pin creations as shortcuts.
  studio: {
    openLabel: 'Estúdio de skills',
    title: 'Estúdio de skills',
    description:
      'Crie skills e agentes sob medida com os construtores do BMAD — cada criação vira um comando de barra e pode ser fixada nos seus atalhos.',
    newSkillCta: 'Nova skill',
    newAgentCta: 'Novo agente',
    loadingLabel: 'Procurando suas criações…',
    galleryAria: 'Suas skills e agentes criados',
    countLabel: (count: number) =>
      count === 1 ? '1 criação neste workspace' : `${count} criações neste workspace`,
    // Empty state teaches the two paths instead of saying "nothing here".
    emptyTitle: 'O que você vai criar primeiro?',
    emptyDescription:
      'Descreva a ideia e o construtor do BMAD conversa com você no chat até a skill ficar pronta — instalada no workspace, com evals para medir a qualidade.',
    emptySkillCardTitle: 'Uma skill',
    emptySkillCardDescription:
      'Um fluxo reutilizável que vira comando /: revisar release notes, padronizar specs, gerar relatórios…',
    emptyAgentCardTitle: 'Um agente',
    emptyAgentCardDescription:
      'Um especialista com nome e personalidade para conversar — como John e Sally, só que do seu jeito.',
    kindSkillBadge: 'Skill',
    kindAgentBadge: 'Agente',
    evalsNoneBadge: 'Sem evals',
    evalsCountBadge: (count: number) => (count === 1 ? '1 eval' : `${count} evals`),
    evalsReadyBadge: 'Evals prontos',
    updatedLabel: (relative: string) => `Atualizada ${relative}`,
    runCta: 'Testar no chat',
    runAria: (name: string) => `Testar ${name} no chat`,
    evalsCreateCta: 'Gerar evals',
    evalsCreateAria: (name: string) => `Gerar evals para ${name}`,
    evalsRunCta: 'Rodar evals',
    evalsRunAria: (name: string) => `Rodar os evals de ${name}`,
    pinCta: 'Fixar nos atalhos',
    unpinCta: 'Tirar dos atalhos',
    // shortcut-scopes: pinning targets the "para iniciar" set, so the
    // accessible name says which of the two sets is being changed.
    pinAria: (name: string) => `Fixar ${name} nos atalhos para iniciar`,
    unpinAria: (name: string) => `Tirar ${name} dos atalhos para iniciar`,
    pinnedBadge: 'Nos atalhos',
    openFileCta: 'Abrir SKILL.md',
    openFileAria: (name: string) => `Abrir o SKILL.md de ${name} no editor`,
    deleteCta: 'Excluir',
    deleteAria: (name: string) => `Excluir ${name}`,
    deleteDialogTitle: 'Excluir esta criação?',
    deleteDialogDescription: (name: string) =>
      `"${name}" será movida para a lixeira do sistema, junto com seus evals. Você pode recuperá-la por lá.`,
    deleteConfirmCta: 'Mover para a lixeira',
    deleteCancelCta: 'Cancelar',
    deleteErrorMessage: 'Não foi possível excluir. Tente novamente.',
    // Create view (the short briefing form before the builder takes over).
    backCta: 'Voltar para o estúdio',
    createTitleSkill: 'Nova skill',
    createTitleAgent: 'Novo agente',
    kindLegend: 'O que você quer criar?',
    kindSkillTitle: 'Skill',
    kindSkillDescription: 'Fluxo reutilizável que vira comando /.',
    kindAgentTitle: 'Agente',
    kindAgentDescription: 'Especialista com persona para conversar.',
    nameLabel: 'Nome',
    namePlaceholderSkill: 'ex.: Revisor de release notes',
    namePlaceholderAgent: 'ex.: Clara, especialista em dados',
    slugPreview: (slug: string) => `Vai virar o comando /${slug}`,
    personaLabel: 'Primeiro nome da persona',
    personaPlaceholder: 'ex.: Clara',
    personaHint: 'É como o agente aparece nos atalhos: "Conversar com <nome>".',
    ideaLabelSkill: 'O que essa skill deve fazer?',
    ideaLabelAgent: 'Qual é a especialidade desse agente?',
    ideaPlaceholder:
      'Descreva o objetivo, quando deve ser usada e como é um bom resultado. Quanto mais contexto, melhor o construtor trabalha.',
    withEvalsLabel: 'Gerar evals junto',
    withEvalsHint: 'Casos de teste que medem a skill — depois é só usar "Rodar evals".',
    // Run configuration (skill-studio): the same model/effort levers as the
    // chat, so a build launched here runs exactly like one driven by hand.
    runConfigLegend: 'Como o construtor vai trabalhar',
    runConfigLoading: 'Carregando…',
    modelLabel: 'Modelo',
    effortLabel: 'Esforço',
    effortHint: 'Quanto o agente raciocina antes de responder.',
    createCta: 'Criar com o Construtor',
    handoffHint:
      'Ao criar, abrimos uma nova conversa e o construtor do BMAD assume o chat para lapidar os detalhes com você.',
    handoffBackgroundNote: 'Sua conversa em andamento continua rodando em segundo plano.'
  },
  // mcp: the "Servidores MCP" module — activate/disable Model Context Protocol
  // servers, test a live connection (status + tools + logs), add/edit/remove.
  mcp: {
    // mcp-visibility: the handshake row inside a turn — what MCP servers this
    // turn started with, told at the moment it happened.
    turnReady: (count: number) =>
      count === 1 ? '1 servidor MCP conectado' : `${count} servidores MCP conectados`,
    turnOneFailed: (server: string) => `${server} não conectou`,
    turnManyFailed: (count: number) => `${count} servidores MCP não conectaram`,
    turnServerAria: (server: string, tools: number) =>
      tools === 1 ? `${server}, 1 ferramenta` : `${server}, ${tools} ferramentas`,
    turnOpenAria: (summary: string) => `${summary}. Abrir o console MCP.`,
    openLabel: 'Servidores MCP',
    title: 'Servidores MCP',
    description:
      'Conecte ferramentas externas ao agente via Model Context Protocol — navegadores, arquivos, APIs. Ative, teste a conexão e veja o que cada servidor oferece.',
    addCta: 'Adicionar servidor',
    countLabel: (count: number) => (count === 1 ? '1 servidor' : `${count} servidores`),
    loadingLabel: 'Carregando servidores…',
    listAria: 'Servidores MCP configurados',
    noTarget: 'Sem destino configurado',
    // Row status vocabulary (the dot, pill and details all read from this).
    status: {
      idle: 'Não testado',
      checking: 'Testando…',
      ok: 'Conectado',
      error: 'Falhou',
      disabled: 'Desativado'
    },
    transport: {
      stdio: 'Local',
      http: 'Remoto',
      sse: 'Remoto (SSE)'
    },
    toolsCountTitle: 'Ferramentas expostas pelo servidor',
    toggleAria: (name: string) => `Ativar ou desativar ${name}`,
    toggleOnHint: 'Ativo — o agente pode usar este servidor',
    toggleOffHint: 'Inativo — clique para ativar',
    expandAria: (name: string) => `Ver detalhes de ${name}`,
    collapseAria: (name: string) => `Ocultar detalhes de ${name}`,
    // Connection test (probe) — the expanded panel.
    testCta: 'Testar conexão',
    testAria: (name: string) => `Testar a conexão de ${name}`,
    testing: 'Testando…',
    testHint: 'Verifique se o servidor inicia e liste suas ferramentas.',
    testingHint: 'Iniciando o servidor e negociando o protocolo…',
    testFailed: 'Não foi possível conectar.',
    connectedTools: (count: number) => (count === 1 ? '1 ferramenta' : `${count} ferramentas`),
    connectedMs: (ms: number) => `${ms} ms`,
    toolsHeading: (count: number) =>
      count === 1 ? 'Ferramenta disponível' : `${count} ferramentas disponíveis`,
    logsHeading: 'Logs da conexão',
    // Config summary rows + form field labels (shared).
    fieldName: 'Nome',
    fieldCommand: 'Comando',
    fieldArgs: 'Argumentos',
    fieldEnv: 'Variáveis de ambiente',
    fieldUrl: 'URL',
    fieldHeaders: 'Cabeçalhos',
    editCta: 'Editar',
    deleteCta: 'Remover',
    // Empty state.
    emptyTitle: 'Nenhum servidor MCP ainda',
    emptyDescription:
      'Servidores MCP dão superpoderes ao agente: acesso a um navegador, aos seus arquivos, a APIs e muito mais. Comece por um modelo pronto ou configure do zero.',
    presetsLabel: 'Comece por um modelo',
    addFromScratch: 'Configurar do zero',
    // Add / edit form.
    addTitle: 'Adicionar servidor MCP',
    addSubtitle: 'Escolha um modelo pronto ou informe os dados de conexão manualmente.',
    editTitle: 'Editar servidor MCP',
    editSubtitle: 'Ajuste os dados de conexão deste servidor.',
    backCta: 'Voltar',
    namePlaceholder: 'ex.: playwright',
    transportLegend: 'Como o servidor é executado',
    transportStdioTitle: 'Local (stdio)',
    transportStdioDescription: 'Um comando que roda na sua máquina.',
    transportRemoteTitle: 'Remoto (HTTP)',
    transportRemoteDescription: 'Um endpoint acessado pela rede.',
    commandPlaceholder: 'ex.: npx',
    argsHint: 'Um argumento por linha.',
    argsPlaceholder: '-y\n@playwright/mcp@latest',
    envHint: 'Um par CHAVE=valor por linha.',
    envPlaceholder: 'API_KEY=sk-...',
    urlPlaceholder: 'https://exemplo.com/mcp',
    headersHint: 'Um cabeçalho "Nome: valor" por linha.',
    headersPlaceholder: 'Authorization: Bearer sk-...',
    cancelCta: 'Cancelar',
    createCta: 'Adicionar',
    saveCta: 'Salvar alterações',
    // Delete confirmation.
    deleteDialogTitle: 'Remover este servidor?',
    deleteDialogDescription: (name: string) =>
      `"${name}" será removido do .mcp.json deste workspace. O agente deixa de ter acesso às ferramentas dele.`,
    deleteConfirmCta: 'Remover servidor',
    deleteCancelCta: 'Cancelar',
    deleteErrorMessage: 'Não foi possível remover. Tente novamente.',
    // Bridge into the console, from the expanded row.
    openConsoleCta: 'Ver logs de uso'
  },
  // mcp-logs: the MCP console — what each server actually did while the agent
  // worked, read from the CLI's own per-server log files. Vocabulary note: the
  // module says "atividade"/"eventos", never "log dump" — PRODUCT.md names
  // log-dump UIs as an anti-reference, and the copy holds that line.
  mcpLogs: {
    // Dock chrome.
    title: 'Console MCP',
    openLabel: 'Console MCP',
    openAria: 'Abrir o console de atividade dos servidores MCP',
    closeAria: 'Fechar o console MCP',
    expandAria: 'Expandir o console para a área toda',
    collapseAria: 'Restaurar a altura do console',
    collapseDockAria: 'Recolher o console para a barra',
    expandDockAria: 'Abrir o console MCP',
    resizeAria: 'Redimensionar o console MCP',
    // The collapsed strip — the ambient "MCP is doing something" signal.
    // mcp-visibility: the standing answer is a count of servers, not the name
    // of whoever spoke last; "nenhum servidor" and "2 de 3" are different
    // facts and get different sentences rather than one with numbers swapped.
    idleStrip: 'Nenhum servidor MCP',
    summaryPlain: (total: number) => (total === 1 ? '1 servidor MCP' : `${total} servidores MCP`),
    // No "MCP ·" prefix: the plug glyph beside it already says which subsystem
    // this is, and the words it bought were the ones the status bar then had to
    // ellipsise — the loud state is the one that most needs to be readable.
    summaryTroubled: (troubled: number, total: number) => `${troubled} de ${total} com falha`,
    liveLabel: 'ao vivo',
    liveAria: 'Recebendo eventos ao vivo',
    // mcp-visibility: the roster — the same vocabulary in the status card, the
    // console strip and the transcript row, so the three cannot disagree.
    rosterHeading: 'Servidores MCP deste workspace',
    rosterEmpty: 'Nenhum servidor configurado ou detectado ainda.',
    rosterTools: (count: number) => (count === 1 ? '1 ferramenta' : `${count} ferramentas`),
    rosterFoot: 'Clique para abrir o console e acompanhar a atividade.',
    stateConnected: 'conectado',
    stateFailed: 'falhou',
    stateNeedsAuth: 'precisa de login',
    stateStarting: 'iniciando',
    stateKnown: 'sem conexão ativa',
    pillTitle: (server: string, state: string) =>
      `${server} — ${state}. Filtrar por este servidor.`,
    // Filters.
    filterAria: 'Filtrar eventos por tipo',
    filterAll: 'Tudo',
    filterTools: 'Ferramentas',
    filterConnection: 'Conexão',
    filterIssues: 'Problemas',
    serverAll: 'Todos os servidores',
    serverAria: 'Filtrar por servidor',
    searchPlaceholder: 'Buscar em eventos, ferramentas e saída…',
    searchAria: 'Buscar nos eventos',
    clearSearchAria: 'Limpar a busca',
    // Row vocabulary.
    categoryTool: 'ferramenta',
    categoryConnection: 'conexão',
    categoryStderr: 'saída',
    categoryOther: 'evento',
    eventConnecting: 'Iniciando conexão…',
    eventConnected: (transport: string) =>
      transport === '' ? 'Conectado' : `Conectado via ${transport}`,
    eventCapabilities: (version: string) => `Handshake concluído · ${version}`,
    eventCapabilitiesPlain: 'Handshake concluído',
    eventToolRunning: (tool: string) => `${tool} ainda em execução`,
    eventClosed: 'Conexão encerrada',
    eventReconnect: 'Cache de conexão limpo — vai reconectar',
    eventShutdown: 'Encerrando o processo do servidor',
    eventExited: 'Processo do servidor encerrado',
    latencyMs: (ms: number) => `${ms} ms`,
    latencySeconds: (seconds: string) => `${seconds} s`,
    barAria: (tool: string, latency: string) => `${tool} levou ${latency}`,
    detailToggleAria: (summary: string) => `Ver detalhes de: ${summary}`,
    copyCta: 'Copiar',
    copiedCta: 'Copiado',
    copyAria: 'Copiar o registro bruto deste evento',
    // Session bands.
    bandLabel: (stamp: string) => `sessão · ${stamp}`,
    bandCount: (count: number) => (count === 1 ? '1 evento' : `${count} eventos`),
    // Follow-the-tail affordance.
    followCta: (count: number) => (count === 1 ? '1 evento novo' : `${count} eventos novos`),
    followAria: 'Ir para o evento mais recente',
    // Expanded console — the per-server rail.
    railHeading: 'Servidores',
    railCalls: (count: number) => (count === 1 ? '1 chamada' : `${count} chamadas`),
    railErrors: (count: number) => (count === 1 ? '1 erro' : `${count} erros`),
    railMedian: (value: string) => `mediana ${value}`,
    railSlowest: (value: string) => `pico ${value}`,
    railLive: 'conectado',
    railOffline: 'sem conexão ativa',
    railNotInCatalog: 'fora do .mcp.json deste workspace',
    openDirCta: 'Abrir pasta de logs',
    openDirAria: (server: string) => `Abrir a pasta de logs de ${server}`,
    // States.
    loadingLabel: 'Lendo a atividade MCP…',
    emptyTitle: 'Nenhuma atividade MCP ainda',
    emptyDescription:
      'Os eventos aparecem aqui assim que o agente usar um servidor MCP durante um turno — conexões, cada ferramenta chamada e o que o servidor imprimiu.',
    emptyCta: 'Configurar servidores MCP',
    noMatchTitle: 'Nenhum evento neste filtro',
    noMatchDescription: 'Ajuste o tipo, o servidor ou a busca para ver mais.',
    clearFiltersCta: 'Limpar filtros',
    errorTitle: 'Não foi possível ler a atividade MCP',
    retryCta: 'Tentar de novo',
    // mcp-visibility: where the console read from. Shown on the empty state
    // because "o agente não usou MCP" and "os logs estão em outro lugar" são
    // indistinguíveis sem o caminho — e o segundo caso é real (CLI do Windows
    // dirigido pelo WSL grava sob %LOCALAPPDATA%).
    sourceReading: 'Lendo de',
    sourceMissing: 'Ainda não existe',
    sourceCopyAria: 'Copiar o caminho da pasta de logs'
  },
  // session-history: persisted conversations (panel, hero recents, row actions).
  chatHistory: {
    newLabel: 'Nova conversa',
    historyLabel: 'Histórico de conversas',
    panelTitle: 'Conversas',
    searchPlaceholder: 'Buscar conversas…',
    searchClearLabel: 'Limpar busca',
    emptyTitle: 'Nenhuma conversa ainda',
    emptyDescription: 'Suas conversas com os agentes ficam guardadas aqui, por workspace.',
    noMatch: (query: string) => `Nada encontrado para "${query}".`,
    groupToday: 'Hoje',
    groupYesterday: 'Ontem',
    groupWeek: 'Últimos 7 dias',
    groupMonth: 'Últimos 30 dias',
    groupOlder: 'Mais antigas',
    untitled: 'Conversa sem título',
    currentBadge: 'Atual',
    openAria: (title: string) => `Abrir conversa: ${title}`,
    renameLabel: (title: string) => `Renomear ${title}`,
    renamePlaceholder: 'Título da conversa',
    renameConfirmLabel: 'Salvar título',
    renameCancelLabel: 'Cancelar renomeação',
    deleteLabel: (title: string) => `Excluir ${title}`,
    deleteConfirmQuestion: 'Excluir esta conversa?',
    deleteConfirmCta: 'Excluir',
    deleteCancelCta: 'Cancelar',
    messageCount: (count: number) => (count === 1 ? '1 mensagem' : `${count} mensagens`),
    loadingLabel: 'Carregando conversas…',
    heroRecentsLabel: 'Continuar de onde parou',
    // background-turns: a conversation whose reply is still being generated.
    runningLabel: 'Em andamento',
    // Agent Change Review: the change card lives in the conversation that asked
    // for it, so this row marker is how a review waiting in *another*
    // conversation stays findable. Same word as the card's own counter.
    reviewPending: (n: number) => (n === 1 ? '1 pendente' : `${n} pendentes`),
    openWithReviewAria: (title: string, n: number) =>
      n === 1
        ? `Abrir conversa: ${title} — 1 mudança pendente de revisão`
        : `Abrir conversa: ${title} — ${n} mudanças pendentes de revisão`
  },
  // agent-selection AG-R3.1: first-run agent picker.
  // agent-onboarding (M17): in-app install + a re-runnable, evidenced scan.
  agentSetup: {
    title: 'Escolha seus agentes',
    description:
      'Um agente de IA conduz cada conversa no Hive. Habilite quantos quiser — dá para trocar por conversa e mudar tudo depois no seu perfil.',
    availableSectionLabel: 'Prontos para usar',
    installableSectionLabel: 'O Hive instala para você',
    manualSectionLabel: 'Instalação pelo fornecedor',
    unavailableSectionLabel: 'Precisam ser instalados',
    comingSoon: 'Em breve',
    // multi-agent: detection + how-to-enable affordance.
    unavailableHint: 'CLI não encontrada neste computador.',
    installCta: 'Como instalar',
    installCtaAria: (agent: string) => `Como instalar ${agent} (abre no navegador)`,
    detecting: 'Procurando agentes instalados…',
    // AO-R2: what the last scan found, and the way to run it again.
    scanSummary: (found: number, total: number) =>
      found === 0
        ? 'Nenhum agente encontrado neste computador.'
        : `${found} de ${total} agentes encontrados neste computador.`,
    rescan: 'Procurar de novo',
    // Only the part the strip above can't say for itself: *why* you'd press it.
    // The groups below already offer the other way out.
    emptyAvailable: 'Instalou um agente agora há pouco? Toque em “Procurar de novo”.',
    // AO-R3: the one-click install and everything it can say back.
    installNow: 'Instalar',
    installNowAria: (agent: string) => `Instalar ${agent} agora`,
    installRuns: 'Roda',
    installing: (agent: string) => `Instalando ${agent}…`,
    installOutputLabel: 'Ver saída do npm',
    retryInstall: 'Tentar de novo',
    retryInstallAria: (agent: string) => `Tentar instalar ${agent} de novo`,
    copyCommand: 'Copiar comando',
    copyCommandAria: (agent: string) => `Copiar o comando de instalação do ${agent}`,
    copied: 'Copiado',
    installError: {
      'not-installable': 'O Hive não consegue instalar este agente.',
      'npm-missing': 'Não encontramos o npm aqui. Instale o Node.js e tente de novo.',
      permission:
        'Sem permissão para instalar pacotes globais. Copie o comando e rode com a permissão necessária.',
      network: 'Não deu para falar com o registro do npm. Confira a conexão e tente de novo.',
      'not-detected': 'A instalação terminou, mas a CLI ainda não aparece. Feche e abra o Hive.',
      failed: 'A instalação falhou.'
    },
    defaultBadge: 'Padrão',
    setDefaultAria: (agent: string) => `Definir ${agent} como agente padrão`,
    toggleAria: (agent: string) => `Habilitar ou desabilitar ${agent}`,
    selectionHint: (count: number) =>
      count === 0
        ? 'Selecione ao menos um agente para continuar.'
        : count === 1
          ? '1 agente habilitado.'
          : `${count} agentes habilitados.`,
    continueCta: 'Continuar'
  },
  // role-personalization RP-R2: required first-run role picker.
  roleSetup: {
    title: 'Qual é o seu papel?',
    description:
      'Escolha sua função para o Hive destacar os fluxos certos para o seu dia a dia. Dá pra mudar quando quiser.',
    continueCta: 'Entrar no Hive'
  },
  // The persistent left tool rail: workspace file search on top, app
  // settings bottom-anchored (the role shortcuts now live next to the
  // conversation — see chat.shortcutsLabel).
  git: {
    // git-management (M10) — the Source Control surface.
    paneTitle: 'Controle de versão',
    // Change groups (GIT-R2).
    groupConflicts: 'Conflitos de merge',
    groupStaged: 'Alterações prontas',
    groupChanges: 'Alterações',
    moreChanges: (count: number) => `e mais ${count}…`,
    // Row (GIT-R2): the status glyph's accessible meaning per kind.
    statusModified: 'Modificado',
    statusAdded: 'Adicionado',
    statusDeleted: 'Excluído',
    statusRenamed: 'Renomeado',
    statusUntracked: 'Não rastreado',
    statusConflict: 'Em conflito',
    statusIgnored: 'Ignorado',
    rowAria: (name: string, meaning: string) => `${name} — ${meaning}`,
    renamedFrom: (from: string) => `renomeado de ${from}`,
    // Branch chip (GIT-R2.5/R6).
    branchAria: (branch: string) => `Branch atual: ${branch}`,
    detachedHead: 'HEAD desanexado',
    refreshLabel: 'Atualizar',
    // Empty states (GIT-R1/R2.5) — teaching, not blank.
    emptyCleanTitle: 'Nenhuma alteração',
    emptyCleanDescription: (branch: string) =>
      `Tudo salvo em ${branch}. Faça uma alteração para começar.`,
    emptyCleanDescriptionDetached: 'Tudo salvo. Faça uma alteração para começar.',
    notARepoTitle: 'Este workspace ainda não usa git',
    notARepoDescription:
      'Inicialize um repositório para versionar seu trabalho — revisar, preparar e commitar sem sair do Hive.',
    initRepo: 'Inicializar repositório',
    gitMissingTitle: 'Git não encontrado',
    gitMissingDescription:
      'O Hive não conseguiu executar o git nesta máquina. Instale o git e reabra o workspace para usar o controle de versão.',
    // Row + group actions (GIT-R3).
    stage: 'Preparar',
    unstage: 'Retirar do preparo',
    discard: 'Descartar alterações',
    openDiff: 'Abrir diferenças',
    copyPath: 'Copiar caminho',
    stageAll: 'Preparar tudo',
    unstageAll: 'Retirar tudo do preparo',
    discardAll: 'Descartar tudo',
    // Discard confirm (GIT-R3.3).
    discardTitle: 'Descartar alterações?',
    discardTrackedOne: (name: string) =>
      `“${name}” será restaurado para o último commit. Esta ação não pode ser desfeita.`,
    discardUntrackedOne: (name: string) =>
      `“${name}” não está sob controle de versão e será movido para a lixeira do sistema (recuperável).`,
    discardMany: (count: number) =>
      `${count} arquivos serão descartados; os não rastreados vão para a lixeira e os demais voltam ao último commit.`,
    discardConfirm: 'Descartar',
    discardCancel: 'Cancelar',
    // Commit box (GIT-R5).
    commitPlaceholder: 'Mensagem (Ctrl+Enter para commitar)',
    commit: 'Commit',
    commitStageAll: 'Preparar tudo e commitar',
    commitAmend: 'Corrigir commit',
    commitMenuLabel: 'Mais opções de commit',
    amendToggle: 'Corrigir último commit (amend)',
    stageAllAndCommit: 'Preparar tudo e commitar',
    commitDisabledEmpty: 'Escreva uma mensagem de commit',
    commitDisabledNothing: 'Nenhuma alteração para commitar',
    // Diff viewer (GIT-R4).
    diffUnified: 'Unificado',
    diffSideBySide: 'Lado a lado',
    diffModeLabel: 'Modo de exibição das diferenças',
    diffBinaryTitle: 'Arquivo binário',
    diffBinaryDescription: 'As diferenças de arquivos binários não podem ser exibidas como texto.',
    diffTooLargeTitle: 'Diferenças muito grandes',
    diffTooLargeDescription:
      'Este arquivo mudou demais para exibir aqui. Abra o arquivo para ver o conteúdo.',
    diffEmptyTitle: 'Sem diferenças',
    diffEmptyDescription: 'Nenhuma alteração de conteúdo para mostrar.',
    diffSideWorking: 'árvore de trabalho',
    diffSideStaged: 'preparado',
    diffTitle: (name: string, side: string) => `${name} (${side})`,
    diffOldLineAria: 'Linha original',
    diffNewLineAria: 'Linha nova',
    // Status bar (GIT-R12).
    statusBarLabel: 'Estado do controle de versão',
    statusBranchAria: (branch: string) => `Branch atual: ${branch}. Trocar de branch`,
    statusSyncAria: (ahead: number, behind: number) =>
      `${ahead} à frente, ${behind} atrás. Sincronizar`,
    statusPublishAria: 'Publicar branch no remoto',
    statusChangesAria: (count: number) =>
      count === 1
        ? `${count} alteração. Abrir o controle de versão`
        : `${count} alterações. Abrir o controle de versão`,
    statusNoChangesAria: 'Sem alterações. Abrir o controle de versão',
    statusInitAria: 'Inicializar repositório git neste workspace',
    statusInit: 'Inicializar repositório',
    publishBranch: 'Publicar branch',
    // Branch picker (GIT-R6).
    branchPickerLabel: 'Trocar de branch',
    branchFilterPlaceholder: 'Buscar ou criar branch…',
    branchEmpty: 'Nenhum branch encontrado.',
    createBranchItem: (name: string) => `Criar branch “${name}”`,
    localBranches: 'Locais',
    remoteBranches: 'Remotos',
    currentBranchAria: (name: string) => `${name} (branch atual)`,
    checkoutAria: (name: string) => `Trocar para ${name}`,
    deleteBranchLabel: (name: string) => `Excluir branch ${name}`,
    deleteBranchTitle: 'Excluir branch?',
    deleteBranchDescription: (name: string) =>
      `O branch local “${name}” será excluído. Commits que só existem nele podem ser perdidos.`,
    deleteBranchConfirm: 'Excluir',
    deleteBranchCancel: 'Cancelar',
    // Remote sync (GIT-R7): overflow menu + op-result toasts.
    moreActions: 'Mais ações',
    fetchAction: 'Buscar (fetch)',
    pullAction: 'Receber (pull)',
    pushAction: 'Enviar (push)',
    syncAction: 'Sincronizar',
    toastFetchOk: 'Busca concluída',
    toastPullOk: 'Atualizado com o remoto',
    toastPushOk: 'Enviado para o remoto',
    toastSyncOk: 'Sincronizado com o remoto',
    toastPublishOk: 'Branch publicado',
    opFailed: 'A operação de git falhou',
    opDetails: 'Detalhes',
    opToastClose: 'Fechar aviso',
    opToastLabel: 'Resultado da operação de git',
    // History timeline (GIT-R8).
    historyToggle: 'Histórico',
    changesToggle: 'Alterações',
    historyEmpty: 'Nenhum commit ainda.',
    historyFileScope: (name: string) => `Histórico de ${name}`,
    historyClearScope: 'Ver todo o histórico',
    loadMore: 'Carregar mais',
    viewHistory: 'Ver histórico',
    commitAria: (subject: string, author: string, when: string) =>
      `${subject}, por ${author}, ${when}`,
    commitFilesHeader: (count: number) =>
      count === 1 ? `${count} arquivo alterado` : `${count} arquivos alterados`,
    commitDiffTitle: (hash: string) => `Commit ${hash}`,
    // Conflict resolution (GIT-R9).
    conflictOurs: 'Atual (HEAD)',
    conflictTheirs: 'Recebido',
    acceptCurrent: 'Aceitar atual',
    acceptIncoming: 'Aceitar recebido',
    acceptBoth: 'Aceitar ambos',
    conflictBlockAria: (n: number) => `Conflito ${n}`,
    conflictRemaining: (n: number) =>
      n === 1 ? '1 conflito não resolvido' : `${n} conflitos não resolvidos`,
    markResolved: 'Marcar como resolvido',
    conflictResolvedTitle: 'Sem conflitos neste arquivo',
    conflictResolvedDesc: 'Prepare-o para concluir o merge.',
    conflictLoadError: 'Não foi possível abrir o arquivo com conflitos.',
    mergeInProgress: 'Resolução de merge em andamento',
    mergeContinue: 'Continuar',
    mergeAbort: 'Abortar',
    // Stash (GIT-R10).
    stashSection: 'Stash',
    stashCreate: 'Guardar alterações',
    stashApply: 'Aplicar',
    stashPop: 'Pop',
    stashDrop: 'Descartar',
    stashAria: (index: number, message: string) => `Stash ${index}: ${message}`,
    stashDialogTitle: 'Guardar alterações (stash)',
    stashMessagePlaceholder: 'Mensagem (opcional)',
    stashIncludeUntracked: 'Incluir arquivos não rastreados',
    stashConfirm: 'Guardar',
    stashCancel: 'Cancelar',
    stashDropTitle: 'Descartar stash?',
    stashDropDescription: (message: string) =>
      `O stash “${message}” será removido definitivamente. Esta ação não pode ser desfeita.`,
    stashDropConfirm: 'Descartar',
    stashDropCancel: 'Cancelar',
    stashToggle: (count: number) => (count === 1 ? '1 stash' : `${count} stashes`),
    // Op-in-flight labels (busy id → human sentence).
    busyLabel: (op: string): string =>
      ({
        commit: 'Commitando…',
        sync: 'Sincronizando…',
        push: 'Enviando…',
        pull: 'Recebendo…',
        fetch: 'Buscando…',
        publish: 'Publicando…'
      })[op] ?? 'Processando…'
  },
  // Agent Change Review (M11) — the tiered review surface (bar, panel, card,
  // inline diff) over the single pending set.
  review: {
    // Per-hunk / per-file controls (HunkActions, one gesture everywhere, G3).
    accept: 'Aceitar',
    reject: 'Rejeitar',
    acceptAria: (target: string) => `Aceitar ${target}`,
    rejectAria: (target: string) => `Rejeitar ${target}`,
    // R-08: a change the agent never made is not the review's to throw away.
    rejectUserAuthoredReason:
      'Esta alteração é sua, não do agente — a revisão não descarta o seu trabalho.',
    hunkLabel: (n: number, total: number) => `Trecho ${n} de ${total}`,
    // Status labels (shape + text, never color alone, a11y).
    statusCreated: 'novo',
    statusModified: 'modificado',
    statusDeleted: 'removido',
    // +adds/-dels pills.
    addsDels: (adds: number, dels: number) => `+${adds} −${dels}`,
    // Review bar (ACR-R2.3).
    barPending: (n: number) => (n === 1 ? `${n} mudança pendente` : `${n} mudanças pendentes`),
    barReview: 'Revisar',
    barAcceptAll: 'Aceitar tudo',
    barRejectAll: 'Rejeitar tudo',
    barLabel: 'Mudanças do agente para revisar',
    // Sidebar panel (ACR-R2.4).
    panelTitle: 'Revisão do agente',
    railLabel: 'Revisão do agente',
    groupCreated: 'Criados',
    groupModified: 'Modificados',
    groupRemoved: 'Removidos',
    openDiffAria: (path: string) => `Abrir diferenças de ${path}`,
    // Empty state (ACR-R1.8) — teaches, never a void.
    emptyTitle: 'Sem mudanças para revisar',
    emptyDescription:
      'Quando o agente editar arquivos, as mudanças aparecem aqui para você aceitar ou rejeitar.',
    // Reject-all confirmation (the one destructive modal, G4).
    rejectAllTitle: 'Rejeitar todas as mudanças?',
    rejectAllDescription: (n: number) =>
      n === 1
        ? 'A mudança do agente será desfeita e o arquivo voltará ao estado anterior ao turno.'
        : `As ${n} mudanças do agente serão desfeitas e os arquivos voltarão ao estado anterior ao turno.`,
    rejectAllConfirm: 'Rejeitar tudo',
    rejectAllCancel: 'Cancelar',
    // In-chat change card (ACR-R2.2). Two scopes, stated as two scopes: the
    // header decides the whole turn, each row decides its own file. The header
    // used to say plain "Aceitar" while acting on everything — which read as a
    // per-file control and behaved like a batch one.
    cardTitle: (n: number) => (n === 1 ? 'Editei 1 arquivo' : `Editei ${n} arquivos`),
    cardReviewed: 'Revisado',
    cardAcceptAll: 'Aceitar tudo',
    cardRejectAll: 'Rejeitar tudo',
    cardAcceptAllAria: (n: number) =>
      n === 1 ? 'Aceitar a alteração deste turno' : `Aceitar as ${n} alterações deste turno`,
    cardRejectAllAria: (n: number) =>
      n === 1 ? 'Rejeitar a alteração deste turno' : `Rejeitar as ${n} alterações deste turno`,
    cardPendingCount: (n: number) => (n === 1 ? '1 pendente' : `${n} pendentes`),
    cardFileExpandAria: (path: string) => `Ver diferenças de ${path}`,
    cardFileCollapseAria: (path: string) => `Ocultar diferenças de ${path}`,
    cardFileReviewedAria: (path: string) => `${path} — já revisado`,
    cardExpand: 'Ver diferenças',
    cardCollapse: 'Ocultar diferenças',
    // Inline editor diff nav (ACR-R2.1).
    inlinePrevAria: 'Trecho anterior',
    inlineNextAria: 'Próximo trecho',
    inlineNav: (n: number, total: number) => `${n} de ${total}`,
    // STALE concurrent-edit guard (ACR-R3.2).
    staleTitle: 'Arquivo alterado por você',
    staleDescription: (path: string) =>
      `Você editou “${path}” depois do turno do agente. O que fazer com as mudanças do agente?`,
    staleKeepMine: 'Manter minhas edições',
    staleTakeAgent: 'Usar a do agente',
    staleCancel: 'Cancelar',
    // Undo-accept toast (ACR-R4.2).
    undoAccept: 'Mudança aceita',
    undoAction: 'Desfazer',
    // Workspace-switch guard for a pending set (ACR-R4.3).
    switchTitle: 'Sair com mudanças pendentes?',
    switchDescription: (n: number) =>
      n === 1
        ? 'Há 1 mudança do agente ainda não revisada neste workspace.'
        : `Há ${n} mudanças do agente ainda não revisadas neste workspace.`,
    switchAcceptAll: 'Aceitar tudo e sair',
    switchRejectAll: 'Rejeitar tudo e sair',
    switchKeep: 'Sair mantendo pendentes',
    switchCancel: 'Cancelar',
    // Keyboard-flow tooltips (ACR-R4.1).
    keyAcceptHint: 'Aceitar (A)',
    keyRejectHint: 'Rejeitar (R)',
    keyNextHint: 'Próximo (J / ↓)',
    keyPrevHint: 'Anterior (K / ↑)'
  },
  secondBrain: {
    // Activity-bar entry (SB-R2.1) + staged-raw badge (SB-R2.5) + the
    // health-check dot (SB-R10.4), both folded into the accessible name.
    railLabel: 'Bases de conhecimento',
    railPending: (n: number) => (n === 1 ? `${n} item para ingerir` : `${n} itens para ingerir`),
    railHealthDue: 'revisão pendente',
    // Panel header (SB-R2.3).
    panelTitle: 'Bases de conhecimento',
    pendingChip: (n: number) => (n === 1 ? `${n} item para ingerir` : `${n} itens para ingerir`),
    // Empty state (SB-R2.2) — inviting, not a void. O header do painel já diz
    // "Bases de conhecimento", então o título aqui reconhece o estado (não há
    // base ainda, e ela é por workspace) e deixa o valor para a descrição.
    emptyTitle: 'A squad ainda não tem uma base aqui',
    emptyDescription:
      'Reúna decisões, aprendizados e domínio num wiki versionado que o agente organiza pra você.',
    emptyCta: 'Configurar base',
    // O que a base devolve, na ordem em que o usuário encontra: perguntar,
    // alimentar, manter. Substituem um parágrafo genérico por três promessas.
    promiseAsk: 'Pergunte e receba a síntese no chat',
    promiseCapture: 'Cole texto ou grave áudio — transcrição no seu computador',
    promiseOwn: 'Markdown versionado, dentro do seu workspace',
    // Todo comando da base de conhecimento abre uma conversa própria — dizer isso
    // ANTES do clique evita a surpresa de ver o chat atual ser sequestrado.
    emptyCtaNote:
      'Abre uma conversa nova com o agente. A conversa atual continua em segundo plano.',
    // Configuração em andamento: o agente está entrevistando o usuário no chat
    // e a base aparece aqui sozinha quando tocar o disco.
    setupRunningTitle: 'Configurando a base…',
    setupRunningDescription:
      'O agente está conduzindo a configuração na conversa. Responda as perguntas dele — a base aparece aqui assim que for criada.',
    setupRecheck: 'Verificar de novo',
    setupRelaunch: 'Rodar o comando de novo',
    // A base acabou de nascer: confirmar e entregar o próximo passo.
    readyTitle: (name: string) => `Base pronta — ${name}`,
    readyDescription: 'Ingira o primeiro conhecimento para ela começar a ser útil.',
    readyCta: 'Ingerir agora',
    readyDismiss: 'Dispensar aviso',
    // Aviso de que o comando abriu conversa própria (e como voltar).
    launchSetup: 'Configuração da base',
    launchIngest: 'Ingestão',
    launchQuery: 'Pergunta à base',
    launchLint: 'Revisão da base',
    launchToastTitle: (label: string) => `${label} abriu uma conversa nova`,
    launchToastDescription: 'A conversa anterior continua rodando em segundo plano.',
    launchToastResume: 'Voltar para ela',
    launchToastClose: 'Dispensar aviso',
    launchToastLabel: 'Avisos da base de conhecimento',
    // Action row (SB-R2.4) — launch the agent commands.
    actionsTitle: 'Ações',
    ingest: 'Ingerir',
    ingestHint: 'Adicionar conhecimento à base',
    query: 'Consultar',
    queryHint: 'Perguntar à base de conhecimento',
    lint: 'Revisar',
    lintHint: 'Health-check: organiza e sanea o wiki',

    // --- Ask surface (SB-R9): perguntar qualquer coisa à base, de qualquer
    // lugar do app. A resposta é sintetizada pelo agente e sai no chat.
    ask: 'Perguntar à base',
    askHint: 'Busca e sintetiza a partir do wiki',
    askShortcut: 'Ctrl+Shift+K',
    askOpenLabel: 'Perguntar à base (Ctrl+Shift+K)',
    askDescription: 'O agente lê o wiki, sintetiza e responde no chat.',
    askPlaceholder: 'O que você quer saber?',
    askFieldLabel: 'Sua pergunta',
    askSubmit: 'Perguntar',
    askSubmitHint: 'Enter para perguntar · Shift+Enter para quebrar linha',
    askStartersTitle: 'Comece por',
    // Cada starter vira o começo do campo (o '…' é removido na inserção).
    askStarterDecision: 'O que decidimos sobre…',
    askStarterHow: 'Como funciona…',
    askStarterOwner: 'Quem cuida de…',
    askStarterSummary: 'Resuma o que sabemos sobre…',
    askRecentTitle: 'Perguntas recentes',
    // Mesmo guard da folha de ingestão, com o verbo desta superfície.
    askNoVaultDescription:
      'Ainda não existe uma base de conhecimento neste workspace. Configure-a e depois volte para perguntar.',
    askUseRecent: (question: string) => `Perguntar de novo: ${question}`,
    askPendingNote: (n: number) =>
      n === 1
        ? '1 item ainda não foi organizado no wiki — a resposta pode não considerá-lo.'
        : `${n} itens ainda não foram organizados no wiki — a resposta pode não considerá-los.`,

    // --- Health-check cadence (SB-R10). A prática do skill: rodar
    // /second-brain-lint a cada 10 ingestões ou uma vez por mês.
    healthTitle: 'Saúde da base',
    healthPractice: 'A cada 10 ingestões ou uma vez por mês',
    healthMeterAria: (n: number, total: number) =>
      `${n} de ${total} ingestões desde a última revisão`,
    healthCount: (n: number, total: number) =>
      n === 1 ? `1 de ${total} ingestões` : `${n} de ${total} ingestões`,
    healthNeverLinted: 'Nunca revisada',
    healthLintedToday: 'Revisada hoje',
    healthLintedYesterday: 'Revisada ontem',
    healthLintedDays: (n: number) => `Revisada há ${n} dias`,
    healthNextBoth: (ingests: number, days: number) =>
      `Próxima revisão em ${ingests === 1 ? '1 ingestão' : `${ingests} ingestões`} ou ${
        days === 1 ? '1 dia' : `${days} dias`
      }`,
    healthNextIngests: (n: number) =>
      n === 1 ? 'Próxima revisão em 1 ingestão' : `Próxima revisão em ${n} ingestões`,
    healthDueTitle: 'Hora do health-check',
    healthDueIngests: (n: number) =>
      n === 1 ? '1 ingestão desde a última revisão' : `${n} ingestões desde a última revisão`,
    healthDueTime: (n: number) => `A última revisão foi há ${n} dias`,
    healthDueNever: 'A base nunca passou por uma revisão',
    healthCta: 'Revisar agora',
    healthSnooze: 'Depois',
    healthSnoozed: 'Lembrete adiado — a base segue precisando de revisão',
    healthNudgeDismiss: 'Dispensar lembrete',
    // Wiki browser (SB-R2.3, T8).
    wikiTitle: 'Wiki',
    indexTitle: 'Índice',
    wikiEmpty: 'O wiki ainda não tem páginas. Ingira algum conhecimento para começar.',
    openFileAria: (path: string) => `Abrir ${path}`,
    // Botão flutuante da base + seu menu (SB-R3.1, SB-R3.5, SB-R9.1):
    // perguntar à base no topo, formas de capturar logo abaixo.
    // Distinto da entrada da activity bar ("Bases de conhecimento"): dois
    // controles com o mesmo nome acessível seriam indistinguíveis.
    fabLabel: 'Base de conhecimento — perguntar ou capturar',
    fabMenuLabel: 'Ações da base de conhecimento',
    fabCaptureTitle: 'Capturar',
    // One vocabulary for the three sources: the FAB menu opens the sheet on a
    // tab, so a menu that says "Colar texto" landing on a tab that says
    // "Escrever" is the same thing under two names — exactly the drift the
    // shared-transcript redesign exists to remove.
    fabText: 'Escrever',
    fabAudioFile: 'Enviar áudio',
    fabRecord: 'Ditar ao vivo',
    // Ingestion sheet (SB-R3.2–3.4).
    ingestTitle: 'Ingerir conhecimento',
    ingestDescription: 'O conteúdo vai para a base e o agente organiza no wiki.',
    ingestTextPlaceholder: 'Cole aqui o que a squad precisa lembrar…',
    ingestConfirm: 'Ingerir',
    ingestCancel: 'Cancelar',
    ingestStaging: 'Ingerindo…',
    ingestError: 'Não foi possível ingerir o conteúdo.',
    // No-vault guard (SB-R3.3).
    ingestNoVaultTitle: 'Configure a base primeiro',
    ingestNoVaultDescription:
      'Ainda não existe uma base de conhecimento neste workspace. Configure-a e depois volte para ingerir.',
    // Audio-file tab (SB-R4.3–4.6).
    ingestPickAudio: 'Escolher arquivo de áudio',
    ingestAudioHint: 'wav, mp3, m4a, ogg ou webm — a transcrição acontece no seu computador.',
    ingestDropTitle: 'Arraste seus áudios aqui',
    ingestDropRejected: (n: number) =>
      n === 1 ? '1 arquivo ignorado: não é áudio.' : `${n} arquivos ignorados: não são áudio.`,
    ingestTranscriptLabel: 'Transcrição (edite antes de ingerir)',
    ingestCharCount: (n: number) => (n === 1 ? '1 caractere' : `${n} caracteres`),
    // The three sources, as tabs (SB-R3.2). "Ditar ao vivo" replaced "Gravar":
    // the mode no longer produces a recording to transcribe afterwards, it
    // writes into the transcript while you speak, and the label has to say so.
    sourceWrite: 'Escrever',
    sourceAudio: 'Enviar áudio',
    sourceLive: 'Ditar ao vivo',
    sourceGroupLabel: 'Como você quer capturar',
    // Staging step (SB-R4.7) — files wait until the user asks for the pass.
    stageTitle: (n: number) => (n === 1 ? '1 áudio pronto' : `${n} áudios prontos`),
    stageTotalSize: (mb: string) => ` · ${mb} no total`,
    stageAdd: 'Adicionar mais',
    stageClear: 'Limpar',
    stageRemove: (name: string) => `Remover ${name}`,
    stageTranscribe: (n: number) => (n === 1 ? 'Transcrever 1 áudio' : `Transcrever ${n} áudios`),
    stageTranscribing: 'Transcrevendo…',
    stageHint:
      'Nada é enviado para a internet. A transcrição aparece abaixo para você revisar antes de ingerir.',
    // The document everything converges on.
    documentLabel: 'Transcrição',
    documentLabelText: 'Conteúdo',
    documentHintAudio: 'Revise e corrija o que o modelo entendeu antes de ingerir.',
    documentHintLive: 'O texto aparece aqui enquanto você fala — pode editar durante ou depois.',
    documentClear: 'Limpar transcrição',
    documentEmptyAudio: 'A transcrição aparece aqui assim que o modelo terminar.',
    documentEmptyLive: 'As primeiras palavras aparecem aqui alguns segundos após você começar.',
    // Live dictation console (SB-R5.6).
    liveStart: 'Começar a ditar',
    liveStop: 'Concluir o ditado',
    liveDiscard: 'Descartar',
    liveRetry: 'Tentar de novo',
    liveIdleTitle: 'Fale e o texto aparece embaixo',
    liveIdleHint: 'A transcrição acontece no seu computador, trecho a trecho, enquanto você fala.',
    // Everything the console *says* while a take runs comes from `dictation.*`
    // through `dictationView` — the same vocabulary the chat composer's
    // transport uses. Two surfaces describing one state machine in two sets of
    // words is how "Ouvindo…" and "Escutando…" end up in the same product.
    liveMicRequest: 'Liberar microfone',
    // What the local engine is doing. Each phase says whether it can be
    // measured — an honest indeterminate state is what replaced the old
    // "Preparando o modelo… 100%" that then sat still (SB-R4.2).
    phaseDownloading: 'Baixando o modelo',
    phaseDownloadingHint: 'Só na primeira vez — depois ele fica salvo no seu computador.',
    phaseLoading: 'Carregando o modelo',
    phaseWarming: 'Preparando o modelo',
    phaseWarmingHint: 'Esta etapa não tem porcentagem. Na primeira vez pode levar alguns minutos.',
    phaseTranscribing: 'Transcrevendo o áudio',
    phaseTranscribingHint: 'Tudo acontece no seu computador — nada é enviado para a internet.',
    // Per-audio status in the queue (one row per file, SB-R4.5).
    jobQueued: 'Na fila',
    jobDecoding: 'Lendo o áudio…',
    jobTranscribing: 'Transcrevendo…',
    jobDone: (chars: number) => `Transcrito · ${chars} caracteres`,
    jobDetails: 'Detalhes técnicos',
    jobRemove: (name: string) => `Remover ${name} da lista`,
    // Why "Ingerir" cannot run yet — stated in words beside the button.
    ingestBlockedWorking: 'Aguarde a transcrição terminar.',
    ingestBlockedEmptyText: 'Escreva ou cole algo para ingerir.',
    ingestBlockedEmptyAudio: 'Escolha um áudio e peça a transcrição.',
    ingestBlockedEmptyLive: 'Comece a ditar — o texto aparece acima.',
    ingestReady: 'Pronto para ingerir.',
    ingestModelLabel: 'Modelo',
    ingestManageModels: 'Gerenciar modelos',
    // Honest, specific decode failures (SB-R4.6).
    ingestAudioEmpty: 'O arquivo de áudio está vazio.',
    ingestAudioUnsupported: 'Não foi possível ler esse áudio. Tente wav, mp3, m4a, ogg ou webm.',
    ingestAudioSilent: 'Não há som nesse áudio.',
    ingestTranscribeFailed: 'Não foi possível transcrever o áudio.',
    // Recorder (SB-R5).
    recordStart: 'Gravar',
    recordStop: 'Parar',
    recordAgain: 'Gravar de novo',
    recordElapsed: 'Tempo de gravação',
    recordHint: 'Fale à vontade — o áudio é transcrito no seu computador.',
    recordSilent: 'Nenhum som detectado — verifique o microfone.',
    recordTakeName: (at: Date) =>
      `Gravação ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    recordDenied:
      'O microfone está bloqueado. Libere o acesso ao microfone nas configurações do sistema e tente de novo.',
    recordUnavailable: 'Nenhum microfone foi encontrado neste computador.',
    recordRetry: 'Tentar de novo',
    recordingLabel: 'Gravando',
    ingestAudioSoon: 'O gravador chega já já.',
    // Model picker (SB-R7.4) — the inline chooser beside the transcript.
    modelPickerLabel: 'Modelo de transcrição',
    modelPickerShort: 'Modelo',
    modelPickerTrigger: (id: string) => `Modelo: ${id}`,
    modelAuto: 'Automático',
    modelAutoWith: (id: string) => `Automático · ${id}`,
    modelAutoChosen: (ram: number) => `Escolhido para este computador (${ram} GB de memória).`,
    modelPinnedBundled: 'Você escolheu este. Já vem no aplicativo.',
    modelPinned: 'Você escolheu este.',
    modelBundled: 'no aplicativo',
    modelBundledSuffix: ' · no aplicativo',
    modelBundledExplain: 'Os três já vêm instalados — nada para baixar.',
    modelNeedsDownload: 'baixar',
    modelTradeoffTiny: 'O mais rápido',
    modelTradeoffBase: 'Equilibrado',
    modelTradeoffSmall: 'O mais preciso',
    modelMoreModels: 'Ver todos os modelos…',
    modelParamsSize: (params: string, mb: number) =>
      `${params} · ${mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`}`,
    // Model manager (SB-R7.1/7.2).
    modelsTitle: 'Modelos de transcrição',
    modelsDescription:
      'Os modelos rodam no seu computador. Baixe uma vez e a transcrição funciona offline.',
    modelsColModel: 'Modelo',
    modelsColParams: 'Parâmetros',
    modelsColSize: 'Tamanho',
    modelsColVram: 'VRAM',
    modelsColSpeed: 'Velocidade',
    modelsRecommended: 'Recomendado',
    modelsDownloaded: 'Baixado',
    modelsEnglishOnly: 'só inglês',
    modelsDownload: 'Baixar',
    modelsDelete: 'Excluir',
    modelsDownloading: (pct: number) => `Baixando… ${pct}%`,
    modelsSizeMb: (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`),
    modelsVramGb: (gb: number) => `~${gb} GB`,
    modelsClose: 'Fechar',
    modelsUse: 'Usar',
    modelsInUse: 'Em uso',
    modelsDeleteAria: (id: string) => `Excluir o modelo ${id}`,
    modelsDownloadAria: (id: string) => `Baixar o modelo ${id}`,
    // Why a model was recommended — keyed by whisperHardware's reason union.
    modelsBundledBadge: 'No aplicativo',
    modelsBundledNote:
      'tiny, base e small já vêm instalados: funcionam offline, sem download, desde o primeiro uso.',
    modelsReasonLowMemory: (ram: number) => `Recomendado: pouca memória disponível (${ram} GB).`,
    modelsReasonCpuOnly: (cores: number) =>
      `Recomendado: sem GPU dedicada e ${cores} núcleos — um modelo leve responde na hora.`,
    modelsReasonNoGpu: 'Recomendado: sem GPU dedicada, um modelo leve responde melhor.',
    modelsReasonDiscreteGpu: (ram: number) => `Recomendado: GPU dedicada e ${ram} GB de memória.`,
    modelsReasonBalanced: 'Recomendado: bom equilíbrio entre velocidade e qualidade aqui.',
    modelsReasonUnknown: 'Não foi possível avaliar seu hardware — usando o padrão.'
  },
  actionRail: {
    ariaLabel: 'Ferramentas do workspace',
    searchLabel: 'Buscar arquivos no workspace',
    appSettingsLabel: 'Configurações do aplicativo',
    // git-management (M10): the activity-bar view entries + change badge.
    explorerView: 'Explorador',
    scmView: 'Controle de versão',
    scmChangeCount: (count: number) =>
      count === 1 ? `${count} alteração pendente` : `${count} alterações pendentes`
  },
  // Workspace file search (Ctrl+P palette).
  // design-studio (M18): the Bancada. Copy lives here like every other
  // surface's — the Studio is app chrome, not agent output.
  designStudio: {
    emptyScreensTitle: 'Nenhuma Tela reconhecida nesta Spec',
    emptyScreensDescription:
      'A Spec foi lida inteira, mas nada nela nomeia uma Tela. Procuramos por:',
    probeScreenHeading: 'Títulos de Tela — "## Tela — Login", "### Screen: Checkout"',
    probeIaTable:
      'A tabela de Arquitetura da Informação — a primeira coluna chamada Surface, Screen ou Tela',
    emptyScreensHint: 'Acrescente uma dessas formas à Spec e abra o Design Studio de novo.',
    emptyScreensAction: 'Abrir a Spec no editor',
    specErrorTitle: 'Não foi possível ler a Spec',
    specErrorRetry: 'Tentar de novo',
    tabAria: (spec: string) => `Design Studio — ${spec}`,
    loading: 'Lendo a Spec…',
    screensPaneTitle: 'Telas',
    treePaneTitle: 'Árvore',
    inspectorPaneTitle: 'Inspetor',
    stageAria: 'Palco',
    previewFrameTitle: 'Preview da Tela',
    resizeHandleLabel: 'Redimensionar colunas do Design Studio',
    toolbarAria: 'Ações do Design Studio',
    screenListAria: 'Telas desta Spec',
    openTreeDrawer: 'Abrir a Árvore',
    openInspectorDrawer: 'Abrir o Inspetor',
    closeDrawer: 'Fechar',
    focusModeNarrowHint: 'A janela está estreita — o Modo Foco devolve o palco inteiro.',
    screenEdited: 'editada nesta sessão',
    screenAuto: 'gerada automaticamente',
    screenCount: (count: number) => (count === 1 ? '1 Tela' : `${count} Telas`),
    screenPickerAria: 'Trocar de Tela',
    viewportAria: 'Tamanho do dispositivo',
    viewportMobile: 'Mobile',
    viewportTablet: 'Tablet',
    viewportDesktop: 'Desktop',
    viewportCustom: 'Personalizado',
    viewportWidthAria: 'Largura em pixels',
    viewportHeightAria: 'Altura em pixels',
    undo: 'Desfazer',
    redo: 'Refazer',
    focusModeEnter: 'Modo Foco',
    focusModeExit: 'Sair do Modo Foco',
    focusModeHint: 'O palco ocupa a janela inteira',
    treeAria: 'Árvore de Componentes desta Tela',
    // T5.5 (DS-R7 AC-1/AC-4): o que se escolhe ao adicionar — Componente e slot,
    // ambos vindos do catálogo do Adaptador ativo, nunca de uma lista fixa.
    treeAddLabel: 'Adicionar Componente',
    treeAddTagLabel: 'Componente',
    treeAddTagPlaceholder: 'Escolha um Componente',
    treeAddSlotLabel: 'Slot',
    treeAddSlotDefault: '(padrão)',
    treeAddInto: (tag: string) => `Dentro de ${tag}`,
    treeAddAsRoot: 'Como o primeiro Componente da Tela',
    treeAddConfirm: 'Adicionar',
    treeAddCancel: 'Cancelar',
    // T5.6 (DS-R7 AC-2/AC-3/AC-5): mover é para dentro/para fora, porque é o
    // único par de gestos que o teclado também alcança (DS-R18).
    treeRemove: 'Remover',
    treeMoveInside: 'Mover para dentro',
    treeMoveInsideHint: 'Torna este Componente filho do Componente acima dele',
    treeMoveOutside: 'Mover para fora',
    treeMoveOutsideHint: 'Move este Componente para junto do Componente que o contém',
    // FIX-1 (spec.md Edge Cases): a Spec mudou em disco. A sessão continua
    // válida de propósito — a Spec é somente leitura e já foi consumida —, então
    // isto avisa sem interromper e sem recarregar nada.
    specOriginChanged: 'A Spec mudou em disco desde que esta aba foi aberta.',
    specOriginOpen: 'Abrir a Spec',
    specOriginDismiss: 'Dispensar o aviso',
    // T5.7 (DS-R7, §3.10): a Tela sem Componentes ensina os dois caminhos —
    // gerar com a Skill e adicionar à mão.
    screenEmptyTitle: 'Esta Tela ainda não tem Componentes',
    screenEmptyDescription:
      'Gere uma primeira versão a partir da Spec ou escolha o primeiro Componente você mesmo.',
    screenEmptyGenerate: 'Gerar com a Skill',
    // T6.2 (DS-R2): toda espera assíncrona tem estado visível. As fases vêm do
    // main como termos fechados; a frase é daqui, como toda copy.
    skillPhaseReading: 'Lendo a Spec…',
    skillPhaseChoosing: 'Escolhendo Componentes…',
    skillPhaseComposing: 'Compondo a Tela…',
    skillRunning: 'A Skill está compondo esta Tela',
    skillErrorTitle: 'A Skill não conseguiu gerar a Tela',
    skillViolationTitle: 'O Design System ativo não tem o que o pedido precisa',
    skillRetry: 'Tentar de novo',
    // T6.5 (DS-R10, §3.7): o Chat é uma faixa. O chip torna o contexto padrão
    // — o Componente selecionado — visível em vez de mágico; o ✕ o solta.
    chatAria: 'Chat de Iteração desta Tela',
    chatTitle: 'Iteração',
    chatContext: (tag: string) => `no contexto: ${tag}`,
    chatReleaseContext: 'Soltar o contexto e falar da Tela inteira',
    chatExpand: 'Abrir a conversa',
    chatCollapse: 'Fechar a conversa',
    chatPlaceholder: 'Escreva o que mudar…',
    chatSend: 'Enviar pedido à Skill',
    chatJumpToLatest: 'Ir para a mensagem mais recente',
    // T6.6 (DS-R9 AC-5): o turno diz o que fez e oferece desfazê-lo inteiro.
    chatTurnChanges: (count: number) => (count === 1 ? '1 mudança' : `${count} mudanças`),
    chatUndoTurn: 'Desfazer este turno',
    inspectorEmptyTitle: 'Nada selecionado',
    inspectorEmptyDescription:
      'Clique em qualquer elemento no palco para editar as propriedades dele.',
    inspectorEmptyAction: 'Escolher na Árvore',
    inspectorGroupAppearance: 'Aparência',
    inspectorGroupState: 'Estado',
    inspectorGroupContent: 'Conteúdo',
    inspectorGroupAdvanced: 'Avançado',
    // T7.4 (DS-R14/DS-R15): exportar é escolher **quais** Telas e para onde. O
    // relatório fica no mesmo lugar porque um lote pode ser meio bom.
    exportLabel: 'Exportar',
    exportDialogTitle: 'Exportar Telas',
    exportDialogDescription:
      'Cada Tela vira um arquivo HTML autocontido — componentes vivos, CSS e ícones embutidos, sem depender de rede.',
    exportListAria: 'Telas a exportar',
    exportScreenAria: (title: string) => `Exportar a Tela ${title}`,
    exportConfirm: 'Escolher a pasta e exportar',
    exportAgain: 'Exportar de novo',
    exportCancel: 'Cancelar',
    exportClose: 'Fechar',
    exportDone: (count: number, dir: string) =>
      count === 1 ? `1 Tela exportada em ${dir}` : `${count} Telas exportadas em ${dir}`
  },
  fileSearch: {
    dialogLabel: 'Buscar arquivos no workspace',
    placeholder: 'Buscar arquivos no workspace…',
    empty: 'Nenhum arquivo corresponde à busca.',
    hint: '↑ ↓ navega · Enter abre · Esc fecha',
    openAria: (name: string) => `Abrir arquivo ${name}`,
    /** design-studio DS-R1 AC-1: the palette's second way in — the workspace's Specs. */
    designStudioGroup: 'Design Studio',
    openDesignStudioAria: (name: string) => `Abrir ${name} no Design Studio`
  },
  // npm-distribution T10 (ND-R6): the self-update flow's copy — `UpdateNotice`
  // (Tier 2, design.md §5 mock-up) and `UpdateCenter` (Tier 3, T13's
  // restructured `AppSettingsSheet` — the former `appSettings.*` namespace
  // that lived here is retired now that nothing references it anymore).
  // Register throughout: an invitation, never a warning (ND-R6.7) — "Nova
  // versão disponível", never "Atualização necessária". Several keys are
  // shared verbatim between Tier 2 and Tier 3 (design.md: the center's
  // version block is "the same state machine as the notice, roomier").
  update: {
    // Tier 1 — the ambient dot on the rail gear (T12, design.md §5 Tier 1).
    // ND-R6.5: a dot alone is a color-only cue, so it needs an accessible name.
    pendingDotAria: 'Atualização disponível',

    // Tier 3 — `UpdateCenter` shell (design.md §5, "the deliberate visit").
    // Sheet title/description + the identity block's version line + the
    // version-block's section heading + the release-notes accordion trigger.
    title: 'Aplicativo',
    description: 'Versão, atualizações e informações do Hive.',
    versionLabel: (version: string) => `Versão ${version}`,
    updatesSectionLabel: 'Atualizações',
    releaseNotesTrigger: 'Novidades desta versão',

    // T11: `UpdateNotice` mounts its own dedicated Radix Toast viewport
    // (bottom-left, above the gear — distinct from the DS's shared
    // bottom-right one, design.md §5.2). The SR-only region name Radix's
    // `ToastViewport` exposes; `{hotkey}` is a literal placeholder Radix
    // itself substitutes (see the DS's `ToastViewport`'s own `label` default).
    viewportLabel: 'Notificações de atualização ({hotkey})',

    // Tier 2 — `UpdateNotice`, `available` state (design.md §5.2 mock-up).
    noticeTitle: 'Nova versão disponível',
    versionTransition: (current: string, next: string) => `${current} → ${next}`,
    // "≈ 92 MB · cerca de 1 min" — bytes rounded to a whole megabyte, a rough
    // duration in minutes. Approximate by design (the "≈"), unlike the exact
    // MB/percent readout of `downloadProgress` once a download is running.
    sizeEstimate: (bytes: number, minutes: number) =>
      `≈ ${Math.round(bytes / (1024 * 1024))} MB · cerca de ${minutes} min`,
    notesTeaser: (notes: string) => notes,
    viewNotesCta: 'Ver novidades',
    // Primary/secondary/tertiary actions (ND-R6.1): refusal is a first-class
    // choice, not a hidden one. Whoever builds T11: give "Agora não" the same
    // visual weight as "Atualizar agora" (a ghost button beside it, not a
    // smaller one) — "Pular esta versão" stays present, quieter, never
    // tucked into a menu.
    updateNowCta: 'Atualizar agora',
    notNowCta: 'Agora não',
    skipVersionCta: 'Pular esta versão',

    // `checking` / `up-to-date` — Tier 3's status line absent a result yet.
    checkingLabel: 'Verificando atualizações…',
    upToDateLabel: 'Você está na versão mais recente.',

    // `downloading` — "38,4 MB de 92,1 MB · 41%", `--ff-num` in the design.
    downloadProgress: (transferredBytes: number, totalBytes: number, percent: number) =>
      `${megabytesLabel(transferredBytes)} MB de ${megabytesLabel(totalBytes)} MB · ${percent}%`,
    downloadProgressAria: 'Progresso do download da atualização',
    cancelCta: 'Cancelar',

    // `verifying` — the checksum beat (design.md §5: naming the check and
    // showing a hash fragment turns a dead pause into a moment of trust).
    verifyingLabel: 'Verificando integridade',
    verifyingHash: (integrity: string) => integrity.replace(/^sha512-/, '').slice(0, 12),

    // `downloaded`
    readyTitle: 'Pronto para instalar',
    readyBody: 'O Hive fecha e reabre.',
    // ND-R4.3 — platforms with no apply step (v1: everything but Windows)
    // stop here and are told plainly that finishing the install is manual.
    readyManualBody: 'Este sistema ainda não instala sozinho — abra o instalador para concluir.',
    restartCta: 'Reiniciar e instalar',
    laterCta: 'Depois',
    openInstallerCta: 'Abrir instalador',

    // `applying` — the brief beat between "Reiniciar e instalar" and the app
    // quitting to let the installer replace it (ND-R4.2): said plainly, never
    // a silent disappearance.
    applyingLabel: 'Instalando — o Hive volta sozinho em instantes.',

    // `error` — ND-R3.3 wants a *distinct* integrity error; network/apply
    // failures read naturally sharing one generic recovery message.
    errorGeneric:
      'Não foi possível concluir a atualização. Tente de novo ou abra o instalador manualmente.',
    errorIntegrity: 'O arquivo baixado não pôde ser confirmado como íntegro. Tente baixar de novo.',
    retryCta: 'Tentar de novo',

    // Tier 3 — `UpdateCenter` additions (design.md §5, "the deliberate visit").
    lastCheckedLabel: (relative: string) => `Verificado ${relative}`,
    // T15 fix: the status line (and its refresh action) is a fixed fixture
    // of the identity block, not conditional on a check having ever
    // succeeded — before the first one (a fresh install, or a visit to this
    // sheet in the brief window before the launch check resolves), this
    // fallback keeps the refresh button reachable instead of the whole line
    // silently disappearing (found by visual validation, T15).
    neverCheckedLabel: 'Ainda não verificado',
    refreshAria: 'Verificar atualizações agora',
    // Skipped-version recovery (ND-R5.5) — declining never strands the user.
    skippedVersionNote: (version: string) => `Você pulou a versão ${version}`,
    installSkippedCta: 'Instalar mesmo assim',
    // `unsupported` (dev/unpacked builds, ND-R6.8) — this namespace's own
    // home for the honest note; `appSettings.devNote` above says the same
    // thing for the flow this feature replaces (left untouched until T14).
    devNote: 'Atualizações automáticas ficam disponíveis apenas na versão instalada do aplicativo.'
  },
  // role-personalization RP-R6 + agent-selection AG-R3.2: the profile sheet.
  profile: {
    openLabel: 'Abrir configurações de perfil',
    title: 'Perfil',
    description: 'Personalize o Hive para o seu jeito de trabalhar.',
    nameSectionLabel: 'Seu nome',
    nameFieldLabel: 'Como você quer ser chamado?',
    nameHint: 'O Hive e os agentes usam esse nome para falar com você.',
    namePlaceholder: 'Seu nome',
    nameSavedLabel: 'Salvo',
    // shortcut-scopes: the role is chosen once, at first access, and is shown
    // here as context (it's what the shortcut defaults are derived from) —
    // not as a control. Changing it would silently rewrite two shortcut sets.
    roleSectionLabel: 'Seu papel',
    roleLockedHint: 'Escolhido no primeiro acesso. Ele define os atalhos padrão do seu dia a dia.',
    // The shortcuts entry point, mirroring the picker's two sets.
    shortcutsSectionLabel: 'Seus atalhos',
    shortcutsSectionHint:
      'Dois conjuntos: o que aparece para iniciar uma conversa e o que fica à mão durante ela.',
    shortcutsStartLabel: 'Para iniciar',
    shortcutsDuringLabel: 'Durante a conversa',
    shortcutsCount: (count: number) => (count === 1 ? '1 atalho' : `${count} atalhos`),
    shortcutsEmpty: 'Nenhum',
    shortcutsCta: 'Configurar atalhos',
    agentSectionLabel: 'Seus agentes',
    agentSectionHint:
      'Habilite os agentes que quiser usar. O agente padrão inicia cada nova conversa; troque por conversa no chat.',
    agentDefaultBadge: 'Padrão',
    agentSetDefaultAria: (agent: string) => `Definir ${agent} como agente padrão`,
    agentUnavailableHint: 'CLI não encontrada neste computador.',
    agentInstallCta: 'Como instalar',
    agentInstallCtaAria: (agent: string) => `Como instalar ${agent} (abre no navegador)`,
    agentEmptyWarning: 'Habilite ao menos um agente para conversar no Hive.',
    // agent-terminal: the terminal section of the profile sheet.
    shellSectionLabel: 'Terminal do agente',
    shellSectionHint:
      'Onde os agentes executam os comandos no seu computador. O Hive lista só o que existe nesta máquina.',
    replayTourCta: 'Rever o tour guiado',
    scopeNote: 'Seu perfil vale para todos os workspaces.',
    closeLabel: 'Fechar'
  },
  // agent-terminal (M20): the terminal picker. Names are product names
  // (`shellName`), so what lives here is the surrounding copy only.
  shell: {
    groupLabel: 'Terminal usado pelos agentes',
    autoLabel: 'Automático',
    // Two sentences because "Automático" means two different things. In POSIX
    // it follows the machine ($SHELL, which is also what the CLIs accept). On
    // Windows the machine's own default is o cmd — o único terminal em que
    // nenhum agente executa comando —, então seguir a máquina seria escolher
    // o pior. Dizer qual das duas regras está valendo é o mínimo.
    autoDescriptionSystem: (name: string) => `Segue o terminal do sistema: ${name}.`,
    autoDescriptionPicked: (name: string) => `O Hive escolhe o melhor para os agentes: ${name}.`,
    autoDescriptionEmpty: 'Nenhum terminal reconhecido para escolher.',
    liveBadge: 'Em uso',
    detecting: 'Procurando terminais…',
    // Not "Procurar de novo": the agents section, in this same sheet, already
    // owns that exact label — two identical buttons one scroll apart is
    // ambiguous by ear (a screen reader reads them the same) and by eye.
    rescan: 'Procurar terminais',
    scanSummary: (count: number) =>
      count === 1 ? '1 terminal encontrado' : `${count} terminais encontrados`,
    empty:
      'Nenhum terminal reconhecido nesta máquina. Os agentes continuam rodando com o padrão do sistema.',
    missingSelection: (name: string) =>
      `O terminal escolhido (${name}) não está mais neste computador. Enquanto isso os agentes usam o automático — a escolha volta sozinha se ele for reinstalado.`,
    // The block inside the selected row: one line per agent naming the shell
    // it really executes in. "Onde" and not "o que muda" — the old title
    // promised an explanation and the reader wanted a destination.
    routesTitle: 'Onde cada agente executa',
    routeUnknown: 'a CLI decide',
    commandShow: 'Ver o comando',
    commandHide: 'Ocultar o comando',
    commandCopy: 'Copiar',
    commandCopied: 'Copiado',
    installGitCta: 'Instalar o Git para Windows'
  },
  // Guided first-access tour (skippable at any moment).
  tour: {
    ariaLabel: 'Tour guiado do Hive',
    skipCta: 'Pular tour',
    backCta: 'Voltar',
    nextCta: 'Próximo',
    startCta: 'Começar',
    doneCta: 'Concluir',
    progressLabel: (current: number, total: number) => `Passo ${current} de ${total}`,
    welcomeTitle: 'Boas-vindas ao Hive',
    welcomeTitleNamed: (name: string) => `Olá ${name}, boas-vindas ao Hive`,
    welcomeBody:
      'Sua central para conduzir os fluxos do BMAD sem terminal. Este tour de 30 segundos mostra o essencial — dá para pular a qualquer momento.',
    shortcutsTitle: 'Seus atalhos',
    shortcutsBody:
      'Cada atalho executa o comando do BMAD correspondente — "Criar um PRD" dispara /bmad-prd, igualzinho a digitar o comando na conversa. Em "Personalizar" você escolhe estes, para iniciar, e também os que ficam à mão durante a conversa.',
    composerTitle: 'Converse do seu jeito',
    composerBody:
      'Escreva livremente, digite / para executar um comando do workspace ou @ para trazer arquivos como contexto.',
    railTitle: 'Encontre qualquer arquivo',
    railBody:
      'A busca do workspace localiza qualquer arquivo em segundos — clique aqui ou pressione Ctrl+P de qualquer lugar.',
    filesTitle: 'Os artefatos moram aqui',
    filesBody:
      'PRDs, histórias e documentos gerados pelos agentes aparecem nesta árvore — clique para ler e editar.',
    profileTitle: 'Deixe com a sua cara',
    profileBody:
      'Seu avatar, no canto superior direito, abre o perfil: nome, papel e agente. Você também pode rever este tour por lá.'
  },
  workUI: {
    resizeHandleLabel: 'Redimensionar painéis',
    // customizable-layout: movable panes (drag the pane header, or use the ↔ menu).
    paneChat: 'Conversa',
    paneEditor: 'Editor',
    paneMoveMenuLabel: (pane: string) => `Mover o painel ${pane}`,
    paneMoveLeft: 'Mover para a esquerda',
    paneMoveRight: 'Mover para a direita',
    workspaceChipTitle: (path: string) => `Workspace ativo: ${path}`,
    /** Action-oriented accessible name for the chip: it's a switcher, not a
        passive label — so the a11y name names both the current state and what
        activating it does. */
    workspaceChipAria: (path: string) =>
      `Workspace ativo: ${path}. Clique para trocar de workspace.`,
    /** Header at the top of the chip menu — states the menu's purpose. */
    switchWorkspace: 'Trocar de workspace',
    /** T7 (WS-R1.2/R7.1): workspace chip menu — "Abrir pasta…" entry. */
    openFolder: 'Abrir pasta…',
    /** T7 (WS-R1.2/R1.3/R7.1): workspace chip menu — Recentes section heading. */
    recents: 'Recentes',
    /** T8 (WS-R6.3): non-fatal errors when a candidate workspace can't be opened — the previous workspace stays active. */
    switchErrorMissing:
      'Não foi possível trocar de workspace: a pasta selecionada não foi encontrada.',
    switchErrorNotADirectory:
      'Não foi possível trocar de workspace: o caminho selecionado não é uma pasta.',
    switchErrorUnreadable:
      'Não foi possível trocar de workspace: não foi possível ler a pasta selecionada.'
  },

  /**
   * voice-prompt (M13): ditar direto no compositor. Toda a copy passa por
   * `dictationCopy.ts` ou pelos controles do `DictationBar` (VP-R6.5).
   *
   * O tom segue o produto: quieto quando não importa, explícito quando o
   * usuário pode perder algo. Duas frases carregam a promessa da feature e por
   * isso não são enxugadas — `preparingKeep` e `errorKeep` dizem, em voz alta,
   * que o áudio continua guardado. É a única coisa que o usuário não pode ver
   * por conta própria, e um take perdido é a falha imperdoável (VP-R4.4).
   */
  dictation: {
    /** Botão do microfone na barra do compositor (VP-R1.1). */
    start: 'Ditar',
    startHint: 'Ditar em voz alta',
    /** Estados do transporte (VP-R4.1–4.5). */
    listening: 'Ouvindo…',
    preparing: 'Preparando o motor…',
    preparingKeep: 'Pode falar — estou guardando seu áudio.',
    transcribing: (n: number) =>
      n === 1 ? 'Transcrevendo 1 trecho…' : `Transcrevendo ${n} trechos…`,
    finalizing: 'Finalizando…',
    queue: (n: number) => (n === 1 ? '1 trecho na fila' : `${n} trechos na fila`),
    silent: 'Não estou ouvindo nada',
    silentHint: 'Verifique o microfone ou fale mais perto.',
    autoStop: (seconds: number) => `Encerrando em ${seconds}…`,
    autoStopHint: 'Fale para continuar.',
    /** Controles do transporte. */
    finish: 'Concluir',
    discard: 'Descartar',
    retry: 'Tentar de novo',
    /** Tempo decorrido, exposto como `role="timer"` (VP-R4.5). */
    elapsed: (clock: string) => `Gravando há ${clock}`,
    /** Rótulo do medidor de nível — números viram barras, isto vira nome. */
    meterLabel: 'Nível do microfone',
    /** Falhas, cada uma com a sua causa (VP-R4.3–4.4). */
    denied: 'Sem acesso ao microfone',
    deniedHint: 'Autorize o microfone nas configurações do sistema e tente de novo.',
    unavailable: 'Nenhum microfone encontrado',
    unavailableHint: 'Conecte um microfone e tente de novo.',
    error: 'Não consegui transcrever este trecho',
    errorKeep: 'Seu áudio está guardado — pode tentar de novo.',
    /** Enviar durante o ditado finaliza antes de enviar (VP-R1.6). */
    finishAndSend: 'Concluindo o ditado antes de enviar…'
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

/** The three runs the provisioning gate is made of, in the order they happen. */
export type ProvisionStage = 'install' | 'update' | 'secondBrain'

/**
 * Reassurance copy for the provisioning gate, one sequence per stage — a
 * sibling export rather than a leaf of `ptBR` for the same reason as
 * `intentLabelsPtBR`: an array leaf would widen `t()`'s literal path union.
 *
 * Each sequence advances every few seconds and then *holds on its last line*,
 * so the tone has to survive an arbitrarily long wait. Hence the closing line
 * of each is written to stay true at ten seconds and at four minutes, and the
 * word "quase" only appears where the remaining work really is the tail of the
 * run. Nothing here promises a duration the app cannot keep — the honest
 * technical line runs directly underneath it.
 */
export const provisionMessagesPtBR: Record<ProvisionStage, readonly string[]> = {
  install: [
    'Estamos preparando o ambiente Hive para você trabalhar.',
    'Baixando o BMAD e os módulos que você escolheu.',
    'Ensinando os agentes o jeito da sua squad.',
    'Já está quase — deixando tudo pronto no seu workspace.'
  ],
  update: [
    'Conferindo se o BMAD deste workspace está em dia.',
    'Trazendo as novidades da squad.',
    'Quase lá — só alinhando as últimas peças.'
  ],
  secondBrain: [
    'Agora a base de conhecimento da squad.',
    'Preparando o lugar onde as decisões do time vão morar.',
    'Último passo — já abrimos o Hive em seguida.'
  ]
}

/**
 * Role display metadata (role-personalization RP-R1.2) — kept a sibling export
 * (not nested in `ptBR`) for the same `t()`-type reason as `intentLabelsPtBR`:
 * a string-indexed leaf would widen `t()`'s compile-time key union. `persona`
 * is the role's BMAD specialist first name (John/Winston/Sally/Murat/Amelia).
 */
export interface RoleMeta {
  name: string
  description: string
  persona: string
}

const roleMetaPtBR: Record<string, RoleMeta> = {
  pm: {
    name: 'Product Manager',
    description: 'Pesquisa de domínio, brainstorming, PRDs, briefs e histórias.',
    persona: 'John'
  },
  'tech-lead': {
    name: 'Tech Lead',
    description: 'Arquitetura técnica, épicos e quebra em histórias.',
    persona: 'Winston'
  },
  ux: {
    name: 'UX Designer',
    description: 'Especificações de experiência e design de interface.',
    persona: 'Sally'
  },
  qa: {
    name: 'QA',
    description: 'Cenários de teste e automação de qualidade.',
    persona: 'Murat'
  },
  dev: {
    name: 'Desenvolvedor',
    description: 'Implementação de histórias e revisão de código.',
    persona: 'Amelia'
  }
}

const GENERAL_ROLE_META: RoleMeta = {
  name: 'Geral',
  description: 'Todos os fluxos do BMAD.',
  persona: 'BMAD'
}

/** Resolves a role's pt-BR display metadata by `RoleId`, falling back to a
 *  neutral "general" descriptor for the internal default / unknown ids. */
export function roleMeta(id: string): RoleMeta {
  return roleMetaPtBR[id] ?? GENERAL_ROLE_META
}

/**
 * Role-action labels keyed by `RoleActionDef.key` (main/roleCatalog.ts) — again
 * a sibling export + helper (not a `ptBR` leaf) to protect `t()`'s key union.
 * Persona actions ("Conversar com <persona>") are keyed `persona-*`.
 */
const roleActionLabelsPtBR: Record<string, string> = {
  'domain-research': 'Pesquisar o domínio',
  brainstorm: 'Fazer um brainstorm',
  prd: 'Criar um PRD',
  'product-brief': 'Criar um product brief',
  'epics-stories': 'Gerar épicos e histórias',
  story: 'Criar uma história',
  architecture: 'Definir a arquitetura',
  'ux-spec': 'Gerar especificação de UX',
  'test-design': 'Desenhar cenários de teste',
  'test-automation': 'Automatizar testes',
  'dev-story': 'Implementar uma história',
  'code-review': 'Revisar o código',
  // shortcut-scopes: the PM's default in-conversation action — brings the
  // other BMAD agents into the thread that's already open.
  'party-mode': 'Reunir os agentes',
  'persona-pm': 'Conversar com John',
  'persona-architect': 'Conversar com Winston',
  'persona-ux': 'Conversar com Sally',
  'persona-qa': 'Conversar com Murat',
  'persona-dev': 'Conversar com Amelia'
}

/** Resolves a role action's pt-BR label by its catalog key, falling back to the raw key. */
export function roleActionLabel(key: string): string {
  return roleActionLabelsPtBR[key] ?? key
}

/**
 * pt-BR labels for workspace *skill* shortcuts, keyed by BMAD skill name
 * (shortcut-customization — the custom-selection sibling of
 * `roleActionLabelsPtBR`, which stays keyed by role-action key). Covers the
 * full catalog a stock BMAD install ships; an unknown/new skill falls back to
 * the workspace catalog's own display name via `shortcutLabel`.
 */
const skillLabelsPtBR: Record<string, string> = {
  // core
  'bmad-advanced-elicitation': 'Refinar com elicitação avançada',
  'bmad-brainstorming': 'Fazer um brainstorm',
  'bmad-customize': 'Personalizar o BMAD',
  'bmad-editorial-review-prose': 'Revisar a prosa',
  'bmad-editorial-review-structure': 'Revisar a estrutura do texto',
  'bmad-index-docs': 'Indexar documentos',
  // Same wording as the `party-mode` role-action key above: the picker's
  // preview resolves by skill key and the strip by action key, and the two
  // must not disagree about what the same shortcut is called. The BMAD name
  // still shows on the row's `/bmad-party-mode` subtitle and matches search.
  'bmad-party-mode': 'Reunir os agentes',
  'bmad-shard-doc': 'Fragmentar um documento',
  'bmad-help': 'Pedir ajuda ao BMAD',
  'bmad-checkpoint-preview': 'Revisar mudanças com checkpoint',
  // bmm — análise e planejamento
  'bmad-domain-research': 'Pesquisar o domínio',
  'bmad-market-research': 'Pesquisar o mercado',
  'bmad-technical-research': 'Fazer pesquisa técnica',
  'bmad-product-brief': 'Criar um product brief',
  'bmad-prfaq': 'Rodar um PRFAQ',
  'bmad-prd': 'Criar um PRD',
  'bmad-ux': 'Gerar especificação de UX',
  'bmad-architecture': 'Definir a arquitetura',
  'bmad-create-epics-and-stories': 'Gerar épicos e histórias',
  'bmad-check-implementation-readiness': 'Checar prontidão para implementar',
  'bmad-generate-project-context': 'Gerar contexto do projeto',
  'bmad-forge-idea': 'Forjar uma ideia',
  'bmad-spec': 'Criar uma spec',
  // bmm — implementação
  'bmad-sprint-planning': 'Planejar o sprint',
  'bmad-sprint-status': 'Ver status do sprint',
  'bmad-create-story': 'Criar uma história',
  'bmad-dev-story': 'Implementar uma história',
  'bmad-quick-dev': 'Desenvolvimento rápido',
  'bmad-dev-auto': 'Rodar o loop de dev autônomo',
  'bmad-code-review': 'Revisar o código',
  'bmad-review-adversarial-general': 'Rodar revisão crítica',
  'bmad-review-edge-case-hunter': 'Caçar edge cases',
  'bmad-correct-course': 'Corrigir o rumo',
  'bmad-retrospective': 'Rodar uma retrospectiva',
  'bmad-document-project': 'Documentar o projeto',
  // tea
  'bmad-testarch-test-design': 'Desenhar cenários de teste',
  'bmad-testarch-automate': 'Automatizar testes',
  'bmad-testarch-atdd': 'Escrever testes ATDD',
  'bmad-testarch-ci': 'Configurar pipeline de CI',
  'bmad-testarch-framework': 'Iniciar framework de testes',
  'bmad-testarch-nfr': 'Auditar requisitos não funcionais',
  'bmad-testarch-test-review': 'Revisar a qualidade dos testes',
  'bmad-testarch-trace': 'Gerar matriz de rastreabilidade',
  'bmad-teach-me-testing': 'Aprender testes na prática',
  'bmad-qa-generate-e2e-tests': 'Gerar testes E2E',
  // bmb
  'bmad-agent-builder': 'Construir um agente',
  'bmad-workflow-builder': 'Construir um workflow',
  'bmad-module-builder': 'Construir um módulo',
  'bmad-bmb-setup': 'Configurar o BMad Builder',
  'bmad-eval-runner': 'Rodar evals de skill'
}

/**
 * The specialist agents' pt-BR presentation, keyed by agent skill name:
 * persona first name + a short role descriptor for the picker's secondary
 * line. Unknown agents fall back to the persona name the main process
 * extracted from the skill's own description.
 */
const agentMetaPtBR: Record<string, { persona: string; role: string }> = {
  'bmad-agent-analyst': { persona: 'Mary', role: 'Analista de negócios estratégica' },
  'bmad-agent-pm': { persona: 'John', role: 'Gerente de produto' },
  'bmad-agent-architect': { persona: 'Winston', role: 'Arquiteto de sistemas' },
  'bmad-agent-ux-designer': { persona: 'Sally', role: 'Designer de UX e UI' },
  'bmad-agent-dev': { persona: 'Amelia', role: 'Engenheira de software sênior' },
  'bmad-agent-tech-writer': { persona: 'Paige', role: 'Especialista em documentação técnica' },
  'bmad-tea': { persona: 'Murat', role: 'Arquiteto de testes e qualidade' }
}

/** The specialist's pt-BR meta by agent skill key, or `null` for an agent this build doesn't know (renderer then leans on the catalog's data). */
export function agentMeta(key: string): { persona: string; role: string } | null {
  return agentMetaPtBR[key] ?? null
}

/**
 * Display names for the shells the catalog detects (agent-terminal). Product
 * names, so they are not translated — "Prompt de Comando" is the one exception
 * because that is what Windows itself calls cmd in pt-BR. An id this build
 * doesn't know (a shell added to `/etc/shells` by hand) falls back to its own
 * binary name, which is still the truth.
 */
const shellNamesPtBR: Record<string, string> = {
  cmd: 'Prompt de Comando',
  powershell: 'Windows PowerShell',
  pwsh: 'PowerShell 7+',
  'git-bash': 'Git Bash',
  bash: 'Bash',
  zsh: 'Zsh',
  fish: 'Fish',
  sh: 'sh',
  dash: 'Dash',
  ksh: 'Ksh'
}

/** The shell's display name, or its binary name when this build doesn't know the id. */
export function shellName(id: string): string {
  return shellNamesPtBR[id] ?? id
}

/**
 * The prompt sigil a shell is recognized by, for the picker's leading tile.
 *
 * Real prompts, not invented glyphs: `$` and `%` are what bash and zsh print,
 * `PS>` is PowerShell's own abbreviation, `C:\` is what a cmd window opens
 * with. A shell this build doesn't know falls back to the generic `>`.
 */
export function shellSigil(id: string, family: string): string {
  if (id === 'git-bash') return '$'
  if (family === 'cmd') return 'C:\\'
  if (family === 'powershell') return 'PS>'
  if (family === 'zsh') return '%'
  if (family === 'fish') return '~>'
  if (family === 'bash' || family === 'sh') return '$'
  return '>'
}

/**
 * Why an agent lands where it lands (agent-terminal AT-R5) — or `null` when
 * the route line above already said everything there is to say.
 *
 * The route names the destination; this names the *reason*, and only when
 * there is one worth a line. Repeating "o Claude executa neste terminal" under
 * a line that already reads "Claude CLI → Git Bash" is how the old version
 * became a paragraph per agent that nobody finished reading.
 */
export function shellSupportNote(
  agent: string,
  support: 'native' | 'fallback' | 'launch-only',
  note?:
    | 'posix-bash-zsh-only'
    | 'windows-git-bash'
    | 'powershell-preview'
    | 'cmd-no-executor'
    | 'install-git-bash'
    | 'no-cli-binding',
  runsIn?: string | null
): string | null {
  if (support === 'native') {
    // The one native case worth a caveat: the CLI itself calls this tool a
    // preview, and the user is entitled to know before betting a session on it.
    return note === 'powershell-preview'
      ? `A própria CLI do ${agent} marca a ferramenta PowerShell como preview.`
      : null
  }
  if (support === 'fallback') {
    if (note === 'cmd-no-executor') {
      return `O ${agent} não executa comandos no Prompt de Comando — o Hive fixa o ${runsIn ?? 'terminal acima'} para ele.`
    }
    if (note === 'install-git-bash') {
      return `Sem o Git para Windows nesta máquina, o ${agent} só tem o PowerShell.`
    }
    return `O ${agent} só aceita bash ou zsh — o Hive fixa o ${runsIn ?? 'terminal acima'} para ele.`
  }
  return `O ${agent} escolhe o próprio terminal; aqui passa só a inicialização.`
}

/**
 * Display label for any shortcut action (shortcut-customization): role-action
 * keys and skill keys resolve through the pt-BR maps; persona shortcuts
 * compose "Conversar com <persona>"; anything unknown falls back to the
 * workspace catalog's label (carried on the resolved action), then the key.
 */
export function shortcutLabel(
  key: string,
  kind: 'workflow' | 'persona',
  fallback?: string
): string {
  const direct = roleActionLabelsPtBR[key] ?? skillLabelsPtBR[key]
  if (direct) return direct
  if (kind === 'persona') {
    const persona = agentMetaPtBR[key]?.persona ?? fallback
    if (persona) return `Conversar com ${persona}`
  }
  return fallback ?? key
}

/**
 * pt-BR decimal-comma megabyte formatter for the update flow's live progress
 * readout (npm-distribution T10, design.md §5: "38,4 MB de 92,1 MB · 41%").
 * One decimal place; unlike `relativeTimeLabel`/`shortDate` below, not
 * exported — it's an internal formatting concern of `update.downloadProgress`
 * alone, no other module needs it.
 */
const megabytesFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})
function megabytesLabel(bytes: number): string {
  return megabytesFormat.format(bytes / (1024 * 1024))
}

/** Compact pt-BR date for a timestamp older than a week — "12 de mai." (plus the year once it differs from the current one). */
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const shortDateWithYear = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
})

/**
 * Relative-time copy for the session history (session-history) — "agora",
 * "há 5 min", "há 2 h", "ontem", "há 3 dias", then a compact date. A sibling
 * export (not a `ptBR` leaf) for the same reason as `intentLabel`: it's a
 * parameterized formatter, and the noInlineStrings guard doesn't scan i18n/.
 * `now` is injectable for deterministic tests.
 */
export function relativeTimeLabel(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  const then = new Date(timestamp)
  const sameYear = then.getFullYear() === new Date(now).getFullYear()
  return (sameYear ? shortDate : shortDateWithYear).format(then)
}
