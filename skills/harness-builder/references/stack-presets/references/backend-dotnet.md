# .NET preset — skills set (no MCP)

> **Org choice:** the `github/awesome-copilot` `dotnet-best-practices` is the
> .NET best-practices baseline (chosen among several skills sharing that name).
>
> **No MCP preset.** The org's baseline MCP set (Figma, Playwright, Chrome
> DevTools) is frontend-only. A .NET backend gets **no MCP by default** — if the
> assessment surfaces a real gap (e.g. a DB or observability MCP), record it as
> one deferred line for the user to decide on, don't install it from here. Any
> MCP eventually added still follows HYG-08: credentials as `${ENV_VAR}`.

**Applies when:** the backend is .NET / C#.

## Detect that .NET applies

- `*.csproj`, `*.sln`, `*.fsproj`, `global.json`, or `Directory.Build.props`.

## Skills (install each only if missing)

Detect presence under `.cursor/skills/`, `.agents/skills/`, `.claude/skills/`, or
in `skills-lock.json`. Install project-level by default.

### Best-practices (pinned baseline)

- **Skill:** `dotnet-best-practices` — .NET / C# best practices (architecture,
  EF Core, CQRS, code-quality review).
- **Source (default):** `github/awesome-copilot` (skill `dotnet-best-practices`).
- **Alternatives:** Microsoft official `dotnet/skills` (plugin collection);
  `kaiboo404/agent-skills-with-project-template` (skill `dotnet-best-practices`).

```bash
npx skills add github/awesome-copilot --skill dotnet-best-practices -y
```

### Testing

- **Goal:** a skill enforcing the org's .NET testing conventions (xUnit/NUnit,
  test structure, mocking discipline).
- **Find & vet** (confirm on the leaderboard, don't hard-code blind):

  ```bash
  npx skills find dotnet testing
  ```

  Pick one with **1K+ installs** from a reputable source (`github`, `microsoft`,
  `dotnet`). Skip anything under 100 installs.
- **Skip if:** `dotnet-best-practices` already covers the project's testing
  conventions — don't duplicate.

### Performance

- Add a dedicated performance skill only on a specific observed gap (allocation /
  async / EF query profiling):

  ```bash
  npx skills find dotnet performance
  ```

  Same vetting bar. Prefer **not** adding one if the baseline suffices.

## Anti-overengineering

- The best-practices skill is the anchor; testing/performance skills are added
  **only on a real, observed gap**, not by default.
- No MCP by default for a .NET backend — resist adding one "to be safe."
