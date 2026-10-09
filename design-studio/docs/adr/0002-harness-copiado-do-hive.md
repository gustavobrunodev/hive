# Harness de agentes copiado do Hive Desktop, não compartilhado

> **Substituída** pela [0007](0007-modulo-do-hive.md) em 2026-10-08: o Design Studio é um módulo do Hive e usa o harness dele, sem cópia. O texto abaixo fica como histórico.

O Design Studio reaproveita o harness de agentes do Hive Desktop **copiando-o** para dentro de `design-studio/`, em vez de extrair um pacote compartilhado ou importar de `../hive-desktop`.

**Por quê:** a pasta precisa poder ser levantada sozinha para a máquina do banco ([0001](0001-porte-com-pontos-de-troca.md)). Outras razões: o repositório `hive` não tem workspaces nem `package.json` na raiz; um pacote compartilhado obrigaria a mexer no Hive; e o porte levaria o repo `hive` inteiro junto.

**O que é copiado:** os serviços do processo principal, que já não dependem de Electron. São eles `agentAdapter`, `agentService`, `agentRegistry`, `cliAdapterCore` e os adaptadores de cada CLI, `chatHistoryStore`, `approvalService`, `processRunner`, `cliEnv`, MCP e autenticação. No renderer, ficam os hooks `.ts` do chat. Os componentes `.tsx` são reescritos no design system novo, que tem de ser diferente do Hive. O que é só do Hive fica de fora: BMAD, Iniciativas, segunda memória, ditado/voz e SCM.

**O que não é copiado, por decisão (2026-10-08):** o `checkpointService`. Os Pontos de restauração são um serviço próprio do app, sem nenhuma dependência de git, porque o app não pode pedir à pessoa que instale nada além do login.

## Consequences

- Nenhum import pode sair de `design-studio/`. Um teste de fronteira garante isso, como o `moduleBoundaries.test.ts` do Hive.
- O commit do Hive de onde veio a cópia fica registrado, para comparar depois. Correções feitas no harness do Hive não chegam aqui sozinhas.
