---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted:
  [
    'step-01-detect-mode',
    'step-02-load-context',
    'step-03-risk-and-testability',
    'step-04-coverage-plan',
    'step-05-generate-output'
  ]
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-07-29'
workflowType: 'testarch-test-design'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design-progress.md'
  - 'hive-desktop/.specs/features/*/spec.md (377 IDs)'
  - 'medição própria 2026-07-29: npm run test, npm run test:coverage, npm run test:e2e:app'
---

# Test Design para QA: Cobertura de Regressão Completa — Hive Desktop

**Propósito:** receita de execução para quem vai escrever os testes. Define o que
testar, em que nível, em que ordem, e o que QA precisa dos outros times.

**Data:** 2026-07-29
**Autor:** Test Architect (agente TEA, `bmad-testarch-test-design`)
**Status:** Rascunho — aguardando decisão dos bloqueadores B-1..B-4
**Projeto:** `hive-desktop`

**Relacionado:** `test-design-architecture.md` traz as preocupações de
testabilidade, o registro completo de riscos e os bloqueadores arquiteturais.
Aqui está só o que QA executa.

---

## Sumário executivo

**Escopo:** regressão de **todas** as 23 features do `hive-desktop` (M0–M12.1),
nos três níveis — unitário/componente, integração IPC, E2E em Electron real.

**Resumo de risco:**

- 16 riscos — **12 de alta prioridade (≥6)**, 1 médio, 3 baixos
- Categorias mais carregadas: **TECH (7)** e **OPS (5)**
- **R-01 (score 9)** é a raiz de R-02, R-06 e de metade de R-08/R-10

**Resumo de cobertura:**

- **P0:** 12 cenários (rede de regressão, caminhos destrutivos, arquivo hostil)
- **P1:** 24 cenários (features sem E2E, buracos de cobertura, contrato de CLI)
- **P2:** 17 cenários (bordas, features órfãs de spec, a11y complementar)
- **P3:** 5 cenários (benchmarks e itens bloqueados por hardware)
- **Total:** ~58 cenários novos + saneamento — **~125–210 h (≈4–6 semanas, 1 QA)**

**Linha de base medida nesta sessão** (não citada — executada):

| Suíte | Comando | Resultado |
| --- | --- | --- |
| Unit + componente | `npm run test` | **109 arquivos / 1589 testes, 100% verde**, ~21 s |
| Gate de cobertura | `npm run test:coverage` | **exit 1 — 14 violações** de per-file 90% |
| E2E Electron real | `npm run build && xvfb-run -a npm run test:e2e:app` | **4 falharam · 4 passaram · 6 skipados**, 10,6 min |

As 4 falhas são **timeouts esperando a work UI**, em 3 arquivos de spec — todos
os que atravessam provisionamento BMAD. Não são bugs de produto nem flakiness:
são a ausência do seam de teste (R-01).

---

## Fora de escopo

| Item | Motivo | Mitigação |
| --- | --- | --- |
| **Testes de carga (k6)** | Não há HTTP, RPS nem carga concorrente — é app desktop single-user. O `nfr-criteria.md` prescreve k6 para serviços; aqui seria cerimônia | Performance vira benchmark in-process (P3-001..003), depois de B-3 |
| **Contract testing por Pact** | Não há fronteira de serviço versionada | O contrato interno (IPC) é guardado por `preload/index.test.ts` + `moduleBoundaries.test.ts`; o externo (stream dos CLIs) por fixtures gravadas (P1-021) |
| **`@seontechnologies/playwright-utils`** | Pressupõe HTTP e `page.goto`; o app não faz requisição | Fixtures próprias, no padrão que o repo já usa em `testSupport/` |
| **Secret scanning (GitLeaks)** | Sem segredos no repo e sem deploy — decisão do `HARNESS.md` §7, ainda válida | Reavaliar na primeira credencial ou primeiro deploy |
| **Mutation testing (Stryker)** | Gatilho do §7 ("um teste verde esconder um bug") não ocorreu | Reavaliar depois de o gate de cobertura ficar verde (P3-005) |
| **Apply nativo do update em Windows/macOS** | Sem hardware disponível (ND T18) | Manual, com assinatura humana (P3-004). **Risco aceito e declarado**, não esquecido |
| **Julgamento estético** (hierarquia visual, copy, "duas affordances fingindo ser uma") | Nenhum sensor pega | Passe visual humano via Playwright MCP, receita em `docs/visual-validation.md` |
| **`design-system`** | Pacote separado, com gate próprio (90% global) | Fora deste plano por fronteira de repositório |

---

## Dependências e bloqueadores de teste

**CRÍTICO:** QA não avança na camada E2E sem os dois primeiros.

### Dependências de Dev/Arquitetura (pré-implementação)

**Fonte:** ver "Guia rápido" do documento de arquitetura para os planos completos.

