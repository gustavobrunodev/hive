# Passe visual — validar a UI sem subir o Electron

Toda milestone recente fechou com defeitos que **nenhum teste poderia ter
pego** e que só apareceram olhando o app rodando: uma affordance duplicada a
60px de distância, contraste de 3.46:1 no tema claro, um botão quebrando o
próprio texto em duas linhas, um header de painel com a label da view anterior.
O `STATE.md` registra isso no M12 e de novo no M12.1 — por isso o passe visual é
parte do trabalho, não formalidade de fim de tarefa.

Este guia é a receita. Antes ela vivia só na memória do agente, e cada
`tasks.md` apontava para uma nota que o repositório não continha.

## Por que não usar o E2E

`npm run test:e2e:app` sobe o Electron de verdade e é o certo para fluxo e
estado em disco — mas custa build + xvfb por iteração. Para _olhar_ a UI, servir
o renderer buildado num browser normal dá um loop de segundos e totalmente
interativo. O preço é que `window.hive` não existe: você mocka.

## A receita

### 1. Buildar e servir o renderer

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.1
npx electron-vite build
python3 -m http.server 8123 -d out/renderer
```

### 2. Injetar o mock antes do primeiro script da página

Via `mcp__playwright__browser_run_code_unsafe`, use
`page.context().addInitScript(...)` e **só depois** `page.goto`. Init scripts
entram por CDP e passam por cima da CSP do renderer — é o único jeito de
plantar `window.hive` antes do React montar.

O mock precisa da **superfície inteira que App/WorkUI tocam no boot**, não só do
namespace que você está testando. Faltando um, o app trava antes de renderar:

- `getWorkspace`, `isProvisioned`, `provisionState`
- `profile.getAgents`, `profile.getRole`
- `updateBmad` e `installBmad` — **têm** que chamar o callback com
  `{ type: 'done', ok: true }`, senão o gate de onboarding nunca libera
- `workflows`, `skills`, `studio`, `mcp`, `chatHistory`, `app`, `shortcuts`, `fs`

Mantenha os formatos em sincronia com [`src/preload/index.d.ts`](../src/preload/index.d.ts) —
é o contrato real. Para módulos que já têm mock pronto, reaproveite os de
[`src/renderer/src/testSupport/`](../src/renderer/src/testSupport/) em vez de
escrever à mão.

**O `boot.mjs` envelhece junto com a bridge, e a falha é muda.** O M29 trocou
`window.hive.whisper` por `window.hive.asr`; o harness continuou com o namespace
antigo, e o app passou a **não renderizar nada** — `createAsrClient` lê
`hive.asr.onPhase` de um `undefined` e derruba a árvore inteira. Na tela isso é
uma página em branco, sem mensagem: o único sinal está no `pageerror`, que o
tool não mostra a menos que você o escute. Se o passe visual abrir em branco,
**suspeite do mock antes do app** — compare o `window.hive` do harness com
[`src/preload/index.d.ts`](../src/preload/index.d.ts), que é o contrato real.

Esse mock já existe pronto em
[`tools/visual/boot.mjs`](../tools/visual/boot.mjs) — o tool
`browser_run_code_unsafe` do MCP roda o arquivo direto (`filename`), sem colar
o script inteiro no prompt. Ele ainda planta fixtures pra dirigir estado depois
do boot: `window.__setVault(v)`, `window.__fsChange(path)` e
`window.__agentEvent(evt)`.

### Sondas de contraste

`tools/visual/engine-contrast.mjs` cobre o seletor de motor do composer
(modelo + esforço) — 29 alvos (22 de texto a 4,5:1, 6 de marca a 3:1 e 1 par
de superfícies que precisam ser distinguidas entre si), nos três temas **e**
nas duas formas que o painel assume (Claude, com escada de esforço; Copilot,
agrupado por fabricante e sem esforço). Ele guarda cinco lições que custaram
uma rodada cada:

- **Transição em curso mascara a medição.** As barras da rampa fazem
  cross-fade de 200ms, e `getComputedStyle` no meio da transição devolve a cor
  de onde ela está saindo — ou seja, a sonda mede o estado ANTERIOR e chama de
  atual. Uma varredura de sete valores candidatos reportou o mesmo número para
  todos antes de a sonda passar a injetar `transition: none` antes de medir.
- **Quando a sonda troca de componente, os seletores dela também trocam.** A
  escada de esforço virou `RampSelect`; os alvos `.hds-seg-*` continuavam lá,
  medindo um controle que não existe mais. A sonda reporta `ausente` em vez de
  pular — foi o que denunciou —, mas nada substitui reler a lista de alvos
  quando o componente muda.
- **Force o tema inicial pelo menu, não confie no boot.** A primeira rodada
  rodou logo depois de uma cena que tinha deixado o app no claro, mediu claro
  três vezes e reportou a linha como "escuro". O probe agora seleciona
  "Escuro" explicitamente antes da primeira medição.
- **`getByRole('menuitemradio', { name: 'Escuro' })` casa com duas linhas** —
  a descrição do tema Hive é "Escuro, nas cores da marca". Ancore o regex
  (`^Escuro`) ou a chamada estoura com strict mode violation.
- **Meça a linha escolhida E uma linha comum.** `document.querySelector('.hds-picker-desc')`
  devolve a primeira do DOM, que é a da linha selecionada — sobre um tint
  translúcido. As duas medem diferente, e foi a selecionada que reprovou
  (4,34:1 no tema Hive).
- **Nem todo pixel colorido é um indicador.** A barra vazia da rampa reprovou
  em 1,46:1 contra o painel — mas ela é a _calha_, não o indicador, e subir seu
  brilho até 3:1 achata justamente o vão cheio↔vazio que faz o controle dizer
  "quanto". Medido nos três temas: os dois números andam em direções opostas
  conforme a calha clareia. O alvo certo é o degrau **escolhido** contra a
  calha (3,29 escuro · 5,62 claro · 3,61 Hive), e cada degrau ainda é nomeado
  por um rótulo que passa dos 4,5:1 — nenhuma informação depende só das barras.

`tools/visual/git-console-contrast.mjs` cobre o console de comandos do Git
(git-logs): 16 alvos de texto e 2 de marca, nos três temas, **com a linha que
falhou expandida** — o tint dessa linha fica sob o texto dela, e é justamente o
que alguém que abre esse dock está procurando. Duas lições:

- **`--faint` de novo.** Relógio e pasta mediram 2,95:1 no tema claro e 2,65:1
  sobre o tint da linha vermelha. É a mesma lição do M14, e ela volta toda vez
  que alguém trata `--faint` como "texto secundário" em vez de "decoração sobre
  `--bg` escuro".
- **Nem todo pixel colorido é um indicador, pela segunda vez.** A placa atrás do
  ícone do dock reprovou em 1,22:1 e parecia um achado; é um contêiner ao lado
  de um título de texto que diz a mesma coisa. O alvo saiu da lista com o porquê
  escrito **dentro** da lista — sem isso a próxima rodada o re-adiciona.

`tools/visual/live-dictation-pass.mjs` cobre o ditado ao vivo (M28). Ele arma o
seam de E2E do ditado e empurra **ticks de áudio reais** no segmentador de
produção, então tudo acima da captura é o app: segmentador, passe ao vivo, trecho
provisório, fila, junção, backdrop. Duas lições que ele pagou:

- **Ele achou um defeito que nenhum teste tinha:** o texto aparecia duas vezes.
  Duas escritas no mesmo tick e a segunda lia o cursor do DOM, um commit atrás.
  Um passe que só tira screenshot não veria — o probe **lê o valor do campo**
  nos dois momentos, e é isso que o torna uma prova.
- **Meça a decoração enquanto o trecho existe.** O backdrop é
  `color: transparent`; uma regra sem `text-decoration-color` não desenha nada, e
  `getComputedStyle` depois do commit final não tem mais elemento para medir.

`tools/visual/explorer-refresh-pass.mjs` cobre o refresh da árvore (M28): faz a
varredura pendurar e verifica que as linhas continuam na tela sem spinner, e que
uma rajada de 20 escritas custa **uma** varredura.

`tools/visual/tool-details-contrast.mjs` + `tools/visual/tool-details-a11y.mjs`
cobrem o painel de detalhes de uma ferramenta (agent-tool-details), montado pela
cena `tools/visual/tool-details.mjs` — que deixa na tela, de uma vez, um comando
que passou, um que falhou, uma busca cortada no teto, uma chamada MCP, uma
ferramenta que não devolveu nada e um passo ainda rodando. São 16 alvos × 3 temas
mais seis checagens de teclado/ARIA. Três lições que custaram uma rodada cada:

- **Resolva cor por canvas, nunca por regex.** O Chromium serializa `oklch()`
  literalmente: `getComputedStyle(...).color` do `--danger-ink` deste app
  devolve a string `oklch(0.7 0.17 25.3)`, e um `/[\d.]+/g` sobre isso lê
  `0.7, 0.17, 25.3` como um RGB — quase preto. A sonda reprovou o rótulo de erro
  em **1,15:1 contra o próprio tint**, uma falha que não existia. `canvas` 2D
  resolve qualquer cor CSS (`oklch`, `oklab`, `color-mix`) para bytes sRGB.
- **Contraste não vê hierarquia — meça-a à parte.** Todos os 14 alvos passaram
  com folga num build em que o rótulo da seção, a meta e o corpo da saída eram
  **o mesmo cinza**: o CSS pedia `var(--ink-2)`, que este sistema não define, e
  um `var()` insolúvel herda em silêncio. Um painel achatado é perfeitamente
  legível. A sonda agora afirma que rótulo ≠ meta e que o corpo tem tinta cheia.
  O vocabulário real é `--ink` / `--muted` / `--faint` — **não existe `--ink-2`**
  (e ainda há seis usos herdados dele em `workbench.css`, todos herdando calados:
  `.wb-mcpturn-chip`, `.wb-gitlog-stderr`, `.wb-mcplog-source-path`,
  `.wb-dstudio-origin-text` e mais dois botões, linhas 13506/15966/16766/16836/
  17417/17436).
- **`textContent` não é o nome acessível.** Filhos de um flex saem colados
  (`"Rodounpm run verify10 linhas"`) enquanto o cálculo de nome do Chromium
  espaça certo e descarta o que é `aria-hidden`. Uma sonda que lê `textContent`
  reporta um defeito inexistente — meça por `locator.ariaSnapshot()`.
- **O scroller do chat não é `.wb-chat-scroll`.** É o
  `.hds-scroll-area-viewport` do Radix dentro dele; `.wb-chat-scroll` tem
  `scrollHeight === clientHeight` e uma sonda que rola por ele mede sempre a
  mesma tela.

`tools/visual/contrast.mjs` cobre as superfícies do M12/M12.1 (convite, guarda,
toast). `tools/visual/ingestContrast.mjs` cobre a folha de ingestão redesenhada
(M12.4): 34 alvos em seis estados — áudio, arquivos em fila, popover de modelo,
ditado parado/ouvindo/em silêncio — em cada tema.

Duas coisas que a sonda precisa saber fazer, e que uma versão ingênua não faz:

- **Compor alpha.** Quase tudo aqui está sobre um tint translúcido
  (`--selected-bg`, `--success-bg`, o banho de accent do quadro ao vivo). Ler a
  cor do fundo direto mede contra um pixel que não existe na tela.
- **Entender `oklch()` e `oklab()`.** Token declara em `oklch`; `color-mix(in
oklab, …)` serializa em `oklab`. Sem os dois parsers a sonda devolve
  `UNMEASURED` — que se lê como "sem problemas" quando na verdade é "sem dados".
  Foi assim que dois alvos reais passaram despercebidos na primeira rodada.

Para o tema claro: `document.documentElement.setAttribute('data-theme','light')`
e rode o arquivo de novo (a CSP do renderer bloqueia `addScriptTag`, então a
sonda tem que viver dentro de `page.evaluate`).

### O gate de preparação exige o mock oposto

O `boot.mjs` resolve `installBmad`/`updateBmad`/`secondBrain.*` com `done`
**na hora**, justamente pra cair na work UI — o que significa que as telas de
preparação passam voando e nunca entram num screenshot. Pra olhar essas telas
use [`tools/visual/provision.mjs`](../tools/visual/provision.mjs), que segura o
stream aberto e te dá o controle dele pelo console:

```js
window.__install.step('core', 'Instalando o módulo BMad Core')
window.__install.progress('added 214 packages in 12s')
window.__install.fail('npm ERR! network timeout') // estado de erro
```

Esses harnesses leem `globalThis.HIVE_THEME` / `HIVE_GATE` / `HIVE_WANT_LIGHT`
para escolher o cenário — mas **cada chamada do `run_code_unsafe` roda num
contexto próprio**, então setar a variável numa chamada e rodar o arquivo na
seguinte não funciona: o valor volta ao default. Ou você edita o default no
topo do arquivo, ou dirige o cenário pelo console depois do boot (foi assim que
o gate de erro abaixo foi capturado: `__install.done()` → `__update.done()` →
`__brain.fail('')`).

Vale pros três estágios (`__install`, `__update`, `__brain`). Sem isso, a
`ProvisionScene` só é vista em teste unitário — e ela é justamente a superfície
em que um defeito fica invisível até a primeira execução de um usuário novo.

### 3. Passar pelos gates de primeira execução

```js
localStorage.setItem('hive.tourSeen', '1') // o tour intercepta pointer events
localStorage.setItem('hive-desktop-theme', 'dark') // 'dark' | 'light' | 'hive'
```

O tema **precisa** ser setado no storage, não via `data-theme` no elemento: o
React não observa mudança manual de atributo, e um valor de sessão anterior
persiste no profile do browser. Depois do boot, troque pelo controle real —
o menu **Aparência** no topo — e não pelo storage: recarregar re-executa o init
script, que sobrescreve a chave de volta.

Componentes que leem disco leem o mock — o `ConflictView`, por exemplo, só
mostra conflito se o `readFile` mockado devolver marcadores
`<<<<<<< / ======= / >>>>>>>` de verdade; sem isso ele renderiza (corretamente)
o estado vazio.

### 4. Screenshots

Os caminhos relativos do tool de screenshot do MCP frequentemente não pousam
onde você espera. Use `page.screenshot({ path: '<repo>/.playwright-mcp/x.png' })`
dentro do `run_code_unsafe`. Recarregar re-executa o init script, então o FS
virtual reseta.

Rode **os três temas** (`dark`, `light`, `hive`). Metade dos defeitos de
contraste registrados apareceu em só um deles — e o `hive`, o bordo da marca,
é o mais novo e o menos olhado dos três.

## Medir contraste — não confie no olho nem no parser ingênuo

O piso é **4.5:1** para texto normal e **3:1** para texto grande
(≥18.66px bold ou ≥24px).

Duas armadilhas já registradas:

1. **O olho erra.** A superfície escura de diálogo é grafite `#242121` sobre um
   corpo quase preto com scrim pesado; o contraste entre os dois faz a
   superfície _parecer_ clara no screenshot mesmo estando certa.
