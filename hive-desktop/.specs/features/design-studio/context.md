# Context — `design-studio` (M18)

Decisões de área cinzenta tomadas com o usuário antes do design. O que está
aqui é **travado**; o design não reabre.

## D-DS-1 — Formato do Bundle de Exportação: HTML vivo

**Pergunta:** a Open Question nº1 do SPEC canônico — o contrato de entrada do
Figma Agent não está definido, e isso muda CAP-14/15 materialmente. Shadow DOM
achatado ou intacto?

**Decisão (usuário, 2026-08-09):** **HTML vivo**. Um `.html` autocontido por
Tela: bundle do Web Awesome + CSS + assets inline, componentes vivos, shadow DOM
intacto, zero rede.

**Racional:** é o que o SPEC já assume (`Assumptions`) e o único caminho que
honra AD-6 — um único renderizador, sem gerador de markup paralelo ao Preview.
Um achatador, se o Figma Agent exigir, é aditivo depois (um segundo método no
mesmo Adaptador), não uma reescrita.

**Consequência para o design:** `renderToStaticHtml()` é o único produtor de
string; o export não tem lógica de DS própria. O risco aceito está registrado
em `design.md` → Risks (R-4).

## D-DS-2 — Escopo: M18 inteira, em 7 fases

**Pergunta:** 15 capabilities é a maior milestone do projeto (~50 tarefas).
Uma milestone ou duas fatias?

**Decisão (usuário, 2026-08-09):** **M18 inteira**, CAP-1..15, quebrada em 7
fases sequenciais.

**Racional:** mantém o padrão M10–M17 (milestone completa, `verify` verde, passe
visual, E2E real) e evita um estado intermediário sem valor de uso — um Studio
que renderiza mas não exporta, ou que exporta mas não itera, não fecha o loop
que o "success signal" do SPEC mede.

**Consequência:** delegação por subagentes é obrigatória (> ~8 tarefas). Lotes
sequenciais, um lote nunca começa antes do anterior reportar tudo verde.

## D-DS-3 — Layout: a Bancada (palco central)

**Pergunta:** quatro superfícies simultâneas (Preview, Árvore, Inspetor, Chat)
dentro de uma aba do painel viewer.

**Decisão (usuário, 2026-08-09):** **Bancada** — Preview flutuando num palco
neutro com moldura de dispositivo; Telas + Árvore à esquerda; Inspetor à
direita; Chat numa faixa inferior colapsável.

**Racional:** faz o Preview virar **objeto**, não painel — o vocabulário de
Figma/Framer que o público-alvo (PM/UX) já tem no corpo. As duas alternativas
falham por motivos opostos: "colunas rentes" trata a Tela como mais um painel de
IDE e perde a leitura de artefato; "artifact/chat-first" prioriza a conversa e
empurra Inspetor e Árvore para uma gaveta, quando a edição fina é P1 aqui.

**Consequência para o design:** a aba vive no painel `viewer`, ≈44% da janela por
padrão — apertado demais para quatro superfícies. O design responde com **Modo
Foco** (DS-R16) e com uma cadeia de degradação por largura, ambos detalhados em
`design.md` §3.

## D-DS-4 — CSP do Preview: `connect-src data:`, não `'none'`

**Pergunta:** a fase 2 mediu que `wa-icon` resolve todo ícone por
`fetch(url, { mode: 'cors' })` (`chunk.ZCZ2WKQR.js:62`) — inclusive quando a
biblioteca local devolve uma URL `data:`. Um `fetch` para `data:` continua sendo
governado por `connect-src`, então o `connect-src 'none'` que a SPEC exige em
P1-Preview AC-2 quebraria **todos** os ícones, em silêncio, no Preview e no
Bundle. O único caminho sem `fetch` que o Web Awesome oferece é `spriteSheet`,
que usa `<use href>` — o Chrome não suporta referência externa em `<use>` e ela
não atravessa shadow root. Sem saída dentro da fase 2.

**Decisão (usuário, 2026-08-09):** a CSP da resposta usa **`connect-src data:`**
no lugar de `'none'`.

**Racional:** o egresso de rede continua sendo zero — uma URL `data:` não alcança
servidor nenhum, então a intenção de AD-5 fica intacta; o que muda é a letra da
AC, não a propriedade de segurança. O argumento decisivo é o Export: o `.html`
autocontido da T7.2 é um arquivo solto, sem o protocolo `hive-studio:`, então
**precisa** de `data:` de qualquer maneira. Escolher `hive-studio:` no Preview
criaria dois caminhos de ícone divergindo entre Preview e Export — exatamente o
tipo de duplicação que AD-6 existe para impedir.

**Consequência para o design:** T3.2 afirma `connect-src data:` no header (não
`'none'`); o resto da CSP (`script-src 'self'`, `style-src 'self' 'unsafe-inline'`,
`img-src 'self' data:`) fica como especificado. A prova de zero rede continua
sendo a T3.8: o Playwright observa o frame e exige zero requisição para fora de
`hive-studio:`. Vira **D32** no `STATE.md` do projeto, junto de D29–D31.

## Agent's discretion

Decidido no design, sem necessidade de confirmação:

- Origem do catálogo (`custom-elements.json` do pacote, congelado em build).
- Ponto de entrada da aba (menu de contexto do Explorer + paleta Ctrl+P).
- Vocabulário visual do palco, moldura de dispositivo e overlay de seleção.
- Estratégia de teste por fase e ferramenta de passe visual.
