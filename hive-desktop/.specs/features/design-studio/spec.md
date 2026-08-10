# Spec — `design-studio` (M18)

Hoje uma Spec de UX (a saída do fluxo `bmad-ux`) só existe como texto. Para
saber se a composição, a hierarquia e o fluxo de uma Tela fazem sentido, o
usuário precisa investir horas de Figma **antes** de ter qualquer sinal. O
Design Studio inverte isso: pega a Spec de UX, gera Telas navegáveis com um
design system real de web components, deixa o usuário editar direto (Inspetor,
Árvore, Chat) e só então exporta um Bundle para o Figma Agent — o trabalho de
Figma começa depois da ideia pressão-testada, não antes.

**Contrato canônico:** `_bmad-output/specs/spec-design-studio/SPEC.md` +
companions (`glossary.md`, `stack.md`, `architecture-decisions.md`,
`architecture-diagrams.md`). Este arquivo é a projeção desse contrato no
vocabulário `tlc-spec-driven` (requisitos rastreáveis, AC testáveis). Onde
divergirem, o SPEC canônico vence.

## Problema

1. **O custo de descobrir que a ideia estava errada é pago no Figma.** Estrutura
   e fluxo são exatamente o que um mockup de baixa fidelidade resolveria — mas o
   único artefato "em pé" que o time produz hoje é de alta fidelidade e caro.
2. **A Spec de UX morre como texto.** Ela descreve N Telas em prosa e ninguém
   nunca as vê juntas; a validação vira leitura, não uso.
3. **Trocar de design system seria uma reescrita.** Qualquer protótipo acoplado
   a uma biblioteca específica joga fora o trabalho quando a empresa apontar
   para o DS interno.

## Requisitos

Rastreamento 1:1 com as capabilities do SPEC canônico (CAP-N ⇄ DS-RN).

- **DS-R1 — Abrir uma Spec de UX (CAP-1).** Uma Spec de UX do workspace abre
  como aba `design-studio` no painel viewer. Todas as Telas reconhecidas são
  listadas **antes** de qualquer Preview ser gerado. Spec sem Tela reconhecível
  produz um estado vazio que explica o que faltou — nunca uma tela em branco.
- **DS-R2 — Geração automática (CAP-2).** A Skill de Design System gera, por
  Tela, uma Árvore de Componentes inicial usando **exclusivamente** o catálogo
  do Adaptador ativo. Toda a espera assíncrona é coberta por estado de
  carregamento visível.
- **DS-R3 — Viewport (CAP-3).** Presets mobile/tablet/desktop + tamanho
  customizado. Trocar preset não perde estado de edição; o preset ativo é
  visível sem abrir menu.
- **DS-R4 — Navegação entre Telas (CAP-4).** Seletor dedicado; cada Tela mantém
  Árvore e histórico de chat independentes. O seletor distingue Telas já
  editadas nesta sessão das ainda auto-geradas.
- **DS-R5 — Seleção de Componente (CAP-5).** Clique em qualquer Componente
  renderizado, inclusive aninhado, sem troca de "modo". Seleção única (sem
  multi-seleção na v1).
- **DS-R6 — Inspetor de Propriedades (CAP-6).** Cada prop editável corresponde a
  uma prop real aceita pelo Componente no DS ativo. Mudança inválida é rejeitada
  com feedback — nunca aplicada em silêncio.
- **DS-R7 — Edição da Árvore (CAP-7).** Adicionar exige escolher entre os
  Componentes do Adaptador ativo; remover/mover atualiza Preview e Árvore de
  forma consistente e reversível.
- **DS-R8 — Reflexo imediato (CAP-8).** Toda edição (Inspetor, Árvore, Chat)
  aparece no Preview sem ação de "aplicar"/"salvar" e sem reload completo.
- **DS-R9 — Desfazer/refazer (CAP-9).** Um log linear por Tela. Desfazer uma
  mudança do Chat reverte exatamente aquele turno, agrupado, sem afetar edições
  manuais feitas depois.
