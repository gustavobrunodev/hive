# Fontes, proveniência e ressalvas

Leia quando precisar citar a origem de uma afirmação, mandar um link, ou quando o
interlocutor questionar de onde vem a recomendação.

---

## 1. Fonte primária desta versão

**Workshop Tech Leads Club — "Desenvolvimento Assistido por IA Avançado #3" (set/2026)**
Dia 1, sessão 1: *"Desenvolvimento com IA, Harness, Spec-Driven e Como Trabalhar com Modelos
Frontier"* — 1h46, conduzida por Waldemar Neto, com participação de Felipe Rodrigues,
Felipe Adamoli e William Fernandes.
https://www.techleads.club/c/workshop-ia-3-09-2026/sections/1181300/lessons/4533570

**Formato da aula:** construção de um ERP do zero, ao vivo, subindo a escada de estrutura um
degrau por feature — prompt cru → plan mode → skill própria → `tlc-spec-driven` →
`tlc-spec-lean` → code review em camadas → auditoria do próprio harness. Ferramenta: Cursor.
Modelo: Grok 4.6 Fast para a maior parte, por velocidade e custo.

Resumo oficial da aula, na íntegra:

> Nessa aula construímos um ERP do zero para entender, nível a nível, por que um prompt solto
> não basta e o que precisa existir em volta do modelo para o código sair validado. Começamos
> com um "implemente isso" seco, passamos por plan mode, criamos uma skill de spec e
> verificação, rodamos o tlc-spec-driven completo e chegamos na versão lean, onde o modelo
> implementa livre e um sub agent prova o trabalho contra um checklist. No caminho vemos o que
> mudou nos modelos nos últimos meses e por que parte do harness que a gente construía já
> virou babysitting.

---

## 2. Links de referência

**Material da aula**
- Diagramas (Excalidraw): https://link.excalidraw.com/l/7V6DWtFSy3p/2CqCeb9zehB
- Código construído ao vivo: https://github.com/tech-leads-club/workshop-1209

**Skills da Tech Leads Club** (abertas, gratuitas)
- Catálogo: https://agent-skills.techleads.club/
- Repositório: https://github.com/tech-leads-club/agent-skills
- `tlc-spec-driven`: https://agent-skills.techleads.club/skills/tlc-spec-driven/
- `tlc-spec-lean`: https://agent-skills.techleads.club/skills/tlc-spec-lean/
- `the-judge` (code review): https://agent-skills.techleads.club/skills/the-judge/
- `harness-eval` (o harness ainda é válido?): https://agent-skills.techleads.club/skills/harness-eval

Instalação: `npx @tech-leads-club/agent-skills install --skill <nome>`

**Outras ferramentas**
- `harness-score` (estrutura do harness existe e está correta?): https://github.com/paladini/harness-score
- Playwright MCP: https://github.com/microsoft/playwright-mcp
- Padrão AGENTS.md: https://agents.md/

**Papers** — ver `contexto.md` seção 7 para o detalhe e para a correção do link errado.
- Liu et al. 2023, *Lost in the Middle* — arXiv:2307.03172
- Levy, Jacoby & Goldberg 2024, *Same Task, More Tokens* — arXiv:2402.14848

---

## 3. Falas que carregam a tese

Reconstruídas da transcrição (fala espontânea, levemente normalizada). Use para dar peso a
uma recomendação, sempre atribuindo.

Sobre **quem verifica**:
> "Não dá para deixar o mesmo agente cuja missão é implementar dizer se a coisa está pronta,
> porque ele vai dizer que está — a missão dele é terminar aquilo ali. Quando abre outro
> subagente, a missão dele é provar que aquilo está funcionando; ele vai fazer de tudo para
> validar."

Sobre **a régua modelo→estrutura**:
> "Essa estrutura está te atrapalhando, porque esses modelos são muito mais inteligentes para
> implementar. Isso aqui basicamente é fazer babysitting nesses modelos."

E o fecho da sessão:
> "spec-driven ainda é útil rodando com os modelos mais baratos. spec-lean é o caminho para
> rodar com modelos melhores."

Sobre **validação visual**:
> "A IA sem ver a coisa é quase impossível de ficar bom, ou de você conseguir validar que
> ficou bom. Modelos são muito bons com imagens, mas muito ruins em interpretar algo visual
> sem ter aquela imagem."

Sobre **`AGENTS.md`**:
> "Coloque o mínimo de coisa possível, só coisas que o modelo não saberia sozinho. Depois de
> ter bastante código feito sempre do mesmo jeito eu posso remover, porque o código é o melhor
> exemplo."

