import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "./Button"

const meta = {
  title: "Forms/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Começar agora",
    variant: "primary",
    arrow: false,
    cut: true,
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "ghost"],
    },
    arrow: { control: "boolean" },
    cut: { control: "boolean" },
    href: { control: "text" },
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    variant: "primary",
  },
}

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ver documentação",
  },
}

export const WithArrow: Story = {
  args: {
    variant: "primary",
    arrow: true,
    children: "Conhecer a skill",
  },
}

export const Disabled: Story = {
  args: {
    variant: "primary",
    disabled: true,
    children: "Indisponível",
  },
}

export const NoCut: Story = {
  args: {
    variant: "ghost",
    cut: false,
    children: "Cancelar",
  },
}
