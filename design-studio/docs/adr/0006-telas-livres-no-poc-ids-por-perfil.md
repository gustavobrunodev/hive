# Telas livres no POC; o design system do banco entra por um perfil

Decisão do usuário, em 2026-10-08: a primeira versão é "livre do IDS, ou seja, usar a impeccable com todas as suas funcionalidades para criar qualquer tipo de interface". O POC roda na máquina pessoal para provar as funcionalidades centrais e o funcionamento correto do app. Depois, dentro do Itaú, outro agente aplica as restrições do IDS usando o iu-memorable.

A decisão volta à intenção da [0001](0001-porte-com-pontos-de-troca.md), que já tratava o visual livre dos Protótipos como consequência de não haver, fora do banco, acesso ao DS Itaú. Ela substitui, para o app, a decisão de 2026-10-02 de vestir as telas com a camada IDS. Essa camada continua no protótipo de validação.

**O que muda no POC:**

- O template `prototipo-angular` não traz design system.
- A identidade de cada Protótipo mora no arquivo de tokens dele (`src/styles/tokens.css`), que o agente escreve.
- O modo "Mudar o estilo" do live (o "departure" da impeccable) fica liberado.
- O validador do modo ao vivo não restringe cores nem fontes.

**O que fica preparado para o banco:**

- **O design system das telas é um ponto de troca: o perfil de design.** O perfil diz:
  - se a troca de estilo está liberada;
  - se as cores precisam vir dos tokens;
  - quais fontes valem;
  - se o agente pode editar os tokens;
  - quais documentos de regras entram em todo turno.

  O POC usa o perfil `livre`. Os testes rodam também com um perfil de exemplo restrito, montado com a camada IDS do protótipo de validação (`prototype/proto.css`), e por isso o caminho restrito já chega ao banco provado. No banco, o porte escreve o perfil `ids` com os tokens e as regras do iu-memorable.
- **Todos os pontos de troca ficam num único arquivo do módulo** (`resources/design-studio/pontos-de-troca.json`, no Hive; [0007](0007-modulo-do-hive.md)): o pacote e o registro da Skill de UX, o template, o perfil de design, as skills de relatório e os dados de exemplo.
- **O app traz um guia de porte escrito para o agente que fará a troca** (`docs/porte.md`). Cada ponto de troca aparece no guia com o valor do POC, o que muda no banco e o teste que prova a troca.
- **As conferências do template ([0004](0004-template-angular.md)) passam a ser código do app**, e não um script dentro do template. O template do iu-memorable não precisa trazer nada do Design Studio. Ele só precisa seguir a forma de pastas das Propostas (tarefa T).

**Por quê:**

- O usuário quer testar as funcionalidades centrais sem as restrições do banco.
- O IDS de verdade só existe lá dentro, no iu-memorable.
- A troca precisa ser um ponto explícito, como pede o PRODUCT, princípio 5 ("Portável").

## Considered Options

- **Manter a camada IDS do protótipo de validação como padrão do POC** (a decisão de 2026-10-02): rejeitada pelo usuário em 2026-10-08.
- **Deixar o POC livre sem perfil e "consertar" no banco:** rejeitada. O agente do porte teria de achar regras espalhadas pelo código, e nada provaria antes que o caminho restrito funciona.

## Consequences

- O PRODUCT.md foi emendado em 2026-10-08 ("Restrições" e "Conteúdo dos frames"): o IDS vale no protótipo de validação e no porte, e não no POC.
- A exceção de contraste do botão primário do IDS (PRODUCT, "Acessibilidade") vale só com o perfil `ids`.
- A seção "Camada do Protótipo" do DESIGN.md descreve o protótipo de validação e o alvo do porte. O app do POC não a usa.
- A [0004](0004-template-angular.md) continua: o Angular foi escolhido justamente para que essa troca não reescreva Protótipos nem template.
- A tabela da 0001 ganhou a linha do design system das telas.