2. **O parser ingênuo erra pior.** Qualquer token feito com `color-mix()` volta
   do `getComputedStyle()` como `color(srgb 0.75 0.71 0.71)` — floats de 0 a 1,
   não `rgb(0-255)`. Lido como 0–255, isso vira quase-preto, e a sonda reporta
   número com cara de confiável e completamente errado.

Use [`src/renderer/src/ui/contrast.ts`](../src/renderer/src/ui/contrast.ts), que
já trata as duas formas:

```js
const { checkContrast } = await import('/assets/contrast.js') // ou cole a função
const el = document.querySelector('[data-testid="health-cta-hint"]')
const style = getComputedStyle(el)
checkContrast(style.color, getComputedStyle(el.parentElement).backgroundColor)
// → { ratio: 3.93, passes: false }
```

Para foreground translúcido ou sobre gradiente, `checkContrast` devolve
`{ passes: false }` **sem** `ratio` — isso significa "não deu para medir", não
"reprovou". Aí amostre pixels do PNG.

3. **A terceira armadilha: `getImageData` NÃO é premultiplicado.** Resolver
   `oklch()`/`color-mix()` pintando num canvas 1×1 e lendo o pixel funciona — é
   o único jeito confiável. Mas "desfazer a premultiplicação" dividindo os
   canais pelo alfa (o passo que parece óbvio) explode um tint de 10% de
   opacidade para quase-branco: o card de autorização mediu **1,18:1** no tema
   escuro sendo que o print mostrava texto claro perfeitamente legível sobre
   grafite. Leia os canais como vêm e componha só com o alfa.

