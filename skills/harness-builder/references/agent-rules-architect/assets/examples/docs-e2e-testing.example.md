# Regras de Testes E2E

**Quando isso se aplica:** escrevendo ou depurando testes end-to-end (Playwright).

## Regras
- Rodar a suíte inteira com `pnpm playwright test`; rodar um único spec com
  `pnpm playwright test e2e/checkout.spec.ts -g "nome do teste"`.
- O servidor de dev precisa estar de pé antes (`pnpm dev`); os testes assumem
  `http://localhost:3000` — não hardcode outra origem.
- Selecionar elementos por `data-testid`, nunca por texto visível ou classe CSS
  — copy muda, `data-testid` não.
- Login de teste usa o bypass em `e2e/fixtures/auth.ts` (`loginAsTestUser()`);
  não automatizar o formulário de login real, ele tem rate limit.
- Mockar chamadas de rede externas com `page.route()`; nunca mockar as rotas da
  própria aplicação.

## Armadilhas
- Testes que dependem de ordem de execução são proibidos — cada spec deve
  rodar isolado (`pnpm playwright test --workers=1` reproduz falhas de ordem
  localmente antes de reportar como flaky).
- Screenshots de baseline ficam em `e2e/__screenshots__/`; regenerar com
  `pnpm playwright test --update-snapshots` só após confirmar que a mudança
  visual é intencional.

## Referências mais profundas (carregar só se necessário)
- Ver `playwright.config.ts` para projects/browsers configurados.
