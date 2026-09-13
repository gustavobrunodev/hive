---
title: Conclusão do redesign da navegação do Hive Desktop
type: feature
created: 2026-09-08
status: in-progress
baseline_commit: 36a34fe5d7f25da448792d81350990bfe1547023
review_loop_iteration: 0
---

<frozen-after-approval reason="escopo autorizado pelo pedido de continuação do usuário">

## Intent

**Problema:** A navegação foi parcialmente redesenhada por outro agente e ainda precisa de integração, correção de regressões e validação. A entrega deve concluir as alterações existentes, preservando o funcionamento do produto.

**Abordagem:** Finalizar a navbar compacta no canto superior esquerdo, a sidebar com Chat/Arquivos, histórico com filtros e busca ampliada, avatar no rodapé e acesso a MCP pelas configurações. Preservar a identidade HIVE e usar a organização espacial solicitada como referência de experiência.

## Boundaries & Constraints

**Sempre:** Reutilizar componentes e tokens de `@hive/design-system`; copy via `t()`; preservar bridge, dados de sessões, arquivos, Git, revisão, skills, bases de conhecimento e seleção de workspace; manter foco visível e operação por teclado. Preservar alterações herdadas pertinentes e o estado local do usuário.

**Consultar antes:** Mudanças de escopo que alterem regras de negócio ou integrações.

**Nunca:** Substituir funcionalidades por mocks em produção, introduzir assets de outra marca, modificar backend sem necessidade ou publicar a aplicação neste trabalho.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Resultado | Tratamento |
| --- | --- | --- | --- |
| Histórico | Lista existente | Mesmos dados na sidebar e no arquivo de conversas | Loading, vazio e erro com nova tentativa |
| Filtros | 1/3/7/30 dias ou todos; nome/criação/atividade | Mesma seleção nas duas superfícies | Limpar janela quando não há resultados |
| Busca | Texto digitado rapidamente | Busca local imediata e conteúdo pelo serviço existente | Ignorar respostas antigas e comunicar falha |
| Mutação | Renomear/excluir uma conversa | Atualizar as duas listas; exclusão confirmada | Preservar histórico e informar falha |
| Sidebar | Ocultar/reabrir e mudar de aba | Estado preservado; navbar e usuário acessíveis | Conteúdo oculto fora do foco |
| Layout | Janela estreita, nome longo, painéis movidos | Controles acessíveis sem sobreposição | Truncamento de nomes e largura mínima útil |
| Usuário | Configurações, MCP, sair | Menus acessíveis e fechamento previsível | Reutilizar proteção de arquivos não salvos |

</frozen-after-approval>

## Code Map

- `src/renderer/src/WorkUI.tsx`: integra navegação, sessões, painéis e configurações.
- `src/renderer/src/ui/{AppNavbar,SidebarNav,UserMenu,TooltipIconButton}.tsx`: controles reutilizáveis.
- `src/renderer/src/ui/{sidebarNav,workspaceSession}.ts`: vocabulário e persistência da navegação.
- `src/renderer/src/chat/{useChatSessions,conversationFilters}.ts`: dados e projeção do histórico.
- `src/renderer/src/chat/{ChatSidebar,AllConversationsDialog,ConversationControls,ConversationList,ConversationRow}.tsx`: histórico e ações.
- `src/renderer/src/profile/{ProfileSheet,McpScope}.tsx`: configurações e acesso ao gerenciador existente.
- `src/renderer/src/assets/workbench.css`: layout, temas e estados da interface.
- `e2e/` e `tools/visual/`: testes com Electron e inspeção pelo MCP Playwright.

## Tasks & Acceptance

**Execução:**

- [x] Inspecionar alterações herdadas, arquitetura, tokens e contratos existentes.
- [x] Finalizar navbar, abas, menu de usuário e geometria responsiva.
- [x] Sincronizar histórico e tratar falhas e respostas assíncronas antigas.
- [x] Preservar navegação de arquivos/Git, ferramentas e configurações/MCP.
- [x] Atualizar testes afetados e cobrir os limites novos com testes significativos.
- [x] Validar via Playwright MCP e Electron, registrar cenários e limitações.

**Critérios:**

- Dada a aplicação aberta, ao usar a navbar, então logo cérebro, controle lateral, explorador, tema e workspace aparecem na ordem solicitada e continuam utilizáveis com a lateral fechada.
- Dada a aba Chat, ao iniciar uma conversa ou abrir revisão, skills e bases, então os fluxos existentes são executados e o histórico permanece alcançável.
- Dado um histórico com datas e títulos distintos, ao filtrar, ordenar, buscar, renomear ou excluir, então sidebar e visualização ampliada permanecem consistentes.
- Dada a aba Arquivos, ao alternar explorador/Git ou buscar arquivo, então arquivos, busca e controle de versão continuam funcionais com estado ativo identificável.
- Dado o menu de usuário, ao usar teclado, Escape ou clique fora, então foco e fechamento seguem os componentes do design system; configurações permitem abrir MCP.
- Dadas diferentes larguras e temas, ao recolher a sidebar ou redimensionar painéis, então a navbar não cobre controles e não há cortes críticos ou erros de runtime.

