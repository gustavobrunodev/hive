import React, { useEffect } from "react"
import type { Decorator, Preview } from "@storybook/react"
import "../src/base.css"

type Tema = "light" | "dark"

/**
 * Põe `data-theme` no `<html>` do iframe. Os tokens do escuro vivem em
 * `:root[data-theme='dark']`, então um atributo num `<div>` não pegaria.
 */
const comTema: Decorator = (Historia, contexto) => {
  const tema = (contexto.globals.theme as Tema | undefined) ?? "light"
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema)
  }, [tema])
  return React.createElement(Historia)
}

const preview: Preview = {
  decorators: [comTema],
  globalTypes: {
    theme: {
      name: "Tema",
      description: "Tema do Design Studio (data-theme)",
      defaultValue: "light",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "light", title: "Claro (abre nele: projetor e tela compartilhada)" },
          { value: "dark", title: "Escuro" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    // reset.css já pinta o body com --quadro, que muda com o tema.
    backgrounds: { disable: true },
    a11y: { test: "error" },
    controls: { matchers: { color: /(background|color)$/i } },
    options: {
      storySort: {
        order: ["Introdução", "Fundamentos", ["Tokens", "Tipografia"], "Marca e ícones", "Agentes", "Ações", "Seleção", "Rótulos", "Entrada", "Navegação", "Quadro", "Modo ao vivo", "Conversa", "Avisos", "Superfícies", "Dados"],
      },
    },
  },
}

export default preview
