# Harness Builder — roteiro de lançamento

Duas peças, uma só timeline de origem: **Full (58s)** para Slack/Teams/town hall
e **Teaser (15s)** para loop em telas internas / repost. Público: devs, tech
leads, QAs. Sem locução — texto na tela + SFX sutil. Identidade visual 100%
herdada de `site/index.html` (mesmos tokens, mesmo componente de terminal).

Abra `index.html` nesta pasta para reproduzir as duas versões e ajustar timing
antes de gravar.

## Shot list — Full (58s)

| # | Janela | Ato | Tela | Copy |
| - | - | - | - | - |
| 1 | 0:00–0:02.5 | Dor 1 | Card central, fundo Bordô com dots instáveis | "AGENTS.md com 40 regras. Metade ninguém lê mais." |
| 2 | 0:02.5–0:05 | Dor 2 | Mesmo card, troca de linha | "O agente erra. Você corrige. Ele erra de novo." |
| 3 | 0:05–0:08 | Dor 3 | Mesmo card, troca de linha | "Sensor dispara toda hora. Ninguém mais olha." |
| 4 | 0:08–0:14 | Reveal de marca | Logo Hive (brain, tone="white") emerge da dispersão de pontos; wordmark "hive" entra; linha de regra Coral se desenha | **Harness Builder** — "Menos retrabalho, mais precisão." |
| 5 | 0:14–0:19 | Terminal — prompt | Card de terminal real (mesmo do hero do site), texto digitado char a char | `› Avalie e melhore o harness deste projeto` |
| 6 | 0:19–0:25 | Terminal — fases | Chips das 6 fases entram em stagger | 0 Orientar · 1 Avaliar · 2 Rules · 3 Skills · 4 Sensores · 5 Steering |
| 7 | 0:25–0:34 | Gate humano | Badge pulsa "Aguardando seu aval" → vira verde "Aprovado" | "Prioriza com você. Nada muda sem aval." |
| 8 | 0:34–0:46 | Evolução contínua | Split 2 colunas: Setup inicial vs Evolução contínua | Prompt real: "Integrei o TanStack Query — faz sentido incluir no harness?" → chip "Sugerido: rule + skill" |
| 9 | 0:46–0:58 | CTA | Comando de instalação + logo lockup | `npx @hive/cli install -s harness-builder` |

## Shot list — Teaser (15s)

| # | Janela | Tela |
| - | - | - |
| 1 | 0:00–0:04 | As 3 dores em cross-fade rápido (auto-cicla a cada ~1.3s, sem espera de leitura) |
| 2 | 0:04–0:09 | Reveal de marca (mesmo do Full, comprimido) |
| 3 | 0:09–0:13 | Terminal: prompt já digitado (sem typewriter) + fases em stagger; sem beat de gate |
| 4 | 0:13–0:15 | CTA, mesma composição do Full |

## Linguagem visual (herdada do `DESIGN.md`)

- **Logo Hive:** usar o componente `Logo` do design system (`@hive/design-system`).
  - Sobre fundo Bordô (telas escuras): `tone="white"`.
  - `mark="brain"` → ícone isolado (reveal, telas muito pequenas).
  - `mark="simple"` → wordmark "hive" (nav, rodapé).
  - `mark="description"` → wordmark + tagline (lockup final CTA).
  - Nunca rotacionar, distorcer ou aplicar sombra na logo.
- Transições: **wipe diagonal** (clip-path lean-right), nunca fade circular ou cortina genérica.
- Fundo: dot-dispersion (`Gradiente Conexão`), nunca gradiente linear/radial simples.
- Tipografia: Funnel Display nos títulos, Inter no corpo, Inter Tight nos comandos/numerais.
- Sem gradiente em texto, sem glassmorphism decorativo, sem cantos arredondados — sempre `cut`/`cut-sm`.
- Verde (`--verde`) só no beat do gate aprovado — é sinal funcional, não decoração.

## Som (sem locução)

- Pad sintetizado grave e contínuo sob os Atos 1–2, sobe de tensão sutilmente nos Dor 1→3.
- Clique de teclado discreto sincronizado ao typewriter do terminal (Ato 3).
- Um tom único, mais alto, no instante em que o gate vira "Aprovado" — reforça confiança/controle.
- Acorde final curto no logo lockup (Ato 5). Sem música genérica de stock "corporate AI".

## Produção / gravação

1. Abrir `index.html`, escolher modo (Full/Teaser), clicar **Play**.
2. Gravar o elemento `.stage` (1280×720, 16:9) — recomendado headless Chrome + `ffmpeg`
   para captura determinística, ou screen recording manual (OBS) com a janela
   redimensionada para o frame do `.stage`.
3. Exportar master em 1080p; o teaser é o corte separado, não um recorte do master
   (timings diferentes, ver tabela acima).
4. Se precisar de variante 9:16 no futuro: **deferido** — recompor Atos 3/4 em pilha
   vertical, não esticar o frame 16:9.

## Decisões já tomadas com o solicitante

- Formato: Full 45–60s + Teaser 15s.
- Produção: protótipo HTML/CSS/JS reaproveitando componentes do design-system.
- Narração: texto na tela + SFX, sem voz institucional.
