---
workflowStatus: 'completed'
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-identify-targets',
    'step-03-generate-tests',
    'step-03c-aggregate',
    'step-04-validate-and-summarize'
  ]
lastStep: 'step-04-validate-and-summarize'
nextStep: ''
lastSaved: '2026-07-30 (2ª execução — P0-003 + P1)'
workflowType: 'testarch-automate'
executionMode: 'sequential'
detectedStack: 'frontend'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - 'hive-desktop/{playwright.config.ts,vitest.config.ts,vitest.e2e.config.ts}'
  - '.github/workflows/hive-desktop.yml'
  - 'tea-index.csv core fragments (test-levels, priorities-matrix, data-factories, selective-testing, ci-burn-in, test-quality, fixture-architecture, network-first)'
---

# Automation Summary — Hive Desktop (MVP completo)

**Escopo** (escolhido pelo usuário): MVP do `test-design-qa.md` — B-2, B-1
(via flag de ambiente), P0-011 e os 12 cenários P0. As decisões que ficaram em
aberto foram delegadas ao Test Architect e estão registradas abaixo com o
raciocínio.
**Modo:** Create · sequential · BMad-Integrated · stack `frontend`.

## Linha de base

| Momento | `npm run test` | Gate de cobertura | Global | E2E real (`xvfb`) |
| --- | --- | --- | --- | --- |
| Antes (medido) | 1589 testes, verde, 22,1 s | **exit 1 — 14 violações** | **16,31%** | **4 falhas · 4 passes · 6 skips**, 10,6 min |
| Agora (medido) | **1670 testes**, verde | **exit 0 — 0 violações** | **95,66%** | **20 passes · 0 falhas**, 1,7 min |

`npm run verify` **exit 0** — e agora inclui a cobertura (`typecheck && lint && test:coverage`).

O global caiu de 97,07% para 95,66% ao longo do lote 3 porque o denominador
cresceu: o saneamento do `coverage.exclude` foi feito antes de vários arquivos
novos entrarem. O que importa é o gate per-file, que está em zero violações.

## Entregue e verificado

### B-2 — instrumentação de diagnóstico do E2E (R-14) ✅

- `playwright.config.ts`: `trace: 'retain-on-failure'`,
  `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`,
  `reporter: [['list'],['html']]`, `retries: 1` **só em CI**,
  `outputDir: 'test-results'`.
- `.github/workflows/hive-desktop.yml`: o `upload-artifact` apontava só para
  `playwright-report/`, diretório que o reporter `list` **nunca criava** — o
  upload era no-op. Agora sobe `playwright-report/` **e** `test-results/`, com
  `if-no-files-found: error` para que um upload vazio falhe em vez de mentir.

### B-1 — seam de teste do gate de provisionamento (R-01, score 9) ✅

Implementado como o usuário decidiu: flag de ambiente explícita **mais** estado
semeado. Ambas as condições são exigidas — a flag sozinha não pode fingir
provisionamento (esconderia o bug que o gate existe para pegar), e `provisioned`
sozinho mudaria o comportamento de produção (R4.1 exige que um workspace
provisionado ainda atualize a cada launch).

- `bmadService.ts`: `isE2ESeamEnabled()` (`HIVE_E2E=1`, e nada mais frouxo) +
  short-circuit em `update()`. `install()` **nunca** é tocado.
- `secondBrainService.ts`: mesma coisa para o segundo passo do gate. Sem isso,
  contornar só o BMAD deixaria todo E2E parado no gate seguinte.
- **9 testes unitários** cobrindo a matriz completa (flag on/off × estado
  semeado/não), asseverando `processRunner.calls` — ou seja, que **nada foi
  spawnado** — e não a forma do evento.
- A restrição do plano é respeitada: `bmadCli.e2e.test.ts` continua atravessando
  o CLI real.

### Infra de QA — fixture de workspace com isolamento por caso (R-16) ✅

`e2e/fixtures/workspace.ts`: `seedProvisionedWorkspace()`, `launchSeededApp()`
(arma `HIVE_E2E=1`, injeta `--user-data-dir`, remove `ELECTRON_RUN_AS_NODE`),
`waitForWorkUI()` e um `test` estendido com as fixtures `seeded`/`hiveApp` —
**um workspace e um `userData` por caso**, removidos no teardown. É a correção
do R-16, não preferência de estilo.