[`tools/visual/contrast.mjs`](../tools/visual/contrast.mjs) faz esse passe já
compondo o alfa: um banner com fundo `--success-bg` (10-14% de opacidade) medido
contra a cor pura reporta um número errado; o script empilha os fundos até um
opaco e só então calcula. Ele percorre os estados de uma feature num run só —
adapte a lista de seletores/estados quando reaproveitar.

[`tools/visual/transcript-contrast.mjs`](../tools/visual/transcript-contrast.mjs)
é o equivalente para o transcript do chat (trilha de atividade, card de
autorização pendente e respondido, card de alterações). Resolve cor por pixel
em vez de parsear, então cobre `oklch()` além de `color-mix()`.

[`tools/visual/timing-contrast.mjs`](../tools/visual/timing-contrast.mjs) faz o
mesmo pelas superfícies de M14 — relógio por passo, medidor do turno (vivo e
liquidado), fila de mensagens, medidor de contexto e sua folha de detalhe. Rode
depois de [`tools/visual/chat-timing.mjs`](../tools/visual/chat-timing.mjs), que
dirige a cena inteira (um turno liquidado com recibo, um turno vivo em pleno
passo, duas mensagens na fila e uso de contexto) e tem três variantes —
`live`, `tight` (janela quase cheia, que é o único estado em que a folha mostra
o aviso) e `held` (fila pausada por interrupção). Cena e tema são constantes
**dentro** da função: o arquivo é uma expressão de função entregue ao tool do
MCP, não um módulo, então um `const` no topo do arquivo quebra o parse e um
`globalThis` de uma chamada anterior já não existe.

[`tools/visual/patch-contrast.mjs`](../tools/visual/patch-contrast.mjs) cobre o
patch em linha do transcript (agent-patch) — cabeçalho, diffstat, número de
linha, sinal, código de contexto/adicionado/removido, marca de palavra alterada,
rodapé e o aviso de falha — nos **três** temas num run só, medindo também os
portadores não-textuais (os segmentos da barra) contra o piso de 3:1. A cena vem
de [`tools/visual/chat-patch.mjs`](../tools/visual/chat-patch.mjs), que põe na
tela de uma vez um edit de dois hunks com marcas de palavra, um arquivo criado,
um edit que falhou (patch proposto e não aplicado) e um patch estourando o teto
de linhas.

**A lição de contraste que essas sondas produziram (M14):** `--faint` só limpa
o piso de 4.5:1 contra `--bg` **escuro**. No tema claro mede 3,29:1, e sobre a
`--surface` elevada de um popover mede 4,18:1 em qualquer tema. Não é papel de
texto de corpo fora do fundo mais escuro — use `--muted` e carregue a hierarquia
por tamanho e peso.

**E de novo, terceira vez (agent-patch):** o número de linha do patch nasceu em
`--faint` e mediu **2,95:1** no tema claro. Três módulos diferentes, mesma
armadilha — o token _parece_ certo porque o papel ("metadado, subordinado")
parece certo. A regra que resolve não é sobre papel, é sobre quem lê: **se
alguém lê o texto, ele é `--muted` ou mais escuro; `--faint` é só para ícone e
marca inativa.** Hierarquia se carrega por posição, largura e peso — no caso do
número, a calha estreita alinhada à direita já faz esse trabalho sozinha.

**A lição de token do M22 (bandeja de anexos):** os `*-ink` do DS não são
todos a mesma coisa. `--danger-ink`/`--warning-ink`/`--info-ink` são tinta para
o **tint** da própria família (`--danger-bg` e companhia). `--accent-ink` é o
oposto: é tinta para um fundo **preenchido** de accent (o botão primário), e por
isso é escura. Usá-la sobre `--selected-bg` — que é o tint do accent — mediu
**1,05:1** no tema Hive e **1,00:1** no claro, ou seja, invisível, com o texto
lá no DOM e nada na tela. E o `--accent` puro também não resolve: sobre o mesmo
tint em fundo escuro ele mede 4,02:1, abaixo do piso.

A família accent simplesmente não tinha a tinta que o próprio tint dela pede, e
agora tem: **`--accent-tint-ink`** (`design-system/src/tokens.css` + o bloco
`hive` em `assets/theme.css`), medida em 5,86:1 / 7,49:1 / 6,10:1 nos três temas.
Use-a para qualquer texto sobre `--selected-bg`.

**E a armadilha da própria sonda:** medir o fundo a partir de
`el.parentElement` mente para qualquer elemento que tenha fundo próprio — uma
pílula tintada é lida contra **o tint dela**, composto sobre o que está embaixo,
não contra a superfície dois níveis acima. Foi assim que o primeiro número saiu
1,13:1 e não explicava nada do que o print mostrava.
[`tools/visual/tray-contrast.mjs`](../tools/visual/tray-contrast.mjs) começa a
pilha no próprio elemento e percorre os três temas num run só.

[`tools/visual/profile-voice-pass.mjs`](../tools/visual/profile-voice-pass.mjs) e
[`tools/visual/voice-gate-pass.mjs`](../tools/visual/voice-gate-pass.mjs) cobrem o
sistema de modelos de voz do M26 — a biblioteca (em uso, fixado, baixando,
falhou, **vazia**), a guarda que toda superfície de gravação atravessa e os
avisos de fim de download — nos três temas, medindo também os portadores não
textuais (a barra de progresso, o passo aceso do medidor, o ponto de "em uso")
contra o piso de 3:1.

[`tools/visual/ask-dictation-pass.mjs`](../tools/visual/ask-dictation-pass.mjs)
cobre o ditado dentro de **Perguntar à base** — a linha em repouso (microfone +
dica de envio), o transporte ao vivo que a substitui, o trecho pousando no campo
da pergunta e a volta ao repouso — nos três temas. O microfone é a costura de
E2E (`__hiveDictationE2E`), e ela **precisa** ser armada num init script com
reload: `useWhisperDictation` lê a costura uma vez, ao montar o motor, então
plantá-la numa página já viva não muda nada na tela.

[`tools/visual/voice-fit-pass.mjs`](../tools/visual/voice-fit-pass.mjs) cobre a
rodada de correções do M26.1 numa máquina forçada a 8 GB sem GPU — as linhas que
este computador não consegue rodar (com os dois motivos distintos), a
confirmação de exclusão e a biblioteca se relendo sozinha quando um download
termina — nos três temas.

**Mais três armadilhas, dessa rodada:**

1. **O `Button` do DS nasce `primary`.** `<Button>Manter</Button>` e
   `<Button className="hds-btn-primary">Excluir</Button>` renderizam **iguais**:
   dois preenchimentos de accent lado a lado, a resposta segura
   indistinguível da destrutiva. Quem cancela precisa de `variant="ghost"`
   explícito. (O mesmo padrão está no `McpManager`.)
2. **A armadilha do `parentElement` de novo, e ela mente para cima e para
   baixo.** O botão preenchido medido a partir do pai deu **1,13:1** — número
   com cara de defeito grave — quando o valor real, começando a pilha no
   próprio elemento, é 5,54:1. A regra é a mesma de sempre: comece no elemento.
3. **Init script é do contexto, não da chamada.** Rodar o `boot.mjs` uma vez e
   depois plantar fixtures com `addInitScript` empilha scripts que **continuam
   valendo** nas chamadas seguintes — inclusive uma fixture de catálogo antiga,
   que aqui derrubou a tela inteira (`Cannot read properties of undefined`)
   contra um build novo. Quando o `boot.mjs` mudar, feche a página e comece um
   contexto novo antes de rodar o passe.

**Três armadilhas que esses dois passes produziram, e que valem para qualquer
sonda daqui pra frente:**

1. **Um estado que a UI só lê uma vez não muda mudando a fixture.** A folha de
   perfil lê o catálogo quando _ela_ abre, não quando o escopo troca — então
   para ver a biblioteca vazia é preciso **fechar e reabrir a folha**, não
   apenas clicar em "voltar". Mutar e medir sem isso reporta um estado que
   nunca foi renderizado.
2. **Init script, não `page.evaluate`, quando há reload no meio.** A guarda no
   chat resolve a preferência na montagem; uma fixture plantada com `evaluate`
   é apagada pela próxima navegação. Só `addInitScript` roda em todo load — e
   roda **depois** do `boot.mjs`, então dá para derivar de `window.__HIVE_ALL`.
