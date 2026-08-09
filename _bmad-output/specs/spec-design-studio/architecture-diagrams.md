# Architecture Diagrams — Design Studio

## Component graph

```mermaid
graph TD
  UI["Preview / Inspetor / Árvore / Chat (React)"] --> Doc
  UI --> DS
  Skill["Skill de Design System"] --> Doc
  Skill --> Agent[("AgentAdapter existente")]
  DS["DesignSystemAdapter (Web Awesome v1)"] --> Doc
  Preview["Preview Host (protocolo hive-studio:// + iframe sandbox)"] --> Doc
  Preview --> DS
  Export["Export Bundle"] --> Doc
  Export --> DS
  Session["Session Store (userData)"] --> Doc
  Doc["ScreenDocument + Command Stack"]
```

## Generation / edit sequence

```mermaid
sequenceDiagram
  participant User
  participant UI as Design Studio UI
  participant Skill as Skill de Design System
  participant Agent as AgentAdapter
  participant Doc as ScreenDocument
  participant DS as DesignSystemAdapter
  participant Host as Preview Host

  User->>UI: abrir Spec de UX (CAP-1)
  UI->>Skill: gerar Telas (CAP-2)
  Skill->>Agent: sessão de agente (prompt + Spec + catálogo)
  Agent-->>Skill: resposta em linguagem natural
  Skill->>Skill: parseia resposta em Command[] (AD-3)
  Skill->>Doc: aplica Command[] (AD-2, AD-3: lote tudo-ou-nada)
  Doc-->>Host: novo estado
  Host->>DS: renderToDom(Document)
  DS-->>Host: nós DOM (construção segura, AD-4 — nunca string/markup)
  Host-->>UI: Preview atualizado via postMessage same-origin (AD-5)
```

## Directory layout

```text
hive-desktop/
  resources/
    design-system-web-awesome/  # DS bundle (JS+CSS+assets), asarUnpack'd (AD-5)
  src/
    main/
      designStudio/
        screenDocument.ts        # ScreenDocument type, Command union, reducer, undo-via-replay (AD-2, AD-8)
        dsAdapter/
          types.ts                # DesignSystemAdapter port + catalog shape
          webAwesomeAdapter.ts     # v1 concrete adapter (safe DOM construction, AD-4)
        skillDesignSystem.ts      # Spec de UX / chat NL -> Command[], via AgentAdapter (AD-3, AD-9)
        previewProtocol.ts        # protocol.handle('hive-studio://…') + per-response CSP (AD-5)
        sessionStore.ts           # userData persistence — mirrors chatHistoryStore.ts (AD-7)
        exportBundle.ts           # Document + DS Adapter -> self-contained HTML (AD-6)
        designStudioService.ts    # facade exposed over IPC as designStudio:*
    renderer/src/
      designStudio/
        DesignStudioViewer.tsx    # registered as EditorTabKind 'design-studio' (AD-1)
        PreviewPane.tsx           # sandboxed iframe pointed at hive-studio://
        Inspector.tsx
        ComponentTree.tsx
        IterationChat.tsx
```

Rationale para a exceção de subdiretório (`main/designStudio/` vs. o resto de `src/main/` flat): ver `architecture-decisions.md`, seção "Naming & Structure".