`waitForWorkUI` **não** clica em "Continuar mesmo assim", de propósito: esse
clique é o que fazia as 4 vermelhas parecerem testar o happy path quando
testavam o caminho de erro.

### P0-011a — saneamento do denominador de cobertura (R-04) ✅

Medido em 2026-07-30, antes de mexer: de 120.430 statements totais, ~98,5 mil
vinham do **build output** —
`out/renderer/assets/transformers.web-*.js` (33.521),
`out/renderer/assets/index-*.js` (32.760), `out/renderer/assets/pdf-*.js`
(27.417), `out/main/index.js` (4.820), `out/preload/index.js` (579) — todos a 0%.
Era isso, e só isso, que produzia o "16,31%".

`coverage.exclude` passou a cobrir `out/**`, `dist/**`, `dist-npm/**`,
`scripts/**`, `e2e/**`, `*.config.ts`, `*.config.mjs`. **Global: 16,31% → 96,81%.**

### P0-011b — limpeza dos pontos vermelhos (R-03) ✅

| Arquivo | Antes | Agora |
| --- | --- | --- |
| `docViewerShared.tsx` | F 83,33% | ✅ |
| `DocxViewer.tsx` | B 85,71% | ✅ |
| `SheetViewer.tsx` | B 85,71% | ✅ |
| `SlidesViewer.tsx` | F 83,33% | ✅ |
| `ImageViewer.tsx` | S/L 85,84% · B 79,06% | ✅ |
| `PdfViewer.tsx` | F 81,81% · B 79,66% | ✅ |
| `preload/index.ts` | F 88,99% | ✅ |

Os branches descobertos estavam quase todos em caminhos que o jsdom nunca
alcança sozinho (nada tem layout, então nada transborda e nenhuma caixa tem
tamanho). Cada teste instala o fato de layout que seu caminho precisa —
`CapturingRO` para o fit-to-view, um polyfill de `PointerEvent` porque o jsdom
descarta `clientX`, métricas de scroll para o drag-to-pan — em vez de asseverar
em volta da lacuna.

O `preload` ganhou o bridge de `mcp` (que **não tinha teste nenhum**: seis
métodos cujo único trabalho é carregar canal e ordem de argumentos), o par
`getAgents`/`setAgents` e o quarteto de health do second-brain.

### P0-008 / P0-009 — arquivo hostil (R-09) ✅ — **e um defeito real encontrado**

13 casos novos em `documentReader.test.ts`: matriz de 3 readers × 4 payloads
(arquivo vazio, bytes aleatórios com extensão plausível, cabeçalho `PK` sem
nada atrás, archive truncado) mais XML de slide malformado e o caso de range
inflado.

**🔴 Defeito encontrado e corrigido — `readSheetAt`, DoS no processo `main`.**
O cap `MAX_SHEET_ROWS`/`MAX_SHEET_COLS` era aplicado **ao grid devolvido** pelo
`sheet_to_json`, não ao range **entregue** a ele. O `<dimension>` de uma
planilha é uma alegação no XML, controlada por quem manda o arquivo e sem
relação com quantas células existem: um `.xlsx` de ~6 KB com duas células reais
declarando `A1:ZZ1048576` fazia o `sheet_to_json` materializar o grid declarado
inteiro. Medido: **ainda alocando após 180 s, app inteiro congelado, nenhum
erro**. Arquivo pequeno, negação de serviço completa.

Correção mínima: o range é limitado **antes** de chegar ao SheetJS. Depois do
fix o mesmo arquivo resolve em 77 ms, com `truncated: true` e o conteúdo real
preservado. O teste de regressão assevera **trabalho limitado** (< 5 s), não só
resultado limitado — o código antigo nunca chegava à asserção.

**Duas premissas do test design corrigidas** (verificado, não suposto):