1. **B-1 — Seam de teste para o gate de provisionamento** · Dev/main · pré-implementação
   - **O que QA precisa:** subir o app buildado até a work UI **sem** executar
     `npx bmad-method install`.
   - **Por que bloqueia:** `configStore` aceita `provisioned: true`, mas
     `updateBmad()` nunca lê a flag — todo launch cai no `UpdateGate` e dispara o
     install real. Hoje os specs correm contra o happy path clicando em "continuar
     mesmo assim" quando o gate emite `error`; daí os timeouts. Bloqueia **4 casos
     existentes** e **5 features** que precisam ganhar E2E.
   - **Precedente que legitima o pedido:** `window.hive.fs.importEntry`, test-hook
     sancionado em produção (design.md §8).

2. **B-2 — Instrumentação de diagnóstico do E2E** · Harness · imediato
   - **O que QA precisa:** `trace: 'retain-on-failure'`,
     `screenshot: 'only-on-failure'`, `video`, `reporter: [['list'],['html']]`,
     `retries: 1` no CI — e o `upload-artifact` do CI apontando para um diretório
     que **existe** (hoje aponta para `playwright-report/`, que o reporter `list`
     nunca cria; os artefatos caem em `test-results/`).
   - **Por que bloqueia:** reparar as 4 vermelhas sem trace é tentativa e erro.

3. **B-3 — Thresholds de performance** · Produto
   - **O que QA precisa:** latência de transcrição do Whisper, teto de memória com
     modelo carregado, tempo de abertura de documento grande, tempo de boot.
   - **Por que bloqueia:** sem threshold não existe regressão detectável. **Não
     serão adivinhados.**

4. **B-4 — IDs de requisito para as 12 features órfãs** · Produto
   - **O que QA precisa:** `spec.md` mínimo (requisitos + IDs), sem re-planejar.
   - **Por que bloqueia:** sem IDs, `bmad-testarch-trace` não tem de onde derivar
     a matriz de rastreabilidade. Os 377 IDs atuais cobrem 11 das 23 features.

### Infraestrutura de QA (pré-implementação)

1. **Fixture de workspace** — QA (depende de B-1)
   - Fábrica de workspace descartável com `_bmad/_config/manifest.yaml` plantado,
     `userData` isolado por caso, cleanup automático.
   - **Um workspace por caso** — mata o acoplamento do `describe.serial` no
     `explorer-editor-ux` (R-16), onde 1 falha de `beforeAll` apagou 6 casos.

2. **Fábrica de fixtures hostis** — QA
   - docx/xlsx/pptx/pdf malformados, truncados e vazios; zip com entrada de path
     traversal (`../`) — `jszip` é a superfície.

3. **Fixtures de stream de CLI** — QA + Dev
   - Saída JSON real de `claude`/`copilot`/`devin` gravada, para o contract test
     do R-07.

4. **Ambientes**
   - **Local:** WSL2 + `xvfb-run -a` (obrigatório — sem display server).
   - **CI:** `ubuntu-latest`, libs do Electron via `apt-get`, `xvfb-run`. ⚠️ **Ambos
     não-provados** — o workflow só dispara em push→`main`/PR e as branches de
     feature não foram mergeadas, então **o CI nunca executou**.
   - **Pre-release:** Windows real (indisponível hoje).

**Padrão de fixture já estabelecido no repo** (seguir, não reinventar):

```typescript
// src/renderer/src/testSupport/hiveGitMock.ts — o molde local de "data factory"
// Mocks de fronteira fatorados, a 100% de cobertura. Um novo mock de fronteira
// entra aqui, não inline no teste.
import { installHiveGitMock } from '../testSupport/hiveGitMock'

beforeEach(() => {
  installHiveGitMock({ status: { staged: [], changes: [] } })
})
```

---

## Avaliação de risco (visão QA)

**Nota:** detalhes completos no documento de arquitetura. Aqui, só como QA valida
cada um.

### Riscos de alta prioridade (score ≥6)

