import * as React from "react"
import "./HarnessMark.css"

/**
 * HarnessMark — marca do produto Harness Builder (iniciativa HIVE).
 *
 * Direção "colmeia afiada": herda o hexágono da marca-mãe HIVE, com o núcleo
 * em foco (o agente sob controle / o harness firme) e as células que se
 * dispersam ao topo (a evolução contínua do harness).
 *
 * Cores 100% da paleta HIVE: coral no traço, verde no núcleo. A versão
 * monocromática (tone="mono") usa uma cor só, passada em `color`.
 */

/**
 * HarnessMark — from @hive/design-system.
 * Marca do produto Harness Builder (direção "colmeia afiada").
 */
export interface HarnessMarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Qual lockup renderizar. Default: "symbol". */
  variant?: "symbol" | "horizontal" | "stacked" | "wordmark" | "icon"
  /** "color" = coral + núcleo verde; "mono" = uma cor só (usa `color`). Default: "color". */
  tone?: "color" | "mono"
  /** Cor da versão monocromática. Default: currentColor. */
  color?: string
  /** Tamanho do símbolo em px; escala o lockup inteiro. */
  size?: number
  /** Cor de fundo do tile (só no variant "icon"). Default: var(--bordo-2). */
  background?: string
  /** Mostra "Uma skill · HIVE". Default: true. */
  endorsement?: boolean
}

const HEX = "58,20 24,40 24,80 58,100 92,80 92,40"
const CORE = "58,46 45,53.5 45,66.5 58,74 71,66.5 71,53.5"
const CELL_1 = "99,24 90,29 90,39 99,44 108,39 108,29"
const CELL_2 = "113,9 107,12.5 107,19.5 113,23 119,19.5 119,12.5"

function HexSymbol({ tone, color }: { tone?: HarnessMarkProps["tone"]; color?: string }) {
  const mono = tone === "mono"
  const stroke = mono ? color || "currentColor" : "var(--coral)"
  const core = mono ? color || "currentColor" : "var(--verde)"
  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", overflow: "visible" }}
    >
      <polygon points={HEX} fill="none" stroke={stroke} strokeWidth={6} strokeLinejoin="round" />
      <polygon points={CORE} fill={core} />
      <polygon points={CELL_1} fill={stroke} opacity={0.9} />
      <polygon points={CELL_2} fill={stroke} opacity={0.5} />
    </svg>
  )
}

function Wordmark({
  fontSize = 24,
  endorsement,
  color,
  align = "left",
}: {
  fontSize?: number
  endorsement?: boolean
  color?: string
  align?: string
}) {
  const showEndo = !(endorsement === false || (endorsement as unknown) === "false")
  return (
    <span className="hds-hbmark-wm" style={{ gap: Math.round(fontSize * 0.28) + "px", textAlign: align as React.CSSProperties["textAlign"] }}>
      <span className="hds-hbmark-name" style={{ fontSize: fontSize + "px", color: color || "var(--ink)" }}>
        Harness Builder
      </span>
      {showEndo && (
        <span className="hds-hbmark-endo" style={{ fontSize: Math.max(9, Math.round(fontSize * 0.42)) + "px" }}>
          Uma skill · HIVE
        </span>
      )}
    </span>
  )
}

const Box = ({ size, children }: { size: number; children: React.ReactNode }) => (
  <span className="hds-hbmark-box" style={{ width: size + "px", height: size + "px" }}>
    {children}
  </span>
)

export function HarnessMark({
  variant = "symbol",
  tone = "color",
  color,
  size,
  background,
  endorsement,
  className,
  ...rest
}: HarnessMarkProps) {
  const cn = ["hds-hbmark", className].filter(Boolean).join(" ")
  const wordColor = tone === "mono" ? color : undefined
  const sym = (s: number) => (
    <Box size={s}>
      <HexSymbol tone={tone} color={color} />
    </Box>
  )

  if (variant === "wordmark") {
    return (
      <span className={cn} role="img" aria-label="Harness Builder" {...rest}>
        <Wordmark fontSize={Number(size) || 24} endorsement={endorsement} color={wordColor} />
      </span>
    )
  }

  if (variant === "icon") {
    const isz = Number(size) || 96
    return (
      <span
        className={cn + " hds-hbmark-tile"}
        role="img"
        aria-label="Harness Builder"
        style={{ width: isz + "px", height: isz + "px", background: background || "var(--bordo-2)" }}
        {...rest}
      >
        <Box size={Math.round(isz * 0.55)}>
          <HexSymbol tone={tone} color={color} />
        </Box>
      </span>
    )
  }

  if (variant === "horizontal") {
    const hz = Number(size) || 44
    return (
      <span
        className={cn + " hds-hbmark-row"}
        role="img"
        aria-label="Harness Builder"
        style={{ gap: Math.round(hz * 0.32) + "px" }}
        {...rest}
      >
        {sym(hz)}
        <Wordmark fontSize={Math.round(hz * 0.52)} endorsement={endorsement} color={wordColor} />
      </span>
    )
  }

  if (variant === "stacked") {
    const st = Number(size) || 56
    return (
      <span
        className={cn + " hds-hbmark-stack"}
        role="img"
        aria-label="Harness Builder"
        style={{ gap: Math.round(st * 0.24) + "px" }}
        {...rest}
      >
        {sym(st)}
        <Wordmark fontSize={Math.round(st * 0.42)} endorsement={endorsement} align="center" color={wordColor} />
      </span>
    )
  }

  // variant === "symbol"
  return (
    <span className={cn} role="img" aria-label="Harness Builder" {...rest}>
      {sym(Number(size) || 40)}
    </span>
  )
}

export default HarnessMark
