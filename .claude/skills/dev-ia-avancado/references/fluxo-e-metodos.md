# Fluxo e métodos: escolher, comparar e construir

Índice:
1. A escada de estrutura, degrau a degrau
2. spec-driven em detalhe
3. spec-lean em detalhe
4. Comparação direta
5. Matriz de recomendação por caso de uso
6. Criar a própria skill
7. Skills vs subagentes vs agentes custom
8. Worktrees e paralelismo

---

## 1. A escada de estrutura, degrau a degrau

Cada degrau existe porque o anterior deixou um problema aberto. Quando alguém pergunta
"qual metodologia eu uso?", descubra em que degrau ele está e qual problema está doendo —
a resposta cai sozinha.

### Degrau 1 — prompt cru

`implementa o próximo item do roadmap`

Funciona e é rápido. Dois problemas fatais em produção:

- **Você não sabe o que vai ser feito** antes de ser feito.
- **Não há contra o que revisar.** Sem uma declaração prévia, revisar significa ler
  mudança por mudança e torcer para lembrar de todas as regras de negócio.

É um degrau legítimo para protótipo, script, spike. Nunca para código que vai para produção.

### Degrau 2 — plan mode

O modelo explora, pergunta o que ficou ambíguo e escreve um plano antes de tocar em código.
Nativo em todas as ferramentas relevantes (Cursor, Claude Code, etc.).

O que ganha: **iterar no plano é ordens de grandeza mais barato que iterar no código.**
Corrigir uma frase de plano é um turno; corrigir a implementação dela é reler diff, refazer
teste, reverter arquivo.

O que ainda falta: ninguém **prova** que o plano foi cumprido. Pegar o plano e conferir item
por item contra o diff é trabalho humano que não escala.

Detalhe importante: plan mode não é waterfall. Waterfall é especificar tudo antes de tudo.
Aqui você pega **um bloco de trabalho** e itera nele com o agente antes de escrever código.

### Degrau 3 — skill própria que planeja e se autovalida

O menor salto com maior retorno. Uma skill de umas poucas dezenas de linhas que:

1. faz discovery lendo o código;
2. **pergunta uma de cada vez** e sempre oferece um recomendado;
3. escreve um plano com as regras em Given/When/Then + decisões técnicas registradas;
4. implementa;
5. **abre um subagente para validar contra o plano.**

Por que "uma pergunta de cada vez": muito material de spec-driven despeja todas as perguntas
juntas, mas pergunta depende de resposta anterior. E o "faça o recomendado" deixa o fluxo
utilizável quando você não quer decidir tudo.

Já nesse degrau você tem os dois elementos que realmente importam: **regras declaradas** e
**verificação independente**. É honestamente melhor que vários frameworks de spec-driven que
não validam o próprio trabalho.

O que falta: cobertura. Não olha arquitetura, regressão, segurança, qualidade dos testes.

### Degraus 4 e 5 — spec-driven e spec-lean

Seções próprias abaixo.

---

## 2. spec-driven em detalhe

