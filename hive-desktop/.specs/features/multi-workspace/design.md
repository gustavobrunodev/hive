# multi-workspace — design

## 1. Onde a regra vive

Todas as regras de "instalar, atualizar, perguntar ou abrir direto" ficam numa
função só, `routeFor` em [`src/main/workspaceService.ts`](../../../src/main/workspaceService.ts),
e saem dela como uma união discriminada:

```ts
type WorkspaceRoute =
  | { step: 'missing' }
  | { step: 'choose' }
  | { step: 'install'; primary: boolean }
  | { step: 'update' }
  | { step: 'ready' }
```

O renderer não decide nada: `App.tsx` é um `switch` sobre esse valor
(`stateForRoute`). Isso é o que permite testar a parte difícil da feature no
processo main, sem uma janela — e o que impede o renderer de divergir da regra.

A ordem dentro de `routeFor` carrega significado:

1. um workspace `light` responde `ready` **antes** de o disco ser consultado —
   a promessa dele é que o Hive não procura os próprios arquivos ali;
2. uma pasta que já tem `_bmad/` é adotada, não questionada;
3. só então uma pasta secundária genuinamente nova recebe a pergunta.

## 2. Picking ≠ committing

`chooseWorkspace()` fazia as duas coisas: abria o seletor nativo *e* persistia.
Isso torna impossível perguntar qualquer coisa no meio. O contrato virou:

| método | efeito |
| --- | --- |
| `pickFolder()` | abre o seletor nativo. Nada mais. |
| `previewWorkspace(path)` | valida e devolve a rota. Não persiste. |
| `openWorkspace(path, kind?)` | registra, ativa, e devolve a rota. |

`kind` só viaja quando o usuário acabou de ser perguntado.

## 3. Persistência

`Config.workspaces: WorkspaceEntry[]` é o registro. `recentWorkspaces` continua
existindo, escrito **na mesma transação** por `pushRecentWorkspace` — nada na
UI o lê mais, mas ele é a fonte da migração e a forma que um build anterior
entende, então um downgrade não perde a lista.

As invariantes (caminhos únicos, exatamente um principal, principal sempre
`managed`, ordem por recência) são restauradas por `sanitizeWorkspaces` em toda
leitura e escrita. Não são verificadas — são impostas. É por isso que
`configStore.test.ts` consegue jogar lixo no campo e receber um registro
íntegro de volta.

## 4. A interface

| superfície | arquivo |
| --- | --- |
| Chip da barra de título + âncora do seletor | `ui/WorkspaceChip.tsx` |
| Painel (filtro, grupos, teclado) | `ui/WorkspaceSwitcher.tsx` |
| Uma linha (marca, estado, ações) | `ui/WorkspaceRow.tsx` |
| Confirmações e renomear | `ui/WorkspaceActionDialog.tsx` |
| A pergunta | `onboarding/WorkspaceKindChoice.tsx` |
| Marca de identidade | `ui/WorkspaceMark.tsx` + `ui/workspaceVisuals.ts` |

### Decisões visuais que valem registro

- **Marca determinística.** Cada workspace ganha um monograma numa matiz
  derivada do caminho (FNV-1a sobre a paleta `--wb-ic-*` que já existia). Com
  uma lista, reconhecer precisa ser possível *antes* de ler. Zero configuração:
  nada para escolher, nada para guardar.
- **`managed` usa o accent, `light` usa a tinta neutra.** Um tique verde no
  primeiro enquadraria o segundo como defeito — exatamente o enquadramento que
  esta feature existe para evitar. Só as duas anomalias reais (instalação
  interrompida, pasta sumida) pegam cor semântica.
- **Sem selo de principal na marca.** A primeira versão flutuava um favo no
  canto do ladrilho — mas a linha de estado já usa esse glifo para "BMAD
  instalado", então uma linha carregava dois favos com dois significados. O
  cabeçalho "Principal" diz em palavras.
- **`aria-disabled`, não `disabled`.** A linha ativa e a pasta que sumiu
  continuam legíveis e alcançáveis por Tab; um `disabled` de verdade as tira da
  ordem de foco, que foi onde as setas travaram na primeira medição.
- **Uma ordem só.** `panelOrder()` é usada pelo painel *e* pelo salto
  `Ctrl+N`. Um principal que não é o mais recente sobe no display e ficaria no
  meio do registro — e a linha anunciando "Ctrl+2" não seria a que Ctrl+2 abre.

## 5. O que o passe visual encontrou

Rodando de verdade, nos três temas
(`tools/visual/workspaceContrast.mjs`):

- **`--faint` a 11px reprova.** O token é documentado contra `--bg`; estas
  superfícies são elevadas, e ali ele mede 4,18:1 no escuro e 3,71:1 no claro.
  Seis alvos. Todos passaram para `--muted`. (É a mesma lição do M-TI: `--faint`
  não é um papel de texto seguro fora do `--bg` escuro.)
- **A própria sonda tinha um ponto cego.** Sem os parsers de `oklch()`/`oklab()`
  ela devolvia `UNMEASURED` para toda marca e todo estado — o que se lê como
  "sem problemas" e na verdade é "sem dados".
- **Caminho truncado nas duas pontas.** Mostrar o caminho inteiro dava
  `…/dev/work/api-ga…`. A linha passou a mostrar a *pasta-mãe*, já que o nome
  está na linha de cima.
- **CTA desabilitada sem estado visual.** `.wb-btn:disabled` não existia; o
  botão da pergunta ficava com o preenchimento cheio e apenas parava de
  responder.