1. **P0-009 não se aplica como escrito.** O plano assumiu que `jszip` era
   superfície de **extração** e perguntou se uma entrada `../` escreveria fora
   do destino. Não escreve: `jszip` aparece **uma única vez** no código
   (`readSlidesAt`), via `loadAsync` sobre um buffer, e toda entrada é lida
   para memória — nada é escrito em disco em lugar nenhum. A traversal que **é**
   alcançável é intra-archive: o `Target` de um relationship entra num lookup de
   entrada do zip depois de tirar um único `../` inicial. O teste foi reescrito
   para prender esse comportamento — e assevera que nada do sistema de arquivos
   é embutido no deck.
2. **pdf e imagem não têm parse no `main`.** `readBinary` só faz base64 dos
   bytes; o pdf.js roda no renderer sob CSP. A superfície R-09 é
   **docx/xlsx/pptx apenas** — registrado em teste para não se re-propor.

O contrato asseverado é "**assenta**, rápido, e o processo continua vivo" — não
"rejeita". Se um reader recusa bytes hostis ou degrada para um grid de lixo é
política da biblioteca e varia por payload (mammoth e jszip recusam qualquer
coisa que não seja container OOXML válido; o SheetJS recusa lixo em forma de zip
mas parseia bytes arbitrários numa planilha sem sentido). Prender isso caso a
caso seria prender o comportamento do SheetJS, não o deste app.

### P0-011 — completo (lote 2) ✅

Os 4 pontos restantes foram limpos e **o gate foi promovido**:

| Arquivo | Antes | O que faltava |
| --- | --- | --- |
| `WorkUI.tsx` | F 85,96% | Estúdio de skills pelo rail, "Perguntar à base" e a folha de captura pelo FAB — três superfícies que o WorkUI liga e que nenhum teste abria |
| `Chat.tsx` | B 88,98% | adapter sem menus de modelo/esforço (Devin/Copilot, nomeados no próprio comentário do arquivo) e chip de arquivo na raiz do workspace |
| `Explorer.tsx` | F 82,95% · B 89,56% | metade do menu de contexto (Renomear, Excluir, e o par row/área que faltava), escopo do kebab numa pasta, dispensa por Escape/backdrop dos diálogos STALE / não-salvo / exclusão, e o plural da exclusão múltipla |

- `package.json`: `verify` = `typecheck && lint && **test:coverage**`.
- `.github/workflows/hive-desktop.yml`: o passo separado de cobertura com
  `continue-on-error: true` **deixou de existir** — a cobertura roda dentro do
  `verify` e reprova o job.
- O mock de `Dialog` no `Explorer.test.ts` passou a honrar `onOpenChange`.
  Descartar a prop tornava inalcançáveis justamente as dispensas por Escape e
  backdrop — em diálogos cujo trabalho é impedir perda de dados.

### P0-005 / P0-006 / P0-007 — caminhos destrutivos (R-08) ✅ — **e uma lacuna real**

**P0-005 (verde).** Aceitar um hunk e depois rejeitar o vizinho no mesmo
arquivo — o gesto ordinário de revisão, e o único que combina duas operações
sobre os mesmos bytes. Cada metade já tinha teste isolado; a interação não. O
teste re-deriva o id do hunk sobrevivente do snapshot **pós-accept**, porque os
índices mudam e rejeitar um id obsoleto é outra forma de perder trabalho.
Comportamento correto, agora travado.

**P0-007 (verde).** A atomicidade do vault é estrutural, não por
temp-file+rename: cada `stageRaw` mira um nome gerado novo, então uma escrita
que falha só pode danificar o arquivo sendo escrito. Três testes prendem essa
propriedade — que é o que não pode regredir se o esquema de nomes mudar.

**🔴 P0-006 — lacuna real encontrada, e corrigida.** Medido em 2026-07-30, duas
formas do mesmo problema:

1. `rejectAll` **apagava** um arquivo que o usuário criou enquanto o turno estava
   aberto e que o agente nunca tocou.
2. `rejectFile` **revertia silenciosamente** (`{ok: true}`) uma edição do usuário
   num arquivo que o agente nunca tocou.

Em nenhum dos dois havia confirmação nomeando o arquivo, e não havia volta: nada
foi commitado e a lixeira não participa — o restore do checkpoint faz `unlink`.

