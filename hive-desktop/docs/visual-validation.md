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
estado em disco — mas custa build + xvfb por iteração. Para *olhar* a UI, servir
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

### 3. Passar pelos gates de primeira execução

```js
localStorage.setItem('hive.tourSeen', '1') // o tour intercepta pointer events
localStorage.setItem('hive-desktop-theme', 'dark') // ou 'light'
```

O tema **precisa** ser setado no storage, não via `data-theme` no elemento: o
React não observa mudança manual de atributo, e um valor de sessão anterior
persiste no profile do browser.

Componentes que leem disco leem o mock — o `ConflictView`, por exemplo, só
mostra conflito se o `readFile` mockado devolver marcadores
`<<<<<<< / ======= / >>>>>>>` de verdade; sem isso ele renderiza (corretamente)
o estado vazio.

### 4. Screenshots

Os caminhos relativos do tool de screenshot do MCP frequentemente não pousam
onde você espera. Use `page.screenshot({ path: '<repo>/.playwright-mcp/x.png' })`
dentro do `run_code_unsafe`. Recarregar re-executa o init script, então o FS
virtual reseta.

Rode **os dois temas**. Metade dos defeitos de contraste registrados apareceu só
no claro.

## Medir contraste — não confie no olho nem no parser ingênuo

O piso é **4.5:1** para texto normal e **3:1** para texto grande
(≥18.66px bold ou ≥24px).

Duas armadilhas já registradas:

1. **O olho erra.** A superfície escura de diálogo é grafite `#242121` sobre um
   corpo quase preto com scrim pesado; o contraste entre os dois faz a
   superfície *parecer* clara no screenshot mesmo estando certa.
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

O mesmo módulo serve em teste unitário: dá para fixar o contraste de um par de
tokens sem passe visual nenhum.

## O que este passe não cobre

Contraste é objetivo e agora é computacional. Hierarquia visual, densidade,
copy, e "duas affordances fingindo ser uma" continuam exigindo olho humano — o
guia direciona essa atenção, não a substitui.
