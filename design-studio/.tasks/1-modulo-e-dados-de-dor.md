# 1 · Módulo no Hive, Dados de dor e conversa do Produto

> Construa com **tlc-implement** (`.claude/skills/tlc-implement/`). Cada critério abaixo vira uma checagem com prova, referenciada pelo número. Nada em `Unresolved` se decide durante a construção.

Ordem do corte: **T** e **1** em paralelo, depois **2**, depois **2b**, depois **3**. O Design Studio é um módulo do Hive Desktop (ADR 0007, decisão do usuário em 2026-10-08), e o código mora no `hive-desktop`.

Dois lotes desta tarefa já estão construídos no branch `feat/design-studio-modulo`, com testes (seção "Já construído"). Os critérios abaixo são só o que falta.

## Intent

PMs e designers de UX do banco conhecem a fundo as Dores dos clientes, mas elas estão espalhadas em três Fontes (Likert, Voz do Cliente e FullStory). O único caminho para usar um agente de código passa por terminal, git e MCP, que essas pessoas não sabem usar (PRODUCT, Users).

No branch, o módulo já mostra as Dores, as Evidências e os Relatórios, e já gera um Relatório. Mas o Início ainda é só uma saudação, e a página de conversa é uma casca. A pessoa vê a Dor e não consegue conversar com o agente sobre ela dentro do módulo, então o fluxo do POC para antes de chegar ao agente. Além disso, nada no código diz o que muda quando o módulo for para o banco: os pontos de troca ainda não têm lugar (ADR 0006).

O que muda:

- O Início ganha o campo do chat, no padrão do Claude Design: agente e modelo (Claude ou Devin), voz pelo ditado do Hive, anexos, Dores citadas com `@` e Relatórios anexados.
- O Início também ganha as "Dores em alta" e o primeiro Relatório guiado pela conversa.
- A conversa do Produto passa a funcionar, com os Relatórios como contexto, perguntas prontas e as Dores citadas virando chips.
- Os botões da folha da Dor e dos Gráficos que mandam para o chat passam a chegar ao chat.
- Tudo o que muda no banco fica num arquivo único, junto com o perfil de design.

24 critérios em 6 fatias · 2 portas de mão única · 6 em aberto, dos quais 1 bloqueia a entrada em uso

## Já construído

Construído nos lotes 1 e 2 (2026-10-04 e 2026-10-05), que seguiram a tarefa anterior do módulo (`design-studio-a`, fora do git). As notas estão em `hive-desktop/.specs/project/STATE.md`, nas seções "Design Studio no Hive — lote 1" e "lote 2". Nada aqui é refeito, e os critérios novos usam o que existe.

| O que existe | Onde | Prova |
|---|---|---|
| A linha "Design Studio" logo abaixo de "+ Novo", a navegação do módulo (Início, Dores, Relatórios, Recentes), as páginas que não desmontam e o módulo que reabre no Início | `src/renderer/src/designStudio/ChatTabBody.tsx`, `DesignStudioNav.tsx` e `useDesignStudio.ts` (commit `8965a25`) | `shell.test.ts`, `nav.test.ts`, `useDesignStudio.test.ts` e o E2E do lote 1 (`83761a1`) |
| `<raiz>` = `Documentos/Design Studio`, com uma pasta por Produto no nome da tela, e Recentes lido do `chatHistoryStore` | `src/main/designStudio/dataRoot.ts` e `conversations.ts` (`6d0b36c`) | `dataRoot.test.ts`, `conversations.test.ts` |
| O catálogo (3 Produtos e as telas da jornada), os dados de exemplo das três Fontes e as três skills de relatório | `resources/design-studio/` (`52b3e6d`, `c98d00f`) | `relatorioSkill.test.ts` |
| O formato do Relatório: Markdown com front matter YAML, `relatorio-de-fonte/1` | `src/main/designStudio/relatorioFormato.ts` | `relatorioFormato.test.ts` |
| Relatórios em `<raiz>/<Produto>/relatorios/<fonte>/`; uma Dor é citada pelo caminho do arquivo mais o id | `relatorios.ts` | `relatorios.test.ts` |
| A geração do Relatório no main, com progresso e publicação só de arquivo válido | `relatorioGeracao.ts` | `relatorioGeracao.test.ts`, `geracao.test.ts` |
| O turno com escopo (pasta, leitura, escrita e comandos), respondido sem cartão para Claude e Devin | `turnScope.ts` e `TurnOpts.scope` (`3492fdf`) | `turnScope.test.ts` |
| Dores, Onde dói, a folha da Dor, Relatórios, Leitura e Gráficos | `src/renderer/src/designStudio/pages/` (`f69efeb`) | os testes do lote 2 (`eec5c29`, `1e40e56`, `af66534`) |
| O módulo só usa valores do `@hive/design-system` | `dsOnly.test.ts` | o próprio teste |
| Os rascunhos que a folha escreve ("Citar no chat", "Perguntar ao agente"), à espera dos campos deste lote | `useRascunhos.ts` | `useRascunhos.test.ts` |

