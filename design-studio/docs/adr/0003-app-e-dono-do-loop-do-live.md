# O app, não o agente, é dono do loop do modo live

> **Substituída** pela [0005](0005-modo-ao-vivo-desenhado-pelo-estudio.md) em 2026-10-08: o modo ao vivo é 100% do app. O app não roda o `live-poll` nem nenhuma parte do live da impeccable; ele executa cada passo por conta própria e só pede ao agente o conteúdo das Variantes. O texto abaixo fica como histórico.

A skill impeccable manda que o próprio agente mantenha o loop de eventos do modo live, como tarefa em segundo plano (`impeccable live-poll`). No Design Studio, quem faz isso é o **processo principal do app**. Ele roda o `live-poll` da Skill de UX ativa e entrega cada evento (gerar Variantes, orientar, aplicar edições de texto) como um turno ao agente da conversa. Um prompt de sistema anula a instrução da skill de manter o próprio loop.

**Por quê:**

- O app é multi-agente visível (Claude e Devin; o Copilot saiu do escopo em 2026-10-01), e o harness do Hive abre **um processo por turno**. Um loop mantido pelo agente só funciona razoavelmente com o Claude Code numa sessão viva.
- Com o app sempre escutando, "aplicar edições de texto" nunca cai no recurso de fallback do servidor do live. Esse recurso dispara `claude`/`codex` com as permissões desligadas.

## Considered Options

- **Consumir o HTTP `/poll` direto:** rejeitado. A CLI faz trabalho obrigatório do lado do cliente: as `_instructions`, o `live-accept` e o reconhecimento de conclusão. O app embrulha a CLI, não reimplementa o protocolo.

## Consequences

- O app depende do contrato de CLI do live, que é interno. O fork `iu-memorable` mantém os mesmos comandos. A Skill de UX segue sempre na última versão, com um teste rápido do live e volta à versão anterior se ele falhar.
- O palco precisa manter a página viva, só escondida, nunca desmontada. Se a conexão SSE cair por mais de 8 s, o servidor encerra a sessão e remove a injeção.
- O indicador de "agente conectado" do overlay mostra que o app está escutando, não que um turno está rodando.
