# Design Studio · 1 · Módulo no Hive, Dados de dor e conversa do Produto

Profile: `light` (nenhum `## tlc-implement` no `hive-desktop/AGENTS.md`). Handoff: `on`, budget 150k.

Sources:

- `design-studio/.tasks/1-modulo-e-dados-de-dor.md`: a tarefa. Os critérios 1 a 24, as decisões 1 (pontos de troca) e 2 (perfil de design), "Já construído" (a base, que não se refaz) e os Unresolved 1 a 6 com os textos escritos por enquanto.
- `design-studio/prototype/home.js`, `composer.js`, `chat.js`, `pages.js` (folha da Dor) e `graficos.js` (insight): **vinculantes para as telas desta tarefa e para o texto delas**. Os valores visuais vêm do `@hive/design-system`, e não do `styles.css` do protótipo (ADR 0007).
- `design-studio/docs/adr/0007-modulo-do-hive.md`: o módulo no Hive, o harness do Hive sem cópia, só Claude e Devin, e o `@hive/design-system`.
- `design-studio/docs/adr/0001-porte-com-pontos-de-troca.md` e `0006-telas-livres-no-poc-ids-por-perfil.md`: o arquivo único de pontos de troca e o perfil.
- `design-studio/PRODUCT.md`: "Esconder a máquina" (nada técnico na conversa), WCAG 2.2 AA, só pt-BR e dados de exemplo rotulados.
- `hive-desktop/.specs/project/STATE.md`, "Design Studio no Hive — lote 1" e "lote 2": o que existe e as lições. São três: uma assinatura de `agent.onEvent` por janela, o `ToastProvider` com `viewport={false}`, e `{' '}` em JSX, que reprova no `noInlineStrings`.
- `.checks/design-studio-t.md`: o leitor do perfil (`perfilDeDesign.ts`) e os perfis em `resources/design-studio/perfis/`, que esta tarefa consome nos critérios 21 e 22.

## Out of scope

- Protótipos, o seletor de Protótipo do campo, "Resolver esta Dor", "Criar Protótipo" e "Continuar": tarefa 2.
- Configurações do módulo: tarefa 3. O agente padrão, o modelo padrão e o tema são do Hive e já existem.
- "Abrir o replay no FullStory", a Dor consolidada entre Fontes, "Conecte seus dados" e o Athena: Futuro do ROADMAP ou porte.
- Apagar uma conversa ou um Relatório, e navegar entre versões antigas de um Relatório: nenhuma fonte pede.
- O Copilot no módulo: fora do produto desde 2026-10-01. Ele continua no resto do Hive.
- A CLI do Devin numa máquina limpa: Unresolved 1, que **bloqueia a entrada em uso**, não a construção. As provas rodam com o agente de teste do E2E (`e2e/__fixtures__/scripted-agent-cli.cjs`) e com dublês no Vitest.
- "Categoria" no GLOSSARY (Unresolved 5): é documento de produto, fica para o usuário decidir.

## Landing

O que esta tarefa toca:

- a casca que já existe: `src/renderer/src/designStudio/`, com as páginas Início e Conversa e o shell;
- o main do módulo: `src/main/designStudio/`, mais as ligações IPC em `src/main/index.ts` e `src/preload/index.ts`.

