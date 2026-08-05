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