| Risco ID | Cat | Descrição | Score | Como QA valida |
| --- | --- | --- | --- | --- |
| **R-01** | TECH | Sem seam de teste para o gate de provisionamento BMAD | **9** | P0-001 (seam honrado) + P0-004 (as 4 vermelhas verdes sobre ele) |
| **R-02** | OPS | E2E sem gate no CI e nunca executado em infra limpa | **6** | Burn-in 10× no runner do GitHub — não na máquina do dev |
| **R-03** | OPS | Gate de cobertura fora do `verify` e vermelho em 14 pontos | **6** | P0-011 + P1-004..008 (os arquivos que reprovam) |
| **R-04** | TECH | Denominador de cobertura contaminado → global 16,3% sem sentido | **6** | P0-011 (sanear `coverage.exclude` antes de qualquer meta global) |
| **R-05** | BUS | Regressão visual/a11y sem gate (contraste 3,93:1 e 3,46:1 no claro) | **6** | P0-010 (contraste automatizado, dark **e** light) + P2-016/017 |
| **R-06** | BUS | 5 features sem nenhum E2E, incluindo a jornada da tese | **6** | P0-003 (pedir PRD → ver `PRD.md`) + P1-001/009/013/015/016 |
| **R-07** | TECH | Sem contract test contra os CLIs externos (formato do stream) | **6** | P1-021 (fixtures gravadas + verificação de formato) |
| **R-08** | DATA | Caminhos destrutivos com defesa única | **6** | P0-005/006/007 — defesa em profundidade **deliberada** (IPC + E2E) |
| **R-09** | SEC | Parsers de documento sem teste de arquivo hostil; `documentReader` branches 66,66% | **6** | P0-008 (malformados) + P0-009 (zip traversal) + P2-015 (`npm audit`) |
| **R-10** | OPS | Auto-update sem E2E de troca real de payload | **6** | P0-012 (integração) + P1-015 + P3-004 (manual) |
| **R-14** | OPS | Falha de E2E não deixa rastro | **6** | P0-002 — verificado por falha proposital que produz trace baixável |
| **R-15** | TECH | 12 de 23 features sem `.specs/`; `FileSearchDialog` sem teste | **6** | P1-023 (specs mínimas) + P1-024 + P2-012/013/014 |

### Riscos médios e baixos

| Risco ID | Cat | Descrição | Score | Como QA valida |
| --- | --- | --- | --- | --- |
| R-11 | PERF | Whisper sem threshold de latência/memória/tamanho | 4 | P3-002, **bloqueado por B-3** |
| R-12 | TECH | ~35 globs de cobertura curados à mão | 3 | Monitorar; automatizar só depois do gate verde (gatilho do §7) |
| R-13 | TECH | `workers: 1` / `retries: 0` — teto de throughput | 2 | Monitorar; elevar quando T1 passar de ~12 min |
| R-16 | TECH | `describe.serial` sobre workspace compartilhado | 3 | P0-004 (isolamento por caso, junto com o seam) |

---

## Plano de cobertura de NFR

**Propósito:** mapear NFR para trabalho de validação planejado. Define que
evidência QA deve produzir; **não** atribui PASS/CONCERNS/FAIL.

| Categoria NFR | Requisito / threshold | Validação planejada | Ferramenta / nível | Artefato de evidência | Prio |
| --- | --- | --- | --- | --- | --- |
| **Segurança** | Zero crash do `main` com arquivo hostil; zero escrita fora do destino em zip | Fixtures malformadas/hostis por formato; zip com `../`; `npm audit` no nightly | Vitest (unit) + CI | Saída de P0-008/009 + relatório do `npm audit` | **P0** |
| **Segurança** (já coberto) | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; sem path traversal | **Nenhum trabalho novo** — `index.test.ts:310-317` assevera os três fuses; `fsService.test.ts` tem 36 asserções de escape (incl. `%2e%2e%2f`); `HtmlPreview.test.ts` assevera `sandbox="allow-scripts"` sem `allow-same-origin` | Vitest | Suíte atual (verde) | — |
| **Confiabilidade** | Toda falha externa degrada com mensagem pt-BR e escape; **nunca** spinner infinito | Cenários de degradação por adapter: CLI ausente, git falha, rede cai no download, modelo corrompido | E2E + integração IPC | Saída de P1-022 | **P1** |
| **Confiabilidade** | Instável ≠ quebrado | Burn-in 10× no nightly | CI | Relatório de burn-in | **P0** |
| **Manutenibilidade** | per-file 90% nos arquivos tocados; global ≥80% **depois** de sanear | Limpar os 14 pontos; `coverage.exclude` saneado; `test:coverage` no `verify` | Vitest + CI | `test:coverage` exit 0 | **P0** |
| **Acessibilidade** | Texto ≥4,5:1; texto grande/ícones ≥3:1; teclado completo; `prefers-reduced-motion` | Probe de contraste existente automatizado nas telas-chave, dark+light; suíte de teclado; alternativa de motion | Playwright MCP + Vitest | Saída de P0-010, P2-016, P2-017 | **P0/P2** |
| **Performance** | **UNKNOWN** | Benchmark in-process de boot, transcrição e abertura de documento | Instrumentação no Electron (**não** k6) | Saída de P3-001..003 | **P3** |
| **Portabilidade** | Install + apply funcionam em Windows real; sha512 verificado | Integração contra registry falso (automatizável) + apply nativo manual | Vitest + manual | P0-012 + checklist de release | **P0/P3** |

**Thresholds ou fontes de evidência ausentes:** os quatro de performance (B-3).
Enquanto UNKNOWN, Performance permanece **CONCERNS** por regra do
`nfr-criteria.md` — threshold ausente nunca é PASS. Não é omissão de QA.

---

## Critérios de entrada

Trabalho de teste E2E não começa antes de:

- [ ] **B-1 resolvido** — seam de teste disponível no app buildado
- [ ] **B-2 resolvido** — trace/screenshot/retries ativos e artefato do CI recuperável
- [ ] Fixture de workspace descartável funcionando, com isolamento por caso
- [ ] `npm run build` verde e `xvfb-run` funcionando no ambiente
- [ ] Branches de feature mergeadas (ou baseline explicitamente escolhida) — hoje
      M10/M11/M12 vivem separadas e "regressão" tem baselines concorrentes