Reaproveita do chat do Hive o `PromptInput` do DS, o `EnginePicker` filtrado, o `AddContextMenu`, a bandeja de anexos, o ditado (`useComposerDictation`) e o "Parar". Do lote 2, reaproveita o turno com escopo (`turnScope.ts`), a geração do Relatório (`relatorioGeracao.ts` e `useGeracao.ts`), os rascunhos da folha (`useRascunhos.ts`) e o `chatHistoryStore`. Nada disso é copiado.

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Todos os pontos de troca num arquivo único (decisão 1) | `resources/design-studio/pontos-de-troca.json`, `formato: "pontos-de-troca/1"`, com `skillDeUx { pacote: "impeccable", registro: "https://registry.npmjs.org/", versaoEmbarcada: "4.1.0" }`, `template: "skills/prototipo-angular/template"`, `perfilDeDesign: "perfis/livre.json"`, `skillsDeRelatorio: "skills"`, `catalogo: "catalogo.json"` e `dadosDeExemplo: "dados-de-exemplo"`. Os caminhos são relativos a `resources/design-studio/`. Um leitor tipado, `src/main/designStudio/pontosDeTroca.ts`, é a única porta de entrada desses valores | Valores espalhados pelo código e por variáveis de ambiente: o agente do porte teria de caçá-los |
| O perfil de design (decisão 2) | o formato `perfil-de-design/1` e o leitor `perfilDeDesign.ts` da tarefa T. O perfil ativo é o que `pontos-de-troca.json` aponta | Ligar o IDS por código, com condicionais |
| Como a resposta do agente cita uma Dor (critério 12) | o turno da conversa do Produto lista cada Dor com o id que ela tem no Relatório e pede que o agente a cite como `[[dor:<id>]]`. O renderer troca cada marca de um id que existe nos Relatórios mais novos do Produto pelo chip da Dor, e a marca de um id desconhecido some do texto | Casar títulos de Dor no texto livre: dá falso positivo com títulos curtos e falha quando o agente parafraseia |
| `axe-core` como dependência de desenvolvimento (critério 23) | `@axe-core/playwright` em `devDependencies` do `hive-desktop`, usado só nos E2E | Conferências escritas à mão: o critério pede "o axe não aponta nenhuma violação", e uma conferência própria não é o axe |
| (lote 1 da construção) O canal IPC da conversa do Produto | pedidos `designStudio:planejarConversa` (cria a sessão se preciso, guarda a mensagem da pessoa, monta prompt, escopo, `resume` e anexos), `designStudio:abandonarConversa`, `designStudio:novaConversa` (o fluxo guiado, sem turno), `designStudio:lerConversa` (a transcrição guardada) e `designStudio:colar` (bytes de um print colado); eventos `designStudio:conversa` do main para toda janela: `{ turnId, produto, conversa } & ({ estado: 'escrevendo', texto } \| { estado: 'pronto', texto, agente, modelo } \| { estado: 'parado', texto, agente, modelo } \| { estado: 'falhou', erro })`. O main assina o `agentService.onEvent`, junta os tokens do turno e grava a resposta; o renderer só chama `agent.send` com o plano | Uma segunda assinatura de `agent.onEvent` no módulo (corta o fluxo do Chat, lição do lote 2) ou o renderer juntando tokens e gravando a resposta (o renderer não sabe onde fica `<raiz>`) |
| (lote 1 da construção) O agente e o modelo de cada resposta, no `chatHistoryStore` (dado guardado) | `StoredChatMessage.agent?: string` (id do agente) e `model?: string` (id do modelo, ausente quando a CLI escolheu), só nas respostas que o módulo grava; `appendMessage` aceita os dois. Ausentes nos arquivos antigos e nas mensagens do chat do Hive: quem lê trata a ausência como "não se sabe" e desenha a resposta sem o cabeçalho do agente. Nada a migrar | Um arquivo à parte em `<raiz>/<Produto>` com o agente de cada resposta (duas fontes para uma transcrição) ou o agente escrito dentro do texto |
| (lote 1 da construção) Onde ficam os anexos que o turno lê | o main copia cada anexo para `<raiz>/<Produto>/relatorios/.anexos/<conversa>/<nome>` no plano, e o turno recebe as cópias como `attachments`; um print colado vai antes para `userData/design-studio-colados/<uuid>/<nome>`. A pasta começa com ponto, como a cópia de trabalho `.parcial` da geração, e não é pasta de Fonte, então nenhuma leitura de Relatório a vê | Abrir `readRoots` para o caminho original de cada anexo (contradiz a 1-C18a, "leitura só em `relatorios/`") ou deixar o anexo onde está (o `Read` do turno com escopo é negado e o agente não abre o arquivo) |
| (lote 1 da construção) O que a conversa guarda | guardadas: a mensagem da pessoa (texto e nomes dos anexos) e a resposta do agente (texto, agente, modelo). Só na memória do módulo, enquanto o Hive está aberto: a linha "Agente trocado para <Agente>", a pergunta "Por qual Fonte quer começar?" com os botões, os passos da geração, o destaque do Relatório pronto e a linha de falha. O fluxo guiado cria a sessão com a linha da pessoa, "Quero gerar o primeiro Relatório de <Produto>" (`home.js`), para entrar em Recentes | Papéis novos de mensagem no `chatHistoryStore` para as linhas do app (uma mudança de formato que o leitor do Hive teria de aprender) |
| (lote 1 da construção) O título da conversa | o renderer corta a primeira mensagem em 46 caracteres (`texto` com os espaços juntados, `.slice(0, 46)`), e o main grava esse título com `rename` logo depois da primeira mensagem | O título automático do `chatHistoryStore` (64 caracteres, cortado em palavra e com "…"), que não é a 1-C10b |
| (lote 1 da construção) A memória do agente quando ele é trocado | o main guarda o id de sessão da CLI por conversa **e** por agente (o `cliSessionId` da sessão vale para o agente da última resposta guardada). A troca de agente começa sessão nova da CLI (`resume: null`, `freshSession: true`) | Um `cliSessionId` por conversa para qualquer agente: o Devin receberia o id do Claude (a classe de defeito do "id de sessão trocado", STATE 2026-09-13) |
| (lote 1 da construção) Qual modelo fica gravado em cada resposta | `model` é o modelo que a CLI informou no próprio turno (`usage.model` do evento `usage`); sem esse informe, o modelo escolhido no campo; ausente só quando não há nenhum dos dois (o campo em "Automático" e uma CLI que não informa) | Gravar só o modelo escolhido no campo: com o seletor em "Automático", a resposta ficaria sem modelo, e a 1-C16 pede o modelo que a deu |

