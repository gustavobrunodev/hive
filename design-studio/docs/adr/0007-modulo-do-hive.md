# Design Studio como módulo do Hive Desktop

Em 2026-10-08, o usuário decidiu: "em vez de ser um novo app com a cópia do harness do hive, o design studio [é] um módulo dentro do hive app, [e o] botão para o módulo fica abaixo de 'Novo chat'". A decisão volta à escolha de 2026-10-04, que já tinha dois lotes construídos no branch `feat/design-studio-modulo`. Ela substitui a [0002](0002-harness-copiado-do-hive.md).

**Como fica:**

- **Entrada.** A linha "Design Studio" fica logo abaixo do botão "+ Novo" na aba Chat & Cowork. No código, o botão se chama "+ Novo" (`chat.newLabel`); "Novo chat" é o mesmo botão. Com o módulo em frente, o corpo da aba vira a navegação dele. Isso já existe desde o lote 1 (commit `8965a25`).
- **Harness.** O módulo usa o harness do Hive, sem cópia: `AgentService`, os adaptadores de Claude e Devin, o `chatHistoryStore` e o turno com escopo (`TurnOpts.scope`, que `decideScoped` responde sem cartão, commit `3492fdf`). O módulo oferece só Claude e Devin, porque o Copilot saiu do escopo do produto em 2026-10-01.
- **Design system.** O módulo usa o `@hive/design-system`, e o teste `dsOnly.test.ts` recusa qualquer cor ou fonte escrita fora dos tokens do Hive. As peças que faltam, como as notas por Fonte e os gráficos do lote 2, entram no DS do Hive. A lib `design-studio/design-system/` continua como referência de comportamento e como fonte da sincronização com a Claude Design, mas o app não a importa.
- **Onde mora cada coisa:**
  - o código fica no `hive-desktop`: `src/main/designStudio/`, `src/renderer/src/designStudio/` e `resources/design-studio/`;
  - `design-studio/` guarda o produto: PRODUCT, ROADMAP, GLOSSARY, DESIGN, as ADRs, as tarefas, o protótipo de validação e a lib de referência.
- **O que vem do Hive pronto:** o ditado por voz offline (Whisper), o login das contas, a instalação do Claude Code pelo próprio app (`agentInstaller.ts`), o tema claro e escuro, o agente e o modelo padrão.

**Por quê:** a pessoa de produto já tem o Hive. O módulo herda tudo o que o harness resolveu em meses, como sessões, ACP do Devin, prompt por stdin no Windows, login e voz, em vez de manter uma cópia que não recebe as correções do Hive.

## Considered Options

- **App Electron próprio com o harness copiado** ([0002](0002-harness-copiado-do-hive.md), retomada brevemente em 2026-10-08): rejeitado na mesma data. A pasta subiria sozinha para o banco, mas as correções do Hive não chegariam à cópia, e o produto teria dois apps para a mesma pessoa.

## Consequences

- **O porte muda de tamanho.** Vai para o banco o Hive com o módulo, e não a pasta `design-studio/` sozinha. Os pontos de troca ([0006](0006-telas-livres-no-poc-ids-por-perfil.md)) continuam num arquivo único, agora em `resources/design-studio/pontos-de-troca.json`.
- **As regras da 0002 caem:** "nenhum import de fora da pasta", o teste de fronteira e o commit de origem da cópia.
- **O PRODUCT.md e o ROADMAP foram emendados** em 2026-10-08: o app real é o módulo do Hive, e o design system e a identidade visual são os do Hive.
- **O visual "Quadro de oficina"** (laranja, Geist e Bricolage, "nenhum azul") fica no protótipo de validação. O módulo é esse protótipo refeito com os valores do Hive.
- **A segurança do renderer do Hive** (CSP com `frame-src 'none'`) precisa abrir os frames dos Protótipos (tarefa 2).
- **As lições do Design Studio anterior** (M18, removido do Hive em 2026-09-02) sobre telas em frames isolados estão em `hive-desktop/.specs/project/STATE.md` (D-DS-4 a D-DS-8) e valem para a tarefa 2b.