- [ ] Requisitos e premissas acordados entre QA, Dev e Produto

**Não bloqueado por nada disso:** a camada de **integração IPC** e os cenários
unitários. Comece por eles — é a cobertura mais barata disponível hoje.

## Critérios de saída

A fase de teste está completa quando:

- [ ] **100% dos P0 passando**, sem exceção
- [ ] **≥95% dos P1 passando**, falhas restantes triadas e aceitas por escrito
- [ ] Nenhum risco score 9 em aberto — hoje **R-01 reprova**
- [ ] Todo risco ≥6 com plano, dono e prazo registrados
- [ ] `npm run test:coverage` **exit 0** e incluído no `verify`
- [ ] E2E verde em **10 execuções consecutivas em infra limpa**, sem `continue-on-error`
- [ ] Contraste ≥4,5:1 nos dois temas em todas as telas-chave
- [ ] DoD de teste respeitado (ver Apêndice B)
- [ ] Os 1589 testes atuais continuam verdes (sem regressão introduzida pelo próprio trabalho)

---

## Plano de cobertura de testes

**IMPORTANTE:** P0/P1/P2/P3 = **prioridade e risco** (no que focar se o tempo
apertar), **não** momento de execução. Ver "Estratégia de execução" para quando
cada coisa roda.

### P0 (crítico)

**Critério:** bloqueia a rede de regressão · risco ≥6 · sem contorno · destrói
trabalho do usuário se falhar.

| Test ID | Requisito / escopo | Nível | Risco | Notas |
| --- | --- | --- | --- | --- |
| **P0-001** | App sobe até a work UI **sem** executar `npx bmad-method install` (seam honrado) | E2E infra | R-01 | **Pré-requisito de todos os demais E2E.** Depende de B-1 |
| **P0-002** | Falha de E2E produz trace, screenshot e vídeo recuperáveis do artefato do CI | Infra | R-14 | Depende de B-2. **Fazer antes de P0-004** |
| **P0-003** | Jornada da tese: pedir PRD ao agente → `PRD.md` aparece no explorer e abre | E2E | R-06 | Adapter scriptado no lugar do CLI real |
| **P0-004** | As 4 vermelhas verdes sobre o seam, com **um workspace por caso** (file-management; explorer-editor-ux casos 1 e 6; workspace-switching) | E2E | R-01, R-16 | Remove `describe.serial`/workspace compartilhado |
| **P0-005** | Rejeitar hunk do agente **não** perde alteração vizinha aceita (shadow-git) | E2E + IPC | R-08 | Defesa em profundidade intencional |
| **P0-006** | Restaurar checkpoint **não** apaga arquivo criado pelo usuário fora do escopo do agente | IPC | R-08 | Asseverar bytes em disco |
| **P0-007** | Escrita no vault do second-brain é atômica: falha no meio não deixa nota corrompida | IPC | R-08 | Vault é compartilhado via git — corromper afeta a squad |
| **P0-008** | `documentReader` rejeita docx/xlsx/pptx/pdf malformado com erro tratado, **sem crash do `main`** | Unit | R-09 | Branches hoje em 66,66% |
| **P0-009** | Zip com entrada de path traversal (`../`) não escreve fora do destino | Unit | R-09 | `jszip` é a superfície |
| **P0-010** | Contraste ≥4,5:1 em todas as telas-chave, tema **dark e light** | Visual autom. | R-05 | Probe já existe (`ui/contrast.ts`); falta gate e varredura |
| **P0-011** | `coverage.exclude` saneado + os 14 pontos limpos + `test:coverage` promovido a gate no `verify` e no CI | Infra + Unit | R-03, R-04 | **Sanear antes de limpar** — hoje o global (16,3%) é artefato |
| **P0-012** | Aplicar update baixado troca o payload e o app sobe na nova versão | Integração | R-10 | Contra registry falso; apply nativo fica em P3-004 |

**Total P0: 12 cenários**

---

### P1 (alta)

**Critério:** features importantes sem cobertura no nível certo · risco 6 com
contorno · buracos de cobertura medidos.