A causa é o modelo "baseline tree × work tree": tudo que apareceu depois do
baseline lê como saída do agente. O guard STALE existe para essa classe e **não
alcançava** — ele compara o mtime contra o registrado no *último recompute*,
então só pega edição que chega depois daquele ponto.

**Decisão (delegada ao Test Architect): classificar autoria pela janela de
turno, e recusar em vez de destruir.**

- O agente só escreve enquanto um turno está em voo, então uma mudança vista
  pela primeira vez sem turno aberto **não pode** ser dele. `ReviewChange` ganhou
  `userAuthored`; `rejectFile`/`rejectHunk` devolvem
  `{ok: false, unattributed: true}`; `rejectAll` reverte o resto e informa
  `skipped`, deixando o que não tocou visível no conjunto.
- **Por que não `TurnMark.paths`:** o próprio doc-comment do campo diz
  "best-effort … empty is fine". Limitar um revert a uma lista que pode
  legitimamente vir vazia transformaria "rejeitar" num no-op silencioso.
- **Direção da falha, escolhida de propósito:** uma mudança do agente
  classificada errado fica em disco, visível no conjunto, e ainda é rejeitável
  caso a caso — chato e recuperável. Um arquivo do usuário classificado errado é
  apagado sem volta. Na dúvida, preserva.
- Primeira observação vence: um arquivo que o agente criou continua sendo dele
  mesmo se o usuário editar depois — senão o STALE, que existe para essa
  sobreposição, nunca teria chance de rodar.
- **Metade de renderer também:** `HunkActions` ganhou `rejectDisabledReason`, e
  o painel desabilita "Rejeitar" com o motivo no controle. Um botão que continua
  ali e não faz nada é pior que nenhum botão — o usuário lê o silêncio como
  sucesso.

### P0-001 / P0-002 / P0-004 — a camada E2E, sobre o seam ✅

`e2e/provisioning-seam.spec.ts` prova o pré-requisito de todo o resto: o app
chega à work UI **sem** rodar `npx bmad-method install`. A prova é em disco, não
em processo — a fixture semeia `manifest.yaml` com um sentinela, e um install
real reescreveria esse arquivo. O sentinela sobrevive.

**As 4 vermelhas foram migradas para a fixture e estão verdes.** Não foram
substituídas por testes novos: os specs originais continuam existindo, com o
mesmo corpo, trocando ~60 linhas de semeadura própria (e a corrida contra o gate
real) pela fixture. `explorer-editor-ux` perdeu o `describe.serial` — cada caso
tem workspace, `userData` e app próprios (R-16).

Três coisas que só apareceram por causa do isolamento:

- **O gate tem mais de dois passos.** Depois de contornar BMAD e second-brain, o
  app parava em `AgentSetup`. A fixture semeia `agent`/`agents`/`role`/`userName`
  — e o comentário registra que deixar qualquer um `null` produz um timeout
  idêntico ao de provisionamento, que não é.
- **O tour guiado cobria a tela.** Vive em `localStorage`, não em `userData`, e
  precisa de reload — foi centralizado no `launchSeededApp`. Ele sozinho gerou
  cinco falhas falsas de contraste.
- **O caso 5 (shift-click) dependia dos arquivos dos casos anteriores** e contava
  `[aria-selected]` no documento inteiro, pegando também a aba do editor. O
  acoplamento do R-16 ficou visível no instante em que os casos foram isolados.

**A metade "opt-in" do seam foi deliberadamente deixada fora do E2E.** Nesse
nível ela mede a conectividade do runner (com a rede disponível o install real
simplesmente funciona e o gate passa batido), não o produto. Está travada de
forma determinística nos 9 testes unitários.

### P0-002 — como guard de harness, não como teste E2E ✅

`src/main/harnessConfig.test.ts` (9 casos, roda no `verify`, sem display server):
trace/screenshot/video, `retries: isCI ? 1 : 0`, o reporter `html` (é o que cria
`playwright-report/`), o acordo entre `outputDir` e os caminhos do
`upload-artifact`, `if-no-files-found: error`, a ausência de `continue-on-error`
no job `verify`, e o `dedupe` de React nos dois configs — o guard que a melhoria
arquitetural #3 pedia.

