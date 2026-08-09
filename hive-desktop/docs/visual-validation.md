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

Esse mock já existe pronto em
[`tools/visual/boot.mjs`](../tools/visual/boot.mjs) — o tool
`browser_run_code_unsafe` do MCP roda o arquivo direto (`filename`), sem colar
o script inteiro no prompt. Ele ainda planta fixtures pra dirigir estado depois
do boot: `window.__setVault(v)`, `window.__fsChange(path)` e
`window.__agentEvent(evt)`.

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

**Uma segunda lição de token, da mesma sonda:** `--success-bg` e `--danger-bg`
**não** formam um par. São tints de banner e carregam croma muito diferente
(0,208 no vermelho contra 0,13 no verde), então na mesma opacidade as remoções
gritam mais alto que as adições — o que inverte a ênfase de um diff, já que o
código _novo_ é o que se está pedindo para aceitar. Para tingir dois lados que
precisam ter o mesmo peso, derive do par `--wb-git-added`/`--wb-git-deleted`,
que é casado por construção.

O mesmo módulo serve em teste unitário: dá para fixar o contraste de um par de
tokens sem passe visual nenhum.

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
