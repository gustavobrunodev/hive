# Design Studio · T · Template Angular de Protótipo — Verification

**Verdict**: PASS — 26 of 26 checks proven, each by a located assertion at `5157dd1`. One caveat: the gate was red in this run, on load-induced timeouts in files this diff does not touch (see Gate).
**Profile**: light (no `## tlc-implement` in `hive-desktop/AGENTS.md`)
**Diff range**: bc69be4..5157dd1 (9c7e385, 351445f, 4f1df3b, 5157dd1) — worktree `/home/gustavobgt/user-harness/hive-wt-template`, branch `feat/design-studio-template`
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier), read-only. Worktree `git status --porcelain` was empty before and after the run (unchanged).

Abbreviations used below: `e2e` = `hive-desktop/src/main/designStudio/prototipoAngular.e2e.test.ts`, `unit` = `…/prototipoAngular.test.ts`, `conf` = `…/conferencia.test.ts`, `perf` = `…/perfilDeDesign.test.ts`.

## Binding sources

Step 1 did not run: it is `ui`-only, and this feature runs under `light`.

## Coverage join · Test policy · Fault injection

- `Coverage` join: not run (it runs under `standard`/`ui` only).
- `Test policy` verdicts: not run (`standard`/`ui` only). The checklist has no `## Test policy` section anyway.
- Fault injection: not run (`standard`/`ui` only).

## Proof runs (at HEAD 5157dd1)

- **Unit:** one invocation for all 16 checks, Node 22.22.1:
  `npx vitest run src/main/designStudio/prototipoAngular.test.ts src/main/designStudio/conferencia.test.ts src/main/designStudio/perfilDeDesign.test.ts -t "T-C4a:|T-C4b:|T-C4c:|T-C6:|T-C7:|T-C9a:|T-C9b:|T-C11a:|T-C11b:|T-C12:|T-C13a:|T-C13b:|T-C13c:|T-C13d:|T-C13e:|T-C13f:" --reporter=verbose`.
  Result: 3 files passed, **16 passed** | 45 skipped. Each of the 16 appears by name with ✓.
- **E2E:** the checklist's command, unchanged by Landing, Node 24.15.0:
  `npm run test:e2e -- src/main/designStudio/prototipoAngular.e2e.test.ts --reporter=verbose`.
  Result: **10 passed (10)**, exit 0, 19.8 s. Each of the 10 appears by name with ✓.
- **Existence:** each of the 26 ids maps to exactly one `it('<id>: …')`. I located them with `rg -n "it\('<id>:"`; T-C13f uses double quotes, at `perf:155`.
- **Diff:** every proof file is new in this range. `perf` was added in 9c7e385, `unit` in 351445f, and `conf` and `e2e` in 4f1df3b (`git log --diff-filter=A`).

## Checks