- **DS-R10 — Chat de Iteração Visual (CAP-10).** Pedido em linguagem natural
  sobre a Tela ativa ou o Componente selecionado. Havendo seleção no envio, o
  pedido é interpretado nesse contexto por padrão. O histórico persiste na
  sessão da Tela e reaparece ao voltar a ela.
- **DS-R11 — Aplicar mudanças da Skill (CAP-11).** `Command[]` da Skill vira
  lote tudo-ou-nada, sujeito a desfazer. Se o pedido não couber no DS
  configurado, a Skill explica a limitação em vez de aplicar mudança parcial.
- **DS-R12 — DS configurável (CAP-12).** Config central resolve qual pacote de
  DS o Studio usa. Trocar o DS não toca Preview/Inspetor/Árvore. Telas já
  criadas não migram automaticamente.
- **DS-R13 — Catálogo (CAP-13).** O catálogo do DS ativo é a única fonte de
  verdade, tanto para a geração automática quanto para a edição manual.
- **DS-R14 — Bundle de Exportação (CAP-14).** Qualquer Tela, em qualquer estado
  de edição, gera um HTML autocontido (CSS + assets inline, zero rede). Exportar
  não altera o estado de edição.
- **DS-R15 — Export em lote (CAP-15).** Múltiplas Telas selecionadas geram
  Bundles independentes; a falha de uma não impede as demais.

Requisitos de superfície, derivados das Constraints do SPEC e do
`PRODUCT.md`/`DESIGN.md` do app:

- **DS-R16 — A Bancada.** O Studio é um palco: Preview flutuando numa área
  neutra com moldura de dispositivo, Telas+Árvore à esquerda, Inspetor à
  direita, Chat numa faixa inferior colapsável. Como a aba vive no painel
  `viewer` (≈44% da janela por padrão), o Studio expõe **Modo Foco**, que
  colapsa rail e chat do app e devolve a janela inteira ao palco.
- **DS-R17 — Duas formas de falha, nunca uma terceira.**
  `CapabilityViolation` (mismatch de catálogo, renderizado igual no Inspetor e
  no Chat) e `OperationError { scope, message, retryable }` (agente
  indisponível, asset do Preview, I/O de export). Nada de forma ad hoc.
- **DS-R18 — Piso do app.** Toda copy em pt-BR via `t()`; contraste AA nos dois
  temas; `prefers-reduced-motion` em toda animação; operabilidade completa por
  teclado (seleção, árvore, inspetor, chat).

## Fora de escopo

| Item | Motivo |
| --- | --- |
| Substituir o Figma / fidelidade pixel-perfect | Valida estrutura, fluxo e composição — não o artefato de marca |
| Construtor de UI genérico (HTML/CSS livre) | Renderiza só Componentes do Adaptador ativo (SPEC Non-goals) |
| Colaboração multi-usuário na mesma Tela | v1 é sessão local, um usuário por vez |
| Acionar o Figma Agent / criar telas no Figma | Produz só o Bundle; a integração é externa |
| Migração automática de Telas ao trocar de DS | SPEC Non-goals — trocar Adaptador não migra documento |
| Histórico de versões entre sessões | Undo/redo é local por sessão, via replay do log |
| Mudar o fluxo `bmad-ux` ou seu formato de saída | Spec de UX é **somente leitura** para o Studio |
| Multi-seleção de Componentes | Explícito no CAP-5 (v1 = seleção única) |

---

## Assumptions & Open Questions

