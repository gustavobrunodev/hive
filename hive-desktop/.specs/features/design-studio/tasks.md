# Tasks — Design Studio (M18)

**Design:** `design.md` · **Spec:** `spec.md` · **Context:** `context.md`
**Contrato canônico:** `_bmad-output/specs/spec-design-studio/`
**Status:** ✅ Concluído (2026-08-10) — 7 fases, 52 tarefas, `verify` verde em 3346 testes / 202 arquivos.

52 tarefas, 7 fases sequenciais. Cada tarefa = uma mudança focada + seus testes
+ **um commit atômico**. Verificação é sempre concreta (um comando ou um
observável), nunca "está feito". `[P]` = pode rodar em paralelo com as irmãs
depois que as deps dela fecharem.

**Pré-requisito de toda tarefa** (lições do STATE): `source ~/.nvm/nvm.sh && nvm use`
(o nvm não persiste entre chamadas de ferramenta); worktree novo precisa do
`@hive/design-system` **buildado** antes; nunca rodar `npx prettier` dentro de
`design-system/`.

**Portão de cada tarefa:** os testes dela passam **e** `npm run verify` continua
verde. Sem enfraquecer, pular ou apagar teste para fechar tarefa.

---

## Fase 1 — O documento e o desfazer (main puro, zero UI)

Nada de Electron, DOM ou agente aqui. É a fase que fixa AD-2 e AD-8 antes de
existir superfície que possa contorná-los.

| # | Tarefa | Deps | Requisitos | Verificação |
| --- | --- | --- | --- | --- |
| **T1.1** ✅ | `designStudio/types.ts`: `ScreenNode`, `ScreenDocument`, união `Command` fechada, `CapabilityViolation`, `OperationError` | — | DS-R9, DS-R17 | `tsc` passa; `SetProp` não aceita bag de props (teste de tipo) |
| **T1.2** ✅ | `screenDocument.ts`: `applyCommand` puro para os 4 Commands | T1.1 | DS-R9 | Testes por Command; o reducer **não** valida (aplica input inválido sem erro) |
| **T1.3** ✅ | `CommandLog` + `pushCommands(log, cmds, groupId)` + `replay(log, upTo)` | T1.2 | DS-R9 | Propriedade: `replay(log, n)` é determinístico e independente de ordem de chamada |
| **T1.4** ✅ | `undo`/`redo` por cursor sobre passos **agrupados** | T1.3 | DS-R9 AC-4/5/6/7 | Log `[manual, chat(3), manual]`: 1º undo tira 1 manual; 2º tira os 3 juntos; edições manuais posteriores intactas |
| **T1.5** ✅ | Truncar ramo de refazer quando há nova edição com cursor no meio | T1.4 | DS-R9 AC-8 | Undo, undo, nova edição → `redo` fica indisponível |
| **T1.6** ✅ | `sessionStore.ts` no molde de `chatHistoryStore` (baseDir injetado, temp+rename, corrompido → sessão nova) | T1.3 | DS-R P2 (sessão) | Testes em tmpdir; JSON corrompido não lança; nada escrito no workspace |
| **T1.7** ✅ | Guard de fronteira: nenhuma superfície muta `ScreenDocument` fora do reducer | T1.2 | AD-2 | Teste no molde de `moduleBoundaries.test.ts`; falha se um arquivo fora de `screenDocument.ts` atribuir em `.props`/`.children` |

---

## Fase 2 — Adaptador de DS e catálogo

Fecha AD-4 e DS-R12/R13. Também resolve os dois achados que quebrariam tarde
(R-1 ícones, R-2 bundle).

