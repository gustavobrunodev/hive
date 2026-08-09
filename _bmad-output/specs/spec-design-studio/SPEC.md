---
id: SPEC-design-studio
companions: [glossary.md, stack.md, architecture-decisions.md, architecture-diagrams.md]
sources:
  - '_bmad-output/planning-artifacts/prds/prd-design-studio-2026-08-08/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-design-studio-2026-08-08/addendum.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-design-studio-2026-08-09/ARCHITECTURE-SPINE.md'
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Design Studio

## Why

Hoje o único jeito de ver uma Spec de UX (o artefato produzido pelo fluxo `bmad-ux`) "em pé" — como tela real, não como texto — é investir tempo de design dentro do Figma antes de saber se a composição, a hierarquia e o fluxo fazem sentido. O Design Studio fecha essa lacuna: pega qualquer Spec de UX e, em minutos, gera Telas navegáveis e editáveis usando um design system real de web components, com edição direta (Inspetor/Árvore) e um Chat de Iteração Visual — a mesma experiência de iterar em um artifact do Claude, só que o "artifact" é uma tela real de produto. Só quando a composição estiver validada o usuário exporta um Bundle de Exportação para o Figma Agent, para que o trabalho de design no Figma comece depois da ideia pressão-testada, não antes. A peça que sustenta isso no longo prazo é o Adaptador de Design System: trocar do DS open source da v1 para o DS interno da empresa deve ser configuração, não reescrita.

## Capabilities

- **CAP-1**
  - **intent:** Usuário abre uma Spec de UX existente e inicia uma nova sessão do Design Studio para ela.
  - **success:** Todas as Telas descritas na Spec são listadas antes de qualquer Preview ser gerado; uma Spec sem Tela reconhecível produz uma mensagem explicando o que faltou, nunca uma tela em branco silenciosa.

- **CAP-2**
  - **intent:** O sistema aciona a Skill de Design System para gerar automaticamente, para cada Tela, uma Árvore de Componentes inicial mapeada ao DS ativo.
  - **success:** A geração usa exclusivamente Componentes do catálogo do Adaptador ativo; um estado de carregamento visível cobre toda a espera assíncrona da chamada de agente.

- **CAP-3**
  - **intent:** Usuário alterna o viewport do Preview entre presets (mobile, tablet, desktop) e um tamanho customizado.
  - **success:** Trocar de preset não perde o estado de edição da Tela atual; o preset ativo é visível sem abrir menu.

- **CAP-4**
  - **intent:** Usuário navega entre as Telas da Spec de UX através de um seletor dedicado, sem perder o estado de edição de cada uma.
  - **success:** Cada Tela mantém Árvore de Componentes e histórico de Sessão de Iteração independentes das demais; o seletor indica quais Telas já foram editadas nesta sessão vs. ainda auto-geradas.

- **CAP-5**
  - **intent:** Usuário clica em qualquer Componente renderizado no Preview para selecioná-lo, incluindo Componentes aninhados.
  - **success:** A seleção funciona em Componentes aninhados sem exigir troca de "modo"; selecionar um novo Componente substitui a seleção anterior — sem multi-seleção na v1.

- **CAP-6**
  - **intent:** Usuário edita, via Inspetor de Propriedades, as props do Componente selecionado, com o Preview refletindo a mudança imediatamente.
  - **success:** Cada prop editável no Inspetor corresponde a uma prop real aceita pelo Componente no DS configurado; uma mudança inválida é rejeitada com feedback, nunca aplicada silenciosamente.

- **CAP-7**
  - **intent:** Usuário adiciona, remove ou move Componentes dentro da Árvore de Componentes da Tela ativa.
  - **success:** Adicionar um Componente exige escolher entre os Componentes disponíveis no Adaptador ativo; remover ou mover atualiza Preview e Árvore de forma consistente e reversível.

- **CAP-8**
  - **intent:** Toda edição feita via Inspetor ou Árvore de Componentes se reflete no Preview sem exigir uma ação explícita de "aplicar" ou "salvar".
  - **success:** O tempo entre uma edição e sua reflexão visual no Preview é percebido como instantâneo, sem reload completo da Tela.

- **CAP-9**
  - **intent:** Usuário desfaz e refaz edições feitas via Inspetor, Árvore de Componentes ou Chat de Iteração Visual dentro da sessão atual da Tela.
  - **success:** Desfazer uma mudança feita pelo Chat reverte exatamente a mudança daquela mensagem, sem afetar edições manuais feitas depois.