## Criteria

### O Início

1. Quando a pessoa abre o módulo, o Início mostra, embaixo da saudação que já existe:
   - o campo do chat, com o foco;
   - a dica "`Enter` envia · `Shift`+`Enter` quebra a linha · `Ctrl`+`V` cola prints · `@` cita Dores";
   - a escolha de Produto (Câmbio, Extrato, Pix);
   - a seção "Dores em alta".
2. Dado o Produto escolhido, "Dores em alta" mostra as 2 Dores de maior impacto (no empate, de maior tendência) de cada Fonte que tem Relatório. Tocar numa nota cita a Dor no campo e marca a nota, e tocar de novo tira a citação. "Ver todas" leva às Dores do Produto. Uma Fonte sem Relatório mostra "Ainda sem Relatório de <Fonte>" e o botão "Gerar", que usa a geração que já existe.
3. Dado um Produto sem nenhum Relatório, o Início mostra "<Produto> ainda não tem Relatórios de Fonte." e o botão "Gerar o primeiro Relatório de <Produto>". Tocar nele abre uma conversa do Produto com a pergunta "Por qual Fonte quer começar?" e um botão para cada Fonte sem Relatório. Tocar numa Fonte gera o Relatório com os quatro passos dentro da conversa, que termina com o destaque e as Dores que mais pesam.

### O campo do chat do módulo

4. O seletor de agente do campo mostra só Claude e Devin, com a logo e os modelos que a CLI de cada um oferece, como o seletor do Hive. Escolher mostra o aviso "<Agente> <Modelo> vai responder". O Copilot não aparece no módulo.
5. Se o campo está vazio, sem anexo e sem Dor citada, ou se o ditado está gravando, então o botão Enviar fica desabilitado.
6. Quando a pessoa digita `@` no campo, então abre a lista de até 9 Dores do Produto com Relatório, ordenadas por impacto e, no empate, por volume. Escolher uma põe o chip da Dor no campo, e o "×" do chip tira a citação. Sem nenhum Relatório, a lista diz "Ainda não há Relatórios de <Produto>."
7. Quando a pessoa anexa uma imagem, um PDF ou um `.docx` (pelo menu +, arrastando para o campo ou com `Ctrl`+`V`), então o arquivo aparece como anexo removível e vai para o agente junto com a mensagem.
8. Quando a pessoa escolhe "Anexar um Relatório de Fonte" no menu +, então vê os Relatórios já gerados. O escolhido vira o anexo "Relatório de <Fonte> · <Produto>" e vai para o agente como contexto.
9. Quando a pessoa toca no microfone e fala, então o ditado do Hive (Whisper, offline) transcreve em pt-BR, e o texto entra no campo depois do que já estava escrito. Nenhum áudio sai da máquina.

### A conversa do Produto

10. Quando a pessoa envia "Quais Dores crescem mais?" no Início, então abre uma conversa do Produto escolhido, que entra em Recentes. A conversa mostra:
    - esse texto como título, cortado em 46 caracteres;
    - os chips "<Produto>", "<n> de 3 Relatórios" e "Sem Protótipo";
    - a mensagem da pessoa e a resposta do agente sendo escrita.
11. Dado um Produto com Relatórios, quando a pessoa envia uma mensagem numa conversa dele, então o turno do agente recebe a narrativa e as Dores ranqueadas do Relatório mais novo de cada Fonte desse Produto.
12. Quando a resposta do agente cita uma Dor do Produto, então ela aparece como chip da Dor, e tocar no chip abre a folha da Dor.
13. Numa conversa do Produto, os botões "Quais Dores crescem mais?", "Compare as três Fontes", "O que a Voz do Cliente diz?" e "Por onde você começaria?" enviam o próprio texto como mensagem.
14. Enquanto o agente responde, o botão de enviar vira "Parar", como no chat do Hive, e a pessoa não consegue mandar outra mensagem até a resposta terminar ou ser parada.
15. Quando a pessoa troca de agente no meio de uma conversa, então a conversa ganha a linha "Agente trocado para <Agente>", e a próxima resposta vem do novo agente.
16. Quando a pessoa fecha e reabre o Hive, então as conversas do módulo continuam em Recentes, e abrir uma mostra as mensagens na mesma ordem, com o agente e o modelo de cada resposta.
17. Sempre, o que o agente faz por baixo não aparece na conversa do módulo: nada de chamada de ferramenta, comando, caminho de arquivo, MCP, git ou pedido de permissão. O módulo mostra só o texto da resposta e, quando houver, linhas de ação em linguagem de PM.
18. Sempre, um turno da conversa do Produto roda com o turno com escopo do Hive (`turnScope.ts`), só com leitura de `<raiz>/<Produto>/relatorios/` e sem comandos. Uma escrita ou um comando é negado sem cartão.

