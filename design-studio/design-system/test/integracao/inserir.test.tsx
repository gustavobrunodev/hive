import React, { useEffect, useState } from "react"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  BarraDeProgresso,
  Botao,
  LinhaDoPainel,
  MensagemDoAgente,
  MolduraDeAparelho,
  NavegacaoDeVariantes,
  PainelFlutuante,
  PreviaDeInsercao,
  Segmentado,
  Sugestoes,
  Toast,
  VagaDeInsercao,
} from "../../src"

/* O ciclo do Inserir montado só com peças da lib: configurar, gerar (vaga e
   progresso), percorrer as Variantes na prévia e inserir (toast e mensagem). */

const VARIANTES = ["Aviso · Informativo", "Aviso · Com ação", "Aviso · Alerta"]

function Inserir() {
  const [fase, setFase] = useState<"config" | "gerando" | "ciclo" | "feito">("config")
  const [pedido, setPedido] = useState("")
  const [tipo, setTipo] = useState<string | null>(null)
  const [qtd, setQtd] = useState("3")
  const [feitas, setFeitas] = useState(0)
  const [i, setI] = useState(0)
  const n = Number(qtd)

  useEffect(() => {
    if (fase !== "gerando") return
    if (feitas >= n) {
      setFase("ciclo")
      return
    }
    const t = setTimeout(() => setFeitas((f) => f + 1), 480)
    return () => clearTimeout(t)
  }, [fase, feitas, n])

  return (
    <div>
      <MolduraDeAparelho nome="Revisar" emFoco>
        <div style={{ position: "relative" }}>
          {fase === "gerando" && <VagaDeInsercao gerando>Gerando Variante {Math.min(feitas + 1, n)} de {n}…</VagaDeInsercao>}
          {fase === "ciclo" && (
            <PreviaDeInsercao>
              <p>{VARIANTES[i]}</p>
            </PreviaDeInsercao>
          )}
          {fase === "feito" && <p>{VARIANTES[i]}</p>}
        </div>
      </MolduraDeAparelho>
      {fase !== "feito" && (
        <PainelFlutuante
          rotulo="Inserir na tela Revisar"
          icone="inserir"
          titulo="Depois do bloco “Beneficiário”"
          subtitulo="Revisar · Proposta A"
          rodape={
            fase === "config" ? (
              <Botao icone="raio" disabled={!pedido.trim()} onClick={() => setFase("gerando")}>
                Gerar Variantes
              </Botao>
            ) : fase === "ciclo" ? (
              <>
                <Botao variante="secundario" tamanho="pequeno" onClick={() => setFase("config")}>Descartar</Botao>
                <Botao tamanho="pequeno" icone="ok" onClick={() => setFase("feito")}>Inserir</Botao>
              </>
            ) : null
          }
        >
          {fase === "config" && (
            <>
              <label htmlFor="pedido">O que inserir</label>
              <textarea id="pedido" value={pedido} onChange={(e) => setPedido(e.target.value)} />
              <Sugestoes
                rotulo="Sugestões"
                valor={tipo}
                aoMudar={(v) => {
                  setTipo(v)
                  setPedido("Um aviso explicando por que o IBAN precisa estar completo")
                }}
                opcoes={[{ valor: "aviso", rotulo: "Aviso" }, { valor: "botao", rotulo: "Botão" }]}
              />
              <LinhaDoPainel rotulo="Quantas Variantes">
                <Segmentado forma="compacto" rotulo="Quantidade" valor={qtd} aoMudar={setQtd} opcoes={["1", "2", "3"].map((v) => ({ valor: v, rotulo: v }))} />
              </LinhaDoPainel>
            </>
          )}
          {fase === "gerando" && <BarraDeProgresso valor={feitas / n} rotulo="Progresso das Variantes" />}
          {fase === "ciclo" && (
            <NavegacaoDeVariantes atual={i + 1} total={n} nome={VARIANTES[i]!} aoAnterior={() => setI((v) => (v + n - 1) % n)} aoProxima={() => setI((v) => (v + 1) % n)} />
          )}
        </PainelFlutuante>
      )}
      {fase === "feito" && (
        <>
          <Toast>Elemento inserido · Ponto de restauração criado</Toast>
          <MensagemDoAgente agente="claude" hora="11:14" carimbo={`Aviso inserido · Variante ${i + 1}`} pontoDeRestauracao="Aviso inserido">
            <p>Inseri um aviso depois do bloco “Beneficiário”.</p>
          </MensagemDoAgente>
        </>
      )}
    </div>
  )
}

describe("fluxo: Inserir", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it("configura, gera, percorre as Variantes e insere", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Inserir />)
    const gerar = screen.getByRole("button", { name: "Gerar Variantes" })
    expect(gerar).toBeDisabled()

    await usuario.click(screen.getByRole("button", { name: "Aviso" }))
    expect(screen.getByRole("textbox", { name: "O que inserir" })).toHaveValue("Um aviso explicando por que o IBAN precisa estar completo")
    await usuario.click(gerar)

    expect(screen.getByText("Gerando Variante 1 de 3…")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
    act(() => void vi.advanceTimersByTime(480))
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33")
    expect(screen.getByText("Gerando Variante 2 de 3…")).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(480))
    act(() => void vi.advanceTimersByTime(480))

    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Variante 1 de 3Aviso · Informativo")
    await usuario.click(screen.getByRole("button", { name: "Próxima Variante" }))
    expect(screen.getByText("Aviso · Com ação", { selector: ".dst-previa p" })).toBeInTheDocument()

    await usuario.click(screen.getByRole("button", { name: "Inserir" }))
    expect(screen.getByRole("status")).toHaveTextContent("Elemento inserido · Ponto de restauração criado")
    expect(screen.getByRole("article", { name: "Claude, 11:14" })).toHaveTextContent("Aviso inserido · Variante 2")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("com uma Variante as setas ficam desabilitadas e Descartar volta à configuração", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Inserir />)
    await usuario.type(screen.getByRole("textbox", { name: "O que inserir" }), "Um botão de ajuda")
    await usuario.click(screen.getByRole("button", { name: "1" }))
    await usuario.click(screen.getByRole("button", { name: "Gerar Variantes" }))
    act(() => void vi.advanceTimersByTime(480))
    expect(screen.getByRole("button", { name: "Próxima Variante" })).toBeDisabled()
    await usuario.click(screen.getByRole("button", { name: "Descartar" }))
    expect(screen.getByRole("textbox", { name: "O que inserir" })).toHaveValue("Um botão de ajuda")
  })
})