| Assunção / decisão | Default escolhido | Racional | Confirmado? |
| --- | --- | --- | --- |
| Formato do Bundle (SPEC OQ-1: contrato do Figma Agent indefinido) | **HTML vivo**: um `.html` autocontido por Tela, bundle Web Awesome + CSS + assets inline, shadow DOM intacto | É o que o SPEC assume e o único caminho que honra AD-6 (um renderizador só). Um achatador é aditivo depois, não uma reescrita | **y** (usuário, 2026-08-09) |
| Escopo da entrega | **M18 inteira**, CAP-1..15, em 7 fases sequenciais | Mantém o padrão M10–M17 (milestone completa, verify verde, passe visual) e evita um meio-termo sem valor de uso | **y** (usuário, 2026-08-09) |
| Layout | **Bancada** — palco central + Modo Foco | Preview vira objeto, não painel; vocabulário Figma/Framer que o público-alvo já tem | **y** (usuário, 2026-08-09) |
| Origem do catálogo (DS-R13) | Derivado do `custom-elements.json` (CEM) que o pacote publica, congelado em JSON versionado no build | Verificado: `@awesome.me/webawesome@3.11.0` publica `dist/custom-elements.json` com nome, atributos **e tipos** (`'neutral' \| 'brand' \| …`, `boolean`, `string`) + slots. Torna DS-R13 mecanicamente verdadeiro em vez de aspiracional | n (decisão de design) |
| Profundidade do isolamento (SPEC OQ-2) | `sandbox="allow-scripts"` sem `allow-same-origin` + CSP própria com `connect-src 'none'`, conforme AD-5 | AD-4/5/7 já fecham as três lacunas concretas. Revisão de segurança dedicada fica como tarefa de fechamento da fase 3, não como bloqueio de design | n |
| Reuso do versionamento do Second Brain (SPEC OQ-3) | **Não** na v1 | SPEC Non-goals já exclui histórico entre sessões; reavaliar após uso real | n |
| Metas numéricas (SPEC OQ-4) | Não definidas nesta v1 | Calibrar após o primeiro ciclo real — a milestone não depende disso | n |
| Como o usuário abre o Studio | Ação no menu de contexto do Explorer sobre um `.md` + entrada na paleta (Ctrl+P) | Segue o padrão de `openDiff`/`openReviewDiff`: quem abre a aba é a superfície que já tem o arquivo em mãos | n (decisão de design) |
| Tamanho do bundle do DS em `resources/` | ~7 MB (`dist/` do Web Awesome), `asarUnpack`'d | `resources/**` já é unpack'd; o payload do app é hospedado em GitHub Releases (D21), então o peso não toca o limite do npm | n (decisão de design) |

**Open questions:** nenhuma bloqueante — todas resolvidas acima ou registradas
como assunção com default explícito.

---

## User Stories

### P1: Abrir a Spec e ver as Telas ⭐ MVP

**User Story**: Como PM/UX, quero abrir uma Spec de UX e ver todas as Telas que
ela descreve, para saber o que vou validar antes de qualquer geração.

**Why P1**: É a porta de entrada; sem ela nada mais acontece.

**Acceptance Criteria**:

1. WHEN o usuário aciona "Abrir no Design Studio" sobre um `.md` do workspace
   THEN o sistema SHALL abrir uma aba de kind `design-studio` no painel viewer,
   rotulada com o basename do arquivo.
2. WHEN a Spec é lida THEN o sistema SHALL listar **todas** as Telas
   reconhecidas no seletor **antes** de disparar qualquer geração de Preview.
3. WHEN a Spec não contém nenhuma Tela reconhecível THEN o sistema SHALL
   renderizar um estado vazio nomeando o que procurou e como corrigir — e SHALL
   NOT renderizar um palco em branco.
4. WHEN a mesma Spec já tem uma aba aberta THEN o sistema SHALL focar a aba
   existente em vez de abrir uma segunda.
5. WHEN o arquivo não existe ou não pode ser lido THEN o sistema SHALL exibir um
   `OperationError` com `retryable: true`.

**Independent Test**: abrir uma Spec com 3 Telas → 3 entradas no seletor, zero
chamadas de agente disparadas. Abrir um `.md` sem Telas → estado vazio com
instrução.

---

### P1: Preview isolado, vivo e imediato ⭐ MVP

**User Story**: Como usuário, quero ver a Tela renderizada com componentes reais
e ver minhas edições aparecerem na hora.

**Why P1**: É o produto. Sem Preview não há validação.

**Acceptance Criteria**:

1. WHEN o Preview carrega THEN o sistema SHALL usar um `<iframe>` com
   `sandbox="allow-scripts"` **sem** `allow-same-origin`, apontado por `src` a
   uma URL `hive-studio://` — e SHALL NOT usar `srcDoc`.
2. WHEN o protocolo responde THEN a resposta SHALL carregar `Content-Security-Policy`
   própria contendo no mínimo `connect-src 'none'`, `script-src 'self'`.
