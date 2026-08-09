---
title: Design Studio
status: draft
created: 2026-08-08
updated: 2026-08-09
---

# PRD: Design Studio
*Working title — confirmar.*

## 0. Propósito do Documento

Este PRD é para quem for desenhar a arquitetura, quebrar em épicos/histórias e implementar o Design Studio — um novo módulo do Hive Desktop. Ele assume como já dado o fluxo `bmad-ux` existente (produz a Spec de UX consumida em §4.1) e não descreve nem modifica esse fluxo. Termos usados ao longo do documento seguem o Glossário (§3) à risca — nenhum sinônimo é introduzido fora dele. Suposições feitas durante esta sessão (modo fast path) aparecem inline como `[ASSUMPTION]` e estão indexadas em §12; devem ser confirmadas antes ou durante a fase de arquitetura. Decisões de "como" técnico (comparação de design systems, estratégia de isolamento do Preview, formato provável do Bundle de Exportação) que não pertencem a um PRD de capacidades ficam detalhadas em `addendum.md`, ao lado deste arquivo.

## 1. Visão

O Design Studio fecha a lacuna entre uma Spec de UX (texto, fluxos, intenção) e a primeira visualização real de uma tela — hoje esse salto só acontece dentro do Figma, o que significa investir tempo de design antes de saber se a composição, a hierarquia e o fluxo fazem sentido. O Design Studio permite pegar qualquer Spec de UX produzida pelo fluxo `bmad-ux` já existente no Hive Desktop e, em minutos, ver e mexer nas Telas descritas nela — já usando um design system real de web components, não wireframes. O usuário navega entre as Telas, seleciona Componentes, ajusta props e estrutura diretamente ou via um chat dedicado, e só quando a composição estiver validada exporta um Bundle de Exportação pronto para alimentar o Figma Agent. O resultado: o trabalho de design no Figma começa depois que a ideia já foi pressão-testada visualmente, não antes.

A peça que sustenta isso no longo prazo é o Adaptador de Design System: a v1 vem com um design system open source de web components, mas o módulo é desenhado para que, quando o Hive Desktop for levado para a máquina da empresa, trocar para o design system interno da empresa — também em web components — seja uma mudança de configuração, não uma reescrita.

A experiência-alvo é a de iterar em um artifact do Claude: uma área de preview ao lado de um chat, onde pedir uma mudança em linguagem natural e ver o resultado refletido imediatamente é o caminho principal — só que aqui o "artifact" é uma tela real de produto, construída com componentes de um design system de verdade.

## 2. Usuário-Alvo

### 2.1 Jobs To Be Done

- Como pessoa que conduz o fluxo BMad de ponta a ponta, quero ver uma Spec de UX "em pé" — como tela, não como texto — para decidir se a composição faz sentido antes de abrir o Figma.
- Como pessoa que vai levar o Hive Desktop para o time da empresa, quero que essa validação visual já funcione com o design system real da empresa assim que eu trocar o Adaptador — sem esperar uma reescrita do módulo.
- Como pessoa validando uma demanda, quero pedir ajustes visuais em linguagem natural e ver o resultado imediatamente, sem escrever HTML/CSS à mão só para testar uma ideia.
- Como pessoa preparando o hand-off para o Figma, quero um artefato (o Bundle de Exportação) que carregue a composição já validada, para não repetir do zero dentro do Figma Agent.

### 2.2 Não-Usuários (v1)

- Times de design que já trabalham direto no Figma sem passar por uma Spec de UX gerada pelo `bmad-ux` — o Design Studio depende desse artefato de entrada.
- Cenários que exigem fidelidade de marca final (tipografia, ilustração, motion de produção) — isso continua sendo trabalho do Figma/design team, não do Design Studio.
- Uso colaborativo simultâneo (duas pessoas editando a mesma Tela ao mesmo tempo) — fora do escopo da v1 (ver §5).

### 2.3 Jornadas de Usuário Principais