| # | Tarefa | Deps | Requisitos | Verificação |
| --- | --- | --- | --- | --- |
| **T2.1** ✅ | `scripts/buildDsCatalog.mjs`: `custom-elements.json` → `catalog.json` (tag, props com `kind`+`values`, slots, grupo) | F1 | DS-R13, D-DS-5 | Catálogo gerado bate com o CEM real do pacote instalado; `wa-button.variant` sai como `enum` com os 5 valores |
| **T2.2** ✅ | Build do bundle do DS com esbuild → `resources/design-system-web-awesome/` (JS único + CSS) | — `[P]` | DS-R14, R-2 | Bundle gerado é um arquivo só; medido ≤ 1 MB; abre sem rede |
| **T2.3** ✅ | `dsAdapter/types.ts` (o port) + registry que resolve o Adaptador ativo **uma vez** no boot | T2.1 | DS-R12 AC-6 | Registry chamado 2× devolve a mesma instância |
| **T2.4** ✅ | `webAwesomeAdapter.catalog()` + `validate(command)` → `CapabilityViolation \| null` | T2.3 | DS-R13 AC-3/4, DS-R6 | Tag fora do catálogo, prop inexistente e valor fora do enum → cada um devolve `CapabilityViolation` |
| **T2.5** ✅ | Allowlist de esquema para props URL-shaped (`https:`, `http:`, `data:image/*`) | T2.4 | DS-R P1-Preview AC-5 | `href: 'javascript:alert(1)'` → `CapabilityViolation`; `https://` passa |
| **T2.6** ✅ | Biblioteca de ícones local via `registerIconLibrary` + SVGs do `@fortawesome/fontawesome-free` embutidos | T2.2 | R-1 / D-DS-8 | `wa-icon` renderiza com a rede desligada; nenhuma URL de `fontawesome.com` no bundle final |
| **T2.7** ✅ | Guard de fronteira: só `dsAdapter/` importa `@awesome.me/webawesome` | T2.4 | AD-4 | Teste falha se qualquer outro arquivo importar o pacote |

---

## Fase 3 — Protocolo, isolamento e o receptor

A fase de segurança. Fecha AD-5 e a correção D-DS-4.

