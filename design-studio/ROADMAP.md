# Design Studio — Roadmap

App desktop onde PMs e designers de UX do Itaú transformam dores reais de clientes em Protótipos mockados para testar com clientes ("errar rápido"). A referência de experiência é o Claude Design. Vocabulário em [GLOSSARY.md](GLOSSARY.md), decisões difíceis de reverter em [docs/adr/](docs/adr/).

**Por que um app, e não o Claude Design:** o Claude Design já atende PMs. O que ele não faz, e justifica este app, é:

- **contexto de dor real**: Fontes → Relatório de Fonte → Dores;
- **Protótipo publicável**: código que vira URL para teste;
- **dados dentro da conta AWS do banco**;
- **Skill de UX + DS Itaú**.

Feature que não serve a nenhum desses diferenciais fica fora.

## v1 — POC (escopo fechado em 2026-10-01)

**Pergunta que o POC responde:** um PM que nunca abriu um terminal consegue ir de uma Dor real a uma Proposta melhorada, rodando ao vivo, numa única sessão e sem ajuda técnica?

**Plataforma:**

- Electron, Windows primeiro, sem pré-requisito além do login.
- Mora em `hive/design-studio/`, sem nenhum import de fora da pasta ([0002](docs/adr/0002-harness-copiado-do-hive.md)).
- Multi-agente visível: Claude e Devin, cada um com seus modelos. O Copilot saiu do escopo em 2026-10-01. Agentes sem sub-agentes usam o modo degradado do impeccable.
- O design system do app é próprio, diferente do Hive, e é desenhado com o impeccable. PRODUCT.md e DESIGN.md ficam nesta pasta.
- Interface só em pt-BR.

**Dados:**

- Só sintéticos, lidos pelas skills de relatório ([0001](docs/adr/0001-porte-com-pontos-de-troca.md)).
- 2–3 Produtos (ex.: Câmbio e Extrato) com as Dores do briefing original já semeadas: histórico que não passa de 90 dias, estorno de câmbio sem notificação, rage click. Elas convivem com ruído realista nas três Fontes.

**Fluxo guiado:** escolher o Produto → escolher a Fonte → gerar o Relatório de Fonte → Painel de Top Dores (Top 5 por Fonte) → criar um Protótipo. Não há passo "Conecte seus dados" no POC.

**Relatório de Fonte:** uma skill embarcada por Fonte grava um arquivo datado por Produto, Fonte e período. Ele tem duas partes:

- as Dores ranqueadas em formato estruturado, que alimentam o Painel;
- uma narrativa com citações e Evidências, que serve de contexto para o agente.

Um relatório novo vira um arquivo novo, e o histórico é preservado.

**Fluxo solto:**

- Há chat em dois escopos. No **Produto**, o usuário pergunta sobre Dores e Relatórios e pode criar um Protótipo a partir da conversa. Dentro de cada **Protótipo** acontece a sessão de design.
- Atalhos: 6 a 8 comandos com rótulos em linguagem de PM, por exemplo "Revisar usabilidade", "Checar acessibilidade", "Deixar mais claro", "Simplificar", "Acabamento final", além dos que geram relatórios.

**Protótipo:**

- **Produto existente:** a Dor é opcional. O agente recria o Atual a partir das Referências.
- **Produto novo:** precisa de um Briefing e não tem Atual.
- Um Protótipo resolve zero ou mais Dores, tem várias Propostas com uma ativa, e cria um Ponto de restauração a cada resposta do agente.
- O template é Angular e vem da Skill de UX ([0004](docs/adr/0004-template-angular.md)): no POC, da skill-irmã `prototipo-angular`. As dependências são instaladas com `npm install` no primeiro Protótipo, e todos compartilham o mesmo `node_modules`.
- A tela é pensada primeiro para celular, com troca entre celular e desktop no palco.
- Os Protótipos ficam em `Documentos/Design Studio/<Produto>/<Protótipo>`.

**Sessão de design:**

- Layout híbrido no estilo do Claude Design: o chat do app de um lado e o Protótipo rodando no palco do outro.
- Dentro do palco, o overlay do impeccable cuida de selecionar elementos, anotar, gerar Variantes, ajustar e aceitar ou descartar. O chat próprio da página e o botão de sair do overlay ficam escondidos.
- O app é dono do loop do live ([0003](docs/adr/0003-app-e-dono-do-loop-do-live.md)).
- O agente age livremente dentro da pasta do Protótipo e roda apenas uma lista fechada de comandos. Fora disso, é bloqueado. O usuário não vê pedidos de permissão técnicos.

**Skill de UX:**

- Fica embarcada no app, com o binário do Windows incluído.
- Atualiza sempre para a versão mais nova. Antes de adotar uma versão, um teste rápido sobe o live num Protótipo de teste. Se falhar, o app mantém a versão anterior e avisa.

## Porte para o banco (feito por outro agente)

Detalhado em [0001](docs/adr/0001-porte-com-pontos-de-troca.md):

- A Skill de UX passa a ser o `iu-memorable`, que tem a mesma CLI e traz o template Angular com o DS Itaú e o comando `mirror`.
- As skills de relatório são reescritas para consultar o Athena.
- O login passa a ser provavelmente pelo Bedrock.
- Entra o passo "Conecte seus dados".
- A atualização da Skill de UX passa a vir de um espelho interno.

## Futuro (depois do POC, a definir)

- **Publicar o Protótipo** num bucket S3 com CloudFront, ou criar um app novo no bucket configurado, via AWS CLI. O app devolve a URL para o teste de usabilidade.
- **Conta AWS e bucket configurados por Protótipo**, direto na interface.
- **Teste com cliente:** integrar ferramentas que aceitam URL de protótipo. Maze e Lyssna têm MCP, mas só de leitura. O MCP da UserTesting cria estudos, mas está em acesso antecipado limitado.
- **Loop de validação:** Hipótese → teste → resultado. Se deu errado, nova Proposta. Se deu certo, Figma.
- **Figma:** gerar a interface validada no Figma via MCP. A Figma já oferece `use_figma`, que escreve no canvas, e `generate_figma_design`, que captura uma UI rodando e a transforma em camadas editáveis.
- **Dor consolidada entre Fontes:** uma mesma Dor com Evidências de várias Fontes.
- **MCP do FullStory**, para o que o export não cobre: replay e screenshot da sessão.

## Riscos abertos

- **Node para o Angular 22:** o Node que roda o `ng serve` precisa ser ≥22.22.3 ou 24.15. Falta verificar se o Node embutido no Electron atende.
- **Rebuild lento no Windows:** acima de 750 ms, o template cru pisca até o HMR chegar.
- **Protocolo do live:** é interno e a skill está sempre na versão mais nova. A proteção é o teste rápido com volta à versão anterior.
- **Recriação do Atual fora do banco:** não existe `mirror` aqui. O agente recria a partir das Referências, então a fidelidade do Atual no POC fica abaixo da que se terá no banco.
- **Esquema dos dados sintéticos:** é um palpite das tabelas reais, e as skills de relatório serão reescritas no porte.