- **UJ-1. Diego abre uma Spec de UX recém-gerada e vê a primeira tela em pé.**
  - **Persona + contexto:** Diego, engenheiro de produto que acabou de rodar o fluxo `bmad-ux` para uma nova demanda e tem uma Spec de UX com três Telas descritas.
  - **Estado de entrada:** dentro do Hive Desktop, com a Spec de UX aberta no Explorer.
  - **Caminho:** Diego aciona "abrir no Design Studio" a partir da Spec de UX → o sistema lista as três Telas identificadas → Diego escolhe a primeira → o Design Studio aciona a Skill de Design System e mostra um estado de carregamento → a Tela aparece renderizada com componentes reais do design system configurado, dentro de um frame de dispositivo.
  - **Clímax:** Diego vê, pela primeira vez, a Tela "em pé" — não como texto, como interface — e consegue apontar de cara o que não bate com a intenção da spec.
  - **Resolução:** Diego troca para a segunda Tela pelo seletor, mantendo a primeira já gerada e navegável a qualquer momento.
  - **Caso de borda:** se a Spec de UX não descrever nenhuma Tela reconhecível, Diego recebe uma explicação do que faltou em vez de uma tela em branco.

- **UJ-2. Diego ajusta a composição de uma Tela até ela fazer sentido, misturando edição direta e chat.**
  - **Persona + contexto:** mesmo Diego, agora na Tela gerada, quer testar um layout diferente para uma seção antes de decidir se vale levar ao Figma.
  - **Estado de entrada:** Tela renderizada no Preview, nenhum Componente selecionado ainda.
  - **Caminho:** Diego clica em um card na Tela → o Inspetor de Propriedades mostra as props do card → ele troca a variante direto no Inspetor e vê o Preview atualizar na hora → depois, sem trocar de ferramenta, ele descreve no Chat de Iteração Visual "essa seção deveria ter os cards lado a lado, não empilhados" → a Skill de Design System reorganiza a Árvore de Componentes daquela seção e o Preview reflete a mudança → Diego não gosta do resultado e desfaz.
  - **Clímax:** Diego consegue alternar livremente entre "mexer com a mão" e "pedir por linguagem natural" na mesma Tela, sem perder contexto do que já foi feito.
  - **Resolução:** a Tela chega a um estado que Diego considera representativo o suficiente da ideia.
  - **Caso de borda:** se o pedido do chat pedir algo fora do catálogo do design system ativo, a Skill de Design System explica a limitação em vez de aplicar algo quebrado.

- **UJ-3. Diego exporta as Telas validadas para o Figma Agent.**
  - **Persona + contexto:** mesmo Diego, com duas das três Telas já num estado que considera pronto para virar input do Figma Agent.
  - **Estado de entrada:** dentro do Design Studio, com a Spec de UX e suas Telas visíveis no seletor.
  - **Caminho:** Diego seleciona as duas Telas prontas → aciona a exportação → o sistema gera um Bundle de Exportação autocontido para cada uma → Diego pega os arquivos gerados para alimentar o Figma Agent (etapa fora do Hive Desktop).
  - **Clímax:** o trabalho de design no Figma começa a partir de uma composição já pressão-testada, não de uma folha em branco.
  - **Resolução:** a terceira Tela, ainda não validada, continua disponível no Design Studio para retomar depois — exportar não fecha a sessão.

## 3. Glossário

- **Design Studio** — nome do novo módulo dentro do Hive Desktop coberto por este PRD.
- **Spec de UX** — o artefato markdown produzido pelo fluxo `bmad-ux` já existente no Hive Desktop; hoje é apenas um arquivo que aparece no Explorer.
- **Tela** — uma superfície de interface individual descrita na Spec de UX (ex.: "Tela de Login"). Uma Spec de UX pode descrever N Telas.
- **Preview** — a renderização interativa, dentro do Design Studio, de uma Tela usando o Design System configurado.
- **Design System (DS)** — biblioteca de web components usada para renderizar o Preview. Trocável via o Adaptador de Design System.
- **Adaptador de Design System** — camada de configuração que mapeia o Design Studio a um DS específico (pacote de componentes, tokens de tema, mapeamento de props) sem acoplar o restante do módulo a uma biblioteca específica.
- **Componente** — uma instância de um web component do DS renderizada dentro de um Preview (ex.: um botão específico posicionado na Tela).
- **Árvore de Componentes** — a estrutura hierárquica dos Componentes de uma Tela, exibida como painel de camadas/outline.
- **Inspetor de Propriedades** — painel que exibe e permite editar as props do Componente selecionado.
- **Sessão de Iteração** — uma rodada de troca no Chat de Iteração Visual que resulta em uma ou mais mudanças aplicadas ao Preview.
- **Chat de Iteração Visual** — chat dedicado ao Design Studio, escopado à Tela/Componente atual, que aciona a Skill de Design System.
- **Skill de Design System** — a skill/agente responsável por traduzir pedidos em linguagem natural e o conteúdo da Spec de UX em marcação de Componentes válida para o DS configurado.
- **Bundle de Exportação** — o pacote HTML autocontido gerado a partir de uma ou mais Telas, destinado a ser consumido pelo Figma Agent.
- **Figma Agent** — ferramenta externa (fora do escopo deste PRD) que consome o Bundle de Exportação para gerar telas no Figma.