## Design Notes

Manter a direção visual já iniciada: superfícies discretas, acento coral do HIVE, navegação textual clara e menus compactos. A lateral mantém painéis montados para conservar expansão e rolagem. O histórico ampliado reutiliza a mesma fonte de dados da sidebar, com busca restrita à visualização ampliada.

## Verification

- `npm run verify`: typecheck, lint e suíte com cobertura; registrar separadamente qualquer limite herdado comprovado.
- `npm run build`: bundles de produção compilam.
- Playwright Electron: navegação, histórico, workspace, arquivos e Git usando fixtures isoladas em disco.
- Playwright MCP: inspeção visual e funcional nos temas escuro, claro e Hive; viewports de desktop amplos e estreitos; tooltips, teclado, filtros e estados de dados.

## Spec Change Log

## Registro de verificação (2026-09-09)

**`npm run verify`** — typecheck limpo; lint com 0 erros e 42 avisos (a base em
`36a34fe` já tinha 46: os avisos de prettier em `scopes.ts` e `ProfileNav.tsx`
introduzidos aqui foram corrigidos); 4190 testes passando em 236 arquivos.

**Cobertura.** Os três limiares desta entrega passam. Dois continuam vermelhos e
**já estavam vermelhos na base** — medido rodando a suíte com o trabalho
guardado no stash:

| Arquivo | Base `36a34fe` | Agora | Limiar |
| --- | --- | --- | --- |
| `src/renderer/src/WorkUI.tsx` (funções) | 86,36% | 87,87% | 90% |
| `src/main/configStore.ts` (funções) | 89,13% | 89,13% | 90% |

`configStore.ts` é do processo principal e nada nesta entrega o toca. O que
falta em `WorkUI.tsx` são callbacks embutidos de outras funcionalidades
(claudeAuth, AWS, studio, console MCP); cobri o vão desta feature — a costura
entre a lateral e o arquivo de conversas — e parei aí em vez de escrever testes
para a métrica.

**`npm run build`** — os bundles de produção compilam (saída em `out/`).

**Playwright Electron** (`e2e/navigation-redesign.spec.ts`, app real sob
`xvfb-run`): 3 de 3 passando em 45,6s — navbar/abas/ferramentas/busca/temas e
configurações do usuário; filtros do histórico, as três ordenações, busca em
conteúdo e as ações de linha persistidas; menu do usuário encerrando o app sem
apagar o perfil.

**Playwright MCP** (`tools/visual/navigation-redesign-pass.mjs`, renderer
buildado com a bridge dublada): 14 de 14 checagens, 54 medições de contraste
acima do piso e **zero erros de console ou de runtime**.

- Temas: escuro, claro e Hive — em cada um, a aba Chat, o arquivo de conversas e
  o menu do usuário.
- Viewports: 1440×900, 1024×768, 800×768 e 640×768, com a lateral aberta e
  recolhida em cada um. A navbar nunca cobre o painel vizinho, os filtros cabem
  na coluna e nada estoura a largura da página.
- Estados de dados: carregando, vazio, erro de leitura e nova tentativa.
- Verificado à mão na sessão: tooltips da navbar, o botão do explorador reabrindo
  a lateral recolhida (0 → 314px, aba Arquivos, view `explorer`), navegação por
  setas entre as abas, `Escape` fechando menus e diálogos, e Servidores MCP
  aberto por Configurações.

**Limitações conhecidas.** Os dois limiares de cobertura herdados acima
continuam vermelhos, então `npm run verify` termina em erro por eles. A validação
visual roda no Chromium servindo o renderer buildado (a receita de
`docs/visual-validation.md`), não no Electron: os fluxos em disco são cobertos
pelo E2E real. Ficaram na árvore de trabalho, sem relação com o código,
`before-dark-1440.png` na raiz e os logs de `.playwright-mcp/` — nenhum dos dois
está no `.gitignore`.

## Segunda rodada — retorno do usuário (2026-09-10)

Cinco pedidos, depois de usar a primeira entrega:

**1. A navbar devia levar à busca, não ao explorador.** O segundo controle era
um atalho para o Explorador — que é uma aba duas linhas abaixo dele. Virou a
**busca de arquivos do workspace** (a mesma paleta do Ctrl+P), que é a pergunta
que não tem outra casa: responde "onde está esse arquivo" sem saber a pasta,
funciona com a lateral fechada e serve de dentro de uma conversa. A cópia que
existia na aba Arquivos saiu junto — com a busca na navbar, um segundo botão
40px abaixo seria a affordance duplicada. O Explorador manteve a própria linha e
o Ctrl+Shift+E.

