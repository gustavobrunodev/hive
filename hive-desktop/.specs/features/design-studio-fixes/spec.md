# Spec — `design-studio-fixes` (M18.1)

A M18 fechou com veredito PASS, 3361 testes verdes e um Verificador independente.
Uma revisão adversarial posterior (2026-08-12) encontrou 20 achados que os testes
verdes não cobriam — porque quase nenhum deles é um teste errado. São afirmações
que os documentos fazem e o código não sustenta, contratos duplicados que ainda
não divergiram, e um requisito inteiro cujo módulo foi escrito, testado e nunca
ligado.

**Feature de origem:** `.specs/features/design-studio/` (spec/design/tasks/validation).
Onde este documento contradiz aquele, este vence — e a tarefa de fechamento
corrige o original em vez de deixar dois textos discordando.

## Problema

1. **Um requisito publicado não existe.** `sessionStore.ts` implementa a P2
   ("fechar o app e reencontrar minha sessão") por inteiro, com 224 linhas de
   teste — e é importado apenas pelos próprios testes. Nenhum handler IPC o
   instancia. O `validation.md` marcou P2 AC-1..AC-4 como ✅ citando esses
   testes: testar um módulo isolado nunca provou que ele está ligado a algo.
2. **O documento aceita entradas que não pode representar.** Um `Command` de
   `type` desconhecido atravessa `validate()` e `applyCommand()` — ambos com
   `switch` sem `default` — e devolve `undefined`, envenenando o log de forma
   permanente. Um `AddComponent` com `parentId: null` substitui a raiz existente
   em silêncio. Ids de nó duplicados fazem o main e o frame apontarem para nós
   diferentes; um id com aspas derruba o `querySelector` do receptor.
3. **A mesma verdade está guardada em dois lugares.** O cursor de undo vive no
   log do main *e* num array no renderer, avançados lado a lado por duas chamadas
   independentes. O formato do token de sessão está escrito em três regexes, e a
   do renderer é a mais frouxa. É exatamente a duplicação que a arquitetura da
   M18 gasta o orçamento inteiro evitando — só que dentro dela.

## Requisitos

Cada requisito fecha achados nomeados da revisão. `AR-n` = achado adversarial.

### Integridade do documento

- **DSF-R1 — O log só aceita o vocabulário fechado (AR-5).** Um `Command` cujo
  `type` não pertence à união é recusado na fronteira IPC, antes de `validate()`,
  como `OperationError`. `validate()` e `applyCommand()` deixam de poder devolver
  `undefined` para qualquer entrada.
- **DSF-R2 — Adicionar nunca é substituir (AR-4).** `AddComponent` com
  `parentId: null` numa Tela que já tem raiz é `CapabilityViolation`, não uma
  troca silenciosa da árvore.
- **DSF-R3 — Um id de nó é único e endereçável (AR-9, AR-10).** Ids têm formato
  verificado e são únicos dentro da Tela; um lote que viole qualquer das duas
  coisas é recusado inteiro, e nenhuma superfície interpola um id em seletor CSS.

### Uma fonte de verdade

- **DSF-R4 — Um cursor de undo, no main (AR-3).** O renderer não guarda mais
  posição no log. Tudo que a toolbar, o seletor de Telas e o chat precisam saber
  sobre o histórico vem da mesma `ScreenView` que o main já devolve.
- **DSF-R5 — Ler não cria estado (AR-16).** Uma chave desconhecida não fabrica
  uma Tela vazia; exportar com ela é `OperationError`, não um arquivo em branco
  reportado como sucesso. O estado por Tela é liberado quando a aba fecha.
- **DSF-R6 — Um só contrato para o canal do Preview (AR-13, AR-14).** O formato
  do token vive num único módulo compartilhado, e o receptor autentica a origem
  da mensagem com os mesmos dois controles que o pai já aplica.

### Sessão persistida (a story que nunca foi ligada)

- **DSF-R7 — A sessão sobrevive ao restart (AR-1, AR-2).** Log por Tela,
  transcript por Tela e Tela ativa persistem em `userData` e são restaurados ao
  reabrir a mesma Spec no mesmo workspace.