Sobre **spec como fonte da verdade**:
> "Se você não está num time em que consegue controlar que toda operação vai ser feita com
> spec-driven, um PR já tem o drift: o código é diferente da spec. Aí você diz para ele 'essa
> aqui é a spec', ele olha o código, é diferente, e começa a lutar num raciocínio pensando
> sobre o que é o certo. Está atrapalhando o modelo."

Sobre **maturidade do fluxo**:
> "Quanto menos eu humano me envolver nesse loop de implementação, melhor — porque daí eu
> consigo rodar esse loop em qualquer lugar, não precisa ser na minha máquina."

Sobre **benchmark de skills**:
> "Ninguém fazia benchmark de verdade. 'Essa skill aqui é boa' — era muito sentimento da
> pessoa. Se a gente está gastando token numa coisa, eu quero saber se ela é realmente
> efetiva."

---

## 4. Ressalvas de precisão

Coisas que esta skill afirma com peso diferente. Respeite ao responder.

**a) O link de paper do material está errado.** O material aponta `arXiv:2402.01438` como
evidência de degradação por tamanho de contexto. Esse ID é outro artigo (Copilot e idiomas
naturais). Verificado em set/2026. As referências corretas estão em `contexto.md` §7.

**b) O benchmark das skills `tlc-*` foi rodado por quem as escreveu.** É aberto, publicado e
reproduzível — e ainda assim é benchmark do fabricante. A metodologia (uma feature complexa
de referência, reimplementada várias vezes por framework) é razoável; a amostra é uma feature.
Apresente como "posição da TLC com benchmark publicado", nunca como resultado independente.

**c) Os percentuais de janela de contexto (40/60) são regra de bolso**, não resultado de
paper. A *direção* é medida; o *limiar* é operacional.

**d) Números de adoção corporativa** ("X% do código escrito por IA") medem linha gerada, não
trabalho entregue, e variam enormemente por contexto. Cite com essa ressalva.

**e) Nomes de modelo e tiers envelhecem rápido.** Quando a pergunta citar um modelo posterior
a set/2026, não finja conhecê-lo: classifique pela régua de capacidade e responda pelo eixo.

**f) Esta é a sessão 1 de um workshop de 11 sessões.** Ver seção 5.

---

## 5. O que esta versão **não** cobre

A v1 vem da primeira sessão. Conscientemente fora de escopo — se a pergunta cair aqui,
responda pelos fundamentos e **diga que essa parte não veio da fonte**:

| Tema | Onde foi tratado no workshop |
|---|---|
| Projeto brownfield, migração e repatriação de legado | Dia 1 tarde / Dia 2 |
| Arquitetura de software na era da IA | Dia 2 |
| Design doc → planejamento → board (o fluxo completo de entrada) | Dia 1 tarde |
| Hooks e harness-toolkit | Dia 1 (Felipe Rodrigues) |
| Mercado e o papel do novo dev | Dia 1 (Felipe Adamoli) |
| Desenvolvimento com IA no iFood | Dia 1 (Júlio Santos) |
| Empresa IA-first, arquitetura para eficiência | Dia 2 |
| Workflow end-to-end em codebase real | Dia 2 |

---

## 6. Como estender esta skill com novas sessões

O desenho suporta crescer por acréscimo. Ao incorporar uma sessão nova:

1. **Extraia** transcrição + resumo + links da aula.
2. **Classifique cada afirmação** num dos eixos existentes (fluxo, harness, verificação,
   contexto, indústria) e acrescente na referência correspondente — não crie arquivo novo
   por sessão. O leitor pergunta por tema, não por aula.
3. **Abra uma referência nova só quando surgir um eixo genuinamente novo** (ex.: brownfield e
   migração provavelmente merecem `legado.md`; arquitetura merece `arquitetura.md`). Se abrir,
   registre na tabela de roteamento do `SKILL.md`.
4. **Atualize o `SKILL.md`** apenas se a sessão mudar uma *regra de decisão*. Conteúdo novo
   que não muda decisão vai só para a referência — o corpo precisa continuar enxuto.
5. **Registre a sessão** na seção 1 e remova a linha correspondente da tabela da seção 5.
6. **Verifique os links citados na aula** antes de propagá-los. O item 4(a) existe porque o
   material trazia um link errado.
7. **Bump** de `metadata.version` e `metadata.snapshot`.