- **CAP-10**
  - **intent:** Usuário descreve, em linguagem natural, uma mudança desejada na Tela ativa (ou no Componente selecionado) via Chat de Iteração Visual.
  - **success:** Quando há um Componente selecionado no envio, o pedido é interpretado nesse contexto por padrão; o histórico do chat persiste durante a sessão da Tela e reaparece ao voltar a ela.

- **CAP-11**
  - **intent:** Mudanças produzidas pela Skill de Design System em resposta a um pedido do chat são aplicadas à Árvore de Componentes e refletidas no Preview, sujeitas a desfazer.
  - **success:** Toda mudança aplicada usa exclusivamente Componentes do Adaptador ativo; se a Skill não conseguir cumprir o pedido dentro do DS configurado, ela explica a limitação em vez de aplicar uma mudança parcial ou incorreta.

- **CAP-12**
  - **intent:** O sistema resolve, a partir de uma configuração central, qual pacote de Design System o Design Studio usa para gerar e renderizar Previews.
  - **success:** Trocar o DS configurado não exige mudanças no Visualizador de Preview, no Inspetor ou na Árvore de Componentes — só na configuração do Adaptador (e na Skill, quando necessário); Telas já criadas com um DS não migram automaticamente ao trocar a configuração.

- **CAP-13**
  - **intent:** O sistema expõe, para a Skill de Design System e para a Árvore de Componentes, o catálogo de Componentes disponíveis do DS ativo e suas props aceitas.
  - **success:** O catálogo é a única fonte de verdade usada tanto pela geração automática (CAP-2) quanto pela edição manual (CAP-6, CAP-7) — nunca divergem.

- **CAP-14**
  - **intent:** Usuário gera um Bundle de Exportação a partir de qualquer Tela, em qualquer estado de edição.
  - **success:** O Bundle é autocontido (HTML + CSS + assets inline ou empacotados), sem dependência de rede; gerar o Bundle não altera o estado de edição da Tela nem da sessão do Design Studio.

- **CAP-15**
  - **intent:** Usuário seleciona mais de uma Tela e gera os respectivos Bundles de Exportação em uma única ação.
  - **success:** Cada Tela selecionada gera seu próprio Bundle independente; uma falha ao exportar uma Tela não impede a exportação das demais.

## Constraints

- Toda mutação de uma Tela passa por um `Command` de vocabulário fechado (`AddComponent`/`RemoveComponent`/`MoveComponent`/`SetProp`), aplicado por um único reducer puro sobre o `ScreenDocument` — nunca mutação direta da árvore por UI, Skill ou Export.
- Cada `Command` é validado contra o catálogo do DS ativo antes do dispatch (mesma função para edição manual e chat) — nunca dentro do reducer.
- A Skill de Design System só emite `Command[]`, nunca markup; o lote de um turno de chat é tudo-ou-nada — se qualquer `Command` falhar a validação, nenhum é aplicado.
- Nenhuma camada (Preview, Inspetor, Árvore, prompt da Skill, Export) importa um pacote de DS diretamente — toda leitura de componentes/props passa pelo catálogo do Adaptador.
- Construção de DOM no Preview usa exclusivamente APIs seguras (`createElement` + atribuição de propriedade/atributo) — nunca `innerHTML` nem markup interpolado; props URL-shaped (`href`/`src`) passam por allowlist de esquemas antes de aplicar.
- Preview roda em iframe `sandbox="allow-scripts"` (sem `allow-same-origin`), servido por um protocolo privilegiado same-origin com CSP própria por resposta incluindo `connect-src 'none'`; carregamento inicial nunca via `srcDoc`, atualizações via `postMessage` same-origin.
- Export usa exclusivamente o renderizador estático do Adaptador — nenhum segundo gerador de markup paralelo ao Preview.
- Sessão (documento + histórico de comandos + transcript do chat) persiste em um JSON por sessão no userData, chaveado separadamente do token de URL do Preview (aleatório, não-adivinhável); a Spec de UX é somente leitura para o Design Studio.
- Desfazer/refazer é um único log linear de `Command` por Tela, reproduzido desde a origem — sem snapshots persistidos; todos os `Command`s de um turno de chat desfazem como um único passo agrupado.
- A Skill de Design System fala apenas com o contrato comum de sessão de agente já existente no app — nenhum branching por agente configurado (Claude vs. Devin vs. GitHub Copilot CLI).
- Falhas têm exatamente duas formas: violação de catálogo do DS (Inspetor e Chat renderizam igual) e erro operacional (agente indisponível, falha de asset do Preview, I/O de export) — nunca uma terceira forma ad hoc.
- Export isola falhas por Tela: uma falha ao exportar uma Tela não impede a exportação das demais Telas selecionadas.
- Design System ativo da v1 é `@awesome.me/webawesome` ^3.11.0 (MIT) — nunca `@shoelace-style/shoelace` (arquivado, sucedido pelo Web Awesome); ver `stack.md` para o detalhe de licenciamento Pro-tier.
- Design Studio é uma aba (`design-studio`) no painel viewer existente, no mesmo padrão de diff/commit/conflict/review — não é uma view de sidebar nem um dialog modal; uma Tela por vez dentro da aba.
- Viewport preset e seleção de Componente são estado transiente de UI, fora do documento da Tela — não participam de undo/redo nem de persistência.