- **DSF-R8 — Nada volta do disco sem passar pela porta (AR-19).** Um arquivo de
  sessão é validado em profundidade — cada Tela, cada entrada do log, cada
  `Command` — e todo `Command` restaurado passa por `validate()` antes de compor
  o documento. O que não passar é descartado com a sessão tratada como nova.

### Falhas visíveis e superfícies honestas

- **DSF-R9 — Limpar uma prop limpa o controle (AR-11).** O `Select` do Inspetor
  é controlado durante toda a sua vida; limpar um enum some com o valor na tela,
  não só no documento.
- **DSF-R10 — Todo turno da Skill termina (AR-14).** Parar interrompe o turno de
  verdade; um turno sem sinal de vida expira como `OperationError` retryable; a
  inscrição no agente é sempre desfeita.
- **DSF-R11 — Nenhuma falha de IPC vira rejeição não tratada (AR-17).** Undo,
  redo e o lote do chat tratam a rejeição do canal como as leituras vizinhas já
  tratam.
- **DSF-R12 — A detecção lista todas as Telas que reconhece (AR-10).** Todas as
  sondas contribuem, com precedência e deduplicação documentadas — não só a
  primeira que der resultado.
- **DSF-R13 — Um export que falha não deixa lixo (AR-18).** O temporário é
  removido quando o rename falha, como o `sessionStore` já faz.

### Documentos que só afirmam o que o código entrega

- **DSF-R14 — Nenhuma alegação sem lastro (AR-6..AR-8, AR-20, AR-21, AR-2).**
  Os comentários que vendem cobertura inexistente são corrigidos; os riscos
  aceitos são registrados em `STATE.md` com o motivo; os números divergentes
  entre `spec.md`, `design.md`, `tasks.md` e `ROADMAP.md` passam a bater; a
  tabela de rastreabilidade da M18 passa a ter linhas para P2 e P3.

## Fora de escopo

| Item | Motivo |
| --- | --- |
| `default-src 'none'` na CSP do Preview (AR-6) | Defesa em profundidade sem caminho de falha demonstrável hoje; risco aceito registrado (DSF-R14). Endurecer a CSP exige medir cada diretiva contra o Web Awesome real, o que é uma investigação própria |
| Revalidar props/URLs em `renderToStaticHtml` (AR-7) | Idem. Com DSF-R8 fechando o caminho do disco, não sobra rota conhecida até o exportador |
| Escapar o nome do atributo na exportação (AR-8) | Idem — inalcançável enquanto `checkProp` filtrar as chaves antes do dispatch |
| Reclassificar `srcdoc` / `data:image/svg+xml` (AR-20) | Idem; o comentário enganoso é corrigido, a regra não muda |
| Segundo adaptador de DS para provar DS-R12 AC-5 | Já aberto por decisão na M18 (F3); nada mudou |
| Calibrar a detecção contra uma Spec de UX real (R-8) | Continua aberto: não existe Spec com `## Tela —` neste repo. DSF-R12 melhora a cobertura das sondas, não substitui a calibração |
| Multi-seleção, migração de Telas, achatar shadow DOM | Deferred da M18, inalterados |

---

## Assumptions & Open Questions

| Assunção / decisão | Default escolhido | Racional | Confirmado? |
| --- | --- | --- | --- |
| Destino da P2 (AR-1) | **Implementar de verdade**: log + transcript + Tela ativa | A story está publicada e o módulo já existe testado; rebaixá-la tiraria uma promessa do produto para economizar a fiação | **y** (usuário, 2026-08-12) |
| Escopo do hardening | **Só o alcançável hoje**; as 4 camadas de defesa em profundidade viram risco aceito com comentário corrigido | Corrigir uma camada sem caminho de falha custa o mesmo que corrigir uma com, e a fila tem as duas | **y** (usuário, 2026-08-12) |
| Forma da entrega | **M18.1 completa**, padrão M10–M17 | Foram o passe visual e o Verificador que pegaram os defeitos mais caros da M18 (5 defeitos visuais, D33) | **y** (usuário, 2026-08-12) |
| Formato do `id` de nó (DSF-R3) | `^[A-Za-z][A-Za-z0-9_-]{0,63}$` | Cobre o que a Skill já produz na prática, é seguro em seletor CSS e em atributo HTML, e é curto o bastante para o erro ser legível | n (decisão de design) |
| Onde a sessão é montada (DSF-R7) | No **main**, dono do log; o renderer continua sem cópia do documento | Persistir do renderer exigiria a segunda cópia do documento que AD-2 existe para impedir | n (decisão de design) |
| Expiração de um turno de Skill (DSF-R10) | 120 s sem nenhum `AgentEvent` do turno | Longo o bastante para um turno real com ferramentas, curto o bastante para não parecer travado. Reavaliar após uso | n (decisão de design) |