### As páginas já construídas chegam ao chat

19. Na folha da Dor, "Citar no chat" põe o chip da Dor no campo do Início (ou no da conversa aberta) e fecha a folha. "Perguntar ao agente" abre uma conversa do Produto com a mensagem "Me explique a Dor “<título>” e o que você mudaria primeiro.", já citando a Dor.
20. Nos Gráficos, "Perguntar ao agente" de um insight abre uma conversa do Produto sobre aquela categoria.

### Pontos de troca e perfil de design (ADR 0006)

21. Sempre, tudo o que muda entre a máquina pessoal e a do banco (ADR 0001) é lido de um único arquivo, `resources/design-studio/pontos-de-troca.json` (decisão 1). Esse arquivo guarda:
    - o pacote e o registro da Skill de UX;
    - o template;
    - o perfil de design;
    - as skills de relatório;
    - o catálogo e os dados de exemplo.

    Nenhum desses valores está escrito no código. Trocar um valor no arquivo e reabrir o Hive troca o comportamento do módulo, sem mudar código.
22. Se `pontos-de-troca.json` ou o perfil de design apontado por ele não seguem o formato (decisões 1 e 2), então a área do Design Studio mostra uma tela de erro de configuração com o nome do arquivo (texto no Unresolved 6) e grava o motivo no log. O resto do Hive funciona normalmente.

### Qualidade das telas novas

23. Sempre, nas telas e nos estados novos desta tarefa, e em todos os temas do Hive:
    - o axe não aponta nenhuma violação;
    - todo controle é alcançável por Tab e acionável por Enter ou Espaço;
    - o foco é visível.
24. Sempre, o código novo desta tarefa continua passando no `dsOnly.test.ts`: nenhuma cor ou fonte fora dos tokens do `@hive/design-system`.

## Out of scope

- Protótipos, o seletor de Protótipo do campo, "Resolver esta Dor", "Criar Protótipo" e "Continuar": ficam na tarefa 2.
- Configurações do módulo (Skill de UX, Fontes de dados, pasta): ficam na tarefa 3. O agente padrão, o modelo padrão e o tema são do Hive e já existem.
- "Abrir o replay no FullStory": com dados sintéticos não existe replay, e o MCP do FullStory está no Futuro do ROADMAP.
- Dor consolidada entre Fontes: está no Futuro do ROADMAP.
- "Conecte seus dados" e Athena: entram no porte (ADR 0001).
- Navegar entre versões antigas de um Relatório, ou apagar uma conversa ou um Relatório: nenhuma fonte pede.
- O Copilot no módulo: saiu do escopo do produto em 2026-10-01. Ele continua no resto do Hive.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela Início | estado vazio (Produto sem Relatório) | 3 |
| tela Início | carregando (Relatório sendo gerado) | 3; existing: o progresso da geração (`relatorioGeracao.ts`) |
| tela Início | erro na geração | existing: a geração só publica arquivo válido e avisa a falha (lote 2) |
| tela Início | densidade e ordem | 1, 2 |
| campo do chat | vazio | 5 |
| campo do chat | ditado | 9; existing: o ditado do Hive |
| conversa do Produto | vazia | 13 (perguntas prontas) |
| conversa do Produto | carregando | 10, 14 |
| conversa do Produto | erro: agente sem login ou turno que falha | Unresolved 2 |
| conversa do Produto | sem autorização | n/a: o Hive é local e de uma pessoa só; o escopo do turno é o 18 |
| conversa do Produto | ordem | 16 |
| Recentes | ordem | existing: lote 1 |
| área do módulo | configuração inválida | 22, Unresolved 6 |
| Dores, folha, Relatórios, Leitura e Gráficos | todos os estados | existing: lote 2 |
| documento: turno do agente na conversa do Produto | estrutura | 11, 18 |

## Swept