- Portas descobertas durante a construção entram aqui, com a forma literal e a alternativa rejeitada, **antes** do código que as fecha. Os prováveis: o canal IPC da conversa do Produto (o lote 2 já tem um canal próprio por superfície, `designStudio:geracao`); um campo novo nas mensagens do `chatHistoryStore` para o agente e o modelo de cada resposta (dado guardado); e a costura de E2E que aponta o módulo para um `resources/design-studio` alternativo (critérios 21 e 22).

## Checks

Convenção: cada teste começa pelo id da checagem (`it('1-C2a: …')`). Assim o filtro `-t "1-C2a:"` (Vitest) ou `-g "1-C2a:"` (Playwright) seleciona só ele.

- `U <arquivo> <id>` abaixo é `cd hive-desktop && source ~/.nvm/nvm.sh && nvm use 22.22.1 && npm run test -- <arquivo> -t "<id>:"`.
- `E2E <id>` é `cd hive-desktop && source ~/.nvm/nvm.sh && nvm use 22.22.1 && npm run build && xvfb-run -a npx playwright test e2e/design-studio-conversa.spec.ts -g "<id>:"`.

Os arquivos de teste novos ficam em `src/renderer/src/designStudio/` e `src/main/designStudio/`. O E2E fica em `e2e/design-studio-conversa.spec.ts`, novo, ao lado do `design-studio-modulo.spec.ts` dos lotes 1 e 2.

### S1 · O Início · 9 files · 75 KB + WorkUI (parte) · ~26k

**1-C1a** · No Início, abaixo da saudação que já existe, aparecem nesta ordem: o campo do chat, a dica, a escolha de Produto e a seção "Dores em alta".
Proof: `U src/renderer/src/designStudio/inicio.test.ts 1-C1a`

**1-C1b** · Ao abrir o módulo no app real, o foco está no campo do chat do Início.
Proof: `E2E 1-C1b`

**1-C1c** · A dica diz exatamente "`Enter` envia · `Shift`+`Enter` quebra a linha · `Ctrl`+`V` cola prints · `@` cita Dores", com `Enter`, `Shift`, `Ctrl`, `V` e `@` em `<kbd>`.
Proof: `U src/renderer/src/designStudio/inicio.test.ts 1-C1c`