**Open questions:** nenhuma bloqueante.

---

## User Stories

### P1: O documento não aceita o que não sabe representar ⭐ MVP

**User Story**: Como usuário, quero que uma resposta estranha do agente ou um
payload malformado não corrompa a Tela em que estou trabalhando.

**Why P1**: Um log envenenado não tem recuperação pela UI: todo `view` seguinte
devolve lixo, e com DSF-R7 o lixo passa a sobreviver ao restart.

**Acceptance Criteria**:

1. WHEN um `Command` com `type` fora da união chega em `designStudio:dispatch`
   THEN o sistema SHALL devolver `OperationError { scope: 'io', retryable: false }`
   — e SHALL NOT empilhar nada no log.
2. WHEN `applyCommand` recebe qualquer valor THEN ele SHALL devolver um
   `ScreenDocument` — e SHALL NOT devolver `undefined` sob nenhuma entrada.
3. WHEN `validate()` recebe um `Command` de `type` desconhecido THEN ele SHALL
   devolver `CapabilityViolation` — e SHALL NOT devolver `null`.
4. WHEN um `AddComponent` com `parentId: null` é despachado numa Tela cuja raiz
   já existe THEN o sistema SHALL devolver `CapabilityViolation` e o documento
   SHALL ficar byte-a-byte inalterado.
5. WHEN um lote contém dois nós com o mesmo `id`, ou um `id` fora do formato,
   THEN **nenhum** `Command` do lote SHALL ser despachado e um único
   `CapabilityViolation` SHALL nomear o id ofensor.
6. WHEN o receptor procura um nó por id THEN ele SHALL usar uma busca que não
   interpola o id em seletor CSS.

**Independent Test**: despachar `{ type: 'Frobnicate' }` → `OperationError`,
`view()` seguinte devolve o mesmo documento de antes. Despachar um lote com id
`a"]` → recusado, árvore intacta.

---

### P1: Um cursor de undo, não dois ⭐ MVP

**User Story**: Como usuário, quero que o botão desfazer, o marcador "editada" e
o "↩ desfazer este turno" concordem sempre — inclusive quando algo falha.

**Why P1**: Hoje o renderer avança o próprio cursor antes de saber se o main
avançou o dele. Divergiram, a UI mente sobre o histórico.

**Acceptance Criteria**:

1. WHEN o main devolve uma `ScreenView` THEN ela SHALL carregar também o
   `groupId` do passo desfazível e se a Tela já recebeu algum `Command`.
2. WHEN o renderer precisa saber a posição no histórico THEN ele SHALL ler a
   `ScreenView` — e SHALL NOT manter array de passos nem cursor próprio.
3. WHEN uma chamada de undo/redo falha THEN a UI SHALL continuar refletindo o
   estado que o main de fato tem.
4. WHEN o transcript de uma Tela é lido THEN ele SHALL continuar preservado ao
   trocar de Tela e voltar (DS-R10 AC-7 segue valendo).

**Independent Test**: forçar a rejeição de `designStudio:undo` → o marcador
"editada", o `canUndo` da toolbar e o "desfazer este turno" continuam
descrevendo o log real do main.

---

### P1: Ler não cria estado ⭐ MVP

**User Story**: Como usuário, quero que exportar uma Tela que o Studio não
conhece me diga isso, em vez de me entregar um arquivo vazio.

**Acceptance Criteria**:

1. WHEN `view`/`undo`/`redo`/`export` recebem uma chave que nunca foi aberta
   THEN o sistema SHALL devolver `OperationError` — e SHALL NOT criar entrada.
2. WHEN uma aba do Studio fecha THEN o estado por Tela daquela aba SHALL ser
   liberado no main e a sessão de Preview SHALL ser encerrada.
