#!/usr/bin/env python3
"""Audit a repository's agent rule files against evidence-based best practices.

Checks the failure modes that research links to context files *hurting* agents:
oversized always-loaded content, redundancy with the README, vague/non-actionable
language, broken docs/ pointers, and missing executable commands.

It also checks the two unconditional blocks from references/mandatory-blocks.md —
the memory contract (a STATE-style file the agent is told to read at session
start) and the general rules ("Writing implementation plans" with real commands).
The architecture block is conditional on the project having architecture
principles at all, so it is not auto-checked.

Every finding is a prompt to *cut or sharpen* — not a hard gate. Usage:

    python3 audit_rules.py <repo-path>

Exit code is 0 unless a structural ERROR is found (e.g. broken pointer, size cap
exceeded). Stdlib only; no dependencies.
"""
from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass

# --- thresholds (line counts / bytes) -------------------------------------
SOFT_LINE_LIMIT = 150          # "ideal" ceiling for the always-loaded file
HARD_LINE_LIMIT = 300          # past here you're very likely net-negative
CODEX_BYTE_CAP = 32 * 1024     # Codex truncates combined AGENTS.md silently
CODEX_WARN_BYTES = 24 * 1024   # warn before you hit the cap
DUP_MIN_LEN = 40               # min line length to count as README duplication

# Clearly non-actionable phrases. Kept tight to avoid false positives.
# Rules are pt-BR by default (see agent-rules-architect SKILL.md), so both
# pt-BR and legacy/English phrasing are checked — repos being improved may
# still carry older English rule files.
VAGUE_PHRASES = [
    "clean code", "best practices", "high quality", "high-quality",
    "readable code", "write good code", "good code", "follow conventions",
    "follow the conventions", "follow our conventions", "well structured",
    "well-structured", "maintainable code", "as appropriate", "use common sense",
    "industry standard", "industry-standard", "properly formatted",
    "format properly", "format your code", "keep it clean", "write clean",
    "código limpo", "boas práticas", "alta qualidade", "código legível",
    "escreva um bom código", "bom código", "siga as convenções",
    "siga nossas convenções", "bem estruturado", "código de fácil manutenção",
    "conforme apropriado", "senso comum", "padrão da indústria",
    "formatado corretamente", "formate corretamente", "formate seu código",
    "mantenha limpo", "escreva código limpo",
]

# Canonical sections mandated by references/mandatory-blocks.md. Their wording
# reads as vague in isolation ("high quality", "industry standards") but each
# phrase is immediately followed by a concrete clause and exact commands, so
# flagging it would punish the required text. Vague-language checks are skipped
# inside these subsections only — the rest of the file is checked normally.
_CANON_SECTION = re.compile(
    r"(?i)^(#+)\s*(writing implementation plans|implementation and testing"
    r"|escrevendo planos de implementa[çc][ãa]o)\b")
_HEADING = re.compile(r"^(#+)\s")

RULE_FILENAMES = ["AGENTS.md", "CLAUDE.md"]

# --- mandatory blocks -----------------------------------------------------
# Block 1 — memory contract: a session-start pointer to a living state file.
_MEMORY_POINTER = re.compile(
    r"(?i)(state\.md|steering|constitution\.md|decisions?\.md|memory)")
_SESSION_IMPERATIVE = re.compile(
    r"(?i)(in[ií]cio de cada sess[ãa]o|antes de come[çc]ar|start of (?:each|every) "
    r"session|read (?:this )?first|leia (?:antes|no in[ií]cio))")
# Block 3 — general rules: the implementation-plan section.
_PLAN_SECTION = re.compile(
    r"(?im)^#+\s*(writing implementation plans|implementation plans"
    r"|escrevendo planos de implementa[çc][ãa]o)\b")


@dataclass
class Finding:
    level: str  # ERROR | WARN | INFO
    where: str
    message: str


def find_files(root: str, name: str) -> list[str]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules",
                       ".venv", "venv", "dist", "build", "__pycache__"}]
        if name in filenames:
            out.append(os.path.join(dirpath, name))
    return out