- validation: 5 (envio vazio), 22 (configuração fora do formato); existing: o Relatório fora do formato é recusado (`relatorioFormato.ts`)
- failure modes: 22, Unresolved 2; existing: a falha da geração (lote 2)
- idempotency and retry: existing: gerar de novo grava um arquivo novo e nunca sobrescreve (lote 2)
- authorization: 18 (escopo do turno)
- concurrency and ordering: 14 (uma resposta por vez); existing: um Relatório por vez (lote 2)
- data lifecycle: 16 (as conversas ficam); apagar está em Out of scope
- external-dependency failure: Unresolved 1 (CLI do Devin numa máquina limpa); existing: a instalação do Claude Code pelo Hive (`agentInstaller.ts`)
- state transitions: n/a: esta tarefa não muda ciclo de vida; o do Relatório já existe (lote 2)
- observability: Unresolved 4

## Impact

| Front | What changes |
|---|---|
| domain | termo novo: conversa do Produto, o chat sem Protótipo do módulo (no protótipo, "conversa livre"). É uma sessão do `chatHistoryStore` chaveada por `<raiz>/<produto>` (lote 1) |
| domain | termo novo: ponto de troca, um valor que muda entre a máquina pessoal e o banco (ADR 0001). Todos vivem em `pontos-de-troca.json` (decisão 1) |
| domain | termo novo: perfil de design, as regras de design system das telas dos Protótipos (decisão 2). O POC usa o Livre, e o porte escreve o do IDS (ADR 0006) |
| domain | termo novo: Categoria (de Dor). Já existe no formato do Relatório (`relatorioFormato.ts`) e ainda não está no GLOSSARY (Unresolved 5) |
| Hive | o seletor de agente do módulo filtra o Copilot (4). O ditado, o anexo e o "Parar" do campo vêm do chat do Hive |
| stored data | nada a migrar: os Relatórios e as conversas do lote 2 seguem no mesmo formato e na mesma pasta |
| sources | a ADR 0007 substituiu a 0002, e o ROADMAP e o PRODUCT foram emendados (2026-10-08) |

## Decided

| Decision | Shape | Alternative rejected |
|---|---|---|
| 1. Todos os pontos de troca num único arquivo do módulo | `resources/design-studio/pontos-de-troca.json`, no bloco "Pontos de troca" abaixo. É o único arquivo que o porte edita, e o guia `docs/porte.md` (tarefa 3) explica cada campo | Valores espalhados pelo código e por variáveis de ambiente: o agente do porte teria de caçá-los, contra o princípio 5 ("Portável", PRODUCT) e a ADR 0001. **Alcança o porte:** é aqui que o agente do banco troca a Skill de UX, o template, o perfil, as skills de relatório, o catálogo e os dados |
| 2. O perfil de design | um JSON por perfil, no bloco "Perfil de design" abaixo. O módulo traz o perfil Livre e o perfil de exemplo restrito, que só os testes usam e cujos tokens vêm de `design-studio/prototype/proto.css` | Ligar o IDS por código, com condicionais: cada regra nova do banco viraria uma mudança de código, sem prova prévia. **Alcança o porte:** o perfil `ids` é escrito no banco, com os tokens e as regras do iu-memorable (ADR 0006) |

Pontos de troca (decisão 1). Os caminhos são relativos a `resources/design-studio/`:

```jsonc
{
  "formato": "pontos-de-troca/1",
  "skillDeUx": {
    "pacote": "impeccable",                      // no banco: o pacote do iu-memorable
    "registro": "https://registry.npmjs.org/",   // no banco: o espelho interno
    "versaoEmbarcada": "4.1.0"
  },
  "template": "skills/prototipo-angular/template",  // no banco: o template Angular do iu-memorable
  "perfilDeDesign": "perfis/livre.json",            // no banco: perfis/ids.json
  "skillsDeRelatorio": "skills",                    // relatorio-likert, relatorio-voz, relatorio-fullstory; no banco: as reescritas para o Athena
  "catalogo": "catalogo.json",                      // no banco: o catálogo de Produtos do banco
  "dadosDeExemplo": "dados-de-exemplo"              // no banco: null
}
```

Perfil de design (decisão 2):