3. WHEN um `Command` é aplicado ao documento THEN o Preview SHALL ser atualizado
   por `postMessage` same-origin — e SHALL NOT renavegar o iframe.
4. WHEN o receptor in-frame constrói DOM THEN ele SHALL usar `createElement` +
   atribuição de propriedade/atributo — e SHALL NOT usar `innerHTML` nem markup
   interpolado.
5. WHEN uma prop URL-shaped (`href`/`src`) tem esquema fora da allowlist
   (`https:`, `http:`, `data:image/*`) THEN o sistema SHALL rejeitar como
   `CapabilityViolation` antes de atribuir.
6. WHEN o token de sessão da URL do Preview é gerado THEN ele SHALL ser
   aleatório e não-adivinhável, distinto da chave de disco `(specPathHash, workspaceHash)`.
7. WHEN o bundle do DS falha ao carregar THEN o sistema SHALL exibir um
   `OperationError` no palco com ação de repetir.

**Independent Test**: aplicar um `SetProp` e medir que o iframe não renavegou
(mesmo `contentWindow`), mas o DOM mudou. Injetar `href: 'javascript:alert(1)'`
→ rejeitado com `CapabilityViolation`, nada atribuído.

---

### P1: Documento por Comandos, com desfazer ⭐ MVP

**User Story**: Como usuário, quero desfazer qualquer edição — minha ou do chat
— com confiança de que volta exatamente um passo.

**Why P1**: Sem undo confiável, editar dá medo e o chat vira risco.

**Acceptance Criteria**:

1. WHEN qualquer superfície muda uma Tela THEN a mudança SHALL passar por um
   `Command` do vocabulário fechado (`AddComponent`/`RemoveComponent`/`MoveComponent`/`SetProp`)
   aplicado pelo reducer único — e SHALL NOT mutar a árvore diretamente.
2. WHEN um `SetProp` é construído THEN ele SHALL carregar exatamente uma mudança
   de campo (`{ componentId, key, value }`) — e SHALL NOT carregar um bag de props.
3. WHEN o reducer recebe um `Command` THEN ele SHALL aplicá-lo sem validar — a
   validação SHALL acontecer em `DesignSystemAdapter.validate()` antes do dispatch.
4. WHEN o usuário desfaz THEN o sistema SHALL recompor o documento por replay do
   log desde a origem até o cursor — e SHALL NOT ler um snapshot persistido.
5. WHEN um turno de chat emitiu N `Command`s THEN desfazer uma vez SHALL reverter
   os N como um único passo agrupado.
6. WHEN o usuário desfaz um turno de chat e depois já havia feito edições manuais
   posteriores THEN essas edições manuais SHALL permanecer intactas.
7. WHEN o usuário refaz THEN o cursor SHALL avançar exatamente um passo agrupado.
8. WHEN uma nova edição é feita com o cursor no meio do log THEN o sistema SHALL
   truncar o ramo de refazer.

**Independent Test**: log com [manual, chat(3 cmds), manual] → um undo remove só
o último manual; o segundo undo remove os 3 do chat de uma vez.

---

### P1: Catálogo e Adaptador de Design System ⭐ MVP

**User Story**: Como time, quero que trocar o DS seja configuração, não
reescrita.

**Why P1**: É a peça que sustenta o módulo no longo prazo (SPEC "Why").

**Acceptance Criteria**:

1. WHEN qualquer camada (Preview, Inspetor, Árvore, prompt da Skill, Export)
   precisa saber que Componentes/props existem THEN ela SHALL ler
   `DesignSystemAdapter.catalog()` — e SHALL NOT importar um pacote de DS.
2. WHEN o catálogo é construído THEN ele SHALL derivar do `custom-elements.json`
   do pacote, expondo por Componente: tag, props com **tipo** (enum/boolean/
   string/number), e slots.
3. WHEN a geração automática (DS-R2) e a edição manual (DS-R6/R7) consultam o
   que é válido THEN ambas SHALL usar a mesma função de validação.