3. WHEN uma Tela é aberta pela primeira vez THEN ela SHALL ser criada por uma
   chamada explícita de abertura, não como efeito de uma leitura.

**Independent Test**: `export` com uma chave inventada → `OperationError`, zero
arquivos escritos, zero entradas criadas no serviço.

---

### P1: A sessão sobrevive ao restart ⭐ MVP

**User Story**: Como PM/UX, quero fechar o Hive e reencontrar as Telas como eu as
deixei.

**Why P1**: É a P2 da M18, publicada e nunca ligada. Sem ela, uma tarde de
iteração morre com o processo.

**Acceptance Criteria**:

1. WHEN uma Tela recebe um `Command` ou uma mensagem de chat THEN o sistema SHALL
   persistir a sessão em `userData`, chaveada por `(specPathHash, workspaceHash)`,
   com escrita write-temp-then-rename.
2. WHEN a mesma Spec é reaberta no mesmo workspace THEN o log de cada Tela, o
   transcript de cada Tela e a Tela ativa SHALL ser restaurados.
3. WHEN a sessão é restaurada THEN cada `Command` do log SHALL passar por
   `validate()` na ordem antes de compor o documento; o primeiro que falhar
   SHALL truncar o log ali, e a Tela SHALL sinalizar que foi truncada.
4. WHEN o arquivo de sessão é corrompido, estranho ou de forma inesperada em
   qualquer nível THEN o sistema SHALL abrir como sessão nova — e SHALL NOT
   derrubar a aba.
5. WHEN o `dsId` gravado difere do Adaptador ativo THEN a sessão SHALL ser
   tratada como nova (DS-R12: Telas não migram).
6. WHEN o Studio roda THEN ele SHALL NOT escrever nada no workspace do usuário.
7. WHEN o preset de viewport, a seleção, o zoom ou o Modo Foco mudam THEN nada
   SHALL ser persistido.

**Independent Test**: editar duas Telas, conversar numa delas, fechar o app,
reabrir a mesma Spec → árvores, transcripts e Tela ativa como deixados; alterar
um byte do JSON para um `Command` inválido → sessão abre truncada no ponto certo,
com aviso, sem exceção.

---

### P1: Falhas que aparecem ⭐ MVP

**User Story**: Como usuário, quero que uma operação que não deu certo me diga
isso, em vez de ficar girando.

**Acceptance Criteria**:

1. WHEN o usuário limpa uma prop de enum no Inspetor THEN o controle SHALL
   passar a não exibir valor algum — e o `Select` SHALL permanecer controlado
   (nenhum aviso de controlled/uncontrolled em teste).
2. WHEN o usuário para um turno da Skill THEN o turno SHALL ser interrompido no
   agente e a inscrição de eventos SHALL ser desfeita.
3. WHEN um turno não emite nenhum `AgentEvent` por 120 s THEN o sistema SHALL
   encerrá-lo como `OperationError { scope: 'agent', retryable: true }`.
4. WHEN qualquer chamada IPC do Studio rejeita THEN a superfície SHALL renderizar
   um `OperationError` — e SHALL NOT produzir rejeição não tratada.
5. WHEN uma exportação falha no rename THEN nenhum arquivo `.tmp` SHALL
   permanecer no diretório escolhido.

**Independent Test**: um turno mockado que nunca emite `done` → após o prazo, o
chat mostra erro com **Tentar de novo**; suíte roda sem warning de React e sem
`unhandledRejection`.

---

### P2: A detecção lista tudo que reconhece

**User Story**: Como PM/UX, quero ver todas as Telas da minha Spec, mesmo quando
ela mistura cabeçalhos e tabela de IA.

**Acceptance Criteria**:

1. WHEN uma Spec contém Telas reconhecíveis por mais de uma sonda THEN o
   resultado SHALL conter as Telas de **todas** as sondas.
2. WHEN duas sondas nomeiam a mesma Tela THEN ela SHALL aparecer uma vez só, e a
   ordem SHALL ser estável e documentada.
3. WHEN nenhuma sonda encontra nada THEN o estado vazio SHALL continuar nomeando
   todas as sondas tentadas.

**Independent Test**: uma Spec com 2 Telas em cabeçalhos e 3 na tabela de IA,
sendo 1 repetida → 4 entradas, sem duplicata.

---