## 4. Features

### 4.1 Ingestão da Spec de UX → Preview Inicial

**Descrição:** usuário abre uma Spec de UX existente e aciona a entrada para o Design Studio, iniciando uma nova sessão. O sistema identifica as Telas descritas na Spec e aciona a Skill de Design System para gerar, para cada uma, uma Árvore de Componentes inicial mapeada ao DS configurado — sem exigir que o usuário escreva código. Realiza UJ-1. `[ASSUMPTION: a Spec de UX em markdown livre produzida hoje pelo bmad-ux é suficiente como entrada — a Skill de Design System interpreta a prosa/estrutura existente sem exigir mudança no formato de saída do bmad-ux.]`

**Requisitos Funcionais:**

#### FR-1: Abrir uma Spec de UX no Design Studio

Usuário pode abrir uma Spec de UX existente a partir do Explorer (ou de um ponto de entrada dedicado), iniciando uma nova sessão do Design Studio para aquela Spec. Realiza UJ-1.

**Consequências (testáveis):**
- O Design Studio identifica e lista todas as Telas descritas na Spec de UX antes de gerar qualquer Preview.
- Se a Spec de UX não descrever nenhuma Tela reconhecível, o usuário recebe uma mensagem explicando o que faltou, não uma tela em branco silenciosa.

#### FR-2: Geração automática do Preview inicial via Skill de Design System

O sistema aciona a Skill de Design System para gerar, para cada Tela, uma Árvore de Componentes inicial mapeada ao DS configurado. Realiza UJ-1.

**Consequências (testáveis):**
- A geração usa exclusivamente Componentes disponíveis no Adaptador de Design System ativo — nunca produz markup fora do DS configurado.
- O tempo entre "abrir a spec" e "primeira Tela renderizada" é comunicado ao usuário via estado de carregamento visível (a geração é assíncrona e pode levar múltiplos segundos por acionar um agente).

### 4.2 Visualizador de Preview

**Descrição:** painel central do Design Studio renderiza a Tela ativa dentro de um frame de dispositivo configurável (mobile/tablet/desktop e tamanho customizado), e permite alternar entre as Telas da Spec de UX sem perder o estado de edição de cada uma. Realiza UJ-1, UJ-2.

**Requisitos Funcionais:**

#### FR-3: Alternar tamanho de dispositivo do Preview

Usuário pode alternar o viewport do Preview entre presets (mobile, tablet, desktop) e um tamanho customizado. Realiza UJ-2.

**Consequências (testáveis):**
- Trocar de preset não perde o estado de edição da Tela atual (Árvore de Componentes e Sessão de Iteração continuam válidas).
- O preset ativo é visível sem precisar abrir um menu.

#### FR-4: Navegar entre Telas via seletor

Usuário pode alternar entre as Telas descritas na Spec de UX através de um seletor dedicado, sem perder o estado de edição de cada Tela já visitada. Realiza UJ-2.

**Consequências (testáveis):**
- Cada Tela mantém sua própria Árvore de Componentes e histórico de Sessão de Iteração independentes das demais.
- O seletor indica quais Telas já foram editadas nesta sessão vs. ainda no estado gerado automaticamente.

### 4.3 Seleção e Edição de Componentes

**Descrição:** usuário clica em qualquer Componente renderizado no Preview para selecioná-lo; a seleção expõe o Inspetor de Propriedades (edição de props visuais) e a Árvore de Componentes (edição estrutural — adicionar, remover, mover Componentes). Realiza UJ-2. `[ASSUMPTION: edição estrutural na v1 opera sobre os Componentes já disponíveis no catálogo do DS configurado — inserir/mover/remover instâncias existentes. Não é um construtor de layout livre, nem permite HTML/CSS arbitrário fora do DS.]`

**Requisitos Funcionais:**

#### FR-5: Selecionar um Componente no Preview

Usuário pode clicar em qualquer Componente renderizado no Preview para selecioná-lo, com destaque visual indicando a seleção. Realiza UJ-2.