4. WHEN um `Command` referencia um Componente ou prop fora do catálogo ativo
   THEN `validate()` SHALL retornar `CapabilityViolation { componentId, reason, attemptedValue? }`.
5. WHEN o DS configurado muda THEN Preview, Inspetor e Árvore SHALL continuar
   funcionando sem alteração de código — e Telas já criadas SHALL NOT migrar.
6. WHEN o app inicia THEN o Adaptador ativo SHALL ser resolvido uma vez pelo
   registry — e SHALL NOT ser re-resolvido por Tela.

**Independent Test**: um teste de fronteira falha se qualquer arquivo fora de
`main/designStudio/dsAdapter/` importar `@awesome.me/webawesome`.

---

### P1: A Bancada — palco, Telas, viewport, seleção ⭐ MVP

**User Story**: Como usuário, quero navegar Telas e tamanhos de dispositivo sem
perder onde eu estava.

**Why P1**: É a navegação básica do módulo.

**Acceptance Criteria**:

1. WHEN o usuário troca o preset de viewport THEN o estado de edição da Tela
   SHALL permanecer intacto e o preset ativo SHALL estar visível sem abrir menu.
2. WHEN o usuário troca de Tela e volta THEN a Árvore, o histórico de chat e a
   posição de undo daquela Tela SHALL estar como ele deixou.
3. WHEN uma Tela já recebeu ao menos um `Command` do usuário nesta sessão THEN o
   seletor SHALL marcá-la como editada, distinta das ainda auto-geradas.
4. WHEN o usuário clica num Componente renderizado, inclusive aninhado, THEN ele
   SHALL ficar selecionado sem exigir troca de modo, substituindo a seleção anterior.
5. WHEN há seleção THEN Preview e Árvore SHALL refletir a mesma seleção nos dois
   sentidos (clicar no Preview destaca na Árvore e vice-versa).
6. WHEN o preset de viewport ou a seleção mudam THEN eles SHALL NOT entrar no log
   de undo nem na persistência de sessão.
7. WHEN o usuário aciona Modo Foco THEN o palco SHALL ocupar a janela inteira, e
   sair do Modo Foco SHALL restaurar a distribuição anterior dos painéis.

**Independent Test**: editar Tela A, ir para B, voltar para A → árvore, chat e
undo preservados; recarregar a janela → preset volta ao default, edição não.

---

### P1: Inspetor de Propriedades ⭐ MVP

**User Story**: Como usuário, quero editar as props do Componente selecionado e
ver o resultado na hora.

**Why P1**: É a edição fina que o chat não substitui.

**Acceptance Criteria**:

1. WHEN um Componente é selecionado THEN o Inspetor SHALL listar exclusivamente
   props que o catálogo declara para aquele Componente.
2. WHEN uma prop é do tipo enum THEN o controle SHALL ser um seletor com
   exatamente os valores do catálogo; boolean → switch; string/number → campo.
3. WHEN o usuário muda um valor THEN o sistema SHALL despachar **um** `SetProp` e
   o Preview SHALL refletir sem ação de aplicar/salvar.
4. WHEN o valor é inválido para o catálogo THEN o sistema SHALL renderizar o
   `CapabilityViolation` no campo — e SHALL NOT aplicar a mudança.
5. WHEN nenhum Componente está selecionado THEN o Inspetor SHALL mostrar um
   estado vazio que ensina como selecionar.

**Independent Test**: selecionar um `wa-button` → o Inspetor oferece
`variant` com exatamente `neutral|brand|success|warning|danger`. Forçar
`variant: 'roxo'` → rejeitado com feedback no campo, documento inalterado.

---

### P1: Árvore de Componentes editável ⭐ MVP

**User Story**: Como usuário, quero adicionar, remover e mover Componentes.

**Why P1**: Estrutura é metade do que se valida numa Tela.

**Acceptance Criteria**:

1. WHEN o usuário adiciona um Componente THEN o sistema SHALL exigir escolha
   entre os Componentes do catálogo ativo.
2. WHEN o usuário remove ou move THEN Preview e Árvore SHALL ficar consistentes
   na mesma atualização, e a ação SHALL ser reversível por undo.
