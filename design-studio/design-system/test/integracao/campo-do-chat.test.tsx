import React, { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CampoDoChat, MensagemDaPessoa, NotaAutoadesiva, Seletor, type Citacao } from "../../src"

/* O Início: tocar numa nota cita a Dor no campo; enviar vira mensagem da pessoa
   com o chip da Dor; a nota desmarca e o campo esvazia. */

const DORES: Citacao[] = [
  { id: "cam-v1", fonte: "voz", titulo: "Minha transação de câmbio estornou e não recebi nenhuma notificação" },
  { id: "cam-l1", fonte: "likert", titulo: "A cotação muda entre simular e confirmar" },
]

function Inicio() {
  const [texto, setTexto] = useState("")
  const [citadas, setCitadas] = useState<Citacao[]>([])
  const [enviadas, setEnviadas] = useState<{ texto: string; citacoes: Citacao[] }[]>([])
  const alternar = (d: Citacao) => setCitadas((cs) => (cs.some((c) => c.id === d.id) ? cs.filter((c) => c.id !== d.id) : [...cs, d]))
  return (
    <div>
      <section aria-label="Conversa">
        {enviadas.map((m, i) => (
          <MensagemDaPessoa key={i} hora={`10:0${i}`} citacoes={m.citacoes}>
            {m.texto && <p>{m.texto}</p>}
          </MensagemDaPessoa>
        ))}
      </section>
      <CampoDoChat
        valor={texto}
        aoMudar={setTexto}
        citacoes={citadas}
        aoRemoverCitacao={(id) => setCitadas((cs) => cs.filter((c) => c.id !== id))}
        aoEnviar={(envio) => {
          setEnviadas((ms) => [...ms, envio])
          setTexto("")
          setCitadas([])
        }}
        agente={<Seletor valor="Claude" complemento="Sonnet" agente="claude" />}
      />
      <section aria-label="Dores em alta">
        {DORES.map((d) => (
          <NotaAutoadesiva key={d.id} fonte={d.fonte} titulo={d.titulo} marcada={citadas.some((c) => c.id === d.id)} aoClicar={() => alternar(d)} />
        ))}
      </section>
    </div>
  )
}

describe("fluxo: citar Dores e conversar", () => {
  it("cita pela nota, remove pelo chip, envia com texto e Dor", async () => {
    render(<Inicio />)
    const enviar = screen.getByRole("button", { name: "Enviar" })
    expect(enviar).toBeDisabled()

    const nota = screen.getByRole("button", { name: /Minha transação de câmbio/ })
    await userEvent.click(nota)
    expect(nota).toHaveAttribute("aria-pressed", "true")
    expect(enviar).toBeEnabled()

    await userEvent.click(screen.getByRole("button", { name: /A cotação muda/ }))
    await userEvent.click(screen.getByRole("button", { name: "Tirar a citação: A cotação muda entre simular e confirmar" }))
    expect(screen.getByRole("button", { name: /A cotação muda/ })).toHaveAttribute("aria-pressed", "false")

    await userEvent.type(screen.getByRole("textbox", { name: "Mensagem para o agente" }), "Resolve primeiro o estorno sem aviso{Enter}")

    const conversa = screen.getByRole("region", { name: "Conversa" })
    const msg = within(conversa).getByRole("article", { name: "Você, 10:00" })
    expect(msg).toHaveTextContent("Resolve primeiro o estorno sem aviso")
    expect(within(msg).getByTitle(DORES[0]!.titulo)).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveValue("")
    expect(nota).toHaveAttribute("aria-pressed", "false")
    expect(enviar).toBeDisabled()
  })

  it("só uma Dor, sem texto, também conversa", async () => {
    render(<Inicio />)
    await userEvent.click(screen.getByRole("button", { name: /A cotação muda/ }))
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }))
    const msg = screen.getByRole("article", { name: "Você, 10:00" })
    expect(within(msg).getByTitle(DORES[1]!.titulo)).toBeInTheDocument()
  })
})