3. **Um mock de assinatura tem que entregar para TODOS os inscritos.** O
   `boot.mjs` guardava só o último `onDownloadSettled`, então quando a guarda
   montava, o aviso global parava de receber — e a sonda esperava para sempre
   por um card que ninguém foi avisado de renderizar. O main faz broadcast; a
   fixture também precisa fazer.

E uma armadilha de screenshot: `.wb-notice-column` está **sempre** montada
(ela também abriga o aviso de atualização) e mede 340×0 enquanto vazia — o
Playwright recusa isso como "element is not visible". Fotografe o card
(`.wb-vnotice`), não a coluna.

[`tools/visual/studio-agent-pass.mjs`](../tools/visual/studio-agent-pass.mjs)
cobre o seletor de construtor do Estúdio (M26) — e prova o que ele existe para
fazer: com o Copilot escolhido, o campo **Esforço some**, porque as capacidades
vêm do agente. Só funciona porque a fixture responde `capabilities(agentId)`
**por agente**; um mock que responde igual para todos esconde exatamente o
comportamento sob teste.

[`tools/visual/approvals.mjs`](../tools/visual/approvals.mjs) cobre o card de
autorização com a concessão de sessão (agent-approvals): o card pendente com a
linha "Permitir tudo nesta sessão" e o estado concedido — os dois cards
fechados como registro e a pílula permanente acima do compositor — nos três
temas, medindo do próprio elemento para cima. **Ele troca o tema com `blur()`,
nunca com `Escape`:** o card pendente pega o foco ao montar e lê `Escape` como
"Recusar", então uma sonda que fecha menu com `Escape` responde justamente o
card que veio fotografar (e mede o estado errado sem avisar).

**Uma segunda lição de token, da mesma sonda:** `--success-bg` e `--danger-bg`
**não** formam um par. São tints de banner e carregam croma muito diferente
(0,208 no vermelho contra 0,13 no verde), então na mesma opacidade as remoções
gritam mais alto que as adições — o que inverte a ênfase de um diff, já que o
código _novo_ é o que se está pedindo para aceitar. Para tingir dois lados que
precisam ter o mesmo peso, derive do par `--wb-git-added`/`--wb-git-deleted`,
que é casado por construção.

O mesmo módulo serve em teste unitário: dá para fixar o contraste de um par de
tokens sem passe visual nenhum.

## Sonda do perfil e do modelo de transcrição (M25)

[`tools/visual/profile-voice-pass.mjs`](../tools/visual/profile-voice-pass.mjs)
cobre a folha de perfil depois que ela virou **drill-down** e o escopo novo
"Voz e transcrição": cinco estados (índice, escopo automático, catálogo de
download aberto, modelo fixado, escopo de terminal) nos três temas, medindo
também o anel do rádio contra o piso de 3:1. 0 reprovações e 0 amostras
`missing` na versão final.

O que ela produziu vale mais que o resultado:

**1. `getBoundingClientRect` não enxerga o defeito que abriu a milestone.** A
queixa era "a bola do rádio não está alinhada ao centro". A geometria de layout
media **simétrica** — 3,5px de folga nos quatro lados — enquanto a tela mostrava
o preenchimento deslocado para cima e para a esquerda. As duas causas são
invisíveis para o DOM:

- o anel era um `border` de 1,5px, e o Chromium resolve largura de borda para um
  número **inteiro** de pixels de dispositivo por aresta; o preenchimento estava
  posicionado com `inset`, que parte da **caixa de padding** e portanto se
  desloca junto com esse arredondamento;
- o controle estava alinhado ao **topo** de linhas com alturas diferentes — a
  frase de justificativa morava dentro da linha "Automático", que ficava com
  três linhas enquanto as vizinhas tinham duas.

O conserto é estrutural, não de valor: anel por `box-shadow: inset` (não cria
caixa de padding), preenchimento centrado por `place-items` (exato por
construção), todas as linhas com duas linhas de texto, e a justificativa **fora**
do grupo. E a prova é um pixel: a sonda renderiza uma cópia ampliada do controle
**fora** do `overflow` da folha e fotografa. Comparar
`.playwright-mcp/base-dot-zoom16.png` (antes) com `m25-dot-proof.png` (depois)
responde a pergunta num olhar; nenhum número de layout responde.

**2. Ampliar com `transform: scale()` no elemento original não funciona dentro
de um `Sheet`.** O `.hds-sheet-content` é `overflow-y: auto`, então a cópia
ampliada é recortada e o screenshot pega o que está atrás. Clone o nó para um
host `position: fixed` fora da folha.

**3. Truncamento é mensurável — não confie no screenshot.**
`scrollWidth > clientWidth + 1` diz, por linha e por tema, se há reticências. Foi
assim que "Automático · Git…" foi pego nos três temas de uma vez, e é a asserção
que impede a regressão. A causa era `1fr` onde precisava ser `minmax(0, 1fr)`:
uma trilha `1fr` tem **piso no próprio conteúdo**, então a coluna vizinha nunca
consegue usar o espaço que esta não está usando.

**4. Especificidade insuficiente não falha em lugar nenhum.** A largura da folha
de perfil estava declarada em `.wb-profile-sheet` (0-1-0) e perdia para
`.hds-sheet-content[data-side='right']` (0-2-1) do design system. A regra estava
no arquivo, correta, e **sem efeito** desde que foi escrita — não é erro de CSS,
não é erro de build, e o valor herdado é plausível. Ao sobrescrever uma medida do
design system, **repita a forma do seletor dele**, não só a classe própria.

**No gate E2E, no mesmo commit** (corolário do M16): `e2e/contrast.spec.ts` ganhou
`@p0 @a11y the transcription-model scope`, que mede o que a sonda mockada não
pode — a leitura de hardware vem do `app.getGPUInfo` real da máquina que roda a
suíte. E os dois sweeps que já abriam a folha de perfil passaram a **navegar até
o escopo**, porque o conteúdo que esperavam agora está um nível dentro.

**Cuidado de piso que veio junto:** o sweep do escopo de atalhos reprovou com
`expected > 5, received 5` — e não era contraste, era o `sampleTextContrast`
deduplicando por (cor, fundo, tamanho, peso). Uma superfície pequena feita com os
tokens da casca produz poucas amostras distintas por construção. O piso de
contagem só serve para pegar "a superfície não abriu" ou "tudo estava
`aria-hidden`"; quem prova que abriu é o `waitFor`, que falha com timeout em vez
de com um zero silencioso.

**E uma armadilha de semântica, não de pixel:** o drill-down fez o `Escape`
voltar um nível antes de fechar. Um teste E2E que fechava a folha com um
`Escape` só passou a deixar o overlay no ar, e a falha aparece 30 s depois como
"botão Enviar não encontrado" — bem longe da causa. Superfície que ganha
navegação interna: procure por `keyboard.press('Escape')` nos specs no mesmo
commit.

## O que este passe não cobre

Contraste é objetivo e agora é computacional. Hierarquia visual, densidade,
copy, e "duas affordances fingindo ser uma" continuam exigindo olho humano — o
guia direciona essa atenção, não a substitui.

## Armadilha nova: fonte de emoji sequestrando texto comum

O app **empacota** o `Noto Color Emoji` (`src/renderer/src/assets/fonts.css`)
porque um host sem fonte de emoji — todo Linux/WSL limpo — renderizava cada
emoji de resposta do agente como retângulo. O `unicode-range` do Google, porém,
declara `U+23, U+2a, U+30-39, U+a9, U+ae` (`#`, `*`, dígitos, `©`, `®`): são as
**bases** dos emojis de teclado (`1️⃣` = `1` + VS16 + U+20E3). `unicode-range`
casa por caractere e não sabe se vem um seletor de variação depois, então
qualquer uma dessas letras cai nesta fonte assim que as famílias anteriores da
pilha não tiverem o glifo.

Foi exatamente o que aconteceu na pilha monoespaçada, onde nenhuma das faces
nomeadas existe numa caixa Linux padrão: um padrão de Glob apareceu como
`✱✱/✱.md`. Esses cinco ranges estão removidos do `fonts.css`.

A lição para o passe visual: **teste com texto que não é emoji** — um caminho
com `*`, um número, um `#` — sempre que mexer em pilha de fontes. O olho passa
batido por um asterisco levemente diferente; um screenshot de um comando com
glob não passa.

## Sonda do Console MCP (M15)