| Check | Claim | Proof run | Evidence | Result |
|---|---|---|---|---|
| T-C1a | `ng build` in `<raiz>/Câmbio/Remessa sem susto/`, `<raiz>` with a space, deps installed once in `<raiz>/node_modules`, exits 0 | E2E ✓ | `e2e:160` `expect(build.status, …).toBe(0)`; preconditions `e2e:158` `expect(raiz).toContain(' ')`, `e2e:159` `existsSync(join(raiz,'node_modules','@angular','core'))` → `true`; path `e2e:153` `novoPrototipo('Câmbio', 'Remessa sem susto')`; single install in the top `beforeAll` (`e2e:136-145`) | PASS |
| T-C1b | after the build, the Protótipo has no `node_modules` | E2E ✓ | `e2e:165` `expect(existsSync(join(pasta, 'node_modules'))).toBe(false)` | PASS |
| T-C2 | `ng serve --host 127.0.0.1 --port <free>`; `/a/acompanhar` in Chromium shows the tela's marker text | E2E ✓ | `e2e:296-300` `expect.poll(() => pagina.getByText('Marca da tela Acompanhar').isVisible()).toBe(true)`; serve argv `e2e:252` `['serve', '--host', '127.0.0.1', '--port', String(porta)]` | PASS |
| T-C3 | same `ng serve`, second tela by convention only, nothing outside `src/app/propostas/a/`, shows without a restart | E2E ✓ | `e2e:318-330` poll `getByText('Marca da tela Revisar')` → `toBe(true)`; `e2e:333` `expect(servidor!.exitCode).toBeNull()`; `e2e:340` `expect(fora).toEqual([])`, which is a sha1 snapshot of every file outside `src/app/propostas/a/` (added, removed or changed). Writes are only `e2e:307` (`src/app/propostas/a/revisar/…`) and `e2e:309-315` (`src/app/propostas/a/telas.json`, written after the folder). The only spawn is `e2e:250`, in `beforeAll`. See gap 3 on `e2e:334` | PASS |
| T-C4a | `tokens.css`: exactly 5 `--cor-*` + 1 `--fonte-*`, no other variable; black, white, 3 distinct greys r=g=b in (0,255); stack starts with `system-ui` | unit ✓ | `unit:56-58` `toHaveLength(5)` / `toHaveLength(1)` / `declaracoes toHaveLength(6)`; `unit:63-64` contains `'0,0,0'` and `'255,255,255'`; `unit:66-72` 3 greys, `r===g===b`, `>0`, `<255`; `unit:73` `new Set(…).size` → `3`; `unit:74` `toBe('system-ui')` | PASS |
| T-C4b | no font file (5 ext.) and no image file (8 ext.) in `template/` | unit ✓ | `unit:95` `expect(arquivos.filter((a) => proibidas.has(extname(a).toLowerCase()))).toEqual([])`; the set at `unit:78-92` is exactly the checklist's 13 extensions | PASS |
| T-C4c | neutral reset in `angular.json` `styles`; casca with status bar + header slot; `@import` only inside template; deps only `@angular/*`, `rxjs`, `tslib`, `typescript` | unit ✓ | `unit:105` `expect(estilos).toContain('src/styles/reset.css')`; `unit:116-122` `.casca-status`, `<ng-content>`, `<app-casca>…<router-outlet>…</app-casca>`, `.cabecalho{position:sticky}`; `unit:127-129` import not a URL and resolves inside `TEMPLATE`; `unit:143-147` the non-allowed-dependency filter is `toEqual([])` | PASS |
| T-C5a | 390×780, tall tela, after 300px scroll: status 36px at top 0, header top at status bottom, same as before | E2E ✓ | `e2e:370-372` for `antes` and `depois`: `m.status.top` → `0`, `m.status.height` → `36`, `m.cabecalho.top` → `m.status.bottom`; `e2e:374-375` equal before and after; scroll measured `e2e:357` `.toBe(300)`; tall `e2e:364-366` `> 780 + 300` | PASS |
| T-C5b | scale 1 and 1.5: no brand-colour pixel between screen top and header bottom | E2E ✓ | `e2e:398` `for (const escala of [1, 1.5])`; `e2e:408` `expect(marcaNaFaixa.n).toBe(0)`; positive control `e2e:412-415` brand present just below → `toBeGreaterThan(0)`; detector `e2e:394` `dados[i] - dados[i + 2] > 48` (gap 4) | PASS |
| T-C5c | 1040×680: status bar not shown | E2E ✓ | `e2e:428` `expect(status.altura === 0 \|\| status.display === 'none').toBe(true)` at `abrir(…, 1040, 680)` (`e2e:422`) | PASS |
| T-C6 | `template:` → `aprovado:false`, `{tipo:"regra", regra:"templateUrl", arquivo:<rel .ts>, linha:<template: line>}` | unit ✓ | `conf:132` `aprovado` → `false`; `conf:133-147` `toEqual([objectContaining({regra:'templateUrl', arquivo:'src/app/extra.component.ts', linha:3}), objectContaining({regra:'templateUrl', arquivo:'src/app/propostas/a/acompanhar/acompanhar.component.ts', linha:5, tela:'acompanhar'})])`. Line 5 is the `template:` line of the fixture (`conf:115`) | PASS |
| T-C7 | `ViewEncapsulation.ShadowDom` → `aprovado:false`, `{regra:"encapsulamento", arquivo, linha}` | unit ✓ | `conf:164` → `false`; `conf:165-172` `toEqual([objectContaining({regra:'encapsulamento', arquivo:'src/app/propostas/a/acompanhar/acompanhar.component.ts', linha:6})])`. Line 6 is the ShadowDom line (`conf:157`) | PASS |
| T-C8 | literal `{` in a tela `.html`, **real compile** → `aprovado:false`, `tipo:"regra"`, `mensagem` ∋ `NG5002`, `arquivo` = that `.html` | E2E ✓ | `e2e:446` → `false`; `e2e:447-450` NG5002 `regra` findings `> 0`; `e2e:451` each `toMatchObject({tipo:'regra', arquivo: html})`. Real compile: `e2e:444` `compilarDeVerdade()` = `e2e:123-124` `criarCompilarComNg({ node: NODE_DO_NG, runner: createProcessRunner() })`, which runs `ng.js build` (`conferenciaCompilacao.ts:114-117`); the file has no stub | PASS |
| T-C9a | entry without folder → `aprovado:false`, `regra` finding naming Proposta and tela id | unit ✓ | `conf:206` → `false`; `conf:208-214` exactly one, `toMatchObject({regra:'telas-json', arquivo:'src/app/propostas/a/telas.json', tela:'revisar'})`; `conf:215-216` `mensagem` contains `'Proposta "a"'` and `'"revisar"'` | PASS |
| T-C9b | folder without entry → same | unit ✓ | `conf:225` → `false`; `conf:227-228` one, `toMatchObject({regra:'telas-json', tela:'extra'})`; `conf:229-230` `'Proposta "a"'`, `'"extra"'` | PASS |
| T-C10a | template + 1 Proposta + 2 compliant telas, **real compile** → `{aprovado:true, achados:[]}` | E2E ✓ | `e2e:467-469` `toEqual({ aprovado: true, achados: [] })` with `compilarDeVerdade()`; two telas `e2e:456-465` | PASS |
| T-C10b | another Angular 22 workspace (project name, `angular.json`, casca) following decision 1, **real compile** → `{aprovado:true, achados:[]}` | E2E ✓ | `e2e:570-572` `toEqual({ aprovado: true, achados: [] })` with `compilarDeVerdade()`. Workspace written from scratch (no template copy): project `vitrine` (`e2e:488`), its own `index`/`browser`/`styles`/`tsConfig` (`e2e:497-501`), casca `Moldura` (`e2e:554-562`), its own explicit routes (`e2e:545-553`) | PASS |
| T-C11a | pt-BR, four sections in order; Proposta (copy Atual / empty in a new Produto); tela with decision 1 + "Beneficiário" → `beneficiario`; ADR 0004 rules; colours and fonts from `tokens.css` | unit ✓ | `unit:189-192` order `proposta < tela < regras < tokens`; `unit:195-198` `atual/`, `copi`, `vazia`, `Produto novo`; `unit:201-208` shape, `catálogo`, `"Beneficiário" vira \`beneficiario\``; `unit:211-215` `ADR 0004`, `templateUrl`, `ShadowDom`, `{{ '{' }}`, `{{ '}' }}`; `unit:218-221` `src/styles/tokens.css`, `toda cor e toda fonte`; pt-BR `unit:223-224` (gap 4) | PASS |
| T-C11b | no shell code block; no `ng build`, `ng serve`, `npm `, `npx `, `node ` | unit ✓ | `unit:233-246` no fence opening is in `['bash','sh','shell','zsh','console','powershell','ps1','cmd','bat','']`; `unit:247-249` `expect(SKILL_MD).not.toContain(comando)` for the 5 strings. SKILL.md fences pair cleanly: 6 openings `json,text,ts,html,json,css` (`rg` lines 46–155) | PASS |
| T-C12 | front matter `version: <semver>`; the app reader returns it from the embedded skill | unit ✓ | `unit:256` `toMatch(/^\d+\.\d+\.\d+$/)`; `unit:261` `expect(await lerVersaoDaSkill(SKILL)).toBe(declarada)` (SKILL.md:4 `version: 0.1.0`) | PASS |
| T-C13a | restricted profile: every colour outside the tokens → `{tipo:"perfil", regra:"cor-fora-dos-tokens", arquivo, linha, valor}`, exact file and line, for (1) a literal in `.css`, (2) a literal in an `.html` `style`, (3) an undeclared `var(--x)` | unit ✓ | `conf:442-460` exact `toEqual` of the whole list: (1) `{arquivo: CSS, linha: 3, valor: '#123456'}`, `{CSS, 5, 'rgb(1, 2, 3)'}`, `{CSS, 6, 'red'}`; (3) `{CSS, 7, 'var(--cor-que-nao-existe)'}`; (2) `{arquivo: HTML, linha: 3, valor: '#abcdef'}` from `<p style="color: #abcdef …">` (`conf:424`). `CSS`/`HTML` are pinned at `conf:436-437`. Exact equality also proves `transparent`/`currentColor`/`inherit` (`conf:410-412`), the comment (`conf:403`) and `red-pulse`/`--cor-red` (`conf:418`) are not findings (gap 2) | PASS |
| T-C13b | restricted profile: each family outside the list → `fonte-fora-do-perfil` with file, line, value; `Lato`, a generic family and a declared `var(--fonte-…)` absent | unit ✓ | `conf:465-475` exact `toEqual([{CSS, 12, 'Roboto'}, {CSS, 15, 'Georgia'}, {CSS, 15, 'Times New Roman'}])`. Absent by exact equality: `'Lato'` (`conf:415`), `sans-serif`/`serif`/`system-ui`, declared `var(--fonte-texto)` (`conf:416`) and `var(--fonte-titulo)` (`conf:424`, declared at `tokens-exemplo.css:31`) | PASS |
| T-C13c | Livre profile, same telas → no `tipo:"perfil"` finding | unit ✓ | `conf:480` `expect(achados.filter((a) => a.tipo === 'perfil')).toEqual([])` via the same `conferirComOPerfil` | PASS |
| T-C13d | only `perfil` findings → `aprovado:true` | unit ✓ | `conf:489` every finding is `perfil`; `conf:490` `> 0`; `conf:491` `expect(relatorio.aprovado).toBe(true)` | PASS |
| T-C13e | reads `livre.json` and `restrito-exemplo.json` with decision 2 values; refuses wrong `formato`, `cores`, `fontes` with the reason | unit ✓ | `perf:49` `toEqual({ ok: true, perfil: LIVRE })`, `perf:50-53` same for `RESTRITO`. Both literals (`perf:17-39`) match task 1 decision 2 (`design-studio/.tasks/1-modulo-e-dados-de-dor.md:184-207`) field by field, which I checked. `perf:58-60` `{ok:false, campo:'formato'}` with `motivo` ∋ `perfil-de-design/1` and `/2`; `perf:63-64` `campo:'cores'`, ∋ `'algumas'`; `perf:66-69` `'Lato'`, `['Lato',3]`, `['']`, `7`, `null` → `{ok:false, campo:'fontes'}` (gap 4) | PASS |
| T-C13f | `tokens-exemplo.css` = the `.pt` colour and font tokens of `proto.css`, renamed `--cor-…`/`--fonte-…`, IDS name in a comment | unit ✓ | `perf:172` origin set `toEqual` `.pt` colour+font names; `perf:177` prefix; `perf:178` value equality; `perf:180` IDS name in comment when proto.css has one. Checked: all 24 colour + 2 font tokens of `.pt` (`proto.css` `.pt` lines 2–31) are hex/rgba/stacks, so the `COR`/`FONTE` filters (`perf:151-152`) drop none; radius and easing are rightly excluded | PASS |

