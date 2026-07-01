# .NET baseline — `dotnet-best-practices`

> **Org choice:** the `github/awesome-copilot` `dotnet-best-practices` is the
> .NET baseline (chosen among several skills sharing that name).

**Applies when:** the backend is .NET / C#.

## Detect that .NET applies

- `*.csproj`, `*.sln`, `*.fsproj`, `global.json`, or `Directory.Build.props`.

## Detect if already installed (if found, skip)

- `dotnet-best-practices` (or another `dotnet-*`) under `.cursor/skills/`,
  `.agents/skills/`, `.claude/skills/`, or in `skills-lock.json`.

## The baseline

- **Skill:** `dotnet-best-practices` — .NET / C# best practices (architecture,
  EF Core, CQRS, code-quality review).
- **Source (default):** `github/awesome-copilot` (skill `dotnet-best-practices`).
- **Alternatives:** Microsoft official `dotnet/skills` (plugin collection);
  `kaiboo404/agent-skills-with-project-template` (skill `dotnet-best-practices`).

## Install (project-level, only if missing)

```bash
npx skills add github/awesome-copilot --skill dotnet-best-practices -y
```

Global alternative: add `-g`.