[`tools/visual/mcp-console-contrast.mjs`](../tools/visual/mcp-console-contrast.mjs)
varre 26 seletores do console MCP — stream, faixas de sessão, rail por servidor,
cluster da status bar e os filtros do design system — nos **três** temas, e
mede também os portadores não-textuais (os pontos de nível, o preenchimento do
medidor de duração) contra o piso de 3:1. As fixtures vêm do `boot.mjs`, que
agora planta `mcpLogs` com a redação real da CLI e expõe `window.__mcpLog(e)`
para empurrar um evento ao vivo.

Ela nasceu de dois erros que valem mais que a sonda:

**1. Trocar tema por `localStorage` + reload mede o tema do boot três vezes.**
O init script do `boot.mjs` regrava `hive-desktop-theme` a _cada_ navegação, então
o valor volta ao default antes do React montar. A primeira passada deu PASS nos
três temas com **seis** falhas de contraste no tema claro na tela. A sonda agora
dirige o menu "Aparência" do próprio app. Vale para qualquer estado que o
harness também controla: **se a sonda seta o que o harness já seta, ela está
medindo o default dela mesma.**

**2. Uma sonda que não lê `oklch()` reporta PASS, não erro.** `getComputedStyle`
devolve `oklch(...)` literal para tokens escritos assim (`--danger-ink`,
`--success`), e o parser por regex retornava `null` e _pulava_ a amostra — em
silêncio. O texto de erro e os pontos de nível nunca foram medidos. A sonda pinta
um pixel num canvas e lê de volta, o que resolve qualquer sintaxe de cor que o
browser aceite. **Amostra pulada e amostra aprovada têm a mesma cara num
relatório — faça o pulo aparecer** (a sonda lista `missing` separado de
`failures`, e o veredito exige os dois vazios).

**A lição de token que ela produziu:** o par `*-ink` sobre `*-bg` não aguenta
texto pequeno em negrito. As contagens de erro mediram 3,91:1 (status bar) e
4,44:1 (contagem do `SegmentedControl`, tema claro) — `--danger-ink` fica perto
demais em luminância do próprio tint, e o da status bar piora quando o estado
pressionado do cluster compõe por baixo. Ambos passaram a usar preenchimento
**opaco** (`color-mix(… var(--danger) 26%, var(--surface))`) com texto `--ink`:
o tom carrega o significado, o número continua legível, e o badge deixa de
depender do que está atrás dele.

E, de novo, `--faint`: a hora, a categoria e a faixa de sessão foram parar nele
por serem metadados, e mediram 2,95:1 no claro. Mesma lição do M14 (L-TI-1),
módulo novo. A regra prática: **`--faint` é para ícone e marca inativa; o que
alguém lê é `--muted` ou mais escuro.**

## Sonda dos escopos de atalho (M16)

[`tools/visual/shortcuts-pass.mjs`](../tools/visual/shortcuts-pass.mjs) percorre
as superfícies de `shortcut-scopes` — o picker nos **dois** escopos, o estado de
conjunto vazio, a folha de perfil e a barra de atalhos dentro de uma conversa —
nos três temas, medindo 22 seletores por estado e deixando um screenshot por
estado em `.playwright-mcp/scopes-<estado>-<tema>.png`.

Duas coisas nela valem para a próxima sonda:

**1. Um arquivo por passe, não um por tema.** Cada chamada de
`browser_run_code_unsafe` roda em contexto próprio, então setar
`globalThis.HIVE_THEME` numa chamada e rodar o arquivo na seguinte não funciona
(ver acima). Esta sonda boota **uma vez** e troca de tema pelo menu "Aparência"
do próprio app dentro do mesmo arquivo, devolvendo os três resultados de uma vez.

**2. O `CommandItem` do design system é `role="option"` (cmdk), não `button`.**
Nos testes unitários o DS é mockado como `<button>`, então `getByRole('button',
{ name: 'Alternar atalho: …' })` funciona lá e falha com timeout de 30s aqui.
No app servido, procure pelo nome acessível
(`[aria-label="Alternar atalho: …"]`).

**O que ela achou, e a regra que sobrou:** quatro reprovações, **duas
pré-existentes** e sem relação com a feature — `PADRÃO` do card de agente
habilitado (3,56:1 no `hive`) e "Como instalar" (4,05:1), ambas coral sobre uma
superfície _já_ tingida com o mesmo coral. A regra: **coral é seguro sobre
`--bg` e não é sobre um tint** — a razão compõe para baixo. O conserto é o que o
`SegmentedControl` do DS já documentava: preenchimento **opaco** carrega o tom,
`--ink` carrega o texto.

E o corolário de processo, agora também no `HARNESS.md`: superfície que só
aparece sob demanda (diálogo, sheet, popover) entra no sweep de
`e2e/contrast.spec.ts` **no mesmo commit** — as duas reprovações do
`AgentPicker` sobreviveram desde o M9 exatamente por não estarem lá.

## Sonda do picker de agentes (M17)

[`tools/visual/agent-setup.mjs`](../tools/visual/agent-setup.mjs) é a primeira
que cobre um **gate de primeira execução**. O `boot.mjs` resolve todos os gates
na hora para cair na work UI, então a tela de escolha de agentes — literalmente
a primeira que um usuário novo vê — nunca aparecia num screenshot. Esta sonda
para nela: reporta workspace escolhido e conjunto de agentes habilitados
**vazio**, que é o que roteia o `App` para `setupAgent`.

Ela percorre cinco estados (nada detectado, instalando, falhou com a saída do
npm aberta, instalado e adotado, e uma nova varredura que acha algo) nos três
temas, medindo 24 seletores e deixando `.playwright-mcp/agents-<estado>-<tema>.png`.

Duas coisas dela valem para a próxima:

**1. `page.goto` só com o hash trocado NÃO recarrega.** A primeira versão
carregava o tema em `#dark`/`#light`/`#hive`; navegação só de hash é
same-document, então o init script não roda de novo e a cena do tema anterior
vaza para o próximo. O relatório dizia três temas e media um. Um query param
(`?theme=`) força navegação de verdade. É a contraparte, para telas de gate, da
lição do M15 sobre dirigir o tema pelo controle real — aqui não existe controle
para dirigir, porque o menu "Aparência" vive na work UI.

**2. Uma regra nova para o mesmo seletor vence nas propriedades que nomeia e
herda o resto.** O `.wb-agent-card-install` redesenhado virou `flex-direction:
column` por cima de uma regra antiga que era uma linha com `align-items:
center`. O valor antigo sobreviveu e centralizou cada linha do bloco de
instalação — invisível em teste unitário, óbvio no primeiro screenshot. Quando
uma reescrita muda o eixo de um componente, **apague a regra antiga** em vez de
empilhar, e re-declare `align-items`/`text-align` explicitamente quando o
ancestral for centralizado.

**O que ela não mede, de propósito:** nada aqui clica em "Instalar" contra o
app de verdade — isso roda um `npm install -g` global. O `e2e/contrast.spec.ts`
cobre a superfície em repouso do picker; os estados transitórios ficam aqui,
onde o bridge é mockado.

## Sonda das superfícies de MCP (M19)

[`tools/visual/mcp-visibility.mjs`](../tools/visual/mcp-visibility.mjs) cobre as
três superfícies que a M19 criou — a linha de handshake dentro do turno, o card
de roster da status bar e a faixa de servidores do console — em **cinco
estados** (saudável, com falha, card saudável, card com falha, console vazio) e
nos três temas, deixando `.playwright-mcp/mcpvis-<estado>-<tema>.png`.

Ela nasceu de três coisas que valem para a próxima sonda:

**1. Mutar a fixture depois que a store carregou mede um estado que nunca foi
renderizado.** `useMcpLogs` lê o histórico **uma vez por workspace**; um
`window.__mcpSilence()` chamado depois disso não muda nada na tela. A primeira
passada reportou cinco amostras `missing` no estado vazio — que é o próprio
sinal de que o estado não existiu. O `boot.mjs` ganhou `?mcpsilent=1`: um query
param força navegação de verdade e re-executa o init script (mesma lição do M17).
A regra: **se o estado que você quer medir depende de um efeito que roda no
mount, chegue nele navegando, não mutando.**

**2. `missing` é o único jeito de um estado ausente virar um erro em vez de um
PASS.** Nas duas passadas, o veredito só ficou verde quando `failures` **e**
`missing` estavam vazios nos três temas. Mas o corolário também vale: seletor
que só existe num estado (o badge de problema, o ponto de falha) não pode entrar
na lista do estado saudável, ou o `missing` vira ruído e para de significar
alguma coisa. A sonda tem duas listas por isso.