## Specific looks requested by the orchestrator

- **`dataRoot.test.ts` C10b inventory: an extension, not a weakening.** The assertion is still exact: `dataRoot.test.ts:233` `expect(filesUnder(dir).sort()).toEqual(EXPECTED)`. `EXPECTED` (`:176-211`) adds by name the 4 `perfis/` files, `skills/prototipo-angular/SKILL.md` and 19 template files. That is exactly the 24 files git tracks under those paths, checked with `git ls-files`. Nothing is derived from disk, and nothing uses `toContain`.
- **ESLint ignore (`eslint.config.mjs:39`, `'resources/design-studio/skills/prototipo-angular/template/**'`).** The ignored tree holds 6 `.ts` files: `main.ts`, `app.component.ts`, `rotas.ts`, `casca/casca.component.ts`, `tela/carregar.ts` and `tela/tela.component.ts`. Their imports are only `@angular/*` and relative template paths. It hides no Hive code.
- **T-C3 keeps the same server and writes only under `src/app/propostas/a/`.** Confirmed (row above). The server is spawned once, in `beforeAll` (`e2e:250`), and is never restarted. It is alive afterwards (`e2e:333`). The writes are confined to `src/app/propostas/a/`, and `e2e:340` proves the rest of the tree is untouched.
- **T-C8, T-C10a and T-C10b compile for real.** Confirmed. All three pass `compilarDeVerdade()` (`e2e:444`, `:468`, `:571`), which wraps the real `ng build` through the Hive's `createProcessRunner()`. The E2E file contains no stub compiler (`rg "compilar:|async () => \[\]"` finds only those three lines).
- **T-C13a's three cases each have an assertion with exact file and line.** Confirmed: `.css` literal at `conf:443`, `.html` `style` literal at `conf:459`, and undeclared `var(--x)` at `conf:452-458`.

