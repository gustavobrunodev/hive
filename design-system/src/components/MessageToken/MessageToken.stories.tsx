import type { Meta, StoryObj } from "@storybook/react-vite"
import { MessageToken } from "./MessageToken"
import { ChatMessage } from "../ChatMessage/ChatMessage"

const meta: Meta<typeof MessageToken> = {
  title: "Chat/MessageToken",
  component: MessageToken,
  parameters: { layout: "padded" },
}
export default meta

type Story = StoryObj<typeof MessageToken>

export const InAUserMessage: Story = {
  render: () => (
    <ChatMessage role="user">
      <MessageToken kind="command">/bmad-prd</MessageToken> revisar o escopo de faturamento a
      partir de <MessageToken kind="file">docs/faturamento/escopo.md</MessageToken>
    </ChatMessage>
  ),
}

export const InAnAssistantMessage: Story = {
  render: () => (
    <ChatMessage role="assistant">
      Comecei por <MessageToken kind="file">docs/faturamento/escopo.md</MessageToken>. Se quiser
      outras perspectivas, rode <MessageToken kind="command">/bmad-party-mode</MessageToken>.
    </ChatMessage>
  ),
}
