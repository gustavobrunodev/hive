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
  chat: {
    promptPlaceholder: 'Escreva uma mensagem…',
    sendLabel: 'Enviar',
    typingLabel: 'O agente está respondendo',
    modelLabel: 'Modelo',
    effortLabel: 'Esforço',
    jumpToLatestLabel: 'Ir para a última mensagem',
    errorMessage: (message: string) => `Não foi possível concluir a resposta: ${message}`,
    loadingCapabilities: 'Carregando opções do agente…',
    composerHint: 'Enter envia · Shift+Enter quebra a linha · / para skills · # para arquivos',
    // chat-controls CC-R1: interrupt the running response — the composer's
    // unified send⇄stop control's stop-state label.
    stopAria: 'Interromper a resposta do agente',
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
    // chat-attachments (R6.5/T16): file attachments + `#` workspace references.
    attachLabel: 'Anexar arquivos',
    attachTitle: 'Anexar arquivos como contexto',
    attachmentRemoveAria: (name: string) => `Remover anexo ${name}`,
    dropHint: 'Solte para anexar como contexto',
    mentionMenuLabel: 'Arquivos do workspace',
    mentionMenuHint: '↑ ↓ navega · Enter insere · Esc fecha',
    mentionEmpty: 'Nenhum arquivo encontrado no workspace.',
    mentionNoMatch: 'Nenhum arquivo corresponde à busca.',
    // The shortcut strip docked next to the composer (the shortcuts'
    // always-at-hand home now that the left rail hosts workspace tools).
    // "Seus atalhos" (not "do seu papel"): since shortcut-customization the
    // set may be the user's own selection, not the role defaults.
    shortcutsLabel: 'Seus atalhos'
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
      'Escolha as skills e os agentes do seu workspace que ficam à mão — na tela inicial e na barra da conversa.',
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
    restoreDefaultsCta: 'Restaurar padrão do papel',
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
    openStudioCta: 'Criar skills no Estúdio'
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
    pinAria: (name: string) => `Fixar ${name} nos atalhos`,
    unpinAria: (name: string) => `Tirar ${name} dos atalhos`,
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
    deleteErrorMessage: 'Não foi possível remover. Tente novamente.'
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
    runningLabel: 'Em andamento'
  },
  // agent-selection AG-R3.1: first-run agent picker.
  agentSetup: {
    title: 'Escolha seus agentes',
    description:
      'Habilite um ou mais agentes de IA para conduzir suas conversas no Hive. Você pode usar vários ao mesmo tempo — cada conversa roda no agente que você escolher — e ajustar tudo depois nas configurações.',
    availableSectionLabel: 'Disponíveis no seu computador',
    unavailableSectionLabel: 'Precisam ser instalados',
    comingSoon: 'Em breve',
    // multi-agent: detection + how-to-enable affordance.
    unavailableHint: 'CLI não encontrada neste computador.',
    installCta: 'Como instalar',
    installCtaAria: (agent: string) => `Como instalar ${agent} (abre no navegador)`,
    detecting: 'Procurando agentes instalados…',
    emptyAvailable: 'Nenhum agente encontrado ainda. Instale um dos CLIs abaixo para começar.',
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
    emptyCleanDescription: (branch: string) => `Tudo salvo em ${branch}. Faça uma alteração para começar.`,
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
    commitDisabledNothing: 'Nenhuma alteração para commitar'
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
  fileSearch: {
    dialogLabel: 'Buscar arquivos no workspace',
    placeholder: 'Buscar arquivos no workspace…',
    empty: 'Nenhum arquivo corresponde à busca.',
    hint: '↑ ↓ navega · Enter abre · Esc fecha',
    openAria: (name: string) => `Abrir arquivo ${name}`
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
    description: 'Versão, atualizações e informações do Hive Desktop.',
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
    roleSectionLabel: 'Seu papel',
    agentSectionLabel: 'Seus agentes',
    agentSectionHint:
      'Habilite os agentes que quiser usar. O agente padrão inicia cada nova conversa; troque por conversa no chat.',
    agentDefaultBadge: 'Padrão',
    agentSetDefaultAria: (agent: string) => `Definir ${agent} como agente padrão`,
    agentUnavailableHint: 'CLI não encontrada neste computador.',
    agentInstallCta: 'Como instalar',
    agentInstallCtaAria: (agent: string) => `Como instalar ${agent} (abre no navegador)`,
    agentEmptyWarning: 'Habilite ao menos um agente para conversar no Hive.',
    replayTourCta: 'Rever o tour guiado',
    scopeNote: 'Seu perfil vale para todos os workspaces.',
    closeLabel: 'Fechar'
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
      'Cada atalho executa o comando do BMAD correspondente — "Criar um PRD" dispara /bmad-prd, igualzinho a digitar o comando na conversa. Em "Personalizar" você escolhe quais skills e agentes ficam aqui.',
    composerTitle: 'Converse do seu jeito',
    composerBody:
      'Escreva livremente, digite / para executar um comando do workspace ou # para trazer arquivos como contexto.',
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
  'bmad-party-mode': 'Reunir os agentes (party mode)',
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
