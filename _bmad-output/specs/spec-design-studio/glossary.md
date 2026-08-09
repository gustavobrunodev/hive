# Glossário — Design Studio

- **Design Studio** — nome do módulo do Hive Desktop coberto por este SPEC.
- **Spec de UX** — artefato markdown produzido pelo fluxo `bmad-ux` já existente no Hive Desktop; hoje é apenas um arquivo que aparece no Explorer. Consumido como está, sem mudança de formato.
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
- **Figma Agent** — ferramenta externa (fora do escopo deste contrato) que consome o Bundle de Exportação para gerar telas no Figma.