Foi tirado do E2E de propósito: lá, uma flag `--reporter=` na linha de comando
sobrescreve o config, e a asserção passaria a medir a invocação em vez do que o
CI de fato roda. Descoberto ao ver o teste falhar exatamente assim.

### P0-010 — varredura de contraste, dark e light ✅ — **e dois defeitos reais**

`e2e/contrast.spec.ts` varre todo nó de texto visível da work UI nos dois temas
e reprova abaixo do piso WCAG AA (4,5:1, ou 3:1 para texto grande pela regra do
próprio WCAG).

A medição é pixel real, e três iterações foram necessárias para que fosse
honesta — cada uma registrada no arquivo:

1. **Normalizar por `fillStyle` não basta.** O Chromium devolve `oklch`/`oklab`
   verbatim e os aceita de volta; toda a paleta saía como "não medido". A versão
   final pinta num canvas 1×1 e **lê os bytes**, deixando o browser fazer
   conversão de espaço de cor *e* composição de alfa.
2. **Trocar `data-theme` na mão é infiel.** O cascade vira mas o estado do React
   não, então o que é colorido por JS mantém o valor antigo. Produziu texto
   quase preto reportado a 1,16:1 e 1,35:1 no tema claro. A versão final clica no
   toggle real.
3. **Animação e tour em cima falseiam.** Cores em transição não são nem o valor
   antigo nem o novo. A versão final congela transições e animações antes de
   amostrar.

Sem esses três, a varredura reportava 5 defeitos; com eles, **2 reais**:

| Tema | Onde | Medido | Causa |
| --- | --- | --- | --- |
| claro | `.wb-pills-persona-label` ("FALAR COM UM ESPECIALISTA") | **3,29:1** | usava `--faint`, que o próprio `theme.css` documenta como *tertiary/large-text only, piso 3:1* — num rótulo de 11 px, onde vale 4,5:1 |
| escuro | `.wb-pill[data-persona]` ("Conversar com Amelia") | **4,40:1** | accent sobre o tint de 14% do `--selected-bg` compartilhado |

Ambos corrigidos localmente (`--muted` no rótulo; tint próprio de 8% na pílula),
sem tocar nos tokens compartilhados nem no design-system. Gate verde nos dois
temas. É exatamente a classe que reincidiu em M12 **e** M12.1 e que ambas as
vezes foi pega por olho humano.

### P0-012 — o payload realmente troca ✅