## Swept

- No `Swept` row resolves to an existing constraint. Each one maps to checks or is `n/a`, and the `n/a` rows are approved policy.
- The test-side claim in "external-dependency failure" holds. A failed install throws in `beforeAll` with the npm output (`e2e:143-145`).
- Observation, not a finding: the `n/a` reason for "idempotency" says the conferência only reads files. In fact the compile step writes into a `mkdtemp` folder and deletes it in `finally` (`conferenciaCompilacao.ts:138-152`), and `ng build` keeps Angular's workspace cache under `.angular/`, which the E2E snapshot excludes (`e2e:189`). "Same report on re-run" still holds.
- The existing constraints that Landing reuses are there:
  - The `ProcessRunner` reuse: `conferenciaCompilacao.ts:5` imports `type { ProcessRunner } from '../processRunner'` and `:31` declares `runner: ProcessRunner`.
  - The `relatorioFormato.ts` `<nome>/1` convention (`relatorioFormato.ts:11,189`): `perfilDeDesign.ts:16` `FORMATO_DO_PERFIL = 'perfil-de-design/1'` and `:85`.

## Level gaps

None. No claim names a route, status or response shape below its boundary:
- T-C2, T-C3 and T-C5 run in real Chromium against a real `ng serve`.
- T-C8 and T-C10 use a real `ng build`.
- T-C6, T-C7, T-C9 and T-C13a–d go through `conferirPrototipo`, the module's public entry. A stub compiler there is fine, because none of those claims is about compilation.

