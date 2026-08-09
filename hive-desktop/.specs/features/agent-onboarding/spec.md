# Spec — `agent-onboarding` (M17)

Uma queixa do usuário, duas causas: **"o app não reconhece o Claude Code que eu
acabei de instalar"** e **"a tela de escolha de agentes não está legal"**. A
primeira é um bug de execução de processo; a segunda é uma tela que só sabe
dizer "instale isso aí" e devolver o usuário ao terminal — exatamente o que o
G1 ("zero-terminal BMAD") promete que não vai acontecer.

## Problema

### 1. A detecção mente por omissão

`agentRegistry.detect()` roda `<binário> --version` pelo `ProcessRunner`, que
chama `child_process.spawn(command, …)` cru. Duas consequências, ambas
reproduzidas:

- **Windows — a única plataforma que hoje tem instalador
  (`package.json#hiveRelease.platforms`) — nunca acha CLI nenhuma.** `npm i -g`
  no Windows escreve três shims (`claude`, `claude.cmd`, `claude.ps1`) em
  `%APPDATA%\npm`. `CreateProcess` não aplica `PATHEXT`: procurando por
  `claude`, ele testa `claude.exe`, não acha, e devolve ENOENT. Pior: mesmo
  achando o `.cmd`, o Node ≥18.20/20.12 recusa executá-lo sem `shell`
  (CVE-2024-27980), então "detectado" viraria "falha ao rodar o turno".
- **macOS/Linux abertos pelo lançador gráfico não herdam o PATH do shell de
  login.** Um app aberto pelo Dock/menu recebe `/usr/bin:/bin:/usr/sbin:/sbin`;
  instalações em `~/.local/bin` (instalador nativo do Claude Code), no prefixo
  do nvm ou num `prefix` custom do npm ficam invisíveis. Verificado aqui: com
  `PATH=/usr/local/bin:/usr/bin:/bin`, os três probes dão `ENOENT`.

E o resultado do probe é **memoizado para sempre** (`detectCache`), sem nenhuma
forma de repetir a busca: quem instala a CLI com o app aberto precisa reiniciar
— e, pelos dois motivos acima, reiniciar não resolve.

### 2. A tela transforma um obstáculo em beco sem saída

A tela de primeira execução lista o que está faltando, entrega um comando de
terminal em texto corrido (`npm i -g @anthropic-ai/claude-code`) e um link
"Como instalar" que joga o usuário no navegador. Para o público-alvo declarado
no `PRODUCT.md` — PMs, analistas e UX **não fluentes em CLI** — isso é o
produto pedindo para o usuário fazer, no terminal, exatamente a coisa que o
produto existe para evitar. E como toda a lista cai no grupo "Precisam ser
instalados" quando a detecção falha, a tela fica sem nenhuma ação possível
além de "Continuar", que está desabilitado.

## Requisitos

- **AO-R1 — Resolução honesta do binário.** Todo spawn do app resolve o comando
  contra um PATH **enriquecido** (o do processo + os diretórios de instalação
  conhecidos por plataforma + o `prefix` do `~/.npmrc` + as versões do nvm) e,
  no Windows, contra o `PATHEXT`. Um `.cmd`/`.bat` resolvido é executado pelo
  `ComSpec` com os argumentos escapados, nunca por `shell: true` sobre a linha
  inteira.
- **AO-R2 — Detecção repetível.** `detect(refresh)` re-executa os probes, e a
  UI tem um controle explícito para pedir isso ("Procurar de novo"), com o
  resultado da última varredura visível.
- **AO-R3 — Instalar de dentro do app.** Claude Code e GitHub Copilot têm
  instalação em um clique (`npm install -g <pacote>`), com progresso ao vivo,
  erro legível e re-detecção automática ao final. O agente recém-instalado
  entra habilitado.
- **AO-R4 — Honestidade sobre o que não dá para instalar.** Devin não tem
  pacote npm; sua linha mantém o link para a documentação do fornecedor e
  **não** ganha botão de instalar. O mesmo vale para qualquer agente quando o
  `npm` não estiver disponível na máquina — nesse caso a tela diz isso, em vez
  de oferecer um botão que vai falhar.
- **AO-R5 — A tela é uma decisão, não um relatório.** Hierarquia: o que está
  pronto para usar primeiro, o que dá para ligar agora em seguida, o que
  depende de terceiros por último. O estado vazio (nenhum agente encontrado)
  ensina a saída em vez de anunciar o fracasso.
- **AO-R6 — Nada regride no perfil.** O mesmo `AgentPicker` serve a primeira
  execução e a folha de perfil; instalar de lá funciona igual.

## Decisões (áreas cinzentas resolvidas durante o build)

- **(a) A correção de PATH mora no `ProcessRunner`, não no `agentRegistry`.**
  Se só o probe enxergasse o binário, "detectado" e "roda" divergiriam no
  primeiro turno. Resolvendo no runner, git, BMAD, npm e MCP herdam a mesma
  correção — e é o `.cmd` do npm no Windows que quebra todos eles igual.
- **(b) Sem consultar o shell de login.** A alternativa clássica
  (`$SHELL -ilc 'echo $PATH'`) custa um subprocesso no boot, depende do rc do
  usuário e é não-determinística em teste. A lista de diretórios conhecidos +
  `~/.npmrc` + varredura do nvm cobre os mesmos casos de forma síncrona e
  testável. Reavaliar se aparecer um gerenciador de versão que não caia nela.
- **(c) `npm install -g`, não um instalador por fornecedor.** É o comando que a
  documentação dos dois agentes manda rodar; reproduzi-lo mantém a instalação
  igual à que o usuário teria feito à mão — inclusive para desinstalar depois,
  fora do Hive. O instalador **não** tenta contornar `EACCES` com `sudo`: ele
  reconhece o erro e explica o que fazer.
- **(d) O botão de instalar vive no card do agente, não num modal.** É uma ação
  sobre uma linha da lista, com progresso que cabe na própria linha; abrir um
  diálogo por cima esconderia as outras opções no exato momento em que o
  usuário está comparando.
- **(e) `available` continua sendo o único portador de verdade.** Um agente
  instalado com sucesso só sai do grupo "instalável" depois que o **probe**
  confirma — não porque o `npm` saiu com código 0.