| Test ID | Requisito / escopo | Nível | Risco/Req | Notas |
| --- | --- | --- | --- | --- |
| **P1-001** | chat-controls: interrupt do turno em voo mantém a saída parcial | E2E | CC-R1 | Reusa `agent.stop()` |
| **P1-002** | Handler IPC do turno: start / stream / stop registrados e ligados | IPC | R-06 | Não depende de B-1 — **comece aqui** |
| **P1-003** | Artefato escrito pelo agente aparece no explorer (live refresh de escrita concorrente) | IPC | R-06, FM-R6 | Não depende de B-1 |
| **P1-004** | Onboarding: `AgentSetup`, `RoleSetup`, `WorkspacePicker`, `InstallConfigForm` — **nenhum tem teste co-localizado** | Comp | R-03 | Módulo mais fraco do projeto (F 72,7% / B 80,6%) e é o primeiro uso |
| **P1-005** | Viewer docx com arquivo real (branches 85,71 → ≥90) | Comp | R-03 | |
| **P1-006** | Viewer xlsx/sheet com arquivo real (branches 85,71 → ≥90) | Comp | R-03 | |
| **P1-007** | Viewer pptx/slides com arquivo real (functions 83,33 → ≥90) | Comp | R-03 | |
| **P1-008** | Viewer pdf e imagem (PdfViewer F 81,81/B 79,66; ImageViewer B 79,06) | Comp | R-03 | Os dois piores do gate |
| **P1-009** | workspace-switching: trocar com pendências não salvas dispara o guard de 3 vias | E2E | WS-R | Depende de B-1 |
| **P1-010** | `ProfileSheet`: troca de agente e de papel a partir da folha | Comp | RP-R | Hoje 44–89% |
| **P1-011** | `RoleSetup`/`ChoiceCard`: papel escolhido recalcula o catálogo de ações | Comp | RP-R | |
| **P1-012** | Rail de ações: itens do papel, badge, largura persistida | Comp | RP-R | |
| **P1-013** | agent-selection: detecção de disponibilidade + orientação "como instalar" | Comp | AG-R | `AgentPicker`/`AgentSwitcher` hoje F 40–50% |
| **P1-014** | agent-selection: agente por conversa (pool de sessões por `agentId`) | IPC | AG-R | Concorrência |
| **P1-015** | npm-distribution: descoberta de versão + verificação sha512 contra registry falso | IPC | R-10 | |
| **P1-016** | npm-distribution: recusa ("Agora não") e skip por versão persistido | Comp | ND-R | Consentimento nunca é automático |
| **P1-017** | git-management: resolução de conflito (accept current / incoming / both) | E2E | GIT-R12 | Único caminho de 13 requisitos ainda sem E2E |
| **P1-018** | agent-change-review: accept/reject por **arquivo** e por **set**, asseverado em disco | E2E | ACR-R | Hoje o E2E só faz smoke da view |
| **P1-019** | agent-change-review: STALE guard quando o disco mudou sob a revisão | IPC | ACR-R3.2 | |
| **P1-020** | second-brain: Ask (`Ctrl+Shift+K`) leva a pergunta ao transcript | E2E | SB-R9 | |
| **P1-021** | Contract test: fixtures do stream JSON gravadas por CLI, falhando se o formato divergir | Unit | R-07 | `claude` / `copilot` / `devin` |
| **P1-022** | Degradação: CLI ausente, git falha, rede cai, modelo corrompido → mensagem pt-BR + escape, **nunca** spinner infinito | E2E + IPC | Confiab. | Lição já institucionalizada no STATE.md |
| **P1-023** | `spec.md` mínimo (requisitos + IDs) para as 12 features órfãs | Doc | R-15 | Pré-requisito da rastreabilidade (B-4) |
| **P1-024** | Busca `Ctrl+P` (`FileSearchDialog`) — **zero cobertura hoje** | Comp | R-15 | Único arquivo de feature sem teste nenhum |

**Total P1: 24 cenários**

---

### P2 (média)

**Critério:** features secundárias, bordas, prevenção de regressão, a11y
complementar.

| Test ID | Requisito / escopo | Nível | Risco/Req |
| --- | --- | --- | --- |
| **P2-001** | chat-controls: navegação por teclado e filtragem type-to-filter no menu de slash | Comp | CC-R2 |
| **P2-002** | chat-controls: menu com catálogo vazio / skill não descoberta | Comp | CC-R2 |
| **P2-003** | Anexos + menções `#`: anexo removido, menção inválida, limite de tamanho | Comp | R-15 |
| **P2-004** | Histórico de sessão: FIFO de turnos, resume, troca de conversa | Comp | R-15 |
| **P2-005** | agent-selection: E2E do switcher entre conversas | E2E | AG-R |
| **P2-006** | git: timeline de history e diff por commit/arquivo | Comp | GIT-R11 |
| **P2-007** | git: stash pop e drop | E2E | GIT-R13 |
| **P2-008** | agent-change-review: `ChangeCard` expandido/colapsado no transcript | Comp | ACR-R |
| **P2-009** | agent-change-review: `ReviewSwitchDialog` ao trocar de view com pendências | Comp | ACR-R4.3 |
| **P2-010** | second-brain: cadência de health — "Depois" garante uma semana de silêncio e nunca finge que a checagem rodou | Comp | SB-R10 |
| **P2-011** | Atalhos personalizáveis: conflito de binding e reset ao padrão | Comp | R-15 |
| **P2-012** | Estúdio de skills: criar skill + eval | E2E | R-15 |
| **P2-013** | Módulo MCP: testar conexão contra servidor inválido; logs | Comp | R-15 |
| **P2-014** | Tour guiado: `hive.tourSeen`, pular, retomar | Comp | R-15 |
| **P2-015** | `npm audit` no nightly, falhando em vulnerabilidade crítica/alta | CI | R-09 |
| **P2-016** | `prefers-reduced-motion`: alternativa verificada em toda animação | Comp | R-05 |
| **P2-017** | Teclado: roving tabindex na tree, convenções Escape/Enter, `focus-visible` em todo controle custom | Comp | R-05 |