## Gaps (ranked)

1. **Gate not reproduced green.** This is not attributable to the diff. `npm run verify` exited 1 with 5 timeouts, all in files this diff does not touch:
   - `src/renderer/src/WorkUI.test.ts` ×3, each with "Hook timed out in 10000ms";
   - `src/renderer/src/designStudio/folhaDor.test.ts` ×1;
   - `src/renderer/src/explorer/Explorer.test.ts` ×1.

   The diff contains no `src/renderer` change. At the time, load average was 7.6 on 8 cores, from a concurrent `tsc -p tsconfig.web.json` in the main tree, and the collect phase took 215 s. Re-run alone at HEAD, all 5 passed. The gate's coverage stage was never reached, so I measured it separately (gate section below). Re-run `npm run verify` on an idle machine before merge to confirm the Handoff's "verify verde".
2. **T-C13a sampling gap against the Landing colour definition.** The check says "definição na Landing", but the named proof samples only some of it.
   - **In the named proof:** hex, `rgb()`, a named colour and `var(--x)`, plus 3 of the 6 exclusions.
   - **Only in an unnamed test:** `rgba`, `hsl`/`hsla`, `oklch`, `oklab`, `lab`, `lch`, `hwb`, `#rgba`/`#rrggbbaa`, and the `<style>` block plus `fill`/`stroke` contexts. That test is `conf:528` with `conf:565`; it calls `achadosDoCss`/`achadosDoHtml` directly and asserts values only, with no file and no line through the report.
   - **Asserted nowhere:** `rg -c` finds 0 hits in `conf` for each of these:
     - the `initial` and `unset` exclusions;
     - the HTML attributes `stop-color`, `flood-color`, `lighting-color`, `color` and `bgcolor`;
     - the named-colour skip-list properties `transition*`, `grid-template-areas`, `grid-row`, `grid-column`, `counter-*`, `will-change`, `container-name` and `view-transition-name`. Only `animation` (`conf:418`), `grid-area` (`conf:544`) and `content` (`conf:543`) are exercised.