**3. Contraste verde não é passe visual.** Os três temas deram PASS de contraste
na primeira execução e o screenshot mostrou três defeitos que número nenhum
pegaria: o resumo da status bar cortado em `1 de 3 com probl…` (`max-width` de
140px), os nomes do card cortados em `hive-appro…`, e as colunas de estado e
contagem desalinhadas entre as linhas. Este último é o mais instrutivo —
`display: grid` **em cada `<li>`** dimensiona as colunas de cada linha de forma
independente, então elas nunca se alinham entre si. O conserto é uma grade só na
`<ul>` com as linhas herdando as trilhas por `subgrid` (que, ao contrário de
`display: contents`, mantém o `<li>` na árvore de acessibilidade).

**A lição de UX que sobrou:** truncar um caminho de cache com reticências corta
justamente a metade que responde à pergunta. O slug (`C--Users-gusta-Desktop-…`)
é o que diz _qual working directory a CLI achou que tinha_; o prefixo é sempre o
mesmo. Estado vazio tem espaço — deixe quebrar em duas linhas.

**No gate E2E, no mesmo commit** (corolário do M16): `e2e/contrast.spec.ts` ganhou
`@p0 @a11y the MCP roster surfaces`, que roda um turno de verdade pelo CLI
stand-in com `mcp_servers` na linha de init — então quem está sendo medido é o
`readMcpRoster` de produção, não uma fixture pronta. E ele repetiu a armadilha
do M15 na primeira execução: os pontos de estado são `--success`/`--danger`,
escritos em `oklch()`, e `checkContrast` devolve "não deu para medir" —
que a asserção leu como razão **zero** e reprovou. Resolver a cor pintando um
pixel dentro do `page.evaluate` conserta; e note que o modo de falha barulhento
foi sorte, porque a mesma lacuna com uma asserção mais frouxa teria virado um
PASS silencioso.

## Sonda do seletor de terminal (M20)

[`tools/visual/shell-contrast.mjs`](../tools/visual/shell-contrast.mjs) percorre
os **três estados** do seletor de terminal do perfil — automático, um terminal
escolhido (as ressalvas por agente trocam) e o estado em que o terminal
escolhido foi desinstalado — nos três temas, medindo cada texto com o floor
correto (4,5:1, ou 3:1 para os ícones de status). 57 medições, 0 reprovações.

Ela achou **três defeitos que o contraste verde não pegaria**, e os três são de
famílias que já apareceram aqui:

**1. Estilo de dado aplicado a uma frase.** A segunda linha da opção
"Automático" é uma sentença, mas herdava o tratamento da linha de _caminho_
(monoespaçada + `text-overflow: ellipsis`) e chegava truncada em "Prompt de
C…". Um caminho e uma frase moram na mesma posição do layout e mesmo assim são
tipos diferentes de conteúdo — o `data-path` separa os dois. E caminho **quebra
em duas linhas** em vez de truncar: a metade que as reticências comiam era
justamente a que distingue dois PowerShells.

**2. A mesma informação duas vezes, a 40px de distância.** A barra de status
dizia "em uso: Prompt de Comando" logo acima da linha "Automático", que diz
"Segue o padrão do sistema: Prompt de Comando" — mais o selo "PADRÃO DO
SISTEMA" na linha correspondente. Três vozes para um fato. A barra ficou só com
a contagem.

**3. `:hover` tão marcado quanto `selecionado`.** A linha em hover usava
`--surface-2`, que nos temas claro e hive é quente o bastante para ler como o
tint de acento do estado **selecionado** — de relance, a linha sob o mouse
parecia escolhida. Trocado por uma lavagem neutra (`color-mix` com `--ink`), que
resolve nos três temas.

**Cuidado de fixture que vale para a próxima:** um `select` mockado como no-op
faz o seletor nunca mudar de opção, e o passe seguinte lê a inércia da fixture
como defeito do componente. O `boot.mjs` guarda o id escolhido em
`state.shellSelected`, então clicar muda de verdade — foi assim que o estado
"escolhido" pôde ser fotografado.

## Sonda da seleção de texto

[`tools/visual/selection-contrast.mjs`](../tools/visual/selection-contrast.mjs)
mede o que o `::selection` realmente pinta nas quatro superfícies em que se
arrasta o mouse — a mensagem do usuário, a resposta do agente, o compositor e
uma linha da árvore — nos três temas. 12 medições por run.

Ela existe porque o defeito que a originou é **invisível para todo o resto
deste guia**. Toda sonda acima mede uma superfície _em repouso_; seleção é um
estado que o usuário provoca. O design system tinha uma única regra global
(`background: var(--accent)`) para todas as superfícies — então na única que é
ela mesma `--accent`, o balão da própria mensagem, arrastar sobre o texto
pintava coral sobre coral. Medido: `rgb(204,121,88)` dos dois lados, razão de
**1,00:1**. Nada disso aparece num screenshot do estado em repouso, num teste
unitário, nem no CSS — que se lê perfeitamente sensato.

**Dois pisos, porque uma seleção faz duas coisas** (e só o segundo pega esse
bug):

- o texto selecionado tem que continuar legível sobre o destaque — **4,5:1**;
- o destaque tem que ser distinguível da superfície em que cai — **3:1**, o
  piso de não-texto. Sem isso não há seleção para ler.

**A lição de token que sobrou:** `::selection` resolve `var()` contra o
**elemento de origem**, e custom properties herdam. Então o par virou
`--selection-bg`/`--selection-ink` (tokens.css) e qualquer superfície que se
pinta de `--accent` reaponta o par **em si mesma**, duas linhas ao lado do
`background` que causa o problema (`ChatMessage.css`, `Button.css`, e a lista
agrupada no topo do `workbench.css`). Não há segunda regra para manter em
sincronia, e a inversão usada — `--accent-ink` sobre `--accent`, o próprio par
do preenchimento trocado — herda a garantia de contraste que aquele par já
tem, em vez de introduzir uma cor que precisaria ser remedida (5,54:1 no escuro
e no hive, 8,91:1 no claro).

**Ler o par no `:root` não serve.** Reaponte-o onde ele é sobrescrito e leia-o
de lá — uma sonda que amostra a raiz mede o default três vezes e reporta PASS.
É a mesma armadilha do M15 (medir o tema do boot três vezes) numa forma nova.