**Consequências (testáveis):**
- A seleção funciona para Componentes aninhados (ex.: um botão dentro de um card) sem exigir troca de "modo".
- Selecionar um novo Componente substitui a seleção anterior; não há multi-seleção na v1.

#### FR-6: Editar propriedades visuais do Componente selecionado

Usuário pode editar, via Inspetor de Propriedades, as props expostas pelo Componente selecionado (ex.: variante, tamanho, texto, estado), com o Preview refletindo a mudança imediatamente. Realiza UJ-2.

**Consequências (testáveis):**
- Cada prop editável no Inspetor corresponde a uma prop real aceita pelo Componente no DS configurado — o Inspetor não expõe props inventadas.
- Uma mudança de prop inválida (fora do conjunto aceito pelo DS) é rejeitada com feedback, não aplicada silenciosamente.

#### FR-7: Editar a Árvore de Componentes de uma Tela

Usuário pode adicionar, remover ou mover Componentes dentro da Árvore de Componentes da Tela ativa através de um painel dedicado (estrutura tipo camadas/outline). Realiza UJ-2.

**Consequências (testáveis):**
- Adicionar um Componente exige escolher entre os Componentes disponíveis no Adaptador de Design System ativo.
- Remover ou mover um Componente atualiza o Preview e a Árvore de Componentes de forma consistente e reversível (ver FR-9).

#### FR-8: Refletir edições diretamente no Preview

Toda edição feita via Inspetor de Propriedades ou Árvore de Componentes se reflete no Preview renderizado sem exigir uma ação explícita de "aplicar" ou "salvar". Realiza UJ-2.

**Consequências (testáveis):**
- O tempo entre uma edição e sua reflexão visual no Preview é percebido como instantâneo (sem reload completo da Tela).

#### FR-9: Desfazer/refazer edições dentro de uma Sessão

Usuário pode desfazer e refazer edições feitas via Inspetor de Propriedades, Árvore de Componentes ou Chat de Iteração Visual dentro da sessão atual da Tela. Realiza UJ-2.

**Consequências (testáveis):**
- Desfazer uma mudança feita pelo Chat de Iteração Visual reverte exatamente a mudança aplicada por aquela mensagem, sem afetar edições manuais feitas depois.

### 4.4 Chat de Iteração Visual

**Descrição:** painel de chat dedicado, escopado à Tela (e ao Componente selecionado, quando houver) ativa, que aciona a Skill de Design System para interpretar pedidos em linguagem natural e aplicar mudanças ao Preview. Espelha a experiência de iterar em um artifact do Claude: descrever o ajuste, ver o resultado refletido ao lado, continuar a conversa a partir do resultado. Realiza UJ-2.

**Requisitos Funcionais:**

#### FR-10: Enviar pedidos de mudança em linguagem natural

Usuário pode descrever, em linguagem natural, uma mudança desejada na Tela ativa (ou no Componente selecionado) através do Chat de Iteração Visual. Realiza UJ-2.

**Consequências (testáveis):**
- Quando há um Componente selecionado no momento do envio, o pedido é interpretado no contexto daquele Componente por padrão.
- O histórico do Chat de Iteração Visual persiste durante a sessão da Tela e é visível ao alternar de volta para essa Tela.

#### FR-11: Aplicar mudanças da Skill de Design System ao Preview

Mudanças produzidas pela Skill de Design System em resposta a um pedido do chat são aplicadas à Árvore de Componentes e refletidas no Preview, sujeitas a desfazer (FR-9). Realiza UJ-2.

**Consequências (testáveis):**
- Toda mudança aplicada usa exclusivamente Componentes do Adaptador de Design System ativo (mesma garantia da FR-2).
- Se a Skill de Design System não conseguir cumprir o pedido dentro das capacidades do DS configurado, ela responde explicando a limitação em vez de aplicar uma mudança parcial ou incorreta.

### 4.5 Adaptador de Design System

**Descrição:** camada de configuração que desacopla o Design Studio de uma biblioteca de web components específica. A v1 vem configurada com um design system open source (ver §12); trocar para outro DS de web components — como o DS interno da empresa, quando o Hive Desktop for instalado lá — é uma mudança de configuração, não uma reescrita do módulo.

**Requisitos Funcionais:**

#### FR-12: Configurar qual Design System o Design Studio usa

