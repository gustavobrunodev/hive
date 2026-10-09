# Design Studio · T · Template Angular de Protótipo (skill-irmã `prototipo-angular`)

Profile: `light` (nenhum `## tlc-implement` no `hive-desktop/AGENTS.md`). Handoff: `on`, budget 150k.

Sources:

- `design-studio/.tasks/t-template-angular.md`: a tarefa. Os critérios 1 a 13, as decisões 1 a 4 (a forma de pastas e de URL, o Angular 22, o arquivo de tokens e a conferência como código do app) e o formato do relatório.
- `design-studio/.tasks/1-modulo-e-dados-de-dor.md`, decisão 2: o formato do perfil de design (`perfil-de-design/1`), o perfil Livre e o perfil de exemplo restrito. Esta tarefa constrói o leitor do perfil, e a tarefa 1 o consome.
- `design-studio/docs/adr/0004-template-angular.md`: as regras do template (`templateUrl`, sem ShadowDom, chaves escapadas, checagem de compilação) e a faixa de Node (≥22.22.3 ou ≥24.15).
- `design-studio/docs/adr/0006-telas-livres-no-poc-ids-por-perfil.md`: o POC é livre do IDS, o perfil é o design system das telas, e as conferências são do app.
- `design-studio/docs/adr/0001-porte-com-pontos-de-troca.md`: o template é um ponto de troca e, no banco, vem do iu-memorable.
- `design-studio/DESIGN.md`, "Camada do Protótipo": **vinculante só para a regra Moldura Sem Fresta**. A barra de status de 36px fica presa no topo e some no desktop, o cabeçalho também fica preso, e a barra leva a sombra de 3px que fecha a emenda de subpixel. O resto da seção não vale para o template do POC.
- `design-studio/prototype/proto.css`: a fonte dos tokens do perfil de exemplo restrito (`perfis/tokens-exemplo.css`).
- `hive-desktop/resources/design-studio/catalogo.json`: os nomes das telas de cada Produto, de onde sai o id da tela ("Beneficiário" vira `beneficiario`).

## Out of scope

- De onde vem o Node e quem instala `<raiz>/node_modules` no app: fica na tarefa 2, decisão 4. Aqui os testes instalam as dependências numa `<raiz>` temporária.
- A ponte do modo ao vivo: tarefa 2b. O template não carrega nada dela.
- A regra "parâmetros de faixa sem unidade, dentro de `calc()`": é cobrada pelo validador das Variantes (tarefa 2b, critério 13).
- A camada IDS do protótipo de validação: só vira o perfil de exemplo dos testes.
- O DS Itaú de verdade, que entra no porte, e as telas prontas de qualquer Produto.
- `pontos-de-troca.json` e a tela de erro de configuração: ficam na tarefa 1 (critérios 21 e 22), que lê o perfil com o leitor desta tarefa.

## Landing

Tudo é arquivo novo em `hive-desktop`:

- a skill-irmã em `resources/design-studio/skills/prototipo-angular/`, com o `SKILL.md` e o `template/`;
- os perfis em `resources/design-studio/perfis/`;
- o leitor do perfil e a conferência em `src/main/designStudio/`.