**No gate E2E, no mesmo commit** (corolário do M16): `e2e/contrast.spec.ts`
ganhou `@p0 @a11y text selection`, que roda um turno de verdade pelo CLI
stand-in — duas das quatro superfícies não existem antes de uma mensagem ser
trocada. O gate foi verificado _ao contrário_ também: com a correção do
`ChatMessage.css` removida, ele reprova com a frase certa ("the highlight … is
indistinguishable from … — selecting the text would change nothing on screen").
Portão que nunca falhou não é portão.

**Cuidado de fixture, terceira vez:** o `listTree` do `boot.mjs` estava escrito
com `kind: 'directory'` onde o `FsTreeNode` do Explorer lê `type`. Toda linha
virava folha — sem pastas, sem aninhamento, sem intervalo de seleção que
valesse o nome — e o passe leria isso como comportamento do componente. Se a
fixture não bate com o contrato, a sonda mede a fixture.

## Quarta armadilha do parser: `oklab()` volta como forma desconhecida

`color-mix(in oklab, var(--accent) 30%, transparent)` — a pílula de menção do
composer — resolve no `getComputedStyle()` como `oklab(L a b / α)`, que **nenhum
dos três regexes** da sonda compartilhada (`color(srgb …)`, `rgba()`, `#hex`)
reconhece. O `parse()` devolveu `null`, o `bgOf()` pulou a camada, e a pílula
mediu **1,00:1 contra a superfície em que estava sentada** — um FAIL alto e
confiante sobre um defeito que não existia, enquanto o defeito de verdade (um
tint fraco demais para enxergar no tema `hive`) passava sem medição.

A correção está em `tools/visual/mention-pass.mjs`: qualquer forma que os
regexes não reconheçam cai num canvas 1×1 (`ctx.fillStyle = valor` + `fillRect`

- `getImageData`), que resolve tudo que o CSS aceita. Continua valendo a
  armadilha 3 — leia os canais como vêm, **sem** dividir pelo alfa. Uma sonda que
  não reconhece a cor não fica em silêncio: ela reporta um número errado com cara
  de certo.

## Quinta armadilha: `opacity` num ancestral nenhuma sonda de CSS enxerga

O passe do file-clipboard precisava medir uma linha "recortada" — a linha
inteira caía a `opacity: .5`, e a pergunta era se o nome do arquivo ainda
passava dos 4,5:1. Três sondas seguidas responderam três números diferentes:

- ler `getComputedStyle(el).color` contra `backgroundColor` → **2,31:1**. Errado:
  a linha estava selecionada, e o fundo lido não era o que estava pintado.
- subir a cadeia até um ancestral opaco e compor `ink*α + bg*(1-α)` à mão →
  mais perto, mas ainda uma reconstrução: `opacity` é um produto de toda a
  cadeia, e a linha ainda podia carregar um tint com alfa no meio.
- ler os **pixels pintados** → 3,98 / 3,97 / 3,37 nos três temas, e esse é o
  número.

A receita da terceira: `page.screenshot({ clip })` sobre a bounding box do
elemento, o buffer de volta para dentro da página em base64, `createImageBitmap`

- canvas + `getImageData`, e então a cor de fundo = o pixel mais frequente, a
  tinta = o pixel mais distante dele em luminância (ignorando os que aparecem
  menos de ~4 vezes, que são antialias). Nenhum `getComputedStyle` participa, e é
  por isso que funciona: `opacity`, `color-mix`, tints empilhados e o próprio
  antialias já estão resolvidos no que a tela mostra.

Consequência de design, não só de método: **um fade de linha inteira que lê bem
não passa no piso de texto**. A saída foi separar os dois — o ícone carrega a
affordance a 0,45 (grafismo, piso de 3:1) e o rótulo recua só até 0,72
(6,81–7,25:1 medidos). Fade de linha única é a armadilha; o Windows Explorer
sempre fantasmou o _ícone_.

## Piso inventado não é medição

O mesmo passe queria checar algo que a WCAG não cobre — "dá para ver que ali há
uma pílula?". O primeiro piso (1,3:1) foi escolhido no teclado; o screenshot em
exatamente 1,30:1 mostrava uma mancha. Subido para 1,7 reprovou uma pílula que
lê perfeitamente a 1,60:1. Onde não existe número normativo, calibre contra
imagens e **escreva a evidência ao lado do número** — os dois screenshots que
cercam o valor estão citados no comentário do arquivo. Sem isso é preferência
com casa decimal.

## Um terceiro tema não herda blocos escritos para dois

`--wb-ic-*` (as cores por tipo de arquivo) tinha rampa clara no `:root` e rampa
escura em `[data-theme='dark']`. O tema `hive` é escuro e caía na rampa **clara**
— L≈52% sobre bordô quase preto, 2,57:1 — na árvore do explorer, no cabeçalho
do visualizador e no diálogo de busca, não só na superfície que encontrou o
problema. Quando um bloco de tokens é chaveado por tema, faça grep de **todos**
os seletores de tema, não só do que você está mexendo.

## Olhar o instalador NSIS sem sair do WSL

O `.exe` de instalação renderiza de verdade aqui, e o screenshot pegou um
defeito de cópia que compilação nenhuma pegaria (o texto dizia "Clique em
Avançar" e o arquivo de idioma pt-BR do NSIS rotula o botão `Próximo`):

```bash
mkdir -p /tmp/fb
Xvfb :99 -screen 0 1100x800x24 -fbdir /tmp/fb &
DISPLAY=:99 WINEPREFIX=/tmp/wine wine dist/Hive-<versão>-setup.exe &
```

`-fbdir` mantém um dump XWD vivo da tela em `/tmp/fb/Xvfb_screen0`: cabeçalho
big-endian de 32 bits (largura em 16, altura em 20, bits-por-pixel em **44**,
bytes-por-linha em **48** — errar esses dois offsets devolve `bpp: 4400`), pixels
BGRX depois de `header_size`. Vinte linhas de Node + `sharp` viram PNG. Não há
`xdotool` nesta máquina, então dá para ver a primeira página, não clicar nas
seguintes.

## Trocar de tema **nunca** com `reload()` — a armadilha que reporta o dobro

Está dito lá em cima ("depois do boot, troque pelo controle real") e vale repetir
aqui com o número: [`tools/visual/four-fixes-pass.mjs`](../tools/visual/four-fixes-pass.mjs)
começou fazendo `localStorage.setItem(tema)` + `reload()` por tema. O
`addInitScript` do `boot.mjs` roda de novo a cada navegação e **regrava a chave
para `dark`**, então as três rodadas mediram o tema escuro e o relatório saiu
`pass` em quinze alvos — nenhum deles do tema que dizia estar medindo.

O sinal foi as três colunas virem com **números idênticos** (`6.98`, `4.79` nos
três temas). Contraste que não muda entre temas não é estabilidade, é a mesma
página medida três vezes. A sonda hoje troca pelo menu Aparência de verdade e
registra `applied` — o `data-theme` que o documento realmente tinha na hora da
medição — para que a próxima versão dela não possa mentir do mesmo jeito.

## `transform-origin: center` num SVG não é o centro do que você desenhou

Numa `<circle>` dentro de um `viewBox`, `transform-origin: center` resolve contra
o **viewport do SVG**, não contra o círculo. Os anéis de sinal do emblema de
preparo (`HiveSignal.tsx`) saíram voando para cima e para a esquerda em vez de
expandirem a partir da marca. `transform-box: fill-box` prende a origem à caixa
do próprio elemento e resolve.

O que este defeito ensina sobre a sonda: **um frame não prova animação.** O
print de uma animação errada é só um anel fora do lugar, que se lê como decisão
de design. Fotografe três fases (`t=400`, `t=1200`, `t=2000`) — a geometria
errada só se denuncia quando as fases não são concêntricas entre si.

## O viewport curto é um estado, não um caso de borda

Trocar `max-height: calc(100vh - …)` por `min-height: 0` num filho flex só
funciona se o **container** tiver altura. `.wb-gate` é `min-height: 100vh`, que
cresce: a 1100×620 o formulário de configuração foi para 1053px, o `body` ganhou
uma barra de rolagem, e a 1440×900 — o tamanho em que todo screenshot é tirado —
nada disso aparecia. Meça `document.body.scrollHeight > window.innerHeight` em
pelo menos um viewport baixo antes de dar uma tela de gate como pronta; uma
barra de rolagem de página lateral num app desktop está nas anti-referências do
`PRODUCT.md`.

## Detectar opacidade por formato de string é a mesma armadilha, de novo

Uma sonda que empilha fundos precisa saber onde parar — e a versão óbvia
("pare na primeira camada opaca") testa a string com algo no formato de
`rgba(…, 0.14)`. Os tints deste app são `oklch(… / 14%)` e `color-mix()`, que
o `getComputedStyle` **não** serializa assim. O teste lia o tint da linha
selecionada como opaco, parava ali, e reportava a marca de seleção do tema
**escuro** pousada em `#f8ece7` — coral sobre o branco do próprio canvas.

O conserto não é um regex melhor: é **não precisar do teste**. Colete todas as
camadas até a raiz e pinte na ordem — uma camada opaca no meio da pilha zera o
canvas, que é exatamente o que ela faz na tela. Parar cedo é uma otimização que
só pode errar.

A generalização, que vale para toda sonda daqui: **se o critério de parada
depende de reconhecer um formato de cor, ele vai quebrar.** O navegador sabe
compor; a sonda não precisa saber.

## Passe exploratório 2026-08-21 — o que uma varredura ampla acha que uma sonda por feature não acha

Todas as sondas acima nasceram de uma milestone e cobrem a superfície dela. Um
passe que varre **todas** as vistas do rail, nos três temas, com um turno na
tela, achou nove reprovações de contraste em seis módulos — nenhum deles o
módulo que estava sendo trabalhado quando a regra foi escrita. A varredura tem
esse valor justamente por não ter dono.

**`--faint` em texto de leitura, quarta e quinta vez.** A regra já está escrita
três vezes neste arquivo e mesmo assim reapareceu em: a coluna de pasta e o
rodapé de teclas da paleta Ctrl+P, a contagem e a pílula "Não testado" do
gerenciador MCP, o cabeçalho de grupo do histórico, e o rodapé do compositor
("de contexto" e a linha que ensina Enter / Shift+Enter / `/` / `@`). Todos
mediram 4,18:1 no escuro e 3,71:1 no claro — o mesmo par de números, porque é o
mesmo token na mesma posição.

O número que fecha o assunto: `--faint` mede **4,53 / 3,29 / 4,97** sobre
`--bg` e **4,18 / 3,71 / 4,59** sobre `--surface` (escuro / claro / hive). Ele
só limpa 4,5:1 sobre o `--bg` escuro — por 0,03 — e sobre o `hive`. **No tema
claro ele não passa em lugar nenhum.** Não é um token de texto; é um token de
ícone e marca inativa, e a única forma de parar de reencontrá-lo é essa tabela.

**O placeholder é o caso mais caro dessa família, e mora no design system.**
`Input`, `Textarea`, `Command` e `Select[data-placeholder]` pintavam
`::placeholder` em `--faint`. O compositor do chat — o controle mais usado do
app — **não tem outro rótulo além do placeholder**, e ele media 4,18 / 3,71 /
4,59. Agora 6,03 / 6,18 / 6,23. Os `:disabled` desses mesmos arquivos seguem em
`--faint` de propósito: componente inativo é isento (WCAG 1.4.3), e o
apagamento é o que carrega "não dá para digitar aqui".

**Tint por baixo de uma calha: um jeito novo de o token certo falhar.** O
número de linha do patch já tinha sido corrigido para `--muted`, com um
comentário citando esta lição — e continuava reprovando: 4,15 (del) e 4,08
(add) no tema claro, contra 4,90 numa linha intocada. A causa não é o token, é
a geometria: `.wb-patch-no` é uma coluna do grid `.wb-patch-line`, então numa
linha alterada ele senta **sobre** o tint de add/del, que compõe a razão para
baixo. O `.wb-patch-text` já era promovido a `--ink` nessas linhas; a calha
nunca foi. A generalização: **quando uma regra tinge a linha inteira, toda
coluna dela precisa ser remedida, não só a que carrega o conteúdo.**

**`--accent-tint-ink` existe e três chamadas ainda não o usavam.** "ATUAL" e
"Em andamento" do histórico só renderizam na linha _atual_ — a que é pintada
com `--selected-bg` — e a inicial do avatar do personalizador de atalhos senta
literalmente sobre `--selected-bg`. Coral sobre o tint do próprio coral: 4,02
no escuro, 4,18 no hive. Ao adicionar um token para resolver uma composição,
**vale um grep pela composição, não só pelo call site que a descobriu.**

### O que só o snapshot de acessibilidade pegou

Contraste é o que este guia sabe medir, e por isso é o que ele encontra. Três
defeitos deste passe são invisíveis para qualquer sonda de cor:

**1. Toda pasta do explorer era um `treeitem` sem nome.** O `Tree` do DS
embrulhava a linha de um nó com filhos num `<button aria-hidden="true">`; como
o `li[role=treeitem]` calcula o nome a partir do conteúdo, e o conteúdo inteiro
estava escondido, o leitor de tela anunciava "item de árvore, recolhido, nível
1" — sem o nome da pasta. Arquivos passavam porque folhas já usavam `<span>`.
O mesmo embrulho punha o botão "Mais ações" da linha **dentro** de uma subárvore
`aria-hidden` (regra `aria-hidden-focus` do axe: um foco alcançável por Tab que
não existe na árvore de acessibilidade) e **dentro de outro `<button>`**, que é
HTML inválido. Um `<span>` resolve os três: o `li` já tinha o papel e já tratava
o clique.

O jeito de encontrar isto é `browser_snapshot` do MCP, não screenshot: a tela
mostra "_bmad" perfeitamente legível.

**2. Três `banner` e nenhum `main`.** `PaneHeader` renderizava `<header>`, e um
`<header>` fora de elemento seccionador computa como `role="banner"` — um por
painel, mais o da barra de título. E a área de trabalho não era `main`, então
não havia para onde "pular para o conteúdo".

**3. `<html>` sem `lang`.** Todo o texto do app é pt-BR e nada dizia isso.
WCAG 3.1.1, nível A, uma linha.

### Duas armadilhas do próprio passe

**Trocar de tema por `element.click()` de dentro da página não funciona.** O
gatilho do `DropdownMenu` do Radix escuta `pointerdown`, não `click`, então um
`page.evaluate(() => btn.click())` abre coisa nenhuma e a sonda mede o tema
anterior três vezes — a mesma classe de falha silenciosa que o M15 registrou
com `localStorage`. Use o clique real do Playwright.

**Um `Escape` para fechar um menu responde o card de autorização.** Já está
escrito na sonda de approvals; vale repetir para qualquer passe que use
`Escape` como "voltar ao estado neutro" com um turno na tela.

### Defeito de layout que só existe fora de 1440×900

O FAB da base de conhecimento é `position: fixed` no canto inferior direito e o
rodapé do compositor vai até a borda da coluna. A 1440px a coluna já ficava
132px longe dele; a ~1100px e abaixo — janela redimensionada, ou zoom de 200% —
o botão pousava **em cima** do fim da dica, e "…· / para skills · @ para
arquivos" chegava na tela como "· / p" (o `text-overflow: ellipsis` existia; as
reticências ficavam atrás do botão). Reservar a pegada do próprio botão no
`padding-right` do rodapé resolve em qualquer largura.

A lição de método: **medir sobreposição é uma asserção de retângulos**, não um
olhar. `!(a.right <= b.left || a.left >= b.right || …)` sobre dois
`getBoundingClientRect` acha isso em qualquer viewport da lista, e o screenshot
de 1440 nunca acharia.

### Um `NaN` que a sonda de contraste não vê e o usuário não desgruda

`contextTokens` somava três campos do `usage` sem coalescer, enquanto o
detalhamento duas funções abaixo coalescia. Um relatório sem um dos campos — uma
versão da CLI, um adaptador que não seja o da Claude — fazia o rodapé do
compositor exibir **"NaN% de contexto"** pelo resto da sessão, com a folha de
detalhe mostrando um detalhamento plausível ao lado. Guardas assimétricas dentro
do mesmo arquivo são o cheiro; o `?? 0` que faltava era um.

### O centro de um modal pode envelhecer (2026-08-31)

[`tools/visual/four-fixes-2026-08-31.mjs`](../tools/visual/four-fixes-2026-08-31.mjs)
cobre as quatro correções daquele dia — o comando **Recarregar janela**, o botão
**Descartar** do git, o **checkout** no menu de estouro do controle de versão e o
centro dos modais do Estúdio/MCP — nos três temas, num run só.

A lição que vale além dela: **um centro feito de porcentagem envelhece.** O
`DialogContent` do DS centrava com `top/left: 50%` + `translate(-50%, -50%)`, e
uma porcentagem em `translate` resolve contra o **tamanho da própria caixa**. O
Estúdio abre com 145px (só o cabeçalho e o spinner) e assenta em 592px quando a
lista chega — medido, no navegador. A thread principal re-resolve a conta; um
compositor que já tirou a foto do transform animado, não. O painel pinta ~metade
do próprio crescimento abaixo do centro e o rodapé fica cortado pela borda da
janela — **intermitente por construção**, porque depende de os dados chegarem
antes ou depois de a animação de abertura ser commitada.

Duas armadilhas de método aqui:

1. **`getBoundingClientRect` mente sobre esse defeito.** Ele lê o layout da
   thread principal, que está certo; quem está errado é o que foi pintado. Uma
   sonda que só mede o retângulo devolve "centralizado" para um modal visivelmente
   torto. O que a sonda deve provar é a propriedade, não a instância: **não pode
   existir porcentagem no transform** de um elemento que muda de tamanho depois
   de aparecer.
2. **A cena precisa ter o crescimento.** Um fixture que resolve a lista na hora
   nunca reproduz nada — o passe planta `studio.list`/`mcp.list` com atraso de
   propósito, e mede nos dois momentos (carregando e carregado).

A correção é centrar por **layout** (`inset: 0` + `margin: auto` +
`height: fit-content`) e animar só `scale`: sem porcentagem, não há o que
dessincronizar. `height: fit-content` é carga estrutural — com `top` e `bottom`
em 0 e altura `auto`, o CSS resolve para a _altura_ e o diálogo ocuparia a
janela inteira.

**E o `AlertDialog` fecha com `Escape` só com o foco dentro dele.** Um passe que
assume o contrário deixa o scrim de pé e todo clique seguinte pousa no overlay —
o erro do Playwright ("`.hds-alert-dialog-overlay` intercepts pointer events")
é o sintoma. Feche pelo botão real.
