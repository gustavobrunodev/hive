# Template de Protótipo em Angular

Os Protótipos usam um template **Angular**, a stack do design system do Itaú, cujo template vive no `iu-memorable`. Assim, o porte troca o DS sem reescrever Protótipos nem template.

O impeccable não suporta Angular oficialmente: não tem fixture nem adaptador para ele. Um spike medido em Angular 22 (5 sessões completas, de selecionar elemento até aceitar) mostrou que o live funciona tratando os arquivos `.html` de `templateUrl` como HTML estático, preservando estado e bindings. As ressalvas medidas viram regras do template e do app:

- Todo componente usa `templateUrl` com `.html`. Template inline no `.ts` não é encontrado (`element_not_found`).
- O encapsulamento é Emulated ou None, nunca ShadowDom.
- O agente escapa `{` e `}` em texto. Um literal quebra o build (NG5002).
- Há uma checagem de compilação antes de devolver as Variantes. Sem ela, 750 ms depois o live mostra o template cru (`{{ … }}`) como se fosse a Variante, e a barra indica sucesso.
- Parâmetros de faixa são sem unidade, dentro de `calc()`.
- Não se aplica patch na skill embarcada, porque a atualização para a última versão o sobrescreveria. As defesas ficam no app.

## Considered Options

- **Vite + React + TS:** é o padrão dos agentes e é suportado oficialmente pelo live. Rejeitado porque, no porte, todos os Protótipos e o template teriam de ser refeitos para o DS Itaú.

## Consequences

- O Node que o app usa para rodar o `ng serve` precisa atender o Angular 22 (≥22.22.3 ou 24.15). O Angular recusou o Node 22.22.1 no spike.
- Rebuilds acima de 750 ms, prováveis no Windows, fazem o template cru piscar até o HMR chegar.