**1-C1d** · A escolha de Produto oferece exatamente Câmbio, Extrato e Pix, nesta ordem, que é a do catálogo.
Proof: `U src/renderer/src/designStudio/inicio.test.ts 1-C1d`

**1-C2a** · Com um Produto escolhido, "Dores em alta" mostra, para cada Fonte com Relatório, as 2 Dores de maior impacto. No empate de impacto, vence a de maior tendência. Uma Dor de impacto menor e uma de mesma faixa com tendência menor ficam de fora.
Proof: `U src/renderer/src/designStudio/inicio.test.ts 1-C2a`

**1-C2b** · Tocar numa nota de "Dores em alta" põe o chip da Dor no campo e marca a nota (`aria-pressed="true"`). Tocar de novo tira o chip e desmarca a nota.
Proof: `U src/renderer/src/designStudio/inicio.test.ts 1-C2b`

**1-C2c** · "Ver todas" leva à página Dores com o Produto escolhido.
Proof: `U src/renderer/src/designStudio/inicio.test.ts 1-C2c`

**1-C2d** · Uma Fonte sem Relatório mostra "Ainda sem Relatório de <Fonte>" e o botão "Gerar". O botão pede a geração que já existe (`designStudio.planejarGeracao`) com esse Produto e essa Fonte.
Proof: `U src/renderer/src/designStudio/inicio.test.ts 1-C2d`

**1-C3a** · Num Produto sem nenhum Relatório, o Início mostra "<Produto> ainda não tem Relatórios de Fonte." e o botão "Gerar o primeiro Relatório de <Produto>".
Proof: `U src/renderer/src/designStudio/inicio.test.ts 1-C3a`

**1-C3b** · Tocar em "Gerar o primeiro Relatório de <Produto>" abre uma conversa do Produto com a pergunta "Por qual Fonte quer começar?" e um botão para cada Fonte sem Relatório, e só para elas.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C3b`

**1-C3c** · Tocar numa dessas Fontes gera o Relatório dentro da conversa. Os quatro passos da geração aparecem na conversa, na ordem em que chegam, e ela termina com o destaque do Relatório e as Dores que mais pesam.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C3c`

### S2 · O campo do chat do módulo · 13 files · 138 KB · ~34k

**1-C4a** · O seletor de agente do campo do módulo lista só Claude e Devin, cada um com a logo e os modelos que o `capabilities()` daquele agente oferece. O Copilot não aparece, mesmo disponível no Hive.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C4a`

**1-C4b** · Escolher um agente e um modelo mostra o aviso "<Agente> <Modelo> vai responder".
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C4b`

**1-C5a** · Com o campo vazio, sem anexo e sem Dor citada, Enviar fica desabilitado, e `Enter` não envia.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C5a`

**1-C5b** · Com o ditado gravando, Enviar fica desabilitado mesmo com texto no campo.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C5b`

**1-C5c** · Com só uma Dor citada, ou só um anexo, e sem texto, Enviar fica habilitado.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C5c`

**1-C6a** · Digitar `@` abre a lista de até 9 Dores do Produto com Relatório, ordenadas por impacto e, no empate, por volume. Com 10 ou mais Dores, a lista mostra 9.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C6a`

**1-C6b** · Escolher uma Dor da lista põe o chip dela no campo, e o "×" do chip tira a citação.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C6b`

**1-C6c** · Sem nenhum Relatório do Produto, a lista do `@` diz "Ainda não há Relatórios de <Produto>."
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C6c`

**1-C7a** · Anexar uma imagem, um PDF e um `.docx` pelo menu + faz cada um aparecer como anexo, com um botão de remover que o tira.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C7a`

**1-C7b** · Arrastar um arquivo para o campo o anexa.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C7b`

**1-C7c** · `Ctrl`+`V` com uma imagem na área de transferência a anexa.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C7c`

**1-C7d** · No app real, um anexo enviado chega ao agente junto com a mensagem: o agente de teste recebe o arquivo no turno.
Proof: `E2E 1-C7d`

**1-C8a** · "Anexar um Relatório de Fonte", no menu +, lista os Relatórios já gerados do Produto.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C8a`