O sistema resolve, a partir de uma configuração central, qual pacote de Design System (componentes + tokens de tema) o Design Studio usa para gerar e renderizar Previews.

**Consequências (testáveis):**
- Trocar o Design System configurado não exige alterações no Visualizador de Preview, no Inspetor de Propriedades ou na Árvore de Componentes — apenas na configuração do Adaptador e, quando necessário, na Skill de Design System.
- Specs de UX e Telas já criadas com um DS não são automaticamente migradas para outro DS ao trocar a configuração (ver §6.2).

#### FR-13: Catálogo de Componentes disponíveis do DS ativo

O sistema expõe, para a Skill de Design System e para a Árvore de Componentes (FR-7), a lista de Componentes disponíveis no Design System ativo e suas props aceitas.

**Consequências (testáveis):**
- O catálogo é a única fonte de verdade usada tanto pela geração automática (FR-2) quanto pela edição manual (FR-6, FR-7) — nunca divergem.

### 4.6 Exportação de Bundle para o Figma Agent

**Descrição:** quando o usuário considera uma ou mais Telas prontas, pode gerar um Bundle de Exportação em HTML autocontido a ser usado como entrada do Figma Agent (ferramenta externa, fora do escopo deste PRD). Realiza UJ-3. `[ASSUMPTION: o formato exato exigido pelo Figma Agent não foi confirmado nesta sessão — ver §11, Pergunta em Aberto #1. Assume-se, como ponto de partida, um HTML autocontido por Tela (CSS e assets inline, sem dependências de rede), dado o precedente de limitação de assets relativos já documentado em HtmlPreview.tsx.]`

**Requisitos Funcionais:**

#### FR-14: Gerar Bundle de Exportação de uma Tela

Usuário pode gerar um Bundle de Exportação a partir de qualquer Tela em qualquer estado de edição (gerada automaticamente ou já iterada via chat/edição manual). Realiza UJ-3.

**Consequências (testáveis):**
- O Bundle de Exportação gerado é autocontido (HTML + CSS + assets necessários inline ou empacotados) e não depende de recursos de rede para ser renderizado corretamente por uma ferramenta externa.
- Gerar um Bundle de Exportação não altera o estado de edição da Tela nem da sessão do Design Studio.

#### FR-15: Exportar múltiplas Telas de uma vez

Usuário pode selecionar mais de uma Tela e gerar os respectivos Bundles de Exportação em uma única ação. Realiza UJ-3.

**Consequências (testáveis):**
- Cada Tela selecionada gera seu próprio Bundle de Exportação independente; uma falha ao exportar uma Tela não impede a exportação das demais.

## 5. Non-Goals (Explícitos)

- Não substitui o Figma nem o trabalho de design visual final — o Design Studio existe para validar estrutura, fluxo e composição de componentes antes de investir tempo de design, não para produzir o artefato de marca definitivo.
- Não busca fidelidade pixel-perfect à marca final da empresa — usa o DS configurado (open source na v1) como aproximação suficiente para validação, não como entrega visual final.
- Não é um construtor de UI genérico: só renderiza e edita Componentes do Adaptador de Design System ativo — não gera HTML/CSS arbitrário fora do catálogo do DS, nem importa componentes de outros frameworks (React, etc.).
- Não inclui colaboração multi-usuário em tempo real na v1 — uma sessão do Design Studio é editada por um usuário local por vez, como o restante do Hive Desktop hoje.
- Não aciona o Figma Agent nem cria as telas no Figma diretamente — produz o Bundle de Exportação; a geração das telas no Figma acontece fora do Hive Desktop.
- Não migra automaticamente Telas/Sessões entre Design Systems diferentes ao trocar o Adaptador.

## 6. Escopo do MVP

### 6.1 Dentro do escopo

- Abrir uma Spec de UX existente e gerar Previews iniciais para todas as Telas nela descritas (FR-1, FR-2).
- Visualizador de Preview com presets de dispositivo e navegação entre Telas (FR-3, FR-4).
- Seleção de Componente, edição de props (Inspetor) e edição estrutural via Árvore de Componentes, com desfazer/refazer (FR-5–FR-9).
- Chat de Iteração Visual escopado à Tela/Componente ativo (FR-10, FR-11).
- Adaptador de Design System configurável, com um design system open source de web components como padrão (FR-12, FR-13).
- Exportação de Bundle de Exportação HTML autocontido, por Tela ou em lote (FR-14, FR-15).

### 6.2 Fora do escopo do MVP