3. **T-C3, `e2e:334`: `expect(servidor!.pid).toBe(pid)` can never fail.** It re-reads the same `ChildProcess` object's immutable `pid`. The "without a restart" claim actually rests on `e2e:333` (`exitCode` is `null`) and on the single spawn at `e2e:250`. Both hold, so the check stands.
4. **Precision gaps in the checklist.** Each value below is something the checklist leaves vague, so the test had to pick it.
   - **T-C5b:** "pixel na cor-marca" has no tolerance. The test operationalises it as `R − B > 48` (`e2e:394`), which counts a brand blend of roughly 19% or more over white; a fainter seam would pass.
   - **T-C13e:** "com o motivo" is vague. Landing says the `motivo` carries the received value; that is asserted for `formato` (`perf:59-60`) and `cores` (`perf:64`), but for `fontes` only `not.toBe('')` (`perf:69`).
   - **T-C8:** the Landing shape for a compile finding includes `linha`. The check does not require it, and `e2e:451` does not assert it.
   - **T-C9a/b:** Landing's literal is `tela "<id>"`. The tests assert `'"revisar"'` and `'"extra"'` (`conf:216`, `conf:230`), not `'tela "revisar"'`.
   - **T-C11a:** "em pt-BR" is not measurable as written. The test checks for four common Portuguese words (`unit:223-224`).
   - **T-C4c:** "reset neutro" is undefined. The test reads it as `box-sizing: border-box`, `margin: 0` and no colour or `font-family` (`unit:107-109`).
5. **T-C13a–d use an inline profile copy.** `RESTRITO` and `LIVRE` are written as literals at `conf:20-42`, not read from `perfis/*.json`. They are tied to the shipped JSON only transitively, through a second literal (`perf:17-39`) pinned at `perf:49-53`. A drift between `conf`'s copy and `restrito-exemplo.json` would go unseen by T-C13a–d. Low.

## Gate

`npm run verify` (Node 22.22.1), one run:
- typecheck (node + web): passed.
- lint: 0 errors, 37 warnings, none in a file this diff adds or changes.
- test:coverage: **4936 passed, 5 failed** (4941), 272 of 275 files passed, exit 1. All 5 failures are timeouts in untouched renderer tests (gap 1).
- Feature files in that run: all green. `conferencia.test.ts` 27, `prototipoAngular.test.ts` 18, `dataRoot.test.ts` 34, `conferenciaCompilacao.test.ts` 8, `perfilDeDesign.test.ts` 16.
- Re-run of the 5 failures alone at HEAD: 5 passed.
- Coverage gate for the feature's directory, measured separately because the gate never reached it: `src/main/designStudio/**` at 90/90/90/90 per file, run with `npx vitest run src/main/designStudio --coverage --coverage.include='src/main/designStudio/**'`. Result: 214 passed, exit 0. Every new file is at or above 90 on all four metrics; the lowest is `conferencia.ts` branches at 93.79. Other new files: `conferenciaPerfil.ts` 98.41/96.51/100/98.41, `perfilDeDesign.ts` 100/95.45/100/100, and `conferenciaCompilacao.ts` and `prototipoAngular.ts` at 100/100/100/100.
