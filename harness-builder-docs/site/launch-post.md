# 🚀 Harness Builder chegou: uma skill para orquestrar o harness completo dos seus agentes de código

🎬 **Vídeo de lançamento (58s):** `[inserir link do Stream/SharePoint quando o vídeo estiver renderizado — roteiro em site/launch-animation/SCRIPT.md]`
*Não assistiu ainda? Os 3 parágrafos abaixo resumem tudo em 30 segundos de leitura.*

---

Três cenas que todo squad já viveu:

- Um `AGENTS.md` com 40 regras, das quais metade ninguém lê mais.
- O agente erra, você corrige, ele erra de novo do mesmo jeito.
- Um sensor/linter dispara toda hora — e a squad aprendeu a ignorar o alerta.

O problema raramente é falta de regras, skills ou sensores. É a **falta de método** para decidir o que realmente merece entrar no harness do projeto — e o que é só ruído acumulado.

## O que é o Harness Builder

**Harness Builder** é uma skill única para agentes de código (Cursor, Claude, GitHub Copilot, Devin e outros) que **monta e evolui o harness completo de qualquer projeto**: as *guides* que orientam o agente antes de agir (`AGENTS.md`, rules, skills) e os *sensors* que dão feedback depois (linters, testes, checks automatizados).

Ela não tenta cobrir tudo de uma vez. Segue um princípio só — **menos, porém mais afiado**: cada rule, skill ou sensor só entra se ataca uma falha real e observada. Na dúvida, ela refina ou remove — nunca empilha.

Funciona tanto para o **setup do zero** (seis fases guiadas: orientar, avaliar, rules, skills, sensores, steering loop) quanto para o **dia a dia** (uma lib nova entrou no projeto? o agente errou de novo no mesmo ponto? um MCP vale a pena? — pedidos pontuais, sem rodar o playbook inteiro).

## Por que isso importa para o seu papel

**Tech Leads** — Padroniza como cada squad decide o que vira rule, skill ou sensor, em vez de cada time reinventar isso do zero. Todo gate de decisão passa pelo seu aval antes de qualquer arquivo mudar.

**PMs** — Menos retrabalho de agente por contexto mal orientado significa menos ciclos de correção "silenciosos" consumindo o sprint. O harness também evolui junto com o escopo, sem parar a squad para uma revisão completa.

**QA** — Os sensores são posicionados pelo custo, o mais à esquerda possível, e cada um carrega uma mensagem de autocorreção — não é só travar o pipeline, é reduzir a régua de regressões que chegam até a revisão manual.

**Devs** — Um `AGENTS.md` enxuto de verdade (o teste é simples: se o agente já infere sozinho, corta), instalável em segundos, e que funciona igual seja qual for o agente de código que você usa.

## Como funciona, em uma imagem

```
0 Orientar → 1 Avaliar → 2 Rules → 3 Skills (presets + lacunas) → 4 Sensores → 5 Steering loop
```

A `harness-engineer` é a espinha: avalia o projeto e só chama os outros três módulos (`agent-rules-architect`, `stack-presets`, `find-skills`) para as lacunas que ela mesma identificou. Nada muda antes de você aprovar as prioridades.

## Como instalar

```bash
npx @hive/cli install -s harness-builder
```

Compatível com Cursor, Claude, GitHub Copilot, Devin e outros agentes de código.

## Saiba mais

- 📖 Página completa da skill: **docusaurus.hive.com.br/harness-builder**
- 🏠 Site do Hive (visão geral das ai-tools da organização): **iconectados.sharepoint.com/sites/hive-ai**

---

*Dúvidas ou feedback? Comenta nesta thread ou chama o time Hive.*