**2. A porcentagem da janela de contexto não aparecia na sessão do Devin.**
Causa medida no CLI real (`devin 3000.6.14`): a linha "Automático" não carregava
`contextWindow`, e a busca só olhava as **famílias**. A config real do usuário diz
`agent.model: "claude-opus-5-max"` — um **variante**, que o próprio CLI escreve
no `config.json` quando o nível de raciocínio muda em sessão (Alt+T). Nenhuma
família tem esse id, então o medidor ficava sem denominador e mostrava a
contagem crua. `windowOf` agora resolve slug, alias e variante. Prova de ponta a
ponta na máquina do usuário: `claude-opus-5-max` → janela 1.000.000 → **"12%"**.
O catálogo estático ganhou as janelas medidas (`swe` 202.752, `opus`/`sonnet`/
`gpt` 1M, `codex` 400.000, `gemini` 1.048.576). `adaptive` continua sem janela de
propósito: é a única das 46 famílias que não declara `max_context_tokens`, porque
o roteador troca de modelo por turno — chutar um número faria o medidor mostrar
60% contra 12% reais.

**3. As ferramentas do chat abriam por cima do histórico.** "Revisão do agente"
e "Bases de conhecimento" eram camadas da lateral: abrir uma **removia a lista de
conversas** e espremia uma revisão de diff numa coluna de 280px. Agora são painéis
da **área de trabalho** (`WorkView`), no lugar do transcript — largura de painel,
histórico intacto, e a volta em um clique (a própria linha alterna, e o painel
carrega um ✕ sempre visível). `SidebarView` e `WorkView` viraram vocabulários
separados, com migração para quem tinha `review`/`brain` salvos na sessão.
`+ Novo` e clicar numa conversa também trazem o transcript de volta — sem isso o
"+ Novo" pareceria não fazer nada.

**4. O avatar não parecia clicável.** Ganhou um `ChevronUpIcon` (aponta para onde
o menu abre), discreto por padrão e em força total no hover/foco/aberto, girando
180° enquanto o menu está aberto. Escondido com a lateral recolhida, onde a linha
é só o disco.

**5. Instalador `.exe`** — ver a seção de verificação abaixo.

### Verificação desta rodada

- `npm run typecheck`: limpo. `npm run lint`: **0 erros**, 41 avisos (base: 46).
  Dois erros de complexidade que eu mesmo introduzi foram resolvidos extraindo
  `navItemName`/`disclosureProps` e o hook compartilhado `useMountedLayers`.
- Testes: **4203 passando** em 237 arquivos. O guarda de `prefers-reduced-motion`
  do próprio repositório pegou a transição nova do caret — alternativa adicionada.
- Passe visual (Playwright MCP): **26 de 26 checagens**, 56 medições de contraste
  acima do piso, zero erro de console. Cobre as ferramentas abrindo no painel de
  trabalho com o histórico intacto, o título não duplicado, o ✕ sempre visível,
  o caret girando e a navbar com busca e sem atalho de explorador.

### O que a suíte E2E completa revelou (e o que era meu)

Rodar as 84 specs — coisa que nenhuma das rodadas tinha feito — achou defeitos
que o passe visual não pegava. Ownership medido guardando o trabalho no stash e
rodando a mesma spec em `36a34fe`:

| Achado | Origem | Situação |
| --- | --- | --- |
| Aba **inativa** a 4,34:1 no tema claro | redesign | corrigido (6,04/7,36/7,66) |
| Tooltip da navbar engolindo o clique nas abas | redesign | corrigido (`pointer-events: none`) |
| `.wb-pnav-list` virou 3 elementos (grupos de config) | redesign | spec ajustada |
| Avatar da barra de título sumiu (`agent-terminal`) | redesign | fixture `openSettings` |
| Tour modal bloqueando specs com launcher próprio | redesign | flag semeada antes do gate |
| `window.reload()` re-executando o provisionamento | **minha, desta rodada** | corrigido (1,6 min de novo) |
| `agent-change-review:63` intermitente | **herdada** | base falha 3/3; aqui passa 1/3 |
| Largura da lateral não sobrevive ao restart | redesign | **em aberto** — ver abaixo |

**O ponto cego do passe visual.** Ele media `.wb-sidebar-tab[data-active]` e
nunca a inativa — que é justamente a metade em risco, porque o par fica sobre
uma trilha mais escura. A sonda agora mede as duas.

### Em aberto

`e2e/explorer-editor-ux.spec.ts:315` — uma largura de lateral arrastada não
sobrevive a um restart. Passa em `36a34fe`, falha aqui, então chegou com o
redesign. Medido: o `defaultLayout` do grupo **não é mais aplicado**, em nenhuma
unidade — semear `{rail: 35, chat: 65}` e recarregar devolve o `defaultSize` do
painel (20% → 20%), e remover o `defaultSize` devolve o `maxSize` (45%), nunca os
35% guardados. A metade da escrita funciona (o número arrastado chega ao registro
da sessão). `initialLayout`, `mergeLayout` e `handleLayoutChanged` estão
idênticos à base, então a causa é o `Group` renormalizando em volta da nova forma
dos painéis — não os três números, que voltaram aos valores em que a UI foi
revisada. Comentado no ponto exato do código.