Rationale completo de cada regra (por que existe, o que ela impede) em `architecture-decisions.md`.

## Non-goals

- Não substitui o Figma nem produz o artefato de marca final — valida estrutura/fluxo/composição, não fidelidade pixel-perfect.
- Não é um construtor de UI genérico: renderiza e edita exclusivamente Componentes do Adaptador de DS ativo, sem HTML/CSS livre nem componentes de outros frameworks.
- Sem colaboração multi-usuário / edição simultânea da mesma Tela na v1 — uma sessão é editada por um usuário local por vez.
- Não aciona o Figma Agent nem cria telas no Figma diretamente — produz apenas o Bundle de Exportação; a integração com o Figma Agent acontece fora do Hive Desktop.
- Sem migração automática de Telas/Sessões entre Design Systems diferentes ao trocar o Adaptador.
- Sem histórico de versões persistente entre sessões — cada sessão mantém apenas desfazer/refazer local via replay do log de comandos.
- Não atende times que já trabalham direto no Figma sem passar por uma Spec de UX do `bmad-ux`.
- Não modifica o fluxo `bmad-ux` existente nem seu formato de saída.

## Success signal

O tempo entre "Spec de UX finalizada" e "Bundle de Exportação gerado" para uma demanda validada no Design Studio cai em relação ao fluxo atual de ir direto para o Figma, e uma proporção crescente das Specs de UX passa pelo Design Studio antes de qualquer trabalho no Figma — sem que isso aumente o retrabalho de estrutura/fluxo identificado já dentro do Figma após uma Tela ter sido "validada" (contra-métrica: exportar rápido não vale se a validação não pegou os problemas reais). Metas numéricas ainda não definidas — ver Open Questions.

## Assumptions

- A Spec de UX em markdown livre produzida hoje pelo `bmad-ux` é suficiente como entrada — a Skill de Design System interpreta a prosa/estrutura existente sem exigir mudança no formato de saída do `bmad-ux`.
- Edição estrutural (CAP-7) na v1 opera apenas sobre Componentes já existentes no catálogo do DS ativo — inserir/mover/remover instâncias, não um construtor de layout livre.
- Formato do Bundle de Exportação assumido como HTML autocontido por Tela (CSS/assets inline, sem dependência de rede) como ponto de partida, pendente confirmação do contrato real do Figma Agent.
- Sem meta de custo por chamada de agente definida nesta v1 — Design Studio herda o mesmo adaptador de agente do resto do app, sem introduzir novo provedor.

## Open Questions

- Qual o formato exato de entrada esperado pelo Figma Agent (HTML único por Tela? múltiplos arquivos? metadados de camadas/tokens)? Inclui se o shadow DOM dos web components precisa ser achatado em markup+estilo equivalente antes de exportar, ou se pode ir renderizado como está — depende de como o Figma Agent atravessa (ou não) shadow DOM. Impacta o detalhamento fino de CAP-14/CAP-15.
- `sandbox="allow-scripts"` + CSP própria (`connect-src 'none'`) + `postMessage` same-origin é isolamento suficiente para conteúdo web regenerado repetidamente por um agente de IA, ou o caso pede isolamento mais forte (worker dedicado, processo separado)? A arquitetura já fechou três lacunas concretas (ver `architecture-decisions.md`, AD-4/AD-5/AD-7) mas deixou esse julgamento de profundidade para uma revisão de segurança dedicada.
- Vale reaproveitar o padrão de versionamento do Second Brain (M12) para histórico de iterações entre sessões, hoje fora do MVP, ou é over-engineering para um fluxo hoje solo?
- Quais metas numéricas definir para o tempo até o Bundle exportado e para a proporção de Specs que passam pelo Design Studio antes do Figma? Calibrar após um primeiro ciclo real de uso.