3. WHEN um move produziria um ciclo (mover um nó para dentro de si) THEN o
   sistema SHALL rejeitar antes do dispatch.
4. WHEN um Componente é adicionado num slot THEN o slot SHALL ser um dos slots
   declarados no catálogo para o Componente pai.
5. WHEN o Componente removido era o selecionado THEN a seleção SHALL ser limpa.

**Independent Test**: mover um nó para dentro de um descendente → rejeitado,
árvore intacta.

---

### P1: Chat de Iteração Visual ⭐ MVP

**User Story**: Como usuário, quero pedir mudanças em português e vê-las
aplicadas — como iterar num artifact, só que a Tela é real.

**Why P1**: É o diferencial do módulo sobre "um editor de árvore".

**Acceptance Criteria**:

1. WHEN o usuário envia um pedido com um Componente selecionado THEN a Skill
   SHALL receber esse Componente como contexto padrão do pedido.
2. WHEN a Skill responde THEN o sistema SHALL parsear a resposta em `Command[]` —
   e SHALL NOT aceitar markup como resposta.
3. WHEN qualquer `Command` do lote falha a validação THEN **nenhum** SHALL ser
   despachado e um único `CapabilityViolation` SHALL ser devolvido ao chat.
4. WHEN o lote inteiro é válido THEN ele SHALL ser despachado e empilhado como um
   único passo de undo.
5. WHEN a Skill não consegue cumprir o pedido dentro do DS ativo THEN ela SHALL
   explicar a limitação — e SHALL NOT aplicar mudança parcial.
6. WHEN a sessão de agente falha ou expira THEN o sistema SHALL exibir
   `OperationError` com `retryable: true` no chat.
7. WHEN o usuário volta a uma Tela THEN o transcript daquela Tela SHALL
   reaparecer.
8. WHEN a Skill fala com o agente THEN ela SHALL usar só `AgentSession`/`AgentEvent` —
   e SHALL NOT ramificar por `agentId`.

**Independent Test**: um lote de 3 Commands onde o 2º é inválido → documento
byte-a-byte inalterado, um `CapabilityViolation` no chat.

---

### P1: Bundle de Exportação ⭐ MVP

**User Story**: Como usuário, quero exportar a Tela validada para alimentar o
Figma Agent.

**Why P1**: É o fim da linha do fluxo — o "success signal" do SPEC mede
exatamente isto.

**Acceptance Criteria**:

1. WHEN o usuário exporta uma Tela THEN o sistema SHALL produzir um HTML
   autocontido (CSS e assets inline, componentes vivos), sem dependência de rede.
2. WHEN o Bundle é gerado THEN ele SHALL vir de `DesignSystemAdapter.renderToStaticHtml()` —
   e SHALL NOT vir de um segundo gerador de markup.
3. WHEN o export roda THEN o estado de edição da Tela e da sessão SHALL ficar
   inalterado.
4. WHEN o usuário seleciona várias Telas THEN cada uma SHALL gerar seu próprio
   Bundle independente.
5. WHEN a exportação de uma Tela falha THEN as demais SHALL continuar, e a falha
   SHALL ser reportada como `OperationError` escopado àquela Tela.
6. WHEN o Bundle é aberto sem rede THEN ele SHALL renderizar idêntico ao Preview.

**Independent Test**: exportar 3 Telas com a do meio forçada a falhar → 2
arquivos escritos, 1 erro reportado, nenhuma exceção não tratada.

---

### P2: Sessão persistida

**User Story**: Como usuário, quero fechar o app e reencontrar minha sessão.

**Acceptance Criteria**:

1. WHEN uma sessão existe THEN documento (log de `Command`), transcript por Tela
   e Tela ativa SHALL persistir em um JSON por sessão no `userData`, chaveado por
   `(specPathHash, workspaceHash)`.
2. WHEN a escrita acontece THEN ela SHALL ser write-temp-then-rename.
3. WHEN o arquivo de sessão está corrompido THEN o sistema SHALL tratar como
   sessão nova — e SHALL NOT derrubar a aba.
4. WHEN o Studio roda THEN ele SHALL NOT escrever nada no workspace do usuário; a
   Spec de UX SHALL ser somente leitura.