**Total P2: 17 cenários**

---

### P3 (baixa)

**Critério:** benchmarks e itens bloqueados por decisão externa ou hardware.

| Test ID | Requisito / escopo | Nível | Bloqueio |
| --- | --- | --- | --- |
| **P3-001** | Benchmark de boot até work UI | Bench in-process | threshold UNKNOWN (B-3) |
| **P3-002** | Benchmark de transcrição Whisper: latência e memória por modelo × backend (WebGPU/WASM) | Bench | threshold UNKNOWN (B-3) |
| **P3-003** | Benchmark de abertura de documento grande por tipo | Bench | threshold UNKNOWN (B-3) |
| **P3-004** | Update real npm→GitHub Releases em Windows (e macOS) | Manual | sem hardware (ND T18) + token (ND-B2) |
| **P3-005** | Mutation testing | Unit | reavaliar após gate verde (gatilho do §7) |

**Total P3: 5 cenários**

---

## Estratégia de execução

**Filosofia:** rodar tudo no PR, a menos que o custo de infraestrutura seja
significativo. Aqui isso é literal — o vitest inteiro (1589 testes) leva ~21 s, e o
Playwright paraleliza centenas de casos em 10–15 min quando configurado para isso.
Só fica fora do PR o que **sobe hardware real, depende de rede externa ou roda por
horas**.

Organizado por **tipo de ferramenta**:

### Todo PR: Vitest + Playwright (~10–15 min)

**Todos os testes funcionais, de qualquer prioridade:**

- `verify` = typecheck + lint + os 1589 testes de unit/componente/IPC (~2–4 min)
- `test:coverage` — gate após P0-011
- Playwright em Electron real, marcados `@p0` (~8–12 min)

**Por que no PR:** feedback rápido, nenhuma infraestrutura caríssima. **Gate após
R-01** — hoje é `continue-on-error`.

⚠️ **Restrição de paralelização deste projeto:** o Playwright está em `workers: 1`
(R-13). Para caber em 12 min com os cenários novos, precisa paralelizar — **e
paralelizar exige antes o isolamento de workspace por caso** (P0-004), senão troca
um problema por outro.

### Nightly: suítes que dependem de rede ou de repetição (~25–40 min)

- E2E completo (todas as specs, todos os cenários, não só `@p0`)
- `bmadCli.e2e.test.ts` — **CLI real**, com resolução npx e rede
- **Burn-in 10×** dos `@p0` — separa instável de quebrado
- Passe de contraste dark/light
- `npm audit`

**Por que fora do PR:** rede externa (npx) e repetição 10× não caberiam no
orçamento do PR. **Um spec preservado no caminho lento:** o seam de B-1 contorna o
provisionamento real; para não apagar a cobertura do caminho contornado, um spec
dedicado continua atravessando `npx bmad-method install` de verdade aqui.

### Pre-release: hardware e execução longa (horas / manual)

- Update real npm→GitHub Releases em Windows (e macOS) — **apply nativo, manual**
- Benchmarks de Whisper (latência e memória por modelo × backend)
- Suíte completa de arquivos hostis, todos os formatos

**Por que fora do CI:** exige hardware indisponível e julgamento humano.

**Testes manuais (excluídos de automação):** apply nativo do update em Windows;
julgamento estético (hierarquia visual, copy, "duas affordances fingindo ser uma").

---

## Estimativa de esforço de QA

**Esforço de desenvolvimento de teste apenas** (exclui o trabalho de Dev e de
Harness — ver "Dependências e bloqueadores").

| Prioridade | Cenários | Faixa de esforço | Notas |
| --- | --- | --- | --- |
| P0 | 12 | **~1,5–2,5 semanas** | Puxado pelas fixtures (workspace, hostis) e pelos caminhos destrutivos com defesa em profundidade |
| P1 | 24 | **~1,5–2,5 semanas** | Cobertura padrão: componente, IPC e um caminho E2E por feature |
| P2 | 17 | **~3–6 dias** | Bordas e regressão secundária |
| P3 | 5 | **~1–2 dias** | Só após B-3; sem threshold não começa |
| Saneamento de cobertura | os 14 pontos | **~3–5 dias** | Testes em viewers/Explorer/WorkUI/Chat/preload |
| **Total** | **58** | **~4–6 semanas** | **1 QA, tempo integral** |

**Premissas:**