**1-C8b** · O Relatório escolhido vira o anexo "Relatório de <Fonte> · <Produto>".
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C8b`

**1-C8c** · Um Relatório anexado entra no turno do agente como contexto: o turno montado traz o conteúdo daquele arquivo de Relatório.
Proof: `U src/main/designStudio/conversaTurno.test.ts 1-C8c`

**1-C9a** · Tocar no microfone e falar faz o ditado do Hive, em pt-BR, escrever a transcrição no campo, depois do texto que já estava lá.
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C9a`

**1-C9b** · Ditar no campo do módulo não faz nenhuma requisição de rede: `fetch` não é chamado, e o áudio vai só para a ponte local do ditado (`window.hive`).
Proof: `U src/renderer/src/designStudio/campoDoChat.test.ts 1-C9b`

### S3 · A conversa do Produto · 13 files · 251 KB (com `src/main/index.ts` e `src/preload/index.ts`) · ~63k

**1-C10a** · Enviar "Quais Dores crescem mais?" no Início abre uma conversa do Produto escolhido, e essa conversa aparece em Recentes.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C10a`

**1-C10b** · O título da conversa é o texto enviado, cortado em 46 caracteres. Um texto de 60 caracteres vira os primeiros 46, e um de 20 fica inteiro.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C10b`

**1-C10c** · A conversa mostra os chips "<Produto>", "<n> de 3 Relatórios" e "Sem Protótipo", com `n` igual ao número de Fontes do Produto que têm Relatório.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C10c`

**1-C10d** · A conversa mostra a mensagem da pessoa e, logo depois, a resposta do agente crescendo enquanto o turno transmite.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C10d`

**1-C11** · Num Produto com Relatórios, o turno de uma mensagem da conversa traz a narrativa e as Dores ranqueadas do Relatório **mais novo** de cada Fonte desse Produto. Um Relatório mais velho da mesma Fonte não entra, e o de outro Produto também não.
Proof: `U src/main/designStudio/conversaTurno.test.ts 1-C11`

**1-C12a** · Uma resposta do agente com `[[dor:<id>]]` de uma Dor do Produto mostra o chip daquela Dor no lugar da marca, e uma marca com id desconhecido não aparece no texto.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C12a`

**1-C12b** · Tocar no chip de Dor de uma resposta abre a folha daquela Dor.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C12b`

**1-C13** · Na conversa do Produto, os botões "Quais Dores crescem mais?", "Compare as três Fontes", "O que a Voz do Cliente diz?" e "Por onde você começaria?" enviam, cada um, o próprio texto como mensagem.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C13`

**1-C14a** · Enquanto o agente responde, o botão de enviar vira "Parar".
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C14a`

**1-C14b** · Enquanto o agente responde, `Enter` e os botões de pergunta pronta não mandam outra mensagem.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C14b`

**1-C14c** · "Parar" interrompe o turno em curso, e o campo volta a enviar.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C14c`

**1-C15a** · Trocar de agente no meio de uma conversa acrescenta a linha "Agente trocado para <Agente>".
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C15a`

**1-C15b** · Depois da troca, a próxima mensagem vai para o agente novo: o turno sai com o id dele.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C15b`

**1-C16** · No app real, depois de fechar e reabrir o Hive, a conversa continua em Recentes. Ao abri-la, ela mostra as mensagens na mesma ordem, cada resposta com o agente e o modelo que a deram.
Proof: `E2E 1-C16`

