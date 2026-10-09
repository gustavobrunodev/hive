# T · Template Angular de Protótipo (skill-irmã `prototipo-angular`)

> Construa com **tlc-implement** (`.claude/skills/tlc-implement/`). Cada critério abaixo vira uma checagem com prova, referenciada pelo número. Nada em `Unresolved` se decide durante a construção.

Ordem do corte: **T** e **1** em paralelo, depois **2**, depois **2b**, depois **3**. Esta tarefa não depende de nenhuma outra: só lê a forma do perfil de design, que a tarefa 1 decide (decisão 2 de lá). A 2 e a 2b consomem tudo o que ela entrega.

## Intent

Hoje nenhum Protótipo pode nascer. O ROADMAP diz que o template Angular vem da skill-irmã `prototipo-angular`, mas ela não existe em `design-studio/`; o "prototipo-angular 0.3.0" que aparece nas Configurações do protótipo de validação é dado de exemplo. As regras medidas no spike da ADR 0004 (`templateUrl`, nada de ShadowDom, chaves escapadas, checagem de compilação) só existem no papel.

Sem template:

- o agente que recria um Atual monta um projeto Angular diferente a cada vez;
- o app não tem como achar as telas de cada Proposta para pôr nos frames;
- a tarefa 2 inteira fica sem base;
- o porte fica sem contrato escrito, embora no banco o template venha do iu-memorable.

O que muda:

- Uma skill-irmã versionada, embarcada no Hive, em `resources/design-studio/skills/`, traz um workspace Angular 22 que o app copia para criar um Protótipo. Ele compila com o `node_modules` compartilhado.
- O template não impõe design system (ADR 0006). A identidade de cada Protótipo fica num arquivo de tokens que o agente escreve, e é esse arquivo que o perfil `ids` vai travar no banco.
- A forma de pastas e de URL das Propostas e das telas fica fixa, porque é por ela que o app encontra cada frame.
- As regras da ADR 0004 e do perfil de design são cobradas por uma conferência que é código do app. Assim, o template do iu-memorable não precisa trazer nada nosso.

13 critérios em 4 fatias · 4 portas de mão única · nada em aberto

## Criteria

### Um Protótipo nasce do template e roda sem `node_modules` próprio

1. Dado o `template/` copiado para `<raiz>/Câmbio/Remessa sem susto/`, com `<raiz>` contendo um espaço (como `Design Studio`) e as dependências instaladas uma única vez em `<raiz>/node_modules`, quando roda `ng build` na pasta do Protótipo, então o comando termina com código 0 e a pasta do Protótipo continua sem `node_modules`.
2. Dada a Proposta `a` com a entrada `{ "id": "acompanhar", "nome": "Acompanhar" }` no `telas.json` e a pasta `acompanhar/` com o componente da convenção (decisão 1), quando o Protótipo roda com `ng serve --host 127.0.0.1 --port <porta livre>`, então `http://127.0.0.1:<porta>/a/acompanhar` mostra essa tela.
3. Dado o mesmo Protótipo, quando o agente cria uma segunda tela só pela convenção (pasta mais entrada no `telas.json`), então `/a/<nova-tela>` passa a mostrá-la, e nenhum arquivo fora de `src/app/propostas/a/` precisa ser editado à mão.
4. Sempre, o template não traz design system. Ele traz:
   - um reset neutro;
   - a casca de celular (5);
   - o arquivo de tokens `src/styles/tokens.css` (decisão 3), que começa só com tokens neutros: preto, branco, três cinzas e a fonte do sistema.

   O template não contém arquivo de fonte nem logo de marca nenhuma.
5. Dada uma tela da convenção a 390×780 com conteúdo mais alto que a moldura, quando o conteúdo rola, então a barra de status de 36px e o cabeçalho ficam presos no topo, e nenhuma linha do conteúdo rolado aparece entre eles (regra Moldura Sem Fresta). A 1040×680 a barra de status não aparece.

### A conferência do app cobra as regras da ADR 0004

6. Quando um componente em `src/app/` declara `template:` em vez de `templateUrl`, então a conferência (decisão 4) recusa o Protótipo, e o relatório cita o arquivo e a regra.
7. Quando um componente declara `ViewEncapsulation.ShadowDom`, então a conferência recusa o Protótipo, e o relatório cita o arquivo e a regra.
8. Quando um `.html` de tela tem `{` ou `}` literal num texto, então a conferência recusa o Protótipo, e o relatório traz o erro de compilação `NG5002` com o arquivo.
9. Se o `telas.json` de uma Proposta e as pastas de tela divergem (uma pasta sem entrada ou uma entrada sem pasta), então a conferência recusa o Protótipo, e o relatório cita a Proposta e a tela.
10. Dado um Protótipo que segue todas as regras, a conferência o aprova. Isso vale também para um Protótipo criado de outro template Angular que siga a decisão 1.

### O agente sabe trabalhar no template