### P2: Um só contrato para o canal do Preview

**Acceptance Criteria**:

1. WHEN qualquer módulo precisa validar o formato do token THEN ele SHALL usar a
   constante compartilhada — e SHALL NOT declarar a própria expressão.
2. WHEN o receptor recebe uma mensagem THEN ele SHALL exigir que a origem seja a
   janela pai **e** que o nonce bata, simetricamente ao que o pai já faz.

---

### P3: Os documentos batem com o código

**Acceptance Criteria**:

1. WHEN um número aparece em mais de um documento da M18 THEN ele SHALL ser o
   mesmo em todos.
2. WHEN um comentário descreve a cobertura de um controle THEN ele SHALL
   descrever a cobertura que o controle tem.
3. WHEN um requisito está fora de escopo por decisão THEN ele SHALL estar
   registrado em `STATE.md` com o motivo.

---

## Edge Cases

- WHEN a sessão em disco tem uma Tela que a Spec não descreve mais THEN essa
  Tela SHALL ser descartada e as demais restauradas.
- WHEN o log restaurado é truncado por um `Command` inválido THEN o cursor SHALL
  ficar no fim do trecho válido e o redo SHALL ficar indisponível.
- WHEN duas janelas do app abrem a mesma Spec THEN a última escrita vence, e uma
  escrita não SHALL corromper o arquivo da outra (temp+rename já garante).
- WHEN o disco está cheio ou sem permissão na hora de salvar a sessão THEN a
  edição SHALL continuar funcionando em memória e o erro SHALL aparecer uma vez,
  não a cada tecla.
- WHEN um turno da Skill é parado e outro é iniciado em seguida THEN só o novo
  SHALL ter inscrição viva no agente.
- WHEN o id de um nó tem exatamente 64 caracteres THEN ele SHALL ser aceito (o
  limite é inclusivo).
- WHEN um lote vazio chega do chat THEN ele SHALL continuar sendo um turno sem
  efeito, sem passo de undo e sem escrita de sessão.

---

## Requirement Traceability

| ID | Achados | Story | Fase | Status |
| --- | --- | --- | --- | --- |
| DSF-R1 | AR-5 | Documento | F1 | Pending |
| DSF-R2 | AR-4 | Documento | F1 | Pending |
| DSF-R3 | AR-9, AR-10 | Documento | F1 | Pending |
| DSF-R4 | AR-3 | Um cursor | F2 | Pending |
| DSF-R5 | AR-16 | Ler não cria estado | F2 | Pending |
| DSF-R6 | AR-13, AR-14 | Canal do Preview | F2 | Pending |
| DSF-R7 | AR-1, AR-2 | Sessão | F3 | Pending |
| DSF-R8 | AR-19 | Sessão | F3 | Pending |
| DSF-R9 | AR-11 | Falhas visíveis | F4 | Pending |
| DSF-R10 | AR-14 | Falhas visíveis | F4 | Pending |
| DSF-R11 | AR-17 | Falhas visíveis | F4 | Pending |
| DSF-R12 | AR-10 | Detecção | F4 | Pending |
| DSF-R13 | AR-18 | Falhas visíveis | F4 | Pending |
| DSF-R14 | AR-2, AR-6..8, AR-20, AR-21 | Documentos | F5 | Pending |

**Cobertura:** 14 requisitos, 14 mapeados a fases. 0 sem mapeamento.
**Achados cobertos:** 16 corrigidos, 4 registrados como risco aceito (AR-6, AR-7,
AR-8, AR-20), 0 ignorados.

---

## Success Criteria

- [ ] Fechar o app com duas Telas editadas e uma conversa, reabrir a Spec e
      reencontrar tudo — sem tocar em terminal.
- [ ] `npm run verify` verde, sem regressão contra o baseline de **3361 testes /
      203 arquivos**.
- [ ] Nenhum `Command` fora da união consegue entrar num log, provado por teste
      de fronteira e por mutação.
- [ ] O renderer não contém cursor de undo próprio, provado por guard no molde de
      `moduleBoundaries.test.ts`.
- [ ] A suíte roda sem warning de controlled/uncontrolled e sem rejeição não
      tratada.
- [ ] Passe visual nos três temas e Verificador independente (autor ≠
      verificador) com veredito por AC.
