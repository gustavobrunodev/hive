# Modo ao vivo do próprio app: desenhado, executado e testado por ele

Esta ADR registra duas decisões do usuário, ambas de 2026-10-08.

1. **O estúdio desenha o modo ao vivo.** As fontes divergiam: o ROADMAP e a [0003](0003-app-e-dono-do-loop-do-live.md) punham o overlay da impeccable dentro do palco, enquanto o DESIGN.md, o manual da marca e o design system desenham o modo ao vivo com peças do estúdio. Vale o estúdio. As ferramentas, as marcas sobre a tela e os painéis são do app, em pt-BR, e o overlay da impeccable não aparece.
2. **O modo ao vivo é 100% do app.** Nas palavras do usuário: "o modo live do app seja 100% do app e controlado pelo app, invertendo a dependência e garantindo controle de forma 100% determinística". O app copia todas as funcionalidades do live da impeccable e executa cada passo por conta própria. No modo ao vivo, o agente não mantém loop, não roda script e não escreve arquivo. Ele só devolve o conteúdo das Variantes, num formato que o app valida antes de usar.

**Por quê:**

- No live da impeccable, quem conduz é o agente. São oito passos em ordem (`reference/live.md` 4.3.1: "No step skipped, no step reordered"), e entre eles estão o aceite, a limpeza depois do aceite e a recuperação de quedas. Se um agente não determinístico pula um passo, o Protótipo fica com marcas soltas ou com Variantes que nunca aparecem, e a pessoa não tem como entender o que houve.
- A interface é só em pt-BR e esconde a máquina, e o overlay é de outra ferramenta.
- Com o app no controle, Claude e Devin ficam iguais. O app monta o turno, e nenhum dos dois precisa da skill instalada nas próprias pastas. O instalador da impeccable não tem destino para o Devin.

**Dependência invertida.** A Skill de UX passa a servir o app, e não o agente. Ela fornece as referências das ações e dos comandos, as regras de geração de Variantes, o piso de qualidade (`craft-floor`), o detector (`impeccable detect`) e o template. O app lê esses arquivos da versão em uso, monta cada turno sempre do mesmo jeito e decide cada passo.

**Como fica:**

- **A ponte** é um script do app, injetado em cada frame em tempo de execução. Nenhum arquivo do Protótipo muda para recebê-la, e por isso ela sobrevive à troca do template pelo do iu-memorable no porte ([0001](0001-porte-com-pontos-de-troca.md)).
- **As Variantes** nascem de um turno sem ferramentas: o agente devolve as N Variantes num JSON. O app valida a resposta e escreve todas as Variantes de uma vez num bloco de sessão no código da tela. Depois compila uma vez, e a ponte troca a Variante mostrada sem nova compilação.
- **Aceitar e descartar** são transformações mecânicas feitas pelo app.
- **Tudo é tipado e testado:** TypeScript estrito; Vitest para unidade e integração; e Playwright para E2E no app Electron real, com um agente de teste de respostas gravadas.
- O detalhe está na tarefa 2b, em `.tasks/2b-modo-ao-vivo-do-app.md`.

## Considered Options

- **Overlay da impeccable dentro do palco**, que era o texto antigo do ROADMAP: rejeitado em 2026-10-08. O pt-BR e o Inserir dependeriam do overlay, e o agente continuaria no comando do loop.
- **Live da impeccable por baixo dos painéis do estúdio**, com o app dono do loop, como na 0003: rejeitado em 2026-10-08. A ponte falaria um protocolo interno da página, e o agente continuaria rodando o aceite e a limpeza.
- **Ponte dentro do template `prototipo-angular`**: rejeitada. Morreria na troca pelo template do iu-memorable, e o modo ao vivo deixaria de ser só do app.

## Consequences

- A 0003 foi substituída por esta. O ROADMAP e o GLOSSARY foram emendados, porque a Skill de UX não dá mais o modo live.
- As regras da [0004](0004-template-angular.md) continuam, agora cobradas pelo app: a checagem de compilação antes de mostrar Variantes e os parâmetros de faixa sem unidade dentro de `calc()`.
- O teste rápido de atualização da Skill de UX passa a conferir o que o app lê dela, sem chamar agente (tarefa 3).
- O overlay do live da impeccable 4.3.1 tem cerca de 13 mil linhas (`scripts/live-browser.js`), sob licença Apache 2.0. Copiar as funcionalidades quer dizer reescrever o comportamento em TypeScript. Um trecho portado leva o aviso de licença.
- O app passa a manter um código que antes vinha da skill. Uma melhoria futura no conhecimento da impeccable chega sozinha pela atualização, mas uma funcionalidade nova do live dela só chega ao estúdio quando o app a copia.