11. O `SKILL.md` da skill-irmã diz ao agente, em pt-BR e nesta ordem:
    - como criar uma Proposta: copiar a pasta do Atual, ou começar vazia num Produto novo;
    - como criar uma tela (decisão 1), com o id da tela tirado do nome dela no catálogo do Produto quando a tela existe nele ("Beneficiário" vira `beneficiario`);
    - as regras da ADR 0004;
    - que toda cor e toda fonte das telas vêm de `src/styles/tokens.css` (decisão 3).

    O `SKILL.md` não manda o agente rodar nada, porque quem confere é o app.
12. O `SKILL.md` declara a versão da skill-irmã num campo que o app lê para mostrar nas Configurações (tarefa 3).

### A conferência também cobra o perfil de design

13. Dado o perfil de exemplo restrito (tarefa 1, decisão 2), a conferência lista, com arquivo e linha, cada cor das telas que não é um token do arquivo de tokens e cada família de fonte fora da lista do perfil. Com o perfil Livre, ela não lista nada disso.

## Out of scope

- De onde vem o Node e onde fica o `node_modules` compartilhado: é decisão do app, na tarefa 2. Aqui o template só precisa compilar com as dependências numa pasta acima.
- A ponte do modo ao vivo: é do app, injetada em cada frame em tempo de execução (ADR 0005, tarefa 2b). O template não carrega nada dela.
- A regra da ADR 0004 "parâmetros de faixa sem unidade, dentro de `calc()`": quem a cobra é o validador das Variantes do app (tarefa 2b, critério 13). Ela fica fora desta conferência, porque nenhum parâmetro sobra no código depois de aceitar (tarefa 2b, critério 24).
- A camada IDS do protótipo de validação (`prototype/proto.css`): o POC é livre (ADR 0006). Os tokens dela viram só o perfil de exemplo dos testes (tarefa 1, decisão 2).
- O DS Itaú de verdade: entra no porte, pelo template e pelos tokens do iu-memorable (ADR 0001 e ADR 0006).
- Telas prontas de algum Produto: quem recria o Atual é o agente, a partir das Referências (tarefa 2).

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| relatório da conferência (lido pelo app) | formato | 6, 7, 8, 9, 13: regra, arquivo e linha ou tela |
| relatório da conferência | aprovado ou recusado | 6 a 10 |
| relatório da conferência | o que traz quando a compilação falha no meio | existing: a saída do próprio `ng build`, repassada no relatório (8) |
| documento `SKILL.md` | estrutura e o que o leitor faz em seguida | 11 |
| documento `SKILL.md` | tom e profundidade | n/a: quem lê é o agente, não uma pessoa de produto |
| tela do Protótipo (conteúdo) | estados vazio, carregando e erro | n/a: é conteúdo do Protótipo, que o agente decide tela a tela |
| tela do Protótipo (conteúdo) | densidade e ordem | 5; a ordem das telas é a do `telas.json` (decisão 1) |

## Swept

- validation: 6, 7, 8, 9, 13
- failure modes: 8 (uma falha de compilação aparece com o arquivo)
- idempotency and retry: n/a: a conferência só lê arquivos, e rodar de novo dá o mesmo resultado
- authorization: n/a: código local, sem usuários nem papéis
- concurrency and ordering: n/a: o template não sobe processos; o servidor de cada Protótipo é da tarefa 2
- data lifecycle: n/a: o template é copiado e não guarda dado nenhum
- external-dependency failure: n/a: quem instala as dependências é o app, na tarefa 2
- state transitions: n/a: o template não tem ciclo de vida
- observability: 6 a 10 e 13 (o relatório da conferência é o diagnóstico)

## Impact

| Front | What changes |
|---|---|
| domain | termo novo: `prototipo-angular`, a skill-irmã que traz só o template no POC (ADR 0001), embarcada no Hive, em `resources/design-studio/skills/` |
| domain | termo existente: Proposta passa a ser, no código, a pasta `src/app/propostas/<id>/` e o primeiro segmento da URL; o Atual é a pasta `atual` |
| domain | termo existente: a tela de um Produto (as telas da jornada em `resources/design-studio/catalogo.json`, já no Hive) passa a ser também o id da pasta da tela; é esse id que cola a nota da Dor ao lado do frame certo |
| domain | termo novo: tokens do Protótipo, o arquivo onde mora a identidade visual de um Protótipo (decisão 3); é ele que o perfil de design trava ou libera |
| domain | termo novo: conferência, o código do app que aprova ou recusa um Protótipo (decisão 4). Ela substitui o `npm run checar` dentro do template, que era o plano anterior |
| stored data | nada a migrar: nenhum Protótipo existe ainda |
| sources | a ADR 0004 ganha um dono para as regras. A ADR 0006 tirou o IDS do POC. O "prototipo-angular 0.3.0" do protótipo de validação é dado de exemplo |

## Decided