**1-C17a** · Um turno cujo fluxo traz chamada de ferramenta, saída de comando, caminho de arquivo, MCP, git e pedido de permissão mostra na conversa do módulo só o texto da resposta. Nenhum desses aparece no DOM da conversa.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-C17a`

**1-C17b** · No app real, com o agente de teste emitindo um `tool_use` e um pedido de permissão, a conversa do módulo não mostra cartão de ferramenta, cartão de permissão nem caminho de arquivo.
Proof: `E2E 1-C17b`

**1-C18a** · O turno da conversa do Produto sai com `TurnOpts.scope` com a pasta `<raiz>/<Produto>`, leitura só em `<raiz>/<Produto>/relatorios/`, nenhuma escrita e nenhum comando.
Proof: `U src/main/designStudio/conversaTurno.test.ts 1-C18a`

**1-C18b** · Com esse escopo, `decideScoped` nega uma escrita, um comando e uma leitura fora de `relatorios/`, e o pedido não vira cartão de aprovação.
Proof: `U src/main/designStudio/conversaTurno.test.ts 1-C18b`

**1-CU2a** · (Unresolved 2, escrito por enquanto) Com o agente escolhido sem conta conectada, a conversa do módulo mostra o mesmo aviso e o mesmo reparo de conta do chat do Hive.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-CU2a`

**1-CU2b** · (Unresolved 2, escrito por enquanto) Um turno que falha no meio deixa na conversa "Não consegui responder agora. Tente de novo.", sem nenhuma mensagem crua do agente.
Proof: `U src/renderer/src/designStudio/conversa.test.ts 1-CU2b`

**1-CU3** · (Unresolved 3, escrito por enquanto) Nem o Início nem a conversa do Produto mostram item marcado "Próxima versão".
Proof: `U src/renderer/src/designStudio/inicio.test.ts 1-CU3`

### S4 · As páginas já construídas chegam ao chat · 4 files · 28 KB · ~7k

**1-C19a** · Na folha da Dor aberta a partir das Dores, "Citar no chat" põe o chip da Dor no campo do Início e fecha a folha.
Proof: `U src/renderer/src/designStudio/folhaDor.test.ts 1-C19a`

**1-C19b** · Com uma conversa do Produto aberta, "Citar no chat" põe o chip no campo dessa conversa.
Proof: `U src/renderer/src/designStudio/folhaDor.test.ts 1-C19b`

**1-C19c** · "Perguntar ao agente", na folha, abre uma conversa do Produto com a mensagem "Me explique a Dor “<título>” e o que você mudaria primeiro.", já citando a Dor.
Proof: `U src/renderer/src/designStudio/folhaDor.test.ts 1-C19c`

**1-C20** · Nos Gráficos, "Perguntar ao agente" de um insight abre uma conversa do Produto com a mensagem "O que está por trás de “<título>” em <categoria>?". `<título>` é o da Dor de maior peso daquela categoria, e a mensagem já cita essa Dor (`graficos.js`, `perguntar-categoria`).
Proof: `U src/renderer/src/designStudio/relatorioGraficos.test.ts 1-C20`

### S5 · Pontos de troca e perfil de design · 7 files · 126 KB (com `src/main/index.ts`) · ~31k

**1-C21a** · `resources/design-studio/pontos-de-troca.json` existe com a forma e os valores da decisão 1, e `lerPontosDeTroca` o lê.
Proof: `U src/main/designStudio/pontosDeTroca.test.ts 1-C21a`

**1-C21b** · Fora de `pontosDeTroca.ts`, nenhum arquivo em `src/main/designStudio/` escreve à mão um dos valores do arquivo: `catalogo.json`, `dados-de-exemplo`, `skills/relatorio-`, `perfis/`, `prototipo-angular`, `impeccable` ou `registry.npmjs.org`.
Proof: `U src/main/designStudio/pontosDeTroca.test.ts 1-C21b`

**1-C21c** · Com uma cópia de `resources/design-studio/` em que `pontos-de-troca.json` aponta `catalogo` para outro arquivo com outro Produto, os serviços do módulo montados de novo (o caminho do "reabrir o Hive") listam esse Produto, sem mudança de código.
Proof: `U src/main/designStudio/pontosDeTroca.test.ts 1-C21c`

**1-C22a** · Se `pontos-de-troca.json` ou o perfil que ele aponta está fora do formato, a área do Design Studio mostra "O Design Studio não conseguiu ler a configuração (<arquivo>). Fale com quem instalou o Hive.", com o nome do arquivo que falhou.
Proof: `U src/renderer/src/designStudio/shell.test.ts 1-C22a`