def read(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def rel(root: str, path: str) -> str:
    return os.path.relpath(path, root)


def check_size(root: str, agents_files: list[str], findings: list[Finding]) -> None:
    root_agents = os.path.join(root, "AGENTS.md")
    if os.path.exists(root_agents):
        text = read(root_agents)
        lines = text.count("\n") + 1
        if lines > HARD_LINE_LIMIT:
            findings.append(Finding("WARN", "AGENTS.md",
                f"{lines} lines (> {HARD_LINE_LIMIT}); very likely net-negative. "
                "Move specialized rules into on-demand doc/ files."))
        elif lines > SOFT_LINE_LIMIT:
            findings.append(Finding("WARN", "AGENTS.md",
                f"{lines} lines (> {SOFT_LINE_LIMIT} ideal). Trim or push detail "
                "into docs/."))

        # Compare against README.
        for readme in ("README.md", "README.rst", "readme.md"):
            rp = os.path.join(root, readme)
            if os.path.exists(rp):
                if len(text) > len(read(rp)):
                    findings.append(Finding("WARN", "AGENTS.md",
                        f"AGENTS.md is larger than {readme} — a strong sign it's "
                        "too long. The best files are shorter than the README."))
                break

    total = sum(len(read(p).encode("utf-8")) for p in agents_files)
    if total > CODEX_BYTE_CAP:
        findings.append(Finding("ERROR", "AGENTS.md (combined)",
            f"{total} bytes across {len(agents_files)} file(s) exceeds the 32 KiB "
            "cap some tools (Codex) silently truncate at."))
    elif total > CODEX_WARN_BYTES:
        findings.append(Finding("WARN", "AGENTS.md (combined)",
            f"{total} bytes is approaching the 32 KiB truncation cap."))


def check_vague(path: str, label: str, findings: list[Finding]) -> None:
    canon_level = 0          # 0 = outside a canonical section
    for i, line in enumerate(read(path).splitlines(), 1):
        heading = _HEADING.match(line)
        if heading:
            level = len(heading.group(1))
            # A heading at or above the canonical section's level ends it.
            if canon_level and level <= canon_level:
                canon_level = 0
            canon = _CANON_SECTION.match(line)
            if canon:
                canon_level = len(canon.group(1))
                continue
        if canon_level:
            continue          # inside mandated wording — not ours to flag
        low = line.lower()
        for phrase in VAGUE_PHRASES:
            if phrase in low:
                findings.append(Finding("WARN", f"{label}:{i}",
                    f'vague/non-actionable: "{line.strip()[:70]}" — replace with a '
                    "concrete command, path, or code snippet, or cut it."))
                break


def check_readme_redundancy(root: str, findings: list[Finding]) -> None:
    agents = os.path.join(root, "AGENTS.md")
    readme = os.path.join(root, "README.md")
    if not (os.path.exists(agents) and os.path.exists(readme)):
        return
    readme_lines = {ln.strip() for ln in read(readme).splitlines()
                    if len(ln.strip()) >= DUP_MIN_LEN}
    dups = []
    for i, line in enumerate(read(agents).splitlines(), 1):
        s = line.strip()
        if len(s) >= DUP_MIN_LEN and not s.startswith("#") and s in readme_lines:
            dups.append((i, s))
    for i, s in dups[:10]:
        findings.append(Finding("WARN", f"AGENTS.md:{i}",
            f'duplicates a README line: "{s[:60]}…" — reference the README instead.'))
    if len(dups) > 10:
        findings.append(Finding("INFO", "AGENTS.md",
            f"...and {len(dups) - 10} more lines duplicated from the README."))


_PATH_TOKEN = re.compile(r"`@?([\w./-]+\.(?:md|mdx))`")


def check_pointers(root: str, agents_files: list[str], findings: list[Finding]) -> None:
    """Every referenced docs file must exist; flag docs files never referenced."""
    referenced: set[str] = set()
    for af in agents_files:
        base = os.path.dirname(af)
        for m in _PATH_TOKEN.finditer(read(af)):
            target = m.group(1)
            cands = [os.path.join(root, target), os.path.join(base, target)]
            if any(os.path.exists(c) for c in cands):
                referenced.add(os.path.normpath(os.path.join(root, target)))
            else:
                findings.append(Finding("ERROR", rel(root, af),
                    f"index points to `{target}` but no such file exists."))

    docs_dir = os.path.join(root, "docs")
    if os.path.isdir(docs_dir):
        for dirpath, _, filenames in os.walk(docs_dir):
            for fn in filenames:
                if fn.endswith((".md", ".mdx")):
                    full = os.path.normpath(os.path.join(dirpath, fn))
                    if full not in referenced:
                        findings.append(Finding("INFO", rel(root, full),
                            "docs file not referenced by any AGENTS.md index — it "
                            "won't be discovered on demand. Add a trigger, or it may "
                            "be human-only docs (fine)."))


def check_commands(root: str, findings: list[Finding]) -> None:
    agents = os.path.join(root, "AGENTS.md")
    if not os.path.exists(agents):
        return
    text = read(agents)
    if not re.search(
        r"(?im)^#+\s*(commands?|build|test|usage|scripts"
        r"|comandos?|testes?|uso)\b", text,
    ):
        findings.append(Finding("INFO", "AGENTS.md",
            "no Commands/Build/Test (or Comandos/Testes) section found — exact "
            "build/test/lint commands are usually the single highest-value content."))
    elif text.count("`") < 4:
        findings.append(Finding("INFO", "AGENTS.md",
            "few backticked commands found — make commands exact and copy-pasteable, "
            "with flags."))


def check_mandatory_blocks(root: str, findings: list[Finding]) -> None:
    """The blocks that go in every AGENTS.md (see references/mandatory-blocks.md)."""
    agents = os.path.join(root, "AGENTS.md")
    if not os.path.exists(agents):
        return
    text = read(agents)

    # Block 1 — memory contract.
    if not _MEMORY_POINTER.search(text):
        findings.append(Finding("WARN", "AGENTS.md",
            "no memory contract found — the agent is never pointed at a living "
            "decision/lessons file. Add the STATE block (see mandatory-blocks.md "
            "block 1) with paths resolved from the project's SDD tool."))
    elif not _SESSION_IMPERATIVE.search(text):
        findings.append(Finding("WARN", "AGENTS.md",
            "a memory file is mentioned but not as a session-start instruction. "
            'Make it imperative — "**leia no início de cada sessão**" — or the '
            "agent will treat it as background, not an action."))

    # Block 3 — general rules.
    if not _PLAN_SECTION.search(text):
        findings.append(Finding("INFO", "AGENTS.md",
            'no "Writing implementation plans" section — it is mandatory (see '
            "mandatory-blocks.md block 3) and must carry this project's real "
            "build/lint/e2e commands."))


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    root = os.path.abspath(argv[1])
    if not os.path.isdir(root):
        print(f"error: not a directory: {root}")
        return 2

    agents_files = find_files(root, "AGENTS.md")
    findings: list[Finding] = []

    if not agents_files:
        findings.append(Finding("INFO", root,
            "no AGENTS.md found. If creating rules, start with a minimal root "
            "AGENTS.md (see the agent-rules-architect skill)."))
    else:
        check_size(root, agents_files, findings)
        check_readme_redundancy(root, findings)
        check_pointers(root, agents_files, findings)
        check_commands(root, findings)
        check_mandatory_blocks(root, findings)
        for af in agents_files:
            check_vague(af, rel(root, af), findings)
        for cf in find_files(root, "CLAUDE.md"):
            check_vague(cf, rel(root, cf), findings)

    order = {"ERROR": 0, "WARN": 1, "INFO": 2}
    findings.sort(key=lambda f: (order[f.level], f.where))

    print(f"\nAudit of {root}")
    print(f"Found {len(agents_files)} AGENTS.md file(s).\n")
    if not findings:
        print("  No issues found — lean and high-signal. ✅")
    icon = {"ERROR": "✗", "WARN": "!", "INFO": "·"}
    for f in findings:
        print(f"  [{f.level:<5}] {icon[f.level]} {f.where}: {f.message}")

    errors = sum(1 for f in findings if f.level == "ERROR")
    warns = sum(1 for f in findings if f.level == "WARN")
    print(f"\nSummary: {errors} error(s), {warns} warning(s), "
          f"{len(findings) - errors - warns} info.")
    print("Each finding is a prompt to cut or sharpen, then re-run.\n")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