Referência concreta: `tlc-spec-driven` (https://agent-skills.techleads.club/skills/tlc-spec-driven/),
Apache/CC, código aberto. As ideias valem para qualquer implementação (Spec Kit, Superpowers,
OpenSpec, a skill interna da sua empresa).

**Quatro fases adaptativas** — a skill pula fase quando o escopo não pede:

| Fase | Produz | Pulável? |
|---|---|---|
| Specify | Requisitos em notação EARS com IDs rastreáveis | Não |
| Design | Arquitetura, data model, error handling, riscos | Sim, em mudança simples |
| Tasks | Quebra atômica com dependências e critério de verificação por task | Sim, se ≤3 passos óbvios |
| Execute | Implementação com verificação por task e commits atômicos | Não |

**O que faz essa família funcionar** (copie isso, mesmo que não use a skill):

- **Verificador independente.** Autor ≠ verificador, evidência-ou-zero, relatório com
  citação `arquivo:linha` ou reprova.
- **Sensor de discriminação (teste de mutação).** Injeta falha de comportamento num espaço
  isolado e confirma que o teste pega. Mutante que sobrevive vira task de correção. Loop
  fix→re-verify limitado (3 iterações) para não girar para sempre.
- **Gates determinísticos.** Scripts Python (`validate_spec.py`, `validate_tasks.py`,
  `check_commit.py`, `validate_state.py`) com exit code. Não-zero = pare.
- **`STATE.md`.** Log de decisões (AD-NNN), snapshot de handoff, reconciliação contra o
  `git status` ao retomar sessão.

**Por que as tasks atômicas existiram:** com a geração anterior de modelos, dar escopo aberto
significava entrega parcial. Cada task carrega *o que fazer* e *como provar* — a task só fecha
quando o gate determinístico (o teste) roda. Isso salvou a execução com modelos pequenos.

**O custo:** task por task é mais lento e gasta mais token, porque o modelo para, roda teste,
retoma. Com modelo bom, esse custo não compra nada.

**Anti-padrão da família:** frameworks que já escrevem o **código pronto** dentro do plano
para outro modelo transcrever. Com modelos atuais isso é desperdício — o implementador sabe
implementar. Dê direção e depois valide.

---

## 3. spec-lean em detalhe

Referência: `tlc-spec-lean` (https://agent-skills.techleads.club/skills/tlc-spec-lean/).

**Padrão: PLAN → CHECKS → BUILD → VERIFY.** Dois artefatos antes de qualquer código.

- **PLAN** (`plan.md`): problema, fluxo, impacto, relações, superfícies, portas irreversíveis,
  critérios. **Revisão humana obrigatória** antes de código.
- **CHECKS** (`checks.md`): derivado do plano aprovado. A regra que sustenta tudo:
  > cada check é uma afirmação observável com **valor concreto** mais a **prova** — o teste
  > cuja saída decide. **Sem prova, não existe check.**
  Checks são congelados depois de aprovados. Nenhum check pode ser enfraquecido ou removido
  para fazer a suíte passar.
- **BUILD**: implementação livre. Testes são escritos **a partir dos checks**, nunca a partir
  da implementação (senão o teste só confirma o que o código já faz).
- **VERIFY**: agente independente, nunca o autor, contra todos os checks.

**As duas mudanças de fundo em relação ao spec-driven:**

1. **Spec e design viraram uma coisa só.** Um plano, direto ao ponto.
2. **Não há mais tasks.** O modelo implementa do jeito que julgar melhor — paralelizando,
   reordenando — e a rigidez migra para o checklist final, que é bem mais severo: bate
   critério por critério, linha por linha.

**Efeito colateral de produto que motivou o desenho:** o plano único **vira um ticket no
board**. Antes, o board recebia um título vago e o agente replanejava tudo do zero na hora de
implementar; o board não servia para nada. Agora você planeja, gera o ticket, e a execução
parte dele.

**Orçamento padrão** ~150k tokens, com perfis (light/standard/ui). Recomendação de tier:
raciocínio alto para escrever os checks e as fatias de domínio; médio-alto para o Verifier
(ele projeta mutações e raciocina adversarialmente); mais rápido para fatias mecânicas.

**Pré-requisito duro:** modelo que segue instrução bem. Com modelo fraco ele implementa
solto e **não roda os checks** — o pior dos dois mundos.

---

## 4. Comparação direta

| | spec-driven | spec-lean |
|---|---|---|
| Artefatos pré-código | spec + design + tasks | plano + checks |
| Granularidade da execução | task a task, gate por task | livre |
| Onde mora o rigor | na entrada (instrução) | na saída (checklist) |
| Velocidade | menor | maior |
| Tokens | mais | menos |
| Modelo mínimo | funciona com barato | exige bom |
| Integração com board | adaptação de cada time | o plano é o ticket |
| Risco principal | babysitting, drift da spec | modelo fraco não roda os checks |

**Se o interlocutor usa spec-driven hoje e tem modelo bom:** não é break change. Rode
spec-lean numa feature e compare tempo, tokens e o que o verificador pegou. A migração é
por evidência, não por decreto.

---

## 5. Matriz de recomendação por caso de uso

| Situação | Recomendação |
|---|---|
| Protótipo, spike, script descartável | Prompt cru. Estrutura aqui é cerimônia |
| Feature pequena, código já bem estruturado, modelo bom | Plan mode + validação no fim |
| Time todo com modelo frontier, quer padronizar | spec-lean |
| Time com modelo barato no loop de implementação | spec-driven, sem negociar |
| Modelo bom para planejar + barato para implementar | spec-driven — a régua é o implementador |
| Legado sem cobertura de teste | Antes de qualquer framework: **sensores**. Sem teste/lint/type não há o que verificar, e nenhuma metodologia salva |
| Domínio com regra de negócio densa | Qualquer degrau ≥3, mas o inegociável é regra em Given/When/Then — é o que a verificação consome |
| Empresa quer framework próprio | Pegue os fundamentos (verificador independente, evidência-ou-zero, gates determinísticos, mutação) e aplique no processo que já existe. São markdowns; dá para pedir ao agente para explicar e adaptar |
| Pipeline automatizado (ticket → agente → PR, sem passar na máquina de ninguém) | Board como fonte, plano que vira ticket, verificação e review 100% automatizados. Aqui o spec-driven repo-cêntrico atrapalha |

---

## 6. Criar a própria skill

O processo que funciona, nessa ordem:

1. **Resolva o problema você mesmo primeiro**, na mão, com o agente. Você não sabe o que
   colocar numa skill antes de ter sentido onde dói.
2. **Peça ao agente para transformar aquilo numa skill.** Escrever markdown na mão é
   desperdício.
3. **Revise com rigor.** Solto, ele enche a skill de instrução inútil — e instrução inútil
   custa token em todo turno e compete por atenção com a que importa.

Regras de conteúdo:

- **Descrição (frontmatter) é o que decide o disparo.** Nome + descrição ficam sempre no
  contexto; o corpo só entra quando dispara. Quanto mais skills instaladas, mais peso fixo.
- **Progressive disclosure.** Corpo enxuto, profundidade em `references/` carregada sob
  demanda.
- **Misture determinístico e não-determinístico.** Script que extrai e valida em vez de pedir
  para a IA "conferir": mais barato, sem alucinação, com exit code. Os melhores exemplos
  públicos disso estão nos `scripts/` das skills `tlc-*` — vale copiar o padrão.
- **Skill é instrução sob demanda.** O que o agente precisa em *todo* turno não é skill: é
  `AGENTS.md`.

---

## 7. Skills vs subagentes vs agentes custom

| Mecanismo | O que é | Quando usar |
|---|---|---|
| **Skill** | Instrução carregada sob demanda | Padrão. Reusável e **componível** — um subagente genérico pode receber 3–4 skills |
| **Subagente** | Thread separado, contexto zerado, devolve só a resposta | Exploração ampla, e sobretudo **verificação** (missão diferente do autor) |
| **Agente custom** | Persona/papel fixo configurado | Raro. É um papel só, não compõe. Skills praticamente os tornaram obsoletos |

Na prática: crie skills, quase nunca agentes. Subagente é mecanismo de contexto e de
incentivo, não de conhecimento — o conhecimento vai em skill.

---

## 8. Worktrees e paralelismo

`git worktree` dá um diretório de trabalho separado por branch. Duas features em paralelo,
dois agentes, sem se atropelarem em arquivo ou em estado local.

Pré-requisito real: **estado isolável**. Com SQLite em arquivo por worktree, tranquilo. Com
banco compartilhado, porta fixa ou cache global, os dois agentes brigam — resolva isso antes.

O valor não é rodar duas features ao mesmo tempo por si. É que **a fase de verificação é
lenta**: enquanto uma branch verifica, você planeja a próxima. O gargalo do fluxo agêntico
raramente é a implementação.