- Inclui design, implementação, depuração e integração no CI.
- Exclui manutenção contínua (~10%).
- Assume infraestrutura de fixture pronta antes dos cenários que dela dependem.
- Assume **B-1 e B-2 resolvidos** — sem eles, todo cenário E2E fica bloqueado e a
  faixa não vale.

**Trabalho fora de QA** (necessário, mas não deste orçamento): B-1 seam de teste
(~8–16 h, Dev/main) · B-2 instrumentação do E2E (~2–4 h, Harness) · B-3 e B-4
(decisão de Produto).

**MVP deste plano (~1–2 semanas de QA):** B-1 + B-2 + saneamento de cobertura + os
12 cenários P0 **já entregam a rede de regressão**. O resto é incremento. Entregue
de uma vez, um lote de 58 cenários chega depois de já ter apodrecido.

---

## Handoff de planejamento de implementação

Sem QA dedicado no projeto, os itens abaixo caem em donos de Dev.

| Item de trabalho | Dono | Marco sugerido | Dependências / notas |
| --- | --- | --- | --- |
| B-1 — seam de teste | Dev/main | pré-implementação | **Única mudança de produto do plano** |
| B-2 — instrumentação do E2E | Harness | imediato | Horas, risco zero. **Antes de B-1** |
| P0-011 — sanear + limpar cobertura | Dev + Harness | 1ª sprint | `coverage.exclude` primeiro |
| P0-004 — reabilitar as 4 vermelhas | QA/Dev | 1ª sprint | Depende de B-1 e B-2 |
| P1-002/003 — integração IPC do turno | QA/Dev | 1ª sprint | **Não depende de B-1** — começar por aqui |
| P0-005..007 — caminhos destrutivos | QA/Dev | 1ª–2ª sprint | Defesa em profundidade deliberada |
| P0-008/009 — fixtures hostis | Dev | 2ª sprint | |
| P0-010 — gate de contraste | Dev + UX | 2ª sprint | Probe já existe |
| P1-021 — contract test de CLI | Dev | 2ª sprint | Precisa dos CLIs reais uma vez, para gravar |
| B-3 — thresholds de performance | Produto | quando puder | Desbloqueia P3-001..003 |
| B-4 — IDs retroativos | Produto | 2ª sprint | Desbloqueia `bmad-testarch-trace` |

---

## Ferramental e acesso

| Ferramenta / serviço | Propósito | Acesso necessário | Status |
| --- | --- | --- | --- |
| `xvfb` | Display server para Electron em WSL2 e no CI | já instalado local; `apt-get` no CI | ⚠️ **não-provado no CI** (nunca executou) |
| Libs do Electron no runner | `libnss3`, `libatk`, `libgbm1`, `libasound2t64`, `libgtk-3-0`… | `apt-get` no workflow | ⚠️ **não-provado** |
| CLIs de agente (`claude`, `copilot`, `devin`) | Gravar fixtures de stream (R-07) | binários, uma vez | ❌ ausentes neste ambiente |
| Hardware Windows (e macOS) | ND T18 — apply nativo do update | máquina | ❌ indisponível |
| Token GitHub | ND-B2 — publish de release asset | credencial | ❌ pendente |
| Playwright MCP | Passe visual dark/light | já em uso (config fora do repo) | ✅ pronto |

**Acessos a solicitar:**

- [ ] Máquina Windows para P3-004 / ND T18
- [ ] Token GitHub para ND-B2
- [ ] Uma execução com `claude` CLI real para gravar as fixtures de P1-021

---

## Interworking e regressão

| Serviço / componente | Impacto | Escopo de regressão | Passos de validação |
| --- | --- | --- | --- |
| **`git` CLI do sistema** | Motor de M10 e do shadow-git de M11 | `gitService`, `gitParse`, `scm/**`, `checkpointService`, `reviewService` (99,8% hoje) | E2E de git com repo descartável + remote bare local |
| **`npx bmad-method`** | Provisionamento e update — **o gargalo do R-01** | `bmadService`, `UpdateGate`, `SecondBrainGate`, e indiretamente todo E2E | Um spec dedicado no nightly com o CLI real; os demais pelo seam |
| **CLIs de agente** | Todo turno de chat | `agentAdapter`, `cliAdapterCore`, `agentService`, `agentRegistry` | Contract test de fixtures (P1-021) + adapter scriptado nos E2E |
| **`@hive/design-system`** (link `file:`) | Toda a UI | Tudo em `renderer/` | ⚠️ Exige `dedupe` de React em **todo** config novo — já obrigatório em `electron.vite.config.ts` **e** `vitest.config.ts`. Um terceiro config repete o crash de React duplicado |
| **`userData`** (config, histórico, ledger de health) | Persistência entre versões | `configStore`, `chatHistoryStore`, `secondBrainHealth` | Ler fixture do formato anterior — upgrade que não lê o antigo perde config em silêncio |
| **Protocolo `hive-model:` + ORT/Transformers.js** | Whisper offline | `whisperProtocol`, `whisperModelStore`, `useWhisper` | E2E do protocolo (já passa) + benchmark P3-002 |
| **Registry npm + GitHub Releases** | Auto-update | `npmRegistry`, `githubReleases`, `updateService`, `updateDownload`, `updateApply` | Registry falso (automatizável) + apply nativo manual |