| # | Tarefa | Deps | Requisitos | Verificação |
| --- | --- | --- | --- | --- |
| **T3.1** ✅ | `previewProtocol.ts`: `STUDIO_SCHEME_PRIVILEGES` + `resolveStudioRequest` puro (host-based, guarda de path-escape) | F2 | DS-R8 | Host desconhecido → `null`; `../` escapando a raiz → `null`; testes exaustivos sem Electron |
| **T3.2** ✅ | `protocol.handle` + **CSP por resposta** (`connect-src data:` ⚠️ ver abaixo, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`) | T3.1 | DS-R P1-Preview AC-2 | Header da resposta contém `connect-src data:` — afirmado em teste, não por inspeção |
| **T3.3** ✅ | Casca HTML por sessão + **token aleatório** na URL, distinto da chave de disco | T3.2 | AD-7, DS-R P1-Preview AC-6 | Token não é derivável de `(specPathHash, workspaceHash)`; dois `open()` dão tokens diferentes |
| **T3.4** ✅ | `src/preview/receiver.ts`: handshake `ready` + render por `createElement` e atribuição | T3.3 | AD-4, DS-R P1-Preview AC-4 | Guard de código: `innerHTML` ausente do bundle do receptor; render de uma árvore de 3 níveis |
| **T3.5** ✅ | Reconciliação por id de nó (patch no lugar; add/remove/move só do que mudou) | T3.4 | DS-R8, D-DS-6 | Um `SetProp` não recria o elemento (identidade do nó preservada) |
| **T3.6** ✅ | Overlay de seleção no receptor: hover 1px, selecionado 2px + chip de tag; clique via `composedPath()[0]` | T3.5 | DS-R5 | Clique em componente **aninhado** seleciona o mais profundo, sem troca de modo; overlay fora da árvore do documento |
| **T3.7** ✅ | Ponte `postMessage` no renderer: `event.source === contentWindow` **e** nonce | T3.4 | D-DS-4, R-5 | Mensagem forjada de outra janela **e** mensagem com nonce errado são ignoradas |
| **T3.8** ✅ | Afirmação de zero rede: o frame não emite requisição externa | T3.6, T2.6 | R-1, AD-5 | Playwright observa network do frame durante render completo: zero requisições fora de `hive-studio://` |

> ⚠️ **T3.2 foi superada durante a execução.** Esta linha pedia
> `connect-src 'none'`; o que foi entregue é **`connect-src data:`**. A fase 2
> mediu que `wa-icon` resolve todo ícone por `fetch(url, { mode: 'cors' })`
> (`chunk.ZCZ2WKQR.js:62`) e que `connect-src` governa `fetch` inclusive para
> URLs `data:` — sob `'none'` todo ícone sumiria em silêncio, no Preview e no
> Bundle. O egresso de rede continua **zero**: uma URL `data:` não alcança
> servidor nenhum. Decisão do usuário registrada em `context.md` (D-DS-4) e no
> `STATE.md` (**D32**); a prova é a T3.8, que observa o tráfego real do frame.

> **Fim da fase 3:** registrar **D29** (D-DS-4), **D30** (D-DS-5) e **D31**
> (D-DS-8) em `.specs/project/STATE.md`, e a revisão de segurança dedicada que a
> SPEC OQ-2 pede.

---

## Fase 4 — A aba, as Telas e o palco

Primeira fase com pixels. É onde a Bancada aparece.

| # | Tarefa | Deps | Requisitos | Verificação |
| --- | --- | --- | --- | --- |
| **T4.1** ✅ | `EditorTabKind` ganha `'design-studio'`; chave sintética `⟨studio⟩<path>`; `openDesignStudio` + item no menu de contexto do Explorer e na paleta | F3 | DS-R1 AC-1/4 | Abrir a mesma Spec 2× **foca** a aba existente; a chave nunca colide com a aba de arquivo |
| **T4.2** ✅ | Detecção de Telas na Spec + estado vazio que **nomeia o que procurou** | T4.1 | DS-R1 AC-2/3/5 | Spec com 3 Telas → 3 entradas **antes** de qualquer chamada de agente; `.md` sem Tela → vazio com instrução, nunca palco em branco |
| **T4.3** ✅ | `DesignStudioViewer.tsx`: casca + colunas `Resizable` + `useDesignStudio` (IPC + estado) | T4.1 | DS-R16 | Monta dentro da aba; colunas redimensionam sem quebrar o palco |
| **T4.4** ✅ | `StudioToolbar.tsx`: seletor de Telas, undo/redo, Modo Foco, Exportar (desabilitado até F7) | T4.3 | DS-R3, DS-R9 | Undo/redo refletem disponibilidade real do log; `Kbd` mostra os atalhos |
| **T4.5** ✅ | `StagePane.tsx`: bancada em três camadas de superfície + dot grid; **zero `box-shadow`** | T4.3 | D-DS-9, DS-R18 | Guard de CSS: nenhuma `box-shadow` no palco; contraste AA nos dois temas |
| **T4.6** ✅ | Escala honesta: iframe na largura real + `transform: scale` no contêiner + readout `1440 × 900 · 75%`; transição só no transform | T4.5 | DS-R3, D-DS-7 | Preset Desktop num palco de 700px → `k < 1`, iframe reporta `innerWidth === 1440`; nunca amplia acima de 100% |
| **T4.7** ✅ | `ScreenList.tsx` + troca de Tela preservando árvore, transcript e cursor de undo | T4.4 | DS-R4 AC-2/3 | Editar A → ir a B → voltar a A: tudo como deixou; estado editada/auto distinguido por **forma + ícone**, não só cor |
| **T4.8** ✅ | Modo Foco (`⛶`, `Ctrl+Shift+.`) + cadeia de degradação por largura (§3.8) | T4.5 | DS-R16 | Sair do Modo Foco restaura a distribuição **anterior** exata; nas 3 faixas de largura nada fica inalcançável |

---

## Fase 5 — Editar: seleção, Inspetor, Árvore

| # | Tarefa | Deps | Requisitos | Verificação |
| --- | --- | --- | --- | --- |
| **T5.1** ✅ | Seleção bidirecional Preview ⇄ Árvore (estado transiente, fora do documento) | F4 | DS-R5 AC-4/5/6 | Clicar no palco destaca na Árvore e vice-versa; seleção **não** entra no log de undo nem na sessão |
| **T5.2** ✅ | `Inspector.tsx`: controle por `kind` do catálogo (enum→Select, boolean→Switch, string→Input) + agrupamento Aparência/Estado/Conteúdo/Avançado | T5.1 | DS-R6 AC-1/2 | `wa-button` oferece `variant` com exatamente os 5 valores do catálogo; nenhuma prop fora do catálogo aparece |
| **T5.3** ✅ | Despacho de `SetProp` (um por mudança) + violação inline no `Field` + debounce 120 ms em texto | T5.2 | DS-R6 AC-3/4, R-6 | `variant: 'roxo'` → erro no campo, documento **inalterado**; enum/boolean despacham sem debounce |
| **T5.4** ✅ | Estado vazio do Inspetor (sem seleção) que ensina a selecionar | T5.2 `[P]` | DS-R6 AC-5 | `Empty` com ação; nunca painel em branco |
| **T5.5** ✅ | `ComponentTree.tsx` sobre o `Tree` do DS + adicionar Componente escolhendo do catálogo, em slot declarado | T5.1 | DS-R7 AC-1/4 | O seletor de adicionar só lista tags do catálogo ativo; slot inválido é recusado |
| **T5.6** ✅ | Remover e mover + guarda de ciclo + limpar seleção quando o selecionado some | T5.5 | DS-R7 AC-2/3/5 | Mover nó para dentro de descendente → rejeitado, árvore intacta; remover o selecionado limpa a seleção |
| **T5.7** ✅ | Atalhos `Ctrl+Z`/`Ctrl+Shift+Z` + estado vazio da Tela sem Componentes | T5.6 | DS-R9, DS-R7 | Atalhos só agem com o foco dentro da aba; vazio oferece **Gerar com a Skill** e **Adicionar Componente** |

---

## Fase 6 — A Skill e o Chat de Iteração

| # | Tarefa | Deps | Requisitos | Verificação |
| --- | --- | --- | --- | --- |
| **T6.1** ✅ | `skillDesignSystem.ts`: contrato de prompt (Spec + catálogo) e **parse estrito** para `Command[]` | F5 | DS-R11 AC-2, AD-9 | Markup como resposta → recusado; JSON malformado → `OperationError` (não `CapabilityViolation`) |
| **T6.2** ✅ | `generateScreens()` (DS-R2) + Skeleton no palco + linha de status viva por `AgentEvent` | T6.1 | DS-R2 | Toda a espera assíncrona coberta por estado visível; a geração só usa tags do catálogo |
| **T6.3** ✅ | Lote tudo-ou-nada: valida **todos** antes de despachar **qualquer um** | T6.1 | DS-R11 AC-3/4 | Lote de 3 com o 2º inválido → documento byte-a-byte inalterado, 1 `CapabilityViolation` |
| **T6.4** ✅ | `iterate()` com o Componente selecionado como contexto padrão | T6.3 | DS-R10 AC-1 | Enviar com seleção → o contexto vai no prompt; sem seleção → escopo da Tela |
| **T6.5** ✅ | `IterationChat.tsx`: faixa colapsada ↔ expandida + `Chip` de contexto com `✕` | T6.4 | DS-R10, DS-R16 | O chip torna o contexto **visível**; `✕` solta o contexto; expandir/colapsar em 200 ms com alternativa reduzida |
| **T6.6** ✅ | Turno de chat = um passo de undo + `↩ desfazer este turno` + pulso nos nós alterados | T6.5 | DS-R9 AC-5, DS-R11 AC-4 | Desfazer o turno reverte os N juntos e preserva edições manuais posteriores |
| **T6.7** ✅ | Transcript por Tela persistido + `OperationError` retryable no chat | T6.5 | DS-R10 AC-6/7, DS-R17 | Voltar à Tela traz o transcript; agente indisponível → erro com **Tentar de novo** funcional |

---

## Fase 7 — Export, provas e fechamento

| # | Tarefa | Deps | Requisitos | Verificação |
| --- | --- | --- | --- | --- |
| **T7.1** ✅ | `renderToStaticHtml(doc)` no Adaptador (único produtor de string) | F6 | DS-R14 AC-2, AD-6 | Guard: `exportBundle.ts` não constrói markup próprio |
| **T7.2** ✅ | `exportScreen()`: HTML autocontido (bundle + CSS + ícones inline), zero rede | T7.1 | DS-R14 AC-1/6 | Arquivo abre com a rede desligada e bate visualmente com o Preview (screenshot diff) |
| **T7.3** ✅ | `exportMany()` com isolamento de falha por Tela | T7.2 | DS-R15 | 3 Telas com a do meio forçada a falhar → 2 arquivos + 1 `OperationError`, zero exceção não tratada |
| **T7.4** ✅ | UI de export (uma Tela / seleção múltipla) sem alterar estado de edição | T7.3 | DS-R14 AC-3, DS-R15 | Exportar não move o cursor de undo nem toca a sessão |
| **T7.5** ✅ | `tools/visual/design-studio.mjs`: sweep palco/Inspetor/Árvore/Chat × estados × 2 temas | T7.4 | DS-R18 | Todos PASS; defeitos achados viram correção **nesta** tarefa |
| **T7.6** ✅ | E2E real: `e2e/contrast.spec.ts` abre a aba; specs do fluxo no app buildado | T7.5 | DS-R18 | Verde sob xvfb no Electron real, não só jsdom |
| **T7.7** ✅ | Varredura de i18n (`t()`), teclado ponta a ponta e `prefers-reduced-motion` | T7.6 `[P]` | DS-R18 | `noInlineStrings` verde; fluxo completo sem mouse; toda animação com alternativa reduzida |
| **T7.8** ✅ | Fechamento: `ROADMAP.md` M18 com veredito por critério, `STATE.md` D29–D31 + lições, `HARNESS.md` change log | T7.7 | — | `npm run verify` verde; contagem de testes registrada contra o baseline de 2548 |

---

## Empacotamento para subagentes

Fases inteiras, nunca partidas; lotes sequenciais de ~7 tarefas. Um lote não
começa antes do anterior reportar tudo verde.

| Lote | Fases | Tarefas | Entrega verificável |
| --- | --- | --- | --- |
| 1 | F1 | 7 | Documento e undo corretos, provados por propriedade — sem UI |
| 2 | F2 | 7 | Catálogo derivado do CEM; bundle offline com ícones locais |
| 3 | F3 | 8 | Preview isolado renderiza e atualiza sem renavegar; zero rede provada |
| 4 | F4 | 8 | A Bancada existe: aba, Telas, palco, escala, Modo Foco |
| 5 | F5 | 7 | Edição manual completa com undo |
| 6 | F6 | 7 | Geração automática e chat de iteração |
| 7 | F7 | 8 | Export, passe visual, E2E e fechamento da milestone |

Depois do último commit, o **Verificador** roda automaticamente (autor ≠
verificador): checagem ancorada no spec, sensor de discriminação por mutação, e
`validation.md` com veredito por AC.

---

## O que a execução acrescentou ao plano (T7.8)

| # | Achado | Onde ficou registrado |
| --- | --- | --- |
| 1 | O bundle real mede **935,6 KB** (845,2 JS + 90,4 CSS), não os ~830 KB estimados — a entrada de CSS puxa `layers.css` + `utilities.css`. Ainda sob o teto de 1 MB. | `design.md` §0 (P-5) |
| 2 | `replay()` precisa do documento de origem como primeiro parâmetro; um log não carrega `screenId`/`title`. | `design.md` §4 |
| 3 | Mover virou **indentar/desindentar por botão** — arrastar é o único gesto que um teclado não faz (DS-R18). | `design.md` §6.1 |
| 4 | A biblioteca de ícones é um conjunto **fixo de 136** (123 solid + 13 brands); um ícone fora dela não renderiza e nunca cai para o CDN. Limitação de produto. | `design.md` §6.1 |
| 5 | `connect-src` é **`data:`**, não `'none'` — medido, travado em D-DS-4/D32, com o egresso de rede ainda em zero e provado pela T3.8. | `spec.md` P1-Preview AC-2 |
| 6 | **R-8 continua aberto**: a detecção de Telas nunca viu uma Spec real deste repo (nenhuma usa `## Tela —`). | `design.md` §6.1 e §7 |
| 7 | **Bug de empacotamento**, achado por `build:unpack` na própria T7.8: `asarUnpack` põe `resources/**` em `app.asar.unpacked/resources/`, então `process.resourcesPath` 404'ava tudo **só no app empacotado**. Corrigido e provado contra o binário. | `previewProtocol.ts` (`studioResourcesRoot`) |

---

## Riscos de execução conhecidos

- **F3 é a fase mais arriscada** — protocolo, CSP e origem opaca são território
  novo no app. Se algo escorregar de cronograma, é aqui. T3.8 (zero rede) é o
  teste que pega o erro silencioso (R-1) e não deve ser cortado.
- **T4.2 depende de markdown livre** (R-8): a heurística de detecção de Telas
  deve ser calibrada contra Specs de UX reais do repositório, não inventadas.
- **T2.2 e T2.6 mudam o empacotamento** — validar `build:unpack` antes de
  declarar a fase 2 fechada, não só os testes unitários.