| Decision | Shape | Alternative rejected |
|---|---|---|
| 1. Forma de pastas e de URL das Propostas e telas | no bloco abaixo | Uma cópia do app inteiro por Proposta, cada uma com seu `ng serve`: o quadro mostra Atual e Propostas lado a lado, e N servidores por Protótipo multiplicam memória e tempo de build. Uma Proposta por branch: duas Propostas não rodam ao mesmo tempo, e o "antes e depois a um gesto" (PRODUCT, princípio 4) fica impossível. **Alcança o porte:** o template do iu-memorable precisa seguir a mesma forma, ou o app não acha as telas |
| 2. Angular 22, componentes com `templateUrl`, encapsulamento Emulated ou None | dependências `@angular/*` 22.x; Node ≥22.22.3 ou ≥24.15 | Vite + React + TS, já rejeitado na ADR 0004: no porte, todos os Protótipos e o template teriam de ser refeitos para o DS Itaú |
| 3. A identidade do Protótipo mora num arquivo de tokens | `src/styles/tokens.css`, com variáveis CSS (`--cor-…`, `--fonte-…`, `--raio-…`, `--espaco-…`). As telas usam essas variáveis. O caminho é o padrão do perfil de design (tarefa 1, decisão 2) | Valores espalhados pelos componentes: o perfil restrito não teria onde conferir nem o que trocar. **Alcança o porte:** o perfil `ids` aponta para o arquivo de tokens do iu-memorable |
| 4. A conferência é código do app, e não um script do template | um módulo tipado do app que recebe a pasta de um Protótipo e o perfil de design e devolve o relatório do bloco abaixo | `npm run checar` dentro do template: o template do iu-memorable não traria esse script, e o porte teria de reescrevê-lo |

Forma da decisão 1:

```
src/app/propostas/
  atual/                       só em Protótipo de produto existente
  a/  b/  c/ …                 uma pasta por Proposta, em ordem de criação
    telas.json                 [{ "id": "<tela>", "nome": "<nome na jornada>" }, …], na ordem da jornada
    <tela>/
      <tela>.component.ts      templateUrl: './<tela>.component.html'
      <tela>.component.html
      <tela>.component.css
src/styles/tokens.css          a identidade do Protótipo (decisão 3)

rota: /<proposta>/<tela>
<tela>: minúsculas, sem acento, com hífen; quando a tela existe no catálogo do Produto, é o nome dela lá ("Beneficiário" → beneficiario)
```

Relatório da conferência (decisão 4):

```jsonc
{
  "aprovado": false,                    // false quando há achado de regra; achados de perfil não reprovam
  "achados": [
    { "tipo": "regra", "regra": "templateUrl", "arquivo": "src/app/propostas/a/acompanhar/acompanhar.component.ts", "linha": 4,
      "mensagem": "…" },
    { "tipo": "perfil", "regra": "cor-fora-dos-tokens", "arquivo": "src/app/propostas/a/acompanhar/acompanhar.component.css", "linha": 12,
      "valor": "#123456" }
  ]
}
```

## Sources

- [docs/adr/0004-template-angular.md](../docs/adr/0004-template-angular.md): as regras do template, o Angular 22 e a faixa de Node.
- [docs/adr/0006-telas-livres-no-poc-ids-por-perfil.md](../docs/adr/0006-telas-livres-no-poc-ids-por-perfil.md): o POC é livre do IDS; o design system das telas é um perfil; as conferências são do app.
- [docs/adr/0001-porte-com-pontos-de-troca.md](../docs/adr/0001-porte-com-pontos-de-troca.md): o template vem da Skill de UX, e não do app; no POC vem da skill-irmã; no banco, do iu-memorable.
- [ROADMAP.md](../ROADMAP.md), seção Protótipo: "da skill-irmã `prototipo-angular`"; `npm install` no primeiro Protótipo com `node_modules` compartilhado; Protótipos em `Documentos/Design Studio/<Produto>/<Protótipo>`; telas livres no POC.
- [DESIGN.md](../DESIGN.md), "Camada do Protótipo": **vinculante só para a regra Moldura Sem Fresta** (barra de status de 36px presa no topo e escondida no desktop, e cabeçalho preso). O resto da seção descreve o IDS do protótipo de validação e não vale para o template do POC (ADR 0006).
- [docs/adr/0005-modo-ao-vivo-desenhado-pelo-estudio.md](../docs/adr/0005-modo-ao-vivo-desenhado-pelo-estudio.md): o modo ao vivo é 100% do app, e a ponte é injetada por ele em tempo de execução.
- Verificado em 2026-10-08: nenhum arquivo `prototipo-angular` existe em `design-studio/`. Esta tarefa o cria.

Esta tarefa é o registro da decisão. Se um documento linkado divergir dela, pergunte antes de construir.

## Unresolved

| # | Kind | Question | Until answered |
|---|---|---|---|
| | | None | |
