# POC construído fora do banco, portado com pontos de troca

O POC do Design Studio é construído numa máquina pessoal, fora do ambiente do Itaú, sem acesso aos dados reais nem ao design system do banco. Dentro da máquina do Itaú, outro agente vai portar o app. Por isso, tudo o que difere entre os dois ambientes é um ponto de troca explícito, e nada além disso pode depender da máquina pessoal:

| Ponto de troca | Fora do banco (POC) | Dentro do banco |
|---|---|---|
| Skill de UX | impeccable + skill-irmã `prototipo-angular` (só o template) | `iu-memorable`: fork completo do impeccable, com a mesma CLI, o template Angular com o DS Itaú e o comando `mirror` |
| Dados das Fontes | arquivos sintéticos lidos pelas skills de relatório | Athena, com as três Fontes (o FullStory chega por export para S3) e um ID de Produto comum |
| Login do agente | o que o harness detectar (assinatura) | provavelmente Bedrock na conta AWS do banco |
| Onboarding "Conecte seus dados" | não existe | entra no porte |
| Origem das atualizações da Skill de UX | upstream: o instalador da própria impeccable, via `npx`, a partir do registro npm | espelho interno |
| Design system das telas dos Protótipos | livre: a impeccable cria qualquer interface (perfil `livre`, [0006](0006-telas-livres-no-poc-ids-por-perfil.md)) | IDS: perfil `ids`, com os tokens e as regras do iu-memorable |

Os valores de cada ponto de troca ficam num único arquivo do módulo no Hive, `resources/design-studio/pontos-de-troca.json` ([0007](0007-modulo-do-hive.md)), e o guia `docs/porte.md` ensina o agente do porte a trocá-los ([0006](0006-telas-livres-no-poc-ids-por-perfil.md)). O app só conhece a pasta da Skill de UX ativa. O template de Protótipo vem dela, e não do app. Os dados sintéticos e o visual livre dos Protótipos não são escolhas de produto: são consequência de não haver acesso, aqui, aos dados reais e ao DS Itaú.

## Considered Options

- **Um MCP local que imitasse as tools do MCP de Athena da AWS** (SQL via DuckDB sobre tabelas sintéticas): faria do porte uma troca de uma entrada no `.mcp.json`. Rejeitado em favor de arquivos lidos pela skill, que deixam o POC mais simples.

## Consequences

- O porte inclui **reescrever as skills de relatório** para consultar o Athena. Esse custo foi aceito conscientemente.
- O esquema dos dados sintéticos é o palpite mais plausível das tabelas reais, não uma cópia delas.