---

### P3: Modo Foco lembrado

**Acceptance Criteria**:

1. WHEN o usuário sai do Modo Foco THEN a distribuição anterior dos painéis SHALL
   ser restaurada exatamente.

---

## Edge Cases

- WHEN a Spec de UX descreve 1 Tela só THEN o seletor SHALL aparecer mesmo assim,
  com uma entrada (sem caso especial escondido).
- WHEN a Spec descreve mais de 20 Telas THEN o seletor SHALL rolar sem quebrar o
  layout do palco.
- WHEN a Skill devolve `Command[]` vazio THEN o sistema SHALL tratar como turno
  sem efeito, sem empilhar passo de undo.
- WHEN a Skill devolve JSON malformado THEN o sistema SHALL reportar
  `OperationError` (não `CapabilityViolation` — não é mismatch de catálogo).
- WHEN o usuário desfaz até a origem THEN o Preview SHALL mostrar o documento
  vazio da Tela e o botão desfazer SHALL ficar desabilitado.
- WHEN o documento fica sem nenhum Componente THEN o palco SHALL mostrar um vazio
  que ensina a adicionar o primeiro Componente.
- WHEN o arquivo da Spec muda em disco com a aba aberta THEN o Studio SHALL
  manter a sessão atual (a Spec é somente leitura e já foi consumida) e sinalizar
  que a origem mudou.
- WHEN duas abas do Studio apontam para a mesma Spec THEN o sistema SHALL focar a
  existente (DS-R1 AC-4), impedindo duas sessões concorrentes sobre o mesmo JSON.
- WHEN uma prop de enum recebe `null`/vazio THEN o sistema SHALL tratar como
  "remover a prop", não como valor inválido.
- WHEN o Componente selecionado é removido pelo chat THEN a seleção SHALL ser
  limpa antes do Preview atualizar.

---

## Requirement Traceability

| ID | CAP | Story | Fase | Status |
| --- | --- | --- | --- | --- |
| DS-R1 | CAP-1 | Abrir a Spec | F4 | Done (F4) |
| DS-R2 | CAP-2 | Chat/Skill | F6 | Pending |
| DS-R3 | CAP-3 | A Bancada | F4 | Done (F4) |
| DS-R4 | CAP-4 | A Bancada | F4 | Done (F4) |
| DS-R5 | CAP-5 | A Bancada | F5 | Pending |
| DS-R6 | CAP-6 | Inspetor | F5 | Pending |
| DS-R7 | CAP-7 | Árvore | F5 | Pending |
| DS-R8 | CAP-8 | Preview | F3 | Pending |
| DS-R9 | CAP-9 | Documento | F1 | Pending |
| DS-R10 | CAP-10 | Chat/Skill | F6 | Pending |
| DS-R11 | CAP-11 | Chat/Skill | F6 | Pending |
| DS-R12 | CAP-12 | Catálogo | F2 | Pending |
| DS-R13 | CAP-13 | Catálogo | F2 | Pending |
| DS-R14 | CAP-14 | Export | F7 | Pending |
| DS-R15 | CAP-15 | Export | F7 | Pending |
| DS-R16 | — | A Bancada | F4 | Done (F4) |
| DS-R17 | — | transversal | F1–F7 | Pending |
| DS-R18 | — | transversal | F4–F7 | Pending |

**Cobertura:** 18 requisitos, 18 mapeados a fases. 0 sem mapeamento.

---

## Success Criteria

- [ ] Uma Spec de UX real do repositório abre, gera Telas e exporta um Bundle sem
      o usuário tocar em terminal.
- [ ] `npm run verify` verde, sem regressão contra o baseline (2548 testes /
      159 arquivos em M17).
- [ ] Teste de fronteira: nenhum arquivo fora de `dsAdapter/` importa o pacote do
      DS; nenhuma camada muta o documento fora do reducer.
- [ ] Passe visual nos temas escuro e claro sobre o app real; sweep de contraste
      E2E cobrindo o palco, o Inspetor, a Árvore e o Chat.
- [ ] O Bundle exportado abre num navegador sem rede e renderiza idêntico ao
      Preview.
