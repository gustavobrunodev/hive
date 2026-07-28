# Flakiness e retries (e2e)

<!--
  EXEMPLO CALIBRADO de UM shard, em `e2e/docs/flakiness.md`. Note o escopo: só
  intermitência. Comandos gerais, seletores e fixtures NÃO estão aqui — cada um
  tem seu próprio arquivo. É isso que faz uma tarefa carregar um arquivo, não cinco.
-->

**Quando isso se aplica:** um spec falha de forma intermitente, ou você vai
mexer em retry/timeout.

## Regras
- Testes que dependem de ordem de execução são proibidos — cada spec roda isolado.
  Reproduza localmente com `pnpm playwright test --workers=1` antes de chamar de flaky.
- Nunca "consertar" flakiness com `waitForTimeout()`. Use uma espera baseada em
  estado: `await expect(page.getByTestId('cart-total')).toHaveText('R$ 90,00')`.
- `retries` só está ligado no CI (`retries: process.env.CI ? 2 : 0`). Não ligue
  retry local — ele esconde a corrida em vez de mostrar.
- Um spec que precisou de retry no CI **não** é sucesso: abra issue com o trace
  (`--trace on-first-retry` já está ligado; o artefato sai em `playwright-report/`).

## Sequência ao investigar
1. Reproduzir isolado: `pnpm playwright test <spec> --workers=1 --repeat-each=10`.
2. Se passar 10/10 isolado, o problema é estado compartilhado — verifique o seed
   e limpe o que o spec criou (ver `fixtures-e-auth.md`).
3. Se falhar isolado, é corrida de UI — troque a espera por asserção de estado.

## Armadilhas
- `page.waitForLoadState('networkidle')` é instável com polling/websocket nesta
  app; prefira esperar pelo elemento que a chamada produz.
