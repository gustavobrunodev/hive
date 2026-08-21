# multi-workspace — requisitos

O app passa a manter **vários workspaces**, como o VS Code, com uma regra que
não existe lá: um deles é o **principal** e ele obrigatoriamente tem o BMAD
instalado. Os demais podem ou não ter — e essa é a única pergunta que o app faz
sobre uma pasta nova.

## Contexto

Até aqui o Hive tinha um workspace de cada vez (`config.workspacePath` mais uma
MRU de caminhos, M8/`workspace-switching`) e **todo** workspace passava pelos
portões de instalação do BMAD → update → segundo cérebro antes da UI de
trabalho. Isso significa que abrir a pasta de um repositório de terceiros para
conversar com o agente sobre ela escrevia `_bmad/`, `.claude/skills/` e
`second-brain/` dentro dela. É o atrito que esta feature remove.

## Requisitos

### MW-R1 — Registro de workspaces

- **MW-R1.1** O app persiste uma lista de workspaces, cada um com caminho, nome
  de exibição opcional, tipo (`managed` | `light`), sinalizador de principal e
  o instante da última abertura.
- **MW-R1.2** Exatamente um workspace é o principal; o principal é sempre
  `managed`. As duas invariantes são restauradas em toda leitura e escrita, de
  modo que um `config.json` editado à mão não consegue violá-las.
- **MW-R1.3** Um usuário que já tinha workspaces (o `workspacePath` ativo mais
  a MRU) encontra a lista já povoada na primeira abertura: o ativo vira o
  principal, os recentes viram secundários, todos `managed` — antes do
  registro, abrir um workspace *significava* passar pelo portão do BMAD.
- **MW-R1.4** O estado real do BMAD vem sempre do disco
  (`_bmad/_config/manifest.yaml`), nunca do registro. O registro guarda a
  **intenção** do usuário; o disco guarda o fato.

### MW-R2 — Tipos de workspace

- **MW-R2.1** `managed`: o Hive provisiona BMAD e o segundo cérebro na pasta.
- **MW-R2.2** `light`: o Hive **não escreve nada** dentro da pasta. Conversa,
  explorador e controle de versão funcionam; só as superfícies alimentadas pelo
  BMAD (workflows, personas, skills do workspace) ficam vazias.
- **MW-R2.3** A conversão só acontece de `light` para `managed` ("Instalar o
  BMAD aqui"). O caminho inverso deixaria um `_bmad/` para trás e faria do
  rótulo uma mentira.

### MW-R3 — O momento da pergunta

- **MW-R3.1** A pergunta aparece **uma vez**, e só quando é genuína: uma pasta
  secundária, nova para o Hive, sem `_bmad/` no disco.
- **MW-R3.2** O primeiro workspace da vida do app é o principal e não é
  questionado. Uma pasta que já tem `_bmad/` é adotada, não questionada — a
  resposta está no disco.
- **MW-R3.3** A pergunta acontece **antes** de qualquer escrita e antes de o
  workspace ficar ativo: cancelar deixa o app exatamente como estava.
- **MW-R3.4** Nada vem pré-selecionado, e cada opção nomeia as pastas que cria.

### MW-R4 — Trocar de workspace

- **MW-R4.1** A troca continua na mesma janela e continua passando pelas duas
  guardas existentes (revisão pendente do agente, editor com alterações não
  salvas).
- **MW-R4.2** O seletor filtra por nome e por caminho, é operável só pelo
  teclado e oferece `Ctrl+1…9` para pular direto — na mesma ordem que exibe.
- **MW-R4.3** O workspace ativo e uma pasta que sumiu continuam na lista,
  legíveis, mas não são alvos de troca.

### MW-R5 — Editar a lista

- **MW-R5.1** Renomear muda só o nome dentro do Hive.
- **MW-R5.2** Tornar principal converte o alvo para `managed` e o leva pelo
  portão de instalação; o principal anterior fica intacto.
- **MW-R5.3** Remover da lista nunca toca no disco, e o principal não pode ser
  removido.
- **MW-R5.4** Toda ação que escreve no disco ou muda qual é o principal passa
  por uma confirmação que diz o que vai acontecer.