**Estratégia de regressão:**

- Os **1589 testes atuais** são a linha de base e devem continuar verdes em todo
  PR. Nenhum cenário novo tem licença para quebrá-los.
- **Baseline concorrente é um problema aberto:** M10, M11 e M12 vivem em branches
  não mergeadas e **o CI nunca executou** (só dispara em push→`main`/PR). Definir a
  baseline é pré-requisito de "regressão" ter significado.
- Antes de release: T0 + T1 verdes como gate, T2 verde por 10 execuções, T3
  assinado por humano.

---

## Apêndice A: marcação e execução seletiva

Aplicando `selective-testing.md`. Tags a adotar: `@p0`/`@p1`/`@p2`/`@p3`, mais
`@destructive`, `@security`, `@a11y`, `@slow`, `@real-cli`.

```typescript
// e2e/agent-turn.spec.ts — P0-003, a jornada que prova a tese do produto
import { test, expect, _electron } from '@playwright/test'
import { seedProvisionedWorkspace } from './fixtures/workspace' // P0-001

test('@p0 pedir PRD ao agente faz PRD.md aparecer no explorer', async () => {
  // Fixture honra o seam de B-1: entra na work UI sem `npx bmad-method install`
  const { workspace, userData } = await seedProvisionedWorkspace()

  const app = await _electron.launch({
    args: ['out/main/index.js'],
    // ELECTRON_RUN_AS_NODE precisa ser removido — vazamento de interop do WSL
    // que subiria o Electron como Node puro (ver AGENTS.md)
    env: { ...cleanEnv(), HIVE_USER_DATA: userData, HIVE_AGENT_ADAPTER: 'scripted' }
  })
  const page = await app.firstWindow()

  await page.getByTestId('intent-create-prd').click()
  // Asserção no DISCO, não só na UI — é o padrão da suíte e o certo para este produto
  await expect
    .poll(() => existsSync(join(workspace, 'docs', 'PRD.md')), { timeout: 30_000 })
    .toBe(true)
  await expect(page.getByRole('treeitem', { name: 'PRD.md' })).toBeVisible()

  await app.close()
})
```

```bash
# Smoke de PR (T1)
xvfb-run -a npx playwright test --grep @p0

# Nightly completo (T2)
xvfb-run -a npx playwright test

# Burn-in para separar instável de quebrado
for i in $(seq 10); do xvfb-run -a npx playwright test --grep @p0 || echo "FALHOU na volta $i"; done

# Só os caminhos destrutivos
xvfb-run -a npx playwright test --grep @destructive
```

---

## Apêndice B: Definition of Done de teste

De `test-quality.md`, aplicado a este projeto:

- **Sem hard waits.** Nenhum `waitForTimeout`. Use `expect.poll` contra estado de
  disco ou locator — o padrão que a suíte atual já segue.
- **Sem condicional de fluxo.** Um teste com `if` esconde dois testes ou um bug.
- **Autolimpante.** Workspace e `userData` descartáveis, removidos no teardown.
- **Seguro em paralelo.** Um workspace por caso — **é a correção do R-16**, não
  preferência de estilo.
- **< 300 linhas** por arquivo de spec, **< 1,5 min** por teste. Os casos que hoje
  dão timeout em 2,0/3,3/3,4 min violam isso — e o violam por causa do R-01.
- **Asserções no corpo do teste**, não escondidas em helper.
- **Dados únicos por execução.** Sem nome de arquivo fixo compartilhado.
- **Toda cópia via `t()`** — `noInlineStrings.test.ts` já impõe, inclusive em teste.

---

## Apêndice C: referências da base de conhecimento

- `risk-governance.md` — metodologia de scoring e motor de decisão de gate
- `probability-impact.md` — escalas P×I e limiares de ação
- `test-levels-framework.md` — seleção de nível e guarda anti-duplicação
- `test-priorities-matrix.md` — critérios P0–P3
- `nfr-criteria.md` — critérios de NFR (e por que k6 não se aplica aqui)
- `adr-quality-readiness-checklist.md` — 8 categorias de testabilidade
- `test-quality.md` — o DoD do Apêndice B
- `selective-testing.md` — marcação e execução por tag
- `ci-burn-in.md` — burn-in para separar instável de quebrado

**Documentos do próprio projeto que valem mais que qualquer fragmento genérico:**
`.specs/project/HARNESS.md` (§7 lista o que deliberadamente não existe, com
gatilho de reavaliação — respeitado por este plano) e `docs/visual-validation.md`
(a receita do passe visual, já extraída da memória do agente para o repo).

---

**Gerado por:** agente TEA do BMad
**Workflow:** `bmad-testarch-test-design` (modo System-Level, execução sequencial)
**Versão:** 4.0 (BMad v6)