- Histórico de versões de longo prazo das iterações de uma Tela — cada sessão mantém desfazer/refazer local, mas não um histórico persistente entre sessões. `[NOTE FOR PM: revisitar se o padrão de versionamento do Second Brain (M12) faz sentido reaproveitar aqui — mesma base de produto, precedente já existe.]`
- Migração automática de Telas entre Design Systems diferentes.
- Colaboração multi-usuário / edição simultânea da mesma Tela.
- Geração ou edição de markup fora do catálogo do DS configurado (HTML/CSS livre, componentes de outros frameworks).
- Integração ou chamada direta ao Figma Agent a partir do Hive Desktop — o Bundle de Exportação é o limite do escopo.
- Mudança no formato de saída do próprio fluxo `bmad-ux` — o Design Studio consome a Spec de UX como ela é produzida hoje.

## 7. NFRs Transversais

- **Desempenho de edição**: mudanças feitas via Inspetor de Propriedades ou Árvore de Componentes devem refletir no Preview em tempo percebido como instantâneo, sem reload completo da Tela (FR-8).
- **Latência de geração assíncrona**: chamadas à Skill de Design System (geração inicial, respostas do chat) são operações de agente e podem levar segundos; o estado de carregamento deve ser sempre visível e nunca deixar a interface parecendo travada.
- **Isolamento do Preview**: o Preview renderiza Componentes gerados ou editados por um agente de IA — conteúdo que deve ser tratado como não confiável pelo processo principal do Electron (ver §8).
- **Consistência entre geração e edição manual**: geração automática (FR-2), edição via Inspetor (FR-6), Árvore (FR-7) e Chat (FR-11) usam o mesmo Catálogo de Componentes (FR-13) — nunca produzem markup que diverge do DS configurado.

## 8. Restrições e Guardrails

**Safety (execução de conteúdo gerado por IA)**
- Componentes web renderizados no Preview podem executar JavaScript arbitrário — é a natureza de web components. Como o conteúdo é gerado/editado por um agente de IA a partir de linguagem natural, o Preview deve rodar isolado do processo principal do Electron e do restante do estado do app, no mesmo espírito já aplicado em `HtmlPreview.tsx` (iframe sandboxed, sem acesso a filesystem/janela pai). `[ASSUMPTION: o isolamento via iframe sandboxed é suficiente para a v1; uma revisão de segurança dedicada deve confirmar isso na fase de arquitetura, já que aqui — diferente do preview de HTML estático hoje — o conteúdo é regenerado repetidamente por um agente, não é um arquivo estático do workspace do usuário.]`
- O limite conhecido de `HtmlPreview.tsx` (sem base URL em `srcDoc`, assets relativos quebram) não pode se repetir aqui sem solução — o Visualizador de Preview precisa de uma estratégia de origem/assets que sirva Componentes e Telas completas de forma confiável (decisão de arquitetura; detalhada em `addendum.md`).

**Custo**
- Cada geração inicial de Preview (FR-2) e cada mensagem no Chat de Iteração Visual (FR-10) aciona a Skill de Design System via o mesmo adaptador de agente já usado pelo restante do Hive Desktop — não introduz um novo provedor, mas aumenta o volume de chamadas de agente por sessão de trabalho. Sem meta de custo específica nesta v1, dado o uso interno/individual. `[ASSUMPTION]`

## 9. Pontos de Integração