O caminho feliz que já existia prova a **ordem dos eventos** e que o *caminho*
certo é entregue à estratégia de plataforma. O que ele não pode ver é se os
bytes naquele caminho são os anunciados — um swap que estagia o payload errado,
ou reaproveita um antigo, produz a mesma sequência e o mesmo caminho. Dois casos
novos: os bytes em disco batem com o sha512 do manifesto, e uma segunda versão
estagia o próprio payload em vez de re-aplicar o primeiro (o bug de "atualizar
duas vezes"). O apply nativo segue manual (sem hardware Windows, ND T18).

## Em aberto (ao fim da 1ª execução — ver o incremento adiante)

| Item | Estado |
| --- | --- |
| P0-003 — jornada da tese (pedir PRD → `PRD.md` no explorer) | ~~bloqueado~~ **entregue na 2ª execução** (seam de binário, R-06) |
| P3-001..003 — benchmarks | bloqueados por B-3 (thresholds de produto) |
| P3-004 — apply nativo em Windows/macOS | bloqueado por hardware (ND T18) |
| B-4 — IDs retroativos das 12 features órfãs | decisão de Produto; desbloqueia `bmad-testarch-trace` |
| R-02 — burn-in 10× em infra limpa | o CI ainda nunca executou (só dispara em push→`main`/PR, e a branch não foi mergeada) |

## Riscos e premissas

- **Baseline concorrente segue em aberto** (premissa 1 do doc de arquitetura):
  este trabalho está em `feat/second-brain`, com M10 e M11 em branches não
  mergeadas. Nada aqui foi commitado.
- O job E2E do CI continua **não-provado em infra limpa** (R-02): o workflow só
  dispara em push→`main`/PR e a branch não foi mergeada, então as duas incógnitas
  do runner (libs do Electron via `apt-get`, `xvfb-run`) permanecem não-provadas.
  Tudo aqui foi medido em WSL2 com `xvfb-run -a`.
- **Três mudanças de produto** saíram deste trabalho, além do B-1 que você
  autorizou: o clamp de range no `readSheetAt` (DoS no `main`), o guard de
  autoria no `reviewService` (R-08) e os dois ajustes de contraste. As duas
  primeiras corrigem perda de dados / indisponibilidade; a terceira é objetiva
  e o `PRODUCT.md` já a exigia. Todas estão isoladas e revisáveis.
- **`continue-on-error` do job E2E não foi removido.** O gatilho do plano é
  burn-in de 10 execuções em infra limpa (R-02), que não é possível aqui.
  A suíte está verde localmente; promover o gate é o próximo passo, não este.

## Próximo workflow recomendado

1. Mergear a branch e deixar o CI executar pela primeira vez — sem isso, "o E2E
   está verde" só vale para esta máquina (R-02).
2. Burn-in 10× dos `@p0` em infra limpa → remover o `continue-on-error` do job
   E2E, fechando o R-02 do mesmo jeito que o R-03 foi fechado.
3. Desbloquear P0-003 (ponto de injeção de adapter scriptado, Dev/R-06).
4. Depois de B-4, `bmad-testarch-trace` para a matriz de rastreabilidade.

---

# 2ª execução — P0-003 e a faixa P1

**Escopo pedido:** (1) P0-003, destravando o ponto de injeção de adapter
scriptado; (2) os 24 cenários P1; (3) os 17 P2. Entregue em três lotes
verificáveis. **Os P2 não foram feitos** — ver "O que ficou de fora".

## Linha de base e resultado (medidos, não estimados)

| Momento | `npm run verify` | Testes | E2E real (`xvfb-run -a`) |
| --- | --- | --- | --- |
| Antes (medido no início) | exit 0 | 1670 | 20 passes, ~1,7 min |
| Agora | **exit 0** | **1741** (+71) | **30 passes** (+10 casos), ~1,9 min |

Gate de cobertura dentro do `verify`, zero violações per-file. Global
95,66% → **96,08%**.

## Lote 1 — P0-003: o ponto de injeção (R-06) e a jornada

**A decisão de design: o seam troca o BINÁRIO, não o adapter.**

Trocar o `AgentAdapter` inteiro teria sido menor, e teria tirado do teste
justamente o que o P0-003 existe para provar: o pool de sessões, o parser de
`stream-json` do `cliAdapterCore`, o aprendizado de `session_id`, a atribuição
por `tool_use`, o checkpoint de revisão, a ponte de IPC, o transcript e o
watcher do explorer. Com o seam no binário, tudo isso é código de produção
dentro do E2E; o único trecho substituído é o processo do CLI.

- `src/main/e2eAgentSeam.ts` — `scriptedAgentCli()` + `withScriptedAgentCli()`.
  Mesma forma do B-1: **duas** condições, nenhuma suficiente sozinha.
  `HIVE_E2E=1` (o opt-in do launcher, compartilhado com o B-1) **e**
  `HIVE_E2E_AGENT_CLI=<caminho existente>`. A flag sozinha não inventa um
  agente; a variável sozinha não redireciona nada — e isso importa mais aqui
  que no B-1, porque este seam redireciona **execução de programa**.
- **O escopo é dado pelo ponto de aplicação, não por um filtro de nome:**
  `index.ts` embrulha só o `ProcessRunner` entregue ao `createAgentRegistry`,
  cujos únicos spawns são os CLIs de agente (turnos e probes `--version`).
  Todo o resto (BMAD, git, MCP) segue com o runner original. Desarmado, o
  wrapper devolve **o mesmo objeto** — produção não ganha indireção.
- **10 testes unitários** cobrindo a matriz inteira, asseverando o que foi
  spawnado (comando, argv, `cwd`, env) e a identidade do runner quando
  desarmado.
- `e2e/__fixtures__/scripted-agent-cli.cjs` — um CLI de mentira que é um CLI de
  verdade: fala as linhas `stream-json` que o parser consome, **escreve
  arquivos de verdade** no workspace e registra cada invocação num JSONL, para
  o teste asseverar *o que o app pediu ao agente*. Fica em `__fixtures__/` pelo
  precedente do `fakeMcpServer.mjs` (ignorado pelo lint).
- `e2e/agent-turn.spec.ts` — **P0-003 verde**: clicar "Criar um PRD" faz
  `docs/PRD.md` aparecer. As asserções são em disco (bytes exatos), no log de
  invocação (`prompt === '/bmad-prd'`, `cwd` = workspace), na árvore do explorer
  (que só pode ter atualizado pelo watcher — nenhum gesto de refresh no teste) e
  na abertura do arquivo.

**Um efeito colateral no `index.test.ts`:** o mock de `./bmadService` era
total, e `e2eAgentSeam` lê `isE2ESeamEnabled` de lá. Virou mock parcial
(`importActual`), o padrão que `gitService`/`fsService` já usavam.

## Lote 2 — a camada de componente (P1-004/010/011/013/024)

O módulo mais fraco do projeto e o primeiro que o usuário toca. Nenhum destes
tinha teste co-localizado; alguns nem eram carregados por teste nenhum.

| Arquivo | Antes | Agora |
| --- | --- | --- |
| `AgentSetup.tsx` | S 84,37 · **F 25** | 100 / 95,45 / 100 / 100 |
| `InstallConfigForm.tsx` | S 91,2 · B 75 · **F 40** | 100 em tudo |
| `RoleSetup.tsx` | S 89,23 · B 90 | 100 em tudo |
| `WorkspacePicker.tsx` | sem teste próprio | 100 em tudo |
| `AgentPicker.tsx` | **F 40** | 100 em tudo |
| `AgentSwitcher.tsx` | **sem teste nenhum** | 100 em tudo |
| `ChoiceCard.tsx` | **S 64,64 · F 50** | 100 / 97,5 / 100 / 100 |
| `ProfileSheet.tsx` | **F 44,44** | 100 / 96,96 / 100 / 100 |
| `FileSearchDialog.tsx` | **não aparecia no relatório** (nada o carregava) | 100 em tudo |

O que estava descoberto não era enfeite: em `AgentSetup`, *quais agentes ficam
habilitados e qual vira padrão*; em `InstallConfigForm`, o **payload** que vira
flag de `bmad-method install`; em `ChoiceCard`, o teclado inteiro (roving
tabindex, setas com wrap, Home/End, opção desabilitada pulada) — a parte que
mouse nenhum alcança; em `ProfileSheet`, o commit do nome (blur/Enter), que
falha em silêncio.

`GuidedInstall`/`UpdateGate`/`SecondBrainGate` ganharam os ramos que faltavam
(evento após unmount, variantes ignoradas do stream, campos ausentes) para que
o gate `src/renderer/src/onboarding/**` a 90 valesse para o módulo inteiro.
**Gates promovidos** para os nove arquivos acima.

## Lote 3 — os E2E que o seam destravou, e os buracos reais

- **P1-018** (`agent-change-review.spec.ts`, reescrito): o cabeçalho do spec
  dizia que a captura do conjunto pendente "não pode ser dirigida de forma
  determinística no sandbox — nenhum CLI de agente instalado". **Essa premissa
  caiu.** Agora um turno real escreve arquivos reais sob um checkpoint real, e
  aceitar-um/rejeitar-o-outro e rejeitar-o-set são asseverados **em disco**
  (bytes do aceito preservados, criado rejeitado sumindo, tudo voltando ao
  pré-turno no set). De quebra, o spec saiu da semeadura própria para a fixture
  e perdeu o clique em "Continuar mesmo assim" (que testava o caminho de erro)
  e o `waitForTimeout`.
- **P1-001** — interromper turno em voo: saída parcial preservada, sem Alert de
  erro, compositor de volta.
- **P1-009** (`workspace-switch-guard.spec.ts`) — as três vias do guard com
  editor sujo: Cancelar (nada muda, segue sujo), Salvar (bytes em disco, *depois*
  troca) e Descartar (troca e o disco fica como estava).
- **P1-017** (`git-conflict.spec.ts`) — o último dos 13 requisitos do M10 sem
  E2E. Conflito de merge real (duas branches na mesma linha), as três escolhas
  em três casos isolados, cada uma asseverando bytes e o fim do estado
  `unmerged`. O teste também prende a **ordem**: escolher não escreve nada;
  só "Marcar como resolvido" reescreve o arquivo.
- **P1-022** — o ângulo que faltava: um turno que falha vira Alert legível (com
  o rasto do stderr) e **devolve o compositor**. "Nunca spinner infinito" era,
  até aqui, uma promessa que nada media.

## P1: onde cada um dos 24 parou

**Novos (10):** P1-001, P1-004, P1-009, P1-010, P1-011, P1-013, P1-017, P1-018,
P1-022, P1-024.

**Já cobertos — verificado, não suposto (12):**

| ID | Onde já estava |
| --- | --- |
| P1-002 | `index.test.ts:653-704` — `agent:start/send/runWorkflow/stop` registrados e roteados |
| P1-003 | `preload/index.test.ts:150` (`fs:watch:start/event/stop`) + `fsService.test.ts`; a jornada agora também no P0-003 |
| P1-005..008 | limpos no P0-011b (viewers a 100%/97,5) e `documentReader.test.ts` já parseia **arquivos reais** gerados (xlsx via `XLSX.writeFile`, pptx montado, docx OOXML) |
| P1-012 | `ActionRail.test.ts` (badges, seleção, dot de update) + largura persistida no `explorer-editor-ux` caso 6 |
| P1-014 | `agentService.test.ts` — roteamento por `agentId`, start preguiçoso, streams concorrentes por `turnId` |
| P1-015 | `updateDownload.test.ts` — sha512 real contra registry falso |
| P1-016 | `UpdateNotice.test.ts:164` — "Agora não" + skip por versão |
| P1-019 | `reviewService.test.ts` — STALE com mtime real (`utimesSync`) |
| P1-020 | `second-brain.spec.ts` §2c — `Ctrl+Shift+K` → `/second-brain-query <pergunta>` no transcript |

**Bloqueados (2):** P1-021 (precisa de `claude`/`copilot`/`devin` reais **uma
vez**, para gravar as fixtures de stream — ausentes neste ambiente) e P1-023
(decisão de Produto, B-4).

## Achados — reportados, não redesenhados

1. **Assimetria na saída parcial (aberto, para Produto).** Um turno
   `interrupted` preserva o que já streamou (CC-R1.3); um turno com `error`
   **descarta** — `handleAgentEvent` põe a mensagem e limpa a bolha sem
   "settle", então o texto some da tela **e** do histórico persistido. Nenhum
   requisito cobre o caminho de erro (CC-R1.3 é escopo de interrupt), então o
   comportamento atual está **prendido em teste**, com o comentário explicando
   por quê — e é ele que vai falhar alto no dia em que alguém decidir.
2. **P1-012 tem uma premissa vencida.** O plano pede "itens do papel no rail";
   os atalhos de papel mudaram de lugar (vivem ao lado da conversa, e o próprio
   `pt-BR.ts` registra isso). O rail testado é o que existe.
3. **Lixo no repositório:** `src/renderer/src/secondBrain/SecondBrainPanel.tsx.tmp.641093.efb6c006f5be`
   — arquivo temporário de alguma sessão anterior. Não foi tocado.

## O que ficou de fora

| Item | Estado |
| --- | --- |
| **Os 17 cenários P2** | **não iniciados** — o orçamento desta sessão foi consumido pelo P0-003 e pela faixa P1. Nada foi começado pela metade |
| P1-021 | precisa dos CLIs reais uma vez |
| P1-023 / B-4 | Produto |
| P3-001..004 | B-3 (thresholds) e hardware |
| R-02 — burn-in 10× em infra limpa | o CI segue sem nunca ter executado; `continue-on-error` **mantido** de propósito |

`e2e/second-brain.spec.ts` continua com semeadura própria e o único
`waitForTimeout` remanescente da suíte — foi deixado intacto por ser um caso
verde de 32 s com setup de modelo próprio; migrá-lo é trabalho de fixture, não
de cobertura.