```jsonc
// perfis/livre.json: o perfil do POC
{
  "formato": "perfil-de-design/1",
  "nome": "Livre",
  "trocaDeEstilo": true,              // libera "Mudar o estilo" no Editar (tarefa 2b)
  "tokens": {
    "arquivo": "src/styles/tokens.css", // onde mora a identidade de cada Protótipo (tarefa T, decisão 3)
    "modelo": null,                   // arquivo copiado para o Protótipo ao criar; null = os tokens neutros do template
    "agentePodeEditar": true
  },
  "cores": "livres",                  // livres | so-tokens
  "fontes": "livres",                 // livres | lista de famílias, como ["Lato"]
  "regras": []                        // documentos que entram em todo turno de Protótipo e de geração
}

// perfis/restrito-exemplo.json: só nos testes, com os tokens tirados de prototype/proto.css
{
  "formato": "perfil-de-design/1",
  "nome": "Restrito (exemplo)",
  "trocaDeEstilo": false,
  "tokens": { "arquivo": "src/styles/tokens.css", "modelo": "perfis/tokens-exemplo.css", "agentePodeEditar": false },
  "cores": "so-tokens",
  "fontes": ["Lato"],
  "regras": ["perfis/regras-exemplo.md"]
}
```

## Sources

- [ADR 0007](../docs/adr/0007-modulo-do-hive.md): o Design Studio é um módulo do Hive, com a entrada abaixo de "+ Novo", o harness do Hive e o `@hive/design-system`.
- [PRODUCT.md](../PRODUCT.md): os usuários, a experiência (chat como primeira tela; agente e modelo; voz; colar e anexar; `@`), Dores no chat e na lateral, multi-agente com logos, sem pedido de permissão técnico, WCAG 2.2 AA, só pt-BR e dados de exemplo rotulados. Emendado em 2026-10-08 para o módulo do Hive (ADR 0007) e para as telas livres no POC (ADR 0006).
- [ROADMAP.md](../ROADMAP.md), v1: Plataforma (emendada), Dados, Fluxo guiado e Fluxo solto (chat no Produto).
- [GLOSSARY.md](../GLOSSARY.md): o vocabulário canônico.
- [ADR 0001](../docs/adr/0001-porte-com-pontos-de-troca.md) e [ADR 0006](../docs/adr/0006-telas-livres-no-poc-ids-por-perfil.md): os pontos de troca, o arquivo único e o perfil de design.
- `hive-desktop/.specs/project/STATE.md`, "Design Studio no Hive — lote 1" e "lote 2": o que já foi construído e as lições, como uma assinatura de `agent.onEvent` por janela e o `ToastProvider` com `viewport={false}`.
- [prototype/](../prototype/): **vinculante para as telas desta tarefa e para o texto delas**. O Início está em `home.js`, o campo do chat e os menus em `composer.js`, e a conversa do Produto e o fluxo guiado no chat em `chat.js`. Os valores visuais vêm do `@hive/design-system`, e não do `styles.css` do protótipo (ADR 0007). Quando um critério cita um texto entre aspas, ele vem desses arquivos.

Esta tarefa é o registro da decisão. Se um documento linkado divergir dela, pergunte antes de construir.

## Unresolved

| # | Kind | Question | Until answered |
|---|---|---|---|
| 1 | blocks go-live | Como a CLI do Devin chega à máquina da pessoa, se o ROADMAP promete "sem pré-requisito além do login"? O instalador do Hive (`agentInstaller.ts`) só instala o Claude Code, por `npm install -g`, que exige npm na máquina; o Devin aparece como `not-installable`. | As provas rodam numa máquina que já tem as CLIs. Numa máquina limpa, o Devin não fica disponível, e o Claude depende do Node que a tarefa 2 resolve (decisão 4 de lá). |
| 2 | open | O que a conversa do módulo mostra quando o agente escolhido não está conectado à conta, ou quando um turno falha no meio? | Escrito por enquanto: o mesmo aviso e o mesmo reparo de conta do chat do Hive; num turno que falha, "Não consegui responder agora. Tente de novo." |
| 3 | open | O módulo mostra itens do roadmap marcados como "Próxima versão", como o protótipo faz (Dor consolidada, Conectar ao banco de dados, Publicar, Testar com clientes, Enviar ao Figma)? | Escrito por enquanto: não mostra. Vale também para as tarefas 2 e 3. |
| 4 | open | Onde ficam os registros para diagnosticar um turno ou uma geração que falhou, se os dados não podem sair da conta do banco (PRODUCT, Posicionamento 3)? | Escrito por enquanto: no log do Hive, sem telemetria. |
| 5 | open | "Categoria" de Dor entra no GLOSSARY? | Definição proposta: "Categoria: um tema que agrupa Dores de uma Fonte nos Gráficos do Relatório." |
| 6 | open | Qual é o texto da tela de erro de configuração (22)? | Escrito por enquanto: "O Design Studio não conseguiu ler a configuração (<arquivo>). Fale com quem instalou o Hive." |