- **`bmad-ux` → Design Studio**: a Spec de UX é consumida como está hoje (markdown livre, sem mudança de formato exigida). O Design Studio não modifica o fluxo `bmad-ux` existente.
- **Skill de Design System**: nova skill (ou extensão de uma existente) responsável por interpretar Spec de UX + pedidos de chat e produzir/editar Árvores de Componentes dentro do Catálogo do DS ativo (FR-2, FR-11, FR-13). Roteada pelo mesmo adaptador de agente já usado pelo chat principal do Hive Desktop.
- **`design-system/` (DS interno da própria casca do Hive Desktop)**: não é o DS usado pelo Design Studio — aquele é React e serve à casca do próprio app. O Adaptador de Design System (FR-12) é uma camada nova e independente, específica para os Componentes renderizados dentro dos Previews.
- **Figma Agent**: consumidor externo do Bundle de Exportação (FR-14, FR-15); confirmar seu contrato de entrada exato fica fora do escopo deste PRD (ver §11, Pergunta em Aberto #1).
- **Padrão de módulo do Hive Desktop**: o app hoje tem três padrões de registro de conteúdo — view de sidebar persistente (Explorer/SCM/Review/Second Brain), dialog modal (MCP, Skill Studio) e aba no painel de editor/viewer (`EditorTabKind`, hoje usado por diff/commit/conflict/review e pelos visualizadores de arquivo). **Decidido na arquitetura (ver `ARCHITECTURE-SPINE.md` do Design Studio, AD-1):** o Design Studio segue o padrão de aba no painel viewer, não o de sidebar view nem o de dialog modal — a coluna estreita do `rail` (sidebar) não comporta Preview + Inspetor + Árvore + Chat ao mesmo tempo, e o dialog modal não preserva estado de sessão entre aberturas.

## 10. Métricas de Sucesso

**Primárias**
- **SM-1**: Tempo entre "Spec de UX finalizada" e "Bundle de Exportação gerado" para uma demanda validada no Design Studio antes de ir para o Figma. `[ASSUMPTION: meta numérica a definir após um primeiro ciclo real de uso — objetivo é reduzir o tempo até a primeira validação visual em relação ao fluxo atual de ir direto para o Figma.]` Valida FR-1, FR-2, FR-14.
- **SM-2**: Proporção de Specs de UX que passam pelo Design Studio antes de qualquer trabalho no Figma. `[ASSUMPTION: meta de adoção majoritária após o primeiro mês de uso pessoal.]` Valida FR-1.

**Secundárias**
- **SM-3**: Número médio de rodadas de Sessão de Iteração (chat) por Tela antes de o usuário exportar o Bundle — sinaliza se a edição conversacional está resolvendo ajustes sozinha ou só arranhando a superfície. Valida FR-10, FR-11.

**Contra-métricas (não otimizar)**
- **SM-C1**: Retrabalho de estrutura/fluxo identificado já dentro do Figma, após uma Tela ter sido "validada" no Design Studio. Contrabalança SM-1 — não adianta exportar rápido se a validação não pegou os problemas reais.

## 11. Perguntas Em Aberto

1. Qual o formato exato de entrada que o Figma Agent espera (HTML único por Tela? Múltiplos arquivos? Metadados adicionais como nomes de camadas ou tokens)? Impacta o detalhamento fino de FR-14/FR-15 na fase de arquitetura — a v1 assume HTML autocontido por Tela como ponto de partida (ver §4.6).
2. O isolamento via iframe sandboxed (mesmo padrão do `HtmlPreview.tsx`) é suficiente para conteúdo gerado repetidamente por um agente de IA, ou esse caso de uso pede uma revisão de segurança mais profunda (ex.: worker isolado, processo separado)? Ver §8.
3. ~~O Design Studio deve seguir o padrão de view de sidebar persistente ou o de dialog modal do Hive Desktop (ver §9)?~~ **Resolvido na arquitetura:** nenhum dos dois — segue o padrão de aba no painel de editor/viewer (`ARCHITECTURE-SPINE.md`, AD-1).
4. Vale reaproveitar o padrão de versionamento do Second Brain (M12) para o histórico de iterações de uma Tela, já fora do escopo do MVP (ver §6.2), ou isso é over-engineering para um fluxo hoje solo?

## 12. Índice de Suposições

- §4.1 — a Spec de UX em markdown livre produzida hoje pelo `bmad-ux` é suficiente como entrada; não é necessário mudar seu formato de saída.
- §4.3 — edição estrutural na v1 é limitada a inserir/mover/remover instâncias de Componentes já existentes no catálogo do DS configurado; não é um construtor de layout livre.
- §4.6 / §11.1 — formato do Bundle de Exportação assumido como HTML autocontido por Tela (CSS/assets inline, sem dependência de rede), pendente confirmação do contrato real do Figma Agent.
- Design system padrão da v1: Shoelace / Web Awesome (decisão do usuário nesta sessão, registrada no memlog).
- §8 — isolamento via iframe sandboxed é assumido suficiente para a v1, pendente revisão de segurança na arquitetura.
- §9 — ~~Design Studio segue o padrão de view de sidebar persistente (não dialog modal)~~ — resolvido na arquitetura: segue o padrão de aba no painel de editor/viewer (ver `ARCHITECTURE-SPINE.md`, AD-1).
- §10 — metas numéricas de SM-1 e SM-2 ainda não definidas; ficam como valores a calibrar após uso real.
