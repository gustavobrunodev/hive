---
version: 1
slug: "prototype-index-html"
primary_target: "prototype/index.html"
related_targets: []
---

# Protótipo de validação do Design Studio (redesign)

## Escopo e modo

O app inteiro do Design Studio como protótipo navegável de alta fidelidade, refeito do zero na experiência do Claude Design: chat como primeira tela e, ao enviar, chat lateral com o Protótipo sendo criado ou alterado no canvas. Todas as features continuam mockadas, as do roadmap marcadas como "Próxima versão". Modo **Operate**.

## Público, tarefa e restrições

- PM e UX não técnicos.
- **Tarefas:**
  - pedir ao agente, por texto ou voz, com anexos colados e Dores citadas, escolhendo agente, modelo e Protótipo (novo, nenhum ou existente);
  - ver o Protótipo nascer e mudar no canvas;
  - comentar, editar elementos com Variantes, ajustar, testar como cliente;
  - voltar Pontos de restauração;
  - apresentar a história Dor → Relatório → Proposta.
- **Recusado pelo usuário:** o mundo de sinalização de metrô e qualquer azul.
- **Não pode parecer:** ferramenta de dev, Hive Desktop, BI genérico, clone visual do Claude Design.
- **Restrições:**
  - WCAG 2.2 AA com margem para projeção;
  - laranja Itaú só como acento;
  - temas claro e escuro;
  - agentes Claude e Devin, sem Copilot;
  - dados de exemplo sempre rotulados.

## Direction contract

THESIS: O Design Studio é um quadro de oficina onde o cliente real está presente. As Dores ficam coladas como notas ao lado das telas, e o agente trabalha no mesmo quadro como um colega com cursor e nome. Recusa a tela de chat genérica de IA, com prompt num vazio creme e brilhos de "mágica", e recusa o dashboard.

OWN-WORLD:
- **Canvas:** pontilhado neutro infinito (claro #f6f6f4 e escuro #141414). Painéis em superfície lisa com sombra suave.
- **Frames:** telas em moldura de aparelho com rótulo acima, à maneira do Figma.
- **Notas autoadesivas por Fonte:** amarelo-manteiga para Likert, pêssego para Voz do Cliente, menta para FullStory, levemente giradas.
- **Cursores:** com nome e cor.
- **Acento:** laranja Itaú #EC7000 só em ações principais, seleção e no cursor do agente, sempre com tinta escura por cima. Nenhum azul.
- **Tipografia:** Geist na interface. Bricolage Grotesque só em saudações e títulos de página.

STORY: O PM abre o app e já está diante de um quadro com as Dores em alta coladas. Escreve ou dita o pedido, anexa um print, cita uma Dor e escolhe o Protótipo. Ao enviar, o pedido vira conversa na lateral e o quadro ganha as telas, desenhadas uma a uma pelo cursor do agente. Ele confia porque vê a Evidência colada ao lado da tela que a resolve.

FIRST VIEWPORT:
- **Barra lateral** à esquerda: marca, Nova conversa, Início, Protótipos, Dores, Relatórios, Recentes, tema e conta.
- **Quadro pontilhado:** ocupa o resto da tela.
- **Saudação** grande em Bricolage, centralizada no terço superior.
- **Campo do chat** logo abaixo: um cartão largo de cantos generosos com texto, anexos, citação @, seletor de Protótipo, agente e modelo, microfone e o botão laranja de enviar.
- **Embaixo do campo:** as Dores em alta como notas autoadesivas, agrupadas por Fonte, e a fileira "Continuar" com frames dos Protótipos recentes.

FORM: Quadro de oficina, a família dos quadros digitais de workshop como FigJam e Miro. Era o 1º da lista ordenada, entrou como escolha do impeccable e foi escolhido pelo usuário. Seed key 21b5e644.
- **Signature interaction:** o cursor do agente, laranja e com nome, desliza pelo canvas até o elemento que está criando ou mudando enquanto a resposta é escrita no chat. Ao terminar, o elemento pulsa uma vez.
- **Segundo momento:** cada Dor citada vira nota colada ao lado do frame que a resolve.
- **Motion grammar:** transições de 180–240 ms em ease-out exponencial. O cursor desliza em 600 ms. Os frames entram com escala e opacidade. Nada decorativo em loop.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