**1-C22b** · Na mesma falha, o motivo vai para o log do Hive, com o arquivo e o erro de formato.
Proof: `U src/main/designStudio/pontosDeTroca.test.ts 1-C22b`

**1-C22c** · No app real, com a configuração do módulo inválida, o resto do Hive funciona: o chat do Hive abre e envia uma mensagem ao agente de teste.
Proof: `E2E 1-C22c`

### S6 · Qualidade das telas novas · 4 files · 119 KB · ~30k

**1-C23a** · No app real, nos temas `dark`, `light` e `hive`, o axe não aponta nenhuma violação em nenhuma destas cenas: o Início com Relatórios, o Início sem Relatório, o campo com a lista do `@` aberta, o menu + aberto, a conversa do Produto com uma resposta, a conversa com "Por qual Fonte quer começar?" e a tela de erro de configuração.
Proof: `E2E 1-C23a`

**1-C23b** · No app real, todo controle dessas cenas é alcançável por Tab e responde a Enter e a Espaço.
Proof: `E2E 1-C23b`

**1-C23c** · No app real, todo controle dessas cenas, quando focado pelo teclado, mostra um indicador de foco visível (um contorno ou anel com espessura ≥ 2px e contraste ≥ 3:1 contra o fundo).
Proof: `E2E 1-C23c`

**1-C24** · O código novo desta tarefa passa no `dsOnly.test.ts`: nenhuma cor ou fonte fora dos tokens do `@hive/design-system` em `src/renderer/src/designStudio/`.
Proof: `cd hive-desktop && source ~/.nvm/nvm.sh && nvm use 22.22.1 && npm run test -- src/renderer/src/designStudio/dsOnly.test.ts`

## Swept

- validation: 1-C5a (envio vazio), 1-C22a e 1-C22b (configuração fora do formato); existing: o Relatório fora do formato é recusado (`relatorioFormato.ts`, `relatorioFormato.test.ts`).
- failure modes: 1-C22a a 1-C22c, 1-CU2a e 1-CU2b; existing: a falha da geração (lote 2, `relatorioGeracao.test.ts`).
- idempotency and retry: existing. Gerar de novo grava um arquivo novo e nunca sobrescreve (lote 2, `relatorioGeracao.ts`).
- authorization: 1-C18a e 1-C18b (escopo do turno).
- concurrency and ordering: 1-C14a a 1-C14c (uma resposta por vez); existing: um Relatório por vez (lote 2, `relatorioGeracao.ts`).
- data lifecycle: 1-C16 (as conversas ficam). Apagar está em Out of scope.
- external-dependency failure: Unresolved 1 (a CLI do Devin numa máquina limpa) bloqueia a entrada em uso, não a construção. 1-CU2a cobre o agente sem conta; existing: a instalação do Claude Code pelo Hive (`agentInstaller.ts`).
- state transitions: n/a. Esta tarefa não muda ciclo de vida, e o do Relatório já existe (lote 2).
- observability: 1-C22b (log do Hive, sem telemetria, Unresolved 4).

## Handoff

O peso é `wc -c / 4` dos arquivos que cada fatia **toca**. O `Chat.tsx` (141 KB) é lido para copiar a ligação, mas nenhuma checagem cai nele, por isso não entra na conta.

- **Lote 1: S1 a S4, ~130k.** S1 pesa 26k, S1+S2 dá 60k, mais a S3 dá 123k e mais a S4 dá 130k. A S5 levaria a 136k, mas depende do `perfilDeDesign.ts` da tarefa T, que corre em paralelo noutro worktree, e muda de superfície: sai das telas e do turno e vai para a configuração do módulo. Por isso o lote 1 termina na S4. Ele roda no worktree principal (`feat/design-studio-modulo`). Manter S1 a S3 juntas também evita que a 1-C7d e a 1-C8c, que são da S2 mas cuja prova passa pelo turno da S3, fiquem com meia fatia em cada lote.
- **Lote 2: S5 e S6, ~61k.** É a S5 (31k, contando `src/main/index.ts` relido por um agente novo) mais a S6 (30k). Entra depois do lote 1 **e** do merge da tarefa T.