Reaproveita o `processRunner` do Hive para rodar o `ng build`, e segue a convenção do `relatorioFormato.ts` para ler e validar um formato versionado (`formato: "<nome>/1"`).

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Forma de pastas e de URL das Propostas e telas (decisão 1) | `src/app/propostas/<proposta>/telas.json` = `[{ "id", "nome" }]` na ordem da jornada; `src/app/propostas/<proposta>/<tela>/<tela>.component.{ts,html,css}` com `templateUrl: './<tela>.component.html'`; a rota é `/<proposta>/<tela>`; `atual/` só em Protótipo de produto existente; o id da tela é minúsculo, sem acento e com hífen | Uma cópia do app inteiro por Proposta, cada uma com seu `ng serve`: N servidores por Protótipo. Uma Proposta por branch: duas Propostas não rodam juntas |
| Angular 22, `templateUrl`, encapsulamento Emulated ou None (decisão 2) | dependências `@angular/*` 22.x; o `ng` roda com Node ≥22.22.3 ou ≥24.15 | Vite + React + TS: no porte, todos os Protótipos seriam refeitos para o DS Itaú |
| A identidade do Protótipo mora em `src/styles/tokens.css` (decisão 3) | variáveis CSS `--cor-…`, `--fonte-…`, `--raio-…` e `--espaco-…`; as telas usam essas variáveis | Valores espalhados pelos componentes: o perfil restrito não teria onde conferir nem o que trocar |
| A conferência é um módulo tipado do app (decisão 4) | `src/main/designStudio/conferencia.ts`: recebe a pasta do Protótipo, o perfil de design e um `compilar` injetável, e devolve `{ aprovado, achados: [{ tipo: "regra", regra, arquivo, linha?, tela?, mensagem } \| { tipo: "perfil", regra, arquivo, linha, valor }] }`. `aprovado` é `false` só quando há achado de `tipo: "regra"` | `npm run checar` dentro do template: o template do iu-memorable não traria o script |
| O leitor do perfil de design é deste lote, e a tarefa 1 o consome | `src/main/designStudio/perfilDeDesign.ts`: `lerPerfilDeDesign(arquivo)` devolve o perfil tipado (`perfil-de-design/1`) ou um erro com o motivo. Os perfis ficam em `resources/design-studio/perfis/livre.json`, `restrito-exemplo.json`, `tokens-exemplo.css` e `regras-exemplo.md` | Cada tarefa lê o JSON por conta própria: a tarefa 1 (critério 22) e esta (critério 13) divergiriam sobre o que é um perfil válido |
| "Cor fora dos tokens" e "fonte fora do perfil" (critério 13), regra que a tarefa 2b (critério 13) reaproveita | Nos `.css` e `.html` das telas (`src/app/propostas/**`), é achado: (a) uma cor literal (hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()` ou nome de cor CSS); (b) um `var(--x)` cuja `--x` não está declarada no arquivo de tokens. Não é achado `transparent`, `currentColor`, `inherit`, `initial`, `unset` nem `none`. Nas fontes, é achado cada família de `font-family` (ou do atalho `font`) que não é família genérica, não está na lista do perfil e não é um `var(--fonte-…)` declarado nos tokens | Comparar só os valores (uma cor literal igual ao valor de um token passaria): a troca dos tokens no porte não alcançaria essa cor |
| (construção) Como o template acha Propostas e telas (critério 3) | `src/app/tela/carregar.ts` usa dois `import()` com template literal, que o esbuild do Angular transforma em glob: `` import(`../propostas/${proposta}/telas.json`) `` e `` import(`../propostas/${proposta}/${tela}/${tela}.component.ts`) ``. Uma rota só, `:proposta/:tela` (mais `**`), aponta para `TelaComponent`, que confere o id no `telas.json` e desenha a primeira classe exportada que é componente (`reflectComponentType`) com `NgComponentOutlet`, dentro da casca. `tsconfig.app.json` inclui `src/**/*.ts`, para que toda tela nova já esteja no programa do TypeScript. Medido em 2026-10-09 (Angular 22.2.2, Node 24.15): o glob é reavaliado a cada rebuild do `ng serve` | Um `rotas.ts` central gerado ou editado a cada tela: fere o critério 3 (arquivo fora de `src/app/propostas/a/`) e precisaria de um gerador. `router.resetConfig` no boot a partir de um índice buscado: o bundle continuaria sem o componente novo |
| (construção) O que dispara o rebuild ao vivo de uma tela nova | A entrada no `telas.json` é escrita **depois** da pasta e dos arquivos da tela: o `telas.json` já está no bundle e é vigiado, e a mudança nele faz o rebuild, que acha a pasta nova pelo glob. Medido: na ordem inversa a tela nova não aparece, nem com `NG_BUILD_WATCH_ROOT=1` (o rebuild de 3 ms reaproveita o resultado anterior, porque nenhum arquivo do bundle mudou); reescrever o `telas.json` com o mesmo conteúdo depois da pasta basta. O `SKILL.md` manda essa ordem, e a tarefa 2 pode reescrever o `telas.json` no fim do turno | `NG_BUILD_WATCH_ROOT=1` ou `--poll` no `ng serve`: medido, não adianta, porque o contexto do esbuild só reconstrói quando muda um arquivo que ele já vigia |
| (construção) `src/app/propostas/` existe sempre no template | o template traz `src/app/propostas/LEIAME.md` (arquivo, não Proposta: a conferência só olha subpastas). Medido: sem a pasta, o glob dá `Could not resolve` e o build falha; vazia, dá um aviso `empty-glob` e o build termina com 0. O electron-builder **não empacota** `.gitkeep` (`excludedNames` do `app-builder-lib`), nem `.gitignore`, `package-lock.json` ou `*.d.ts`, então o template não depende de nenhum deles | Um `.gitkeep`: some no app empacotado, e o primeiro build de um Protótipo novo falharia |
| (construção) Manifesto das dependências compartilhadas | o próprio `template/package.json`: `dependencies` = `@angular/{common,compiler,core,forms,platform-browser,router}` `^22.2.0`, `rxjs ~7.8.0`, `tslib ^2.3.0`; `devDependencies` = `@angular/{build,cli}` `^22.2.2`, `@angular/compiler-cli ^22.2.0`, `typescript ~6.0.2`. A tarefa 2 instala esse manifesto em `<raiz>` (copiado para `<raiz>/package.json`); a cópia dentro do Protótipo fica e nunca é instalada. Os testes fazem o mesmo numa `<raiz>` temporária | Um `dependencias.json` ao lado do template: o template do iu-memorable não traria esse arquivo, e o porte teria de escrevê-lo. Dependências fixas no código do app: a troca do template exigiria mudar o app |
| (construção) A casca e o cabeçalho da tela | `src/app/casca/casca.component.{ts,html,css}`, com `ViewEncapsulation.None` (a regra do cabeçalho precisa alcançar a tela): `.casca` em coluna flex; `.casca-status` com `position: sticky; top: 0; z-index: 4; flex: none; height: 36px; background: var(--cor-fundo); box-shadow: 0 3px 0 var(--cor-fundo)`; a tela abre o seu `.html` com `<header class="cabecalho">`, e a casca o prende com `position: sticky; top: var(--casca-topo); z-index: 4; flex: none; background: var(--cor-fundo)`. Acima de 600px de largura, `.casca-status { display: none }` e `--casca-topo: 0px` | Cabeçalho desenhado pela casca, com o título vindo do `telas.json`: cada tela perderia as ações do próprio cabeçalho (voltar, ajuda), que o agente decide tela a tela |
| (construção) Os nomes dos tokens neutros | `--cor-texto` (#000000), `--cor-texto-suave` (#4d4d4d), `--cor-borda` (#cccccc), `--cor-fundo-suave` (#f2f2f2), `--cor-fundo` (#ffffff) e `--fonte-texto` (pilha que começa por `system-ui`). A casca só usa `--cor-fundo`, `--cor-texto` e `--fonte-texto`, e `perfis/tokens-exemplo.css` declara os mesmos seis nomes (`--pt-ink` → `--cor-texto`, `--pt-muted` → `--cor-texto-suave`, `--pt-line` → `--cor-borda`, `--pt-bg` → `--cor-fundo-suave`, `--pt-surface` → `--cor-fundo`, `--pt-text` → `--fonte-texto`), então a casca funciona com os dois | Nomes por cor (`--cor-preto`, `--cor-cinza-1`): quando o perfil restrito troca o arquivo de tokens, a casca perderia o fundo e a fonte |
| (construção) A compilação da conferência | `src/main/designStudio/conferenciaCompilacao.ts`: `criarCompilarComNg({ node, runner, tempoLimiteMs? })` devolve o `compilar(pasta)` que a conferência recebe. Ele acha `node_modules/@angular/cli/bin/ng.js` subindo a partir da pasta, roda `<node> <ng.js> build --output-path <pasta temporária> --progress=false` pelo `ProcessRunner`, com `cwd` na pasta e `NO_COLOR=1`, `FORCE_COLOR=0`, `NG_CLI_ANALYTICS=false`, e apaga a saída. Cada bloco `✘ [ERROR] <código>: <texto>` vira `{ tipo: "regra", regra: "compilacao", arquivo, linha, mensagem: "<código>: <texto>" }`, com o `arquivo` da primeira linha de local, relativo à pasta e com `/` (medido: o Angular imprime o caminho absoluto quando a pasta tem espaço ou acento). Saída sem bloco, `ng.js` ausente, processo que não sobe ou tempo esgotado viram um achado `compilacao` com `arquivo: "."` e o fim da saída na `mensagem` | `ngc -p tsconfig.app.json`: não é o mesmo build que o `ng serve` faz, e o template do iu-memorable pode ter outra configuração |
| (construção) As regras do relatório | `tipo: "regra"`: `templateUrl` (`template:` dentro de `@Component({…})` num `.ts` de `src/app/**`, fora `*.spec.ts`; linha do `template`), `encapsulamento` (`ViewEncapsulation.ShadowDom`; linha dele), `telas-json` (pasta `propostas/` ausente ou sem Proposta, Proposta sem `telas.json`, JSON inválido ou fora da forma, id que não é minúsculo-com-hífen, id repetido, entrada sem pasta e pasta sem entrada; `arquivo` é o `telas.json` da Proposta, `tela` é o id, e a `mensagem` traz `Proposta "<p>"` e `tela "<id>"`), `componente` (pasta da tela sem `<tela>.component.ts` ou `.html`) e `compilacao`. `tipo: "perfil"`: `cor-fora-dos-tokens` e `fonte-fora-do-perfil`. `tela` vem preenchida em todo achado de regra cujo arquivo está numa pasta de tela. Ordem: estrutura (`telas-json`, `componente`), código (`templateUrl`, `encapsulamento`), compilação, perfil; dentro de cada grupo, por arquivo e linha. Um `compilar` que lança vira um achado `compilacao` | Um único `regra: "convencao"` para tudo da decisão 1: o app não saberia dizer ao agente o que consertar sem ler a mensagem |
| (construção) Onde a conferência procura cores e fontes | Nos `.css` de `src/app/propostas/**`, e nos `.html` de lá só em contexto de estilo: atributo `style`, bloco `<style>` e os atributos `fill`, `stroke`, `stop-color`, `flood-color`, `lighting-color`, `color` e `bgcolor`. Comentários, textos entre aspas e `url(…)` são ignorados. Nome de cor CSS = as 148 cores nomeadas, como palavra inteira (`-` conta como parte do nome, então `--cor-red` e `red-pulse` não são cores), e não é procurado nos valores de `font`, `font-family`, `animation*`, `transition*`, `grid-area`, `grid-template-areas`, `grid-row`, `grid-column`, `counter-*`, `content`, `will-change`, `container-name` e `view-transition-name`. A definição (b) vale em qualquer propriedade, inclusive num `font-family`: ali um `var(--fonte-x)` não declarado gera os dois achados. `valor` é o texto como está no arquivo (`#123456`, `rgb(1, 2, 3)`, `red`, `var(--x)`, `Roboto`); a família é comparada com a lista do perfil sem diferenciar maiúsculas | Procurar cor em todo o texto do `.html`: a palavra "red" num parágrafo viraria achado |
| (construção) O leitor do perfil | `perfilDeDesign.ts`: `validarPerfilDeDesign(valor)` e `lerPerfilDeDesign(arquivo)` devolvem `{ ok: true, perfil }` ou `{ ok: false, campo, motivo }`, com `campo` em `arquivo`, `json`, `formato`, `nome`, `trocaDeEstilo`, `tokens`, `tokens.arquivo`, `tokens.modelo`, `tokens.agentePodeEditar`, `cores`, `fontes` ou `regras`, conferidos nessa ordem, e o `motivo` em pt-BR com o valor recebido. `fontes: []` é válido | Lançar exceção no perfil inválido: a tarefa 1 (critério 22) precisa do motivo para a tela de erro de configuração, sem `try` em volta |
| (construção) A versão e o id da tela | `prototipoAngular.ts`: `lerVersaoDaSkill(pastaDaSkill)` lê o front matter do `SKILL.md` (YAML) e devolve `version` quando é semver, senão `null`; `idDaTela(nome)` faz minúsculas, tira acentos (NFD), troca o que não é letra ou dígito por hífen e apara hifens (`"Beneficiário"` → `beneficiario`, `"Área Pix"` → `area-pix`). A skill começa em `version: 0.1.0` | Ler a versão do `package.json` do template: o template do iu-memorable tem a versão dele, não a da skill |
| (construção) Onde rodam os testes lentos | O comando `E2E` fica como está: o Vitest roda sob o Node 24.15.0 (medido, a suíte do relatório passa). O teste chama o `ng` com `process.env.HIVE_NG_NODE ?? process.execPath` e falha no `beforeAll` se essa versão não atende `^22.22.3 \|\| ^24.15.0 \|\| >=26`; instala o `template/package.json` uma vez numa `<raiz>` temporária chamada `Design Studio`, com o `npm` do mesmo Node, e cada caso copia o template para a sua própria pasta de Protótipo | Rodar o Vitest no 22.22.1 e o `ng` num binário achado em `~/.nvm`: dependeria do layout do nvm de quem roda |
| (construção) O inventário de `resources/design-studio/` do lote anterior | `dataRoot.test.ts` (C10b, "the unpackaged directory carries…") compara a lista **exata** dos arquivos embarcados e reprovou com os arquivos novos. A lista `EXPECTED` ganha, por nome, os 4 arquivos de `perfis/` e os arquivos da skill `prototipo-angular` (o `SKILL.md` e cada arquivo do `template/`), e a asserção continua `toEqual`. A tarefa 1 vai mexer no mesmo array (o `pontos-de-troca.json`): conflito previsto no merge, resolvido somando as duas listas | Derivar a lista esperada do próprio disco: o teste passaria com qualquer arquivo a mais ou a menos. Trocar por `toContain`: enfraquece a prova do lote anterior |

- Portas descobertas durante a construção entram aqui, com a forma literal e a alternativa rejeitada, **antes** do código que as fecha. Os prováveis: como o template acha Propostas e telas sem um arquivo central editado à mão (critério 3); onde fica o manifesto das dependências compartilhadas; e onde rodam os testes lentos, com Node ≥22.22.3.

## Checks

Convenção: cada teste começa pelo id da checagem (`it('T-C6: …')`). Assim `-t "T-C6:"` seleciona só esse teste. Os testes `*.e2e.test.ts` rodam pelo `npm run test:e2e`, que tem rede e tempo longo e fica fora do `npm run test`. Eles instalam as dependências do template numa `<raiz>` temporária e rodam o `ng` com um Node ≥22.22.3; o comando exato fica na linha de Landing, quando for decidido.

`E2E` abaixo é este comando:

`cd hive-desktop && source ~/.nvm/nvm.sh && nvm use 24.15.0 && npm run test:e2e -- src/main/designStudio/prototipoAngular.e2e.test.ts`

Se a Landing decidir outro, ele substitui este.

### S1 · Um Protótipo nasce do template e roda sem `node_modules` próprio · 4 files · 46 KB · ~12k

**T-C1a** · Dado o `template/` copiado para `<raiz>/Câmbio/Remessa sem susto/`, com `<raiz>` contendo um espaço (`…/Design Studio`) e as dependências instaladas uma única vez em `<raiz>/node_modules`, o `ng build` rodado na pasta do Protótipo termina com código 0.
Proof: `E2E -t "T-C1a:"`

**T-C1b** · Depois desse `ng build`, a pasta do Protótipo continua sem `node_modules`.
Proof: `E2E -t "T-C1b:"`

**T-C2** · Com a Proposta `a`, a entrada `{ "id": "acompanhar", "nome": "Acompanhar" }` no `telas.json` e a pasta `acompanhar/` da convenção, e com o Protótipo rodando por `ng serve --host 127.0.0.1 --port <porta livre>`, `http://127.0.0.1:<porta>/a/acompanhar`, aberto no Chromium, mostra o texto que marca essa tela.
Proof: `E2E -t "T-C2:"`

**T-C3** · Com o mesmo `ng serve` ainda rodando, criar uma segunda tela só pela convenção (a pasta da tela e a entrada no `telas.json`, sem tocar em nenhum arquivo fora de `src/app/propostas/a/`) faz `/a/<nova-tela>` mostrar o texto que marca essa tela, sem reiniciar o servidor.
Proof: `E2E -t "T-C3:"`

**T-C4a** · `template/src/styles/tokens.css` declara exatamente 5 variáveis `--cor-*` e 1 `--fonte-*`, e nenhuma outra variável. As cores são preto, branco e três cinzas (r = g = b, estritamente entre 0 e 255, os três diferentes). A fonte é uma pilha do sistema que começa por `system-ui`.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/prototipoAngular.test.ts -t "T-C4a:"`

**T-C4b** · O `template/` não contém nenhum arquivo de fonte (`.woff`, `.woff2`, `.ttf`, `.otf` ou `.eot`) nem de imagem (`.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico` ou `.avif`). Isso vale também para o favicon do Angular, que é uma logo de marca.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/prototipoAngular.test.ts -t "T-C4b:"`

**T-C4c** · O `template/` traz um reset neutro (um `.css` global ligado em `styles` no `angular.json`) e a casca de celular (o componente de layout que envolve as telas, com a barra de status e o espaço do cabeçalho). Nenhum design system entra: os `@import` das folhas do template só apontam para arquivos do próprio template, e as dependências declaradas são só `@angular/*`, `rxjs`, `tslib` e `typescript`.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/prototipoAngular.test.ts -t "T-C4c:"`

**T-C5a** · A 390×780, numa tela da convenção com conteúdo mais alto que a moldura e depois de rolar o conteúdo 300px, a barra de status mede 36px de altura com o topo em 0, e o topo do cabeçalho fica no fundo da barra de status. As duas posições são as mesmas de antes de rolar.
Proof: `E2E -t "T-C5a:"`

**T-C5b** · Na mesma cena, com fator de escala 1 e 1,5, nenhum pixel na cor-marca do conteúdo rolado aparece na faixa entre o topo da tela e o fundo do cabeçalho.
Proof: `E2E -t "T-C5b:"`

**T-C5c** · A 1040×680, a barra de status não aparece (altura calculada 0 ou `display: none`).
Proof: `E2E -t "T-C5c:"`

### S2 · A conferência do app cobra as regras da ADR 0004 · 3 files · 34 KB · ~9k

**T-C6** · Um componente em `src/app/` que declara `template:` no lugar de `templateUrl` faz a conferência devolver `aprovado: false` com um achado `{ tipo: "regra", regra: "templateUrl", arquivo: "<caminho relativo do .ts>", linha: <linha do template:> }`.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/conferencia.test.ts -t "T-C6:"`

**T-C7** · Um componente que declara `ViewEncapsulation.ShadowDom` faz a conferência devolver `aprovado: false` com um achado `{ tipo: "regra", regra: "encapsulamento", arquivo: "<caminho relativo do .ts>", linha: <linha> }`.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/conferencia.test.ts -t "T-C7:"`

**T-C8** · Um `.html` de tela com `{` literal num texto, compilado de verdade, faz a conferência devolver `aprovado: false` com um achado `tipo: "regra"`. A `mensagem` contém `NG5002`, e o `arquivo` é o `.html` da tela.
Proof: `E2E -t "T-C8:"`

**T-C9a** · Uma entrada no `telas.json` sem a pasta correspondente faz a conferência devolver `aprovado: false` com um achado `tipo: "regra"` que cita a Proposta e o id da tela.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/conferencia.test.ts -t "T-C9a:"`

**T-C9b** · Uma pasta de tela sem entrada no `telas.json` faz a conferência devolver `aprovado: false` com um achado `tipo: "regra"` que cita a Proposta e o id da tela.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/conferencia.test.ts -t "T-C9b:"`

**T-C10a** · Um Protótipo criado do template, com uma Proposta e duas telas que seguem todas as regras, compilado de verdade, recebe `{ aprovado: true, achados: [] }`.
Proof: `E2E -t "T-C10a:"`

**T-C10b** · Um Protótipo criado de outro workspace Angular 22, com outro nome de projeto, outro `angular.json` e outra casca, mas que segue a decisão 1, recebe `{ aprovado: true, achados: [] }`, compilado de verdade.
Proof: `E2E -t "T-C10b:"`

### S3 · O agente sabe trabalhar no template · 2 files · 3 KB · ~1k

**T-C11a** · O `SKILL.md` da skill-irmã, em pt-BR, traz quatro seções nesta ordem:
1. criar uma Proposta, copiando a pasta do Atual ou começando vazia num Produto novo;
2. criar uma tela, com a forma da decisão 1 e o id tirado do nome no catálogo, com o exemplo "Beneficiário" → `beneficiario`;
3. as regras da ADR 0004 (`templateUrl`, sem ShadowDom, `{` e `}` escapados);
4. toda cor e toda fonte das telas vêm de `src/styles/tokens.css`.

Proof: `cd hive-desktop && npm run test -- src/main/designStudio/prototipoAngular.test.ts -t "T-C11a:"`

**T-C11b** · O `SKILL.md` não manda o agente rodar nada: nenhum bloco de código de shell e nenhuma ocorrência de `ng build`, `ng serve`, `npm `, `npx ` ou `node `.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/prototipoAngular.test.ts -t "T-C11b:"`

**T-C12** · O front matter do `SKILL.md` declara `version: <semver>`, e o leitor do app (`lerVersaoDaSkill` ou equivalente em `src/main/designStudio/`) devolve essa versão ao ler a skill embarcada.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/prototipoAngular.test.ts -t "T-C12:"`

### S4 · A conferência também cobra o perfil de design · 4 files · 26 KB · ~7k

**T-C13a** · Com o perfil de exemplo restrito, cada cor das telas fora dos tokens (definição na Landing) aparece como `{ tipo: "perfil", regra: "cor-fora-dos-tokens", arquivo, linha, valor }`, com o arquivo e a linha exatos de cada ocorrência. Isso vale para a cor literal num `.css`, para a cor literal num `style` de `.html` e para um `var(--x)` não declarado.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/conferencia.test.ts -t "T-C13a:"`

**T-C13b** · Com o perfil de exemplo restrito, cada família de fonte fora da lista do perfil aparece como `{ tipo: "perfil", regra: "fonte-fora-do-perfil", arquivo, linha, valor }`. `Lato`, uma família genérica e um `var(--fonte-…)` declarado não aparecem.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/conferencia.test.ts -t "T-C13b:"`

**T-C13c** · Com o perfil Livre, as mesmas telas de T-C13a e T-C13b não geram nenhum achado `tipo: "perfil"`.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/conferencia.test.ts -t "T-C13c:"`

**T-C13d** · Um Protótipo que só tem achados `tipo: "perfil"` recebe `aprovado: true`.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/conferencia.test.ts -t "T-C13d:"`

**T-C13e** · `lerPerfilDeDesign` lê `perfis/livre.json` e `perfis/restrito-exemplo.json` com os valores da decisão 2 da tarefa 1. Ele recusa, com o motivo, um perfil com `formato` diferente de `perfil-de-design/1`, com `cores` fora de `livres` e `so-tokens`, ou com `fontes` que não é `"livres"` nem uma lista de textos.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/perfilDeDesign.test.ts -t "T-C13e:"`

**T-C13f** · Os valores de `perfis/tokens-exemplo.css` são os tokens de cor e de fonte da camada `.pt` de `design-studio/prototype/proto.css`, renomeados para `--cor-…` e `--fonte-…`, com o nome IDS em comentário.
Proof: `cd hive-desktop && npm run test -- src/main/designStudio/perfilDeDesign.test.ts -t "T-C13f:"`

## Swept

- validation: T-C6, T-C7, T-C8, T-C9a, T-C9b e T-C13a a T-C13e.
- failure modes: T-C8 (uma falha de compilação aparece com o arquivo e o código).
- idempotency and retry: n/a. A conferência só lê arquivos, e rodar de novo dá o mesmo relatório.
- authorization: n/a. É código local, sem usuários nem papéis.
- concurrency and ordering: n/a. O template não sobe processos; o servidor de cada Protótipo é da tarefa 2.
- data lifecycle: n/a. O template é copiado e não guarda dado nenhum.
- external-dependency failure: n/a no produto, porque quem instala as dependências é o app (tarefa 2). Nos testes, a instalação que falha derruba o `beforeAll` com a saída do npm.
- state transitions: n/a. O template não tem ciclo de vida.
- observability: o relatório da conferência é o diagnóstico (T-C6 a T-C10b e T-C13a a T-C13d).

## Handoff

S1 a S4 somam 29k de leitura, tudo em superfície nova (`resources/design-studio/skills/prototipo-angular/`, `resources/design-studio/perfis/` e `src/main/designStudio/`). Por isso é **um lote só**, num worktree próprio (`feat/design-studio-template`), em paralelo ao lote 1 da tarefa 1. A tarefa 1 só lê o perfil no lote 2 dela, depois do merge deste.

- **Onde a fronteira caiu:** lote único fechado. T-C1a a T-C13f (as 26 checagens de S1 a S4) verdes em `5157dd1` (`feat/design-studio-template`, base `bc69be4`): as 16 de unidade num `vitest run` só, e as 10 do `E2E` numa execução, no Node 24.15.0; `npm run verify` verde no 22.22.1. Commits: `9c7e385` (perfis + leitor), `351445f` (skill + template), `4f1df3b` (conferência + E2E), `5157dd1` (STATE/HARNESS).
- **O que foi decidido no meio da construção:** nenhuma conversa com o usuário além do pedido de retomada depois do limite de sessão da API (sem mudança de escopo). O comando `E2E` ficou como está. A lista exata de `dataRoot.test.ts › C10b` (lote anterior) foi estendida por nome, sem afrouxar a asserção (linha de Landing própria); a tarefa 1 vai editar o mesmo array, então o merge tem conflito previsto.
- **O que foi abandonado:** `NG_BUILD_WATCH_ROOT=1` como gatilho do rebuild de uma tela nova (medido: o rebuild acontece mas reaproveita o resultado, a tela não entra); um `.gitkeep` em `src/app/propostas/` (o electron-builder não empacota); procurar cor em todo o texto do `.html` (a palavra "red" num parágrafo viraria achado); atribuir a um erro o local de um `▲ [WARNING]` seguinte, que o parse da saída do `ng build` fazia na primeira versão.
