# Spec — `agent-terminal` (M20)

**O pedido:** "poder escolher/configurar o terminal que o agente vai utilizar,
entre os que estão disponíveis no sistema (Windows: PowerShell, Git Bash, cmd)"
— com a observação explícita de que **no Windows o padrão deve ser o CMD**.

## Problema

Hoje a escolha não existe, e o que acontece no lugar dela é invisível:

1. **O app nunca decide o shell — ele herda um.** `createProcessRunner` chama
   `spawn(command, args)` direto, com `stdio[0] = 'ignore'` e o `PATH`
   alargado do `cliEnv.ts`. Não há shell no meio, exceto no único caso em que
   o Node se recusa a rodar sem um: um shim `.cmd`/`.bat` do npm no Windows,
   que vai por `cmd.exe /d /s /c` (CVE-2024-27980). Ou seja, **o Windows já
   roda o agente por dentro do cmd** — só que por acidente de empacotamento,
   sem que ninguém tenha escolhido e sem que nada na tela diga isso.

2. **O agente escolhe o *próprio* shell sozinho, e a regra não é óbvia.**
   Medido no binário real (`claude 2.1.226`, `strings` sobre
   `bin/claude.exe`), a CLI do Claude Code decide assim:

   - **POSIX:** `CLAUDE_CODE_SHELL=<caminho>` é aceito **só** se o caminho
     contiver `bash` ou `zsh` **e** for executável (`X_OK`, ou `--version`
     saindo 0). Qualquer outra coisa é registrada como
     `"…is not a valid bash/zsh path, falling back to detection"` e ignorada —
     a detecção então olha `$SHELL` e procura `zsh`/`bash` em `/bin`,
     `/usr/bin`, `/usr/local/bin`, `/opt/homebrew/bin`.
   - **Windows:** o executor de `Bash` é o **Git Bash**, apontado por
     `CLAUDE_CODE_GIT_BASH_PATH` (o basename precisa ser `bash.exe`/`sh.exe`/
     `bash`/`sh` e o arquivo precisa existir), senão auto-detectado em
     `%ProgramFiles%\Git\bin\bash.exe` e vizinhos. `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`
     liga a ferramenta **PowerShell** (preview) — e ela liga sozinha quando
     não há Git Bash nenhum. **Não existe executor `cmd`**: escolher cmd
     muda quem *lança* a CLI, não quem roda os comandos dela.

   Nada disso aparece em lugar nenhum do app, e o usuário não tem como
   influenciar.

3. **A consequência prática.** Numa máquina com Git Bash instalado e um
   usuário que trabalha em PowerShell, o agente executa comandos numa sintaxe
   que não é a do usuário — e vice-versa. O app não oferece nem a escolha nem
   a explicação.

## Requisitos

- **AT-R1 — Catálogo real.** O app detecta os shells **presentes na máquina**
  (não uma lista fixa): no Windows `cmd`, Windows PowerShell, PowerShell 7+
  (`pwsh`) e Git Bash; em POSIX o que estiver em `/etc/shells`, no `$SHELL` e
  nos prefixos conhecidos (`/bin`, `/usr/bin`, `/usr/local/bin`,
  `/opt/homebrew/bin`). Cada entrada carrega o **caminho absoluto** que foi
  encontrado — evidência verificável, no mesmo espírito do `--version` que o
  `AgentPicker` mostra. Um shell que não existe não aparece.

- **AT-R2 — Escolha persistida, com "Automático".** A escolha é global (não
  por workspace), vive em `config.json` (`agentShell`) e sobrevive a
  reinício. `null` = **Automático**, que resolve para **`cmd` no Windows** e
  para o `$SHELL` do usuário em POSIX (caindo em `bash` → `sh` quando o
  `$SHELL` não é um shell que o app conhece).

- **AT-R3 — A escolha vale de verdade no lançamento.** O turno do agente é
  lançado **por dentro** do shell escolhido:
  `cmd.exe /d /s /c "…"` · `powershell -NoLogo -NoProfile -NonInteractive
  -Command …` · `<shell> -c 'exec …'`. Três invariantes, porque as três já
  quebraram software parecido:
  - **nada de perfil/rc** (`-NoProfile`, e `-c` sem `-l`/`-i`): um banner de rc
    entra no stdout que o parser de `stream-json` lê;
  - **`exec` em POSIX**: sem ele o `kill()` mata o shell e deixa a CLI viva —
    o botão "parar" pararia de funcionar;
  - **código de saída preservado** (`exit $LASTEXITCODE` no PowerShell), senão
    um turno que falhou é reportado como concluído.

- **AT-R4 — A escolha vale no *agente*, quando o agente permite.** Cada
  adapter traduz o shell escolhido para o que a **sua** CLI entende, e essa
  tradução é do adapter (a UI e o runner continuam sem saber o que é
  `CLAUDE_CODE_*`). Claude: `CLAUDE_CODE_SHELL` (bash/zsh em POSIX),
  `CLAUDE_CODE_GIT_BASH_PATH` (Git Bash no Windows),
  `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` (PowerShell no Windows). Copilot e Devin
  não publicam variável equivalente — para eles a escolha é só de lançamento.

- **AT-R5 — A tela não mente.** Onde a escolha não alcança os comandos do
  agente, a UI diz isso na hora da escolha, por agente habilitado — inclusive
  no caso que o pedido nomeia como padrão (`cmd` no Windows, onde o Claude
  continua rodando `Bash` pelo Git Bash / PowerShell). Um seletor que
  prometesse "o agente vai usar o cmd" seria falso.

- **AT-R6 — Sem regressão.** `npm run verify` verde, gate E2E verde, e o passe
  visual nos três temas (`docs/visual-validation.md`).

## Decisões (áreas cinzentas resolvidas durante o build)

- **D-AT-1 — Só o turno do agente passa pelo shell.** `git`, `npx bmad-method`,
  o probe MCP e o probe `--version` continuam com spawn direto. O parser de
  cada um desses depende do stdout exato, e nenhum deles é "o terminal do
  agente" — alargar o alcance seria risco sem pedido.

- **D-AT-2 — O padrão do Windows é `cmd`, mesmo sabendo que o Claude não
  executa nele.** Foi pedido explicitamente, é o que já acontece de fato hoje
  (shim `.cmd` do npm), e a UI carrega a ressalva (AT-R5) em vez de esconder.

- **D-AT-3 — Aspas: uma passada por família.** cmd reusa o `escapeCmdArgument`
  que já existe (duas passadas: argv + metacaracteres). PowerShell usa **só
  aspas simples** no script, para que o argumento único que o Node entrega
  não precise sobreviver a um segundo nível de escape de aspas duplas. POSIX
  usa aspas simples com o `'\''` clássico.

- **D-AT-4 — Um shell que sumiu não trava o app.** Se o id salvo não existe
  mais (Git Bash desinstalado), a resolução cai no automático e a tela mostra
  a escolha como indisponível, sem apagá-la do disco — voltar a instalar
  restaura a escolha do usuário.
