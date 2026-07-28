#!/usr/bin/env python3
"""Inventory a repository's coding-agent *harness* — its guides and sensors.

Scans a repo for the controls that make up an agent harness (linters, type
checkers, tests/coverage/mutation, dependency & architecture rules, SAST & secret
scanning, hook runners, CI, agent rule files), infers *where each runs* in the
lifecycle (in-session / pre-commit / CI / continuous), and prints a coverage map
plus likely gaps.

It also runs the three **hygiene-floor** checks, which are reported by ID on
every run regardless of stack or scope:

    CI-04   pre-commit hook tooling installed and actually wired
    HYG-02  .gitignore covers .env AND .env.*
    HYG-08  MCP config exists and references credentials via ${ENV_VAR}

It is a fast, deterministic first pass for the harness-engineer skill — not a
verdict. Confirm what each control *actually enforces* by reading the configs, and
treat every gap as a prompt to investigate, not an order to add a tool.

Usage:
    python3 harness_inventory.py <repo-path> [--json]

Stdlib only; no dependencies. Exit code is always 0 (it's a report).
"""
from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field

SKIP_DIRS = {
    ".git", "node_modules", ".venv", "venv", "env", "dist", "build", "out",
    "__pycache__", ".next", ".nuxt", "target", ".turbo", ".cache", "vendor",
    ".gradle", "bin", "obj", ".idea", ".pytest_cache", ".mypy_cache",
    "coverage", ".stryker-tmp",
}

# ---------------------------------------------------------------------------
# Control registry. Each control knows how to be detected and how to be placed.
# detection: config filenames/dirs (exact basename, or a "dir/" prefix), and
# dependency package names searched inside manifests. stage is inferred from
# which orchestration files reference its cmd_keywords.
# ---------------------------------------------------------------------------


@dataclass
class Control:
    key: str
    label: str
    direction: str       # feedforward | feedback
    execution: str       # computational | inferential | mixed
    category: str        # maintainability | architecture | behaviour | security | cross
    cmd_keywords: tuple = ()      # tokens that, in a hook/CI/guide file, mean "runs here"
    config_files: tuple = ()      # exact basenames signalling presence
    config_dirs: tuple = ()       # path-prefix dirs signalling presence
    dep_names: tuple = ()         # package names searched in manifests
    gating_default: str = "report"  # gate | report
    note: str = ""


CONTROLS = [
    Control("eslint", "ESLint", "feedback", "computational", "maintainability",
            cmd_keywords=("eslint",), config_files=(".eslintrc", ".eslintrc.js",
            ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yml", ".eslintrc.yaml",
            "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs",
            "eslint.config.ts"), dep_names=("eslint",)),
    Control("ruff", "Ruff", "feedback", "computational", "maintainability",
            cmd_keywords=("ruff",), config_files=("ruff.toml", ".ruff.toml"),
            dep_names=("ruff",)),
    Control("pylint", "Pylint", "feedback", "computational", "maintainability",
            cmd_keywords=("pylint",), config_files=(".pylintrc", "pylintrc"),
            dep_names=("pylint",)),
    Control("flake8", "flake8", "feedback", "computational", "maintainability",
            cmd_keywords=("flake8",), config_files=(".flake8",), dep_names=("flake8",)),
    Control("golangci", "golangci-lint", "feedback", "computational", "maintainability",
            cmd_keywords=("golangci-lint", "golangci"), config_files=(".golangci.yml",
            ".golangci.yaml", ".golangci.toml")),
    Control("clippy", "Clippy", "feedback", "computational", "maintainability",
            cmd_keywords=("clippy",), config_files=("clippy.toml", ".clippy.toml")),
    Control("rubocop", "RuboCop", "feedback", "computational", "maintainability",
            cmd_keywords=("rubocop",), config_files=(".rubocop.yml",), dep_names=("rubocop",)),
    Control("prettier", "Prettier", "feedforward", "computational", "maintainability",
            cmd_keywords=("prettier",), config_files=(".prettierrc", ".prettierrc.json",
            ".prettierrc.js", ".prettierrc.yml", ".prettierrc.yaml", "prettier.config.js"),
            dep_names=("prettier",), note="formatter — keeps style noise out of the agent's way"),

    Control("tsc", "TypeScript type checker", "feedback", "computational", "maintainability",
            cmd_keywords=("tsc", "tsc --noemit", "typecheck"), config_files=("tsconfig.json",),
            dep_names=("typescript",), gating_default="gate",
            note="a typed language gives you a sensor for free"),
    Control("mypy", "mypy", "feedback", "computational", "maintainability",
            cmd_keywords=("mypy",), config_files=("mypy.ini", ".mypy.ini"), dep_names=("mypy",),
            gating_default="gate"),
    Control("pyright", "Pyright", "feedback", "computational", "maintainability",
            cmd_keywords=("pyright",), config_files=("pyrightconfig.json",),
            dep_names=("pyright",), gating_default="gate"),

    Control("tests", "Test suite", "feedback", "computational", "behaviour",
            cmd_keywords=("pytest", "vitest", "jest", "go test", "cargo test",
            "mvn test", "gradle test", "dotnet test", "rspec", "npm test", "npm run test"),
            config_files=("pytest.ini", "jest.config.js", "jest.config.ts",
            "vitest.config.ts", "vitest.config.js", "conftest.py"),
            dep_names=("pytest", "vitest", "jest"), gating_default="gate",
            note="the regression sensor; ask whether assertions are strong, not just green"),
    Control("coverage", "Coverage", "feedback", "computational", "maintainability",
            cmd_keywords=("--coverage", "coverage", "cov", "nyc", "c8", "jacoco",
            "coverlet", "tarpaulin", "llvm-cov"), config_files=(".coveragerc", ".nycrc"),
            dep_names=("nyc", "c8", "coverage"),
            note="coverage shows what RAN, not what was ASSERTED"),
    Control("mutation", "Mutation testing", "feedback", "computational", "maintainability",
            cmd_keywords=("stryker", "mutmut", "cosmic-ray", "pitest", "cargo-mutants",
            "gremlins", "go-mutesting"), config_files=("stryker.conf.json",
            "stryker.conf.js", "stryker.config.json", ".mutmut-cache"),
            dep_names=("@stryker-mutator", "stryker", "mutmut", "cosmic-ray"),
            note="finds MISSING ASSERTIONS — key when tests are AI-generated"),
    Control("property", "Property-based testing", "feedback", "computational", "behaviour",
            cmd_keywords=("hypothesis", "fast-check", "proptest", "jqwik", "fscheck"),
            dep_names=("hypothesis", "fast-check", "proptest", "jqwik", "fscheck")),

    Control("depcruiser", "dependency-cruiser (arch rules)", "feedback", "computational",
            "architecture", cmd_keywords=("depcruise", "dependency-cruiser"),
            config_files=(".dependency-cruiser.js", ".dependency-cruiser.cjs",
            ".dependency-cruiser.json"), dep_names=("dependency-cruiser",),
            gating_default="gate", note="enforces module boundaries / layer direction"),
    Control("importlinter", "import-linter (arch rules)", "feedback", "computational",
            "architecture", cmd_keywords=("import-linter", "lint-imports"),
            config_files=(".importlinter",), dep_names=("import-linter",),
            gating_default="gate"),
    Control("deptry", "deptry", "feedback", "computational", "architecture",
            cmd_keywords=("deptry",), dep_names=("deptry",)),
    Control("archunit", "ArchUnit (structural tests)", "feedback", "computational",
            "architecture", cmd_keywords=("archunit",), dep_names=("archunit",),
            gating_default="gate"),
    Control("boundaries", "eslint-plugin-boundaries", "feedback", "computational",
            "architecture", dep_names=("eslint-plugin-boundaries",), gating_default="gate"),

    Control("semgrep", "Semgrep (SAST)", "feedback", "computational", "security",
            cmd_keywords=("semgrep",), config_files=(".semgrep.yml", ".semgrep.yaml"),
            config_dirs=(".semgrep/",), dep_names=("semgrep",)),
    Control("bandit", "Bandit (SAST)", "feedback", "computational", "security",
            cmd_keywords=("bandit",), config_files=(".bandit",), dep_names=("bandit",)),
    Control("gitleaks", "GitLeaks (secret scan)", "feedback", "computational", "security",
            cmd_keywords=("gitleaks",), config_files=(".gitleaks.toml",),
            gating_default="gate", note="best as a pre-commit gate"),
    Control("trufflehog", "trufflehog (secret scan)", "feedback", "computational", "security",
            cmd_keywords=("trufflehog",), gating_default="gate"),
    Control("sca", "Dependency / vuln scanning (SCA)", "feedback", "computational", "security",
            cmd_keywords=("npm audit", "pip-audit", "osv-scanner", "govulncheck",
            "cargo-audit", "cargo audit", "trivy", "dependency-check", "--vulnerable"),
            config_files=("dependabot.yml", "renovate.json", ".renovaterc"),
            note="known-vuln detection; usually CI + scheduled"),
]

GUIDE_FILES = ("AGENTS.md", "CLAUDE.md", "GEMINI.md", ".cursorrules",
               ".windsurfrules", ".clinerules", "copilot-instructions.md")
GUIDE_DIRS = (".cursor/rules/", ".github/", ".clinerules/")

HOOK_FILES = (".pre-commit-config.yaml", ".pre-commit-config.yml", "lefthook.yml",
              "lefthook.yaml", "lefthook.toml", ".lefthook.yml")
HOOK_DIRS = (".husky/", ".githooks/")

# --- hygiene floor ---------------------------------------------------------
# HYG-08: where MCP configuration is expected to live.
MCP_CONFIG_PATHS = (".cursor/mcp.json", ".mcp.json", ".agents/mcp_config.json",
                    ".vscode/mcp.json", ".claude/mcp.json")
# Keys whose *value* must never be a literal in a committed MCP config.
CREDENTIAL_KEY_HINTS = ("key", "token", "secret", "password", "passwd", "apikey",
                        "api_key", "credential", "auth", "pat", "bearer")
# Values that are fine even under a credential-shaped key: env interpolation, or
# an obviously non-secret pointer.
_ENV_INTERP = re.compile(r"\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Z_][A-Z0-9_]*$")

CI_DIRS = (".github/workflows/",)
CI_FILES = (".gitlab-ci.yml", "azure-pipelines.yml", "Jenkinsfile", ".travis.yml")
CIRCLE = ".circleci/config.yml"

MANIFESTS = {
    "package.json": "Node/JavaScript/TypeScript",
    "tsconfig.json": "TypeScript",
    "pyproject.toml": "Python",
    "setup.cfg": "Python",
    "requirements.txt": "Python",
    "go.mod": "Go",
    "Cargo.toml": "Rust",
    "pom.xml": "Java/JVM (Maven)",
    "build.gradle": "Java/JVM (Gradle)",
    "build.gradle.kts": "Kotlin/JVM (Gradle)",
    "Gemfile": "Ruby",
    "composer.json": "PHP",
}


@dataclass
class Scan:
    root: str
    rel_files: set = field(default_factory=set)
    basenames: dict = field(default_factory=dict)   # basename -> [relpaths]
    dirs: set = field(default_factory=set)
    manifest_text: str = ""
    hook_text: str = ""
    guide_text: str = ""
    config_text: str = ""                            # tsconfig/eslint/pyproject contents
    ci_files: list = field(default_factory=list)     # (relpath, scheduled, text_lower)


def read(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def walk(root: str) -> Scan:
    s = Scan(root=root)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            s.rel_files.add(rel)
            s.basenames.setdefault(fn, []).append(rel)
            d = os.path.dirname(rel)
            while d:
                s.dirs.add(d + "/")
                d = os.path.dirname(d)
    return s


def has_dir(s: Scan, prefix: str) -> bool:
    return any(p == prefix or p.startswith(prefix) for p in s.dirs) or \
        any(f.startswith(prefix) for f in s.rel_files)


def files_under(s: Scan, prefix: str) -> list:
    return [f for f in s.rel_files if f.startswith(prefix)]


def gather_text(s: Scan) -> None:
    # Manifests (for dependency detection).
    for name in ("package.json", "pyproject.toml", "setup.cfg", "requirements.txt",
                 "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts",
                 "Gemfile", "composer.json", "go.mod"):
        for rel in s.basenames.get(name, []):
            s.manifest_text += "\n" + read(os.path.join(s.root, rel))

    # Config contents we content-check (tsconfig strict, eslint AI rules, ruff).
    for name in ("tsconfig.json", "pyproject.toml", "ruff.toml", ".ruff.toml",
                 ".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs",
                 ".eslintrc.yml", ".eslintrc.yaml", "eslint.config.js",
                 "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts"):
        for rel in s.basenames.get(name, []):
            s.config_text += "\n" + read(os.path.join(s.root, rel))

    # Hook orchestration.
    for name in HOOK_FILES:
        for rel in s.basenames.get(name, []):
            s.hook_text += "\n" + read(os.path.join(s.root, rel)).lower()
    for prefix in HOOK_DIRS:
        for rel in files_under(s, prefix):
            s.hook_text += "\n" + read(os.path.join(s.root, rel)).lower()
    # husky/lint-staged/simple-git-hooks declared in package.json count as hooks.
    pkg = ""
    for rel in s.basenames.get("package.json", []):
        pkg += read(os.path.join(s.root, rel)).lower()
    if any(k in pkg for k in ("lint-staged", "husky", "simple-git-hooks", "pre-commit")):
        s.hook_text += "\n" + pkg

    # Guides.
    for name in GUIDE_FILES:
        for rel in s.basenames.get(name, []):
            s.guide_text += "\n" + read(os.path.join(s.root, rel)).lower()
    for rel in files_under(s, ".cursor/rules/"):
        s.guide_text += "\n" + read(os.path.join(s.root, rel)).lower()

    # CI files, per-file with scheduled detection.
    ci_paths = []
    for prefix in CI_DIRS:
        ci_paths += [f for f in files_under(s, prefix) if f.endswith((".yml", ".yaml"))]
    for name in CI_FILES:
        ci_paths += s.basenames.get(name, [])
    if os.path.exists(os.path.join(s.root, CIRCLE)):
        ci_paths.append(CIRCLE)
    for rel in ci_paths:
        txt = read(os.path.join(s.root, rel)).lower()
        scheduled = "schedule:" in txt or "cron:" in txt or " cron " in txt
        s.ci_files.append((rel, scheduled, txt))


def detect_stack(s: Scan) -> list:
    out = []
    for name, label in MANIFESTS.items():
        if s.basenames.get(name):
            out.append(label)
    # de-dup preserving order
    seen, uniq = set(), []
    for x in out:
        if x not in seen:
            uniq.append(x)
            seen.add(x)
    return uniq


def control_present(c: Control, s: Scan) -> bool:
    for name in c.config_files:
        if s.basenames.get(name):
            return True
    for d in c.config_dirs:
        if has_dir(s, d):
            return True
    mt = s.manifest_text.lower()
    for dep in c.dep_names:
        if dep.lower() in mt:
            return True
    # A keyword wired into hooks/CI/guides also proves the control is in play.
    return bool(control_stages(c, s))


def control_stages(c: Control, s: Scan) -> list:
    stages = []
    kws = tuple(k.lower() for k in c.cmd_keywords)
    if kws:
        if any(k in s.guide_text for k in kws):
            stages.append("in-session")
        if any(k in s.hook_text for k in kws):
            stages.append("pre-commit")
        for _rel, scheduled, txt in s.ci_files:
            if any(k in txt for k in kws):
                stages.append("continuous" if scheduled else "CI")
    # de-dup, stable order
    order = ["in-session", "pre-commit", "CI", "continuous", "runtime"]
    return [st for st in order if st in stages]


def content_findings(s: Scan, present: dict, findings: list) -> None:
    cfg = s.config_text.lower()
    # tsc strict
    if present.get("tsc") and '"strict": true' not in cfg and "strict: true" not in cfg:
        findings.append(("WARN", "type-strictness",
            "tsconfig.json present but `\"strict\": true` not detected — the "
            "strongest free sensor in a typed codebase is underused."))
    # ESLint AI-failure-mode rules
    if present.get("eslint"):
        ai_rules = ("max-lines", "max-lines-per-function", "max-params", "complexity",
                    "no-explicit-any")
        if not any(r in cfg for r in ai_rules):
            findings.append(("WARN", "lint-ai-rules",
                "ESLint present but none of the AI-failure-mode rules detected "
                "(max-lines, max-lines-per-function, max-params, complexity, "
                "no-explicit-any). Style-only linting misses agent sprawl."))


def gap_findings(s: Scan, present: dict, stack: list, findings: list) -> None:
    def any_of(*keys):
        return any(present.get(k) for k in keys)

    typed_langs = ("TypeScript", "Go", "Rust", "Java/JVM (Maven)",
                   "Java/JVM (Gradle)", "Kotlin/JVM (Gradle)")
    is_typed = any(l in stack for l in typed_langs)
    is_py = "Python" in stack
    is_ts = "TypeScript" in stack

    if is_ts and not present.get("tsc"):
        findings.append(("GAP", "no-typecheck",
            "TypeScript repo without a type-check step wired — add `tsc --noEmit` "
            "as an in-session + CI sensor."))
    if is_py and not any_of("mypy", "pyright"):
        findings.append(("GAP", "no-typecheck",
            "Python repo with no type checker (mypy/pyright) detected — consider "
            "one as a sensor, especially for shared/core modules."))

    if not any_of("depcruiser", "importlinter", "archunit", "boundaries", "deptry"):
        findings.append(("GAP", "no-arch-rules",
            "No module/architecture/dependency rules detected. If the codebase has "
            "layers or boundaries, add structural rules (dependency-cruiser / "
            "import-linter / ArchUnit) with self-correction messages."))

    if present.get("tests") and not present.get("mutation"):
        findings.append(("GAP", "no-mutation",
            "Tests present but no mutation testing. Coverage hides assertion gaps — "
            "add incremental mutation testing (Stryker/mutmut/PIT), especially if "
            "tests are AI-generated."))

    if not any_of("gitleaks", "trufflehog"):
        findings.append(("GAP", "no-secret-scan",
            "No secret scanning detected. Add GitLeaks (or similar) as a pre-commit "
            "gate — cheap, high blast-radius."))

    # Pre-commit hook tooling is covered by the CI-04 hygiene check, not here.

    if not s.guide_text.strip():
        findings.append(("GAP", "no-guides",
            "No agent rule files detected (AGENTS.md/CLAUDE.md/.cursor rules). The "
            "agent is never told which sensors to run in-session — hand the guides "
            "work to the agent-rules-architect skill."))

    # inferential feedback rarely shows up as a file; nudge to consider it.
    findings.append(("INFO", "inferential-review",
        "AI code/modularity review and dependency-freshness reports can't be "
        "reliably auto-detected — confirm with the user whether any inferential "
        "feedback exists; if not, it's usually a gap for AI-heavy codebases."))

    # present-but-inert controls
    for c in CONTROLS:
        if present.get(c.key) and not control_stages(c, s):
            findings.append(("INFO", "inert",
                f"{c.label} is configured but not wired to any stage "
                "(hook/CI/agent-rule). It's present but inert — wire it or drop it."))


# ---------------------------------------------------------------------------
# Hygiene floor — CI-04, HYG-02, HYG-08. Checked on every run, by ID.
# These are exempt from the "must trace to an observed failure" rule: they are
# cheap, universal, and their absence is itself the evidence.
# ---------------------------------------------------------------------------

DOC_BASE = "https://paladini.github.io/harness-score/guide/measure-and-improve"


def check_ci04(s: Scan) -> tuple:
    """CI-04 — pre-commit hook tooling installed AND actually wired."""
    # A config file for a hook runner is wiring by itself.
    for name in HOOK_FILES:
        if s.basenames.get(name):
            return "PASS", f"hook runner configured ({name})."

    # .husky/ or .githooks/ count only if a hook script carries a real command.
    for prefix in HOOK_DIRS:
        for rel in files_under(s, prefix):
            if "/_/" in rel or rel.endswith(("/.gitignore", "/husky.sh")):
                continue          # husky's own internals, not a hook
            body = [ln.strip() for ln in read(os.path.join(s.root, rel)).splitlines()]
            if any(ln and not ln.startswith("#") and not ln.startswith("#!")
                   for ln in body):
                return "PASS", f"hook script with commands present ({rel})."

    pkg = ""
    for rel in s.basenames.get("package.json", []):
        pkg += read(os.path.join(s.root, rel))
    if '"simple-git-hooks"' in pkg and '"pre-commit"' in pkg:
        return "PASS", "simple-git-hooks pre-commit configured in package.json."

    if "lint-staged" in pkg.lower():
        return "FAIL", ("lint-staged is configured but no hook runner invokes it "
                        "— nothing runs it at commit time. Wire husky "
                        "(`npx husky init` + `.husky/pre-commit` running "
                        "`npx lint-staged`).")
    if "husky" in pkg.lower():
        return "FAIL", ("husky is a dependency but no hook script with commands "
                        "was found — run `npx husky init` and add the checks.")
    return "FAIL", "No pre-commit hook tooling detected."


def check_hyg02(s: Scan) -> tuple:
    """HYG-02 — .gitignore covers `.env` AND `.env.*`."""
    paths = s.basenames.get(".gitignore", [])
    if not paths:
        return "FAIL", "No .gitignore found."

    base = glob = False
    for rel in paths:
        for raw in read(os.path.join(s.root, rel)).splitlines():
            ln = raw.strip()
            if not ln or ln.startswith("#") or ln.startswith("!"):
                continue          # a negation is an exception, not coverage
            core = ln.lstrip("/").removeprefix("**/").rstrip("/")
            if core in (".env", "*.env"):
                base = True
            elif core.startswith(".env") and "*" in core:
                glob = True
                if core.startswith(".env*"):   # `.env*` also covers bare `.env`
                    base = True

    if base and glob:
        return "PASS", ".gitignore covers `.env` and `.env.*`."
    if base:
        return "FAIL", ("`.gitignore` matches `.env` but not `.env.*` — "
                        "`.env.local` / `.env.production` still stage.")
    if glob:
        return "FAIL", "`.gitignore` matches `.env.*` but not bare `.env`."
    return "FAIL", ".gitignore has no .env pattern."


def _literal_credentials(node, trail: str = "") -> list:
    """Walk parsed JSON; return trails whose credential-shaped value is a literal."""
    out = []
    if isinstance(node, dict):
        for k, v in node.items():
            where = f"{trail}.{k}" if trail else str(k)
            key_is_cred = any(h in str(k).lower() for h in CREDENTIAL_KEY_HINTS)
            if key_is_cred and isinstance(v, str):
                if v and not _ENV_INTERP.search(v):
                    out.append(where)
            else:
                out += _literal_credentials(v, where)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            where = f"{trail}[{i}]"
            # CLI-style `--figma-api-key=xxx` hides the credential in an argv string.
            if isinstance(v, str) and "=" in v:
                argk, _, argv_ = v.partition("=")
                if any(h in argk.lower() for h in CREDENTIAL_KEY_HINTS):
                    if argv_ and not _ENV_INTERP.search(argv_):
                        out.append(f"{where} ({argk.lstrip('-')})")
                        continue
            out += _literal_credentials(v, where)
    return out


def check_hyg08(s: Scan) -> tuple:
    """HYG-08 — MCP config exists and uses ${ENV_VAR} for credentials."""
    found = [p for p in MCP_CONFIG_PATHS if p in s.rel_files]
    if not found:
        return "FAIL", ("No MCP config found (.cursor/mcp.json, .mcp.json, or "
                        ".agents/mcp_config.json).")

    offenders, unparsed = [], []
    for rel in found:
        try:
            data = json.loads(read(os.path.join(s.root, rel)) or "{}")
        except ValueError:
            unparsed.append(rel)
            continue
        offenders += [f"{rel}:{t}" for t in _literal_credentials(data)]

    if offenders:
        return "FAIL", ("credential-shaped value(s) written literally: "
                        + ", ".join(offenders[:5])
                        + (" …" if len(offenders) > 5 else "")
                        + ". Replace with ${ENV_VAR} interpolation and rotate the "
                          "old value — it is in git history.")
    if unparsed:
        return "WARN", f"MCP config present but unparseable: {', '.join(unparsed)}."
    return "PASS", f"MCP config uses env interpolation ({', '.join(found)})."


HYGIENE_CHECKS = [
    ("CI-04", "Pre-commit checks installed", check_ci04,
     "Add pre-commit tooling (husky + lint-staged, pre-commit, lefthook) so fast "
     "checks run before a commit exists — the earliest possible feedback loop."),
    ("HYG-02", ".gitignore covers environment files", check_hyg02,
     'Add ".env" and ".env.*" to .gitignore so an agent can never stage '
     "credentials by accident."),
    ("HYG-08", "MCP config uses env interpolation for credentials", check_hyg08,
     "Reference credential-shaped values in MCP config via ${ENV_VAR} "
     "interpolation instead of literals — this rewards deliberate, safe "
     "tool-access configuration."),
]


def hygiene_report(s: Scan) -> list:
    out = []
    for check_id, label, fn, remedy in HYGIENE_CHECKS:
        status, detail = fn(s)
        out.append({"id": check_id, "label": label, "status": status,
                    "detail": detail, "remedy": remedy,
                    "doc": f"{DOC_BASE}#{check_id.lower()}"})
    return out


def build_report(root: str) -> dict:
    s = walk(root)
    gather_text(s)
    stack = detect_stack(s)

    present = {}
    controls_out = []
    for c in CONTROLS:
        if control_present(c, s):
            present[c.key] = True
            stages = control_stages(c, s)
            controls_out.append({
                "key": c.key, "label": c.label, "direction": c.direction,
                "execution": c.execution, "category": c.category,
                "stages": stages or ["unwired"], "gating_default": c.gating_default,
                "note": c.note,
            })

    # guides as a control
    if s.guide_text.strip():
        guide_names = [n for n in GUIDE_FILES if s.basenames.get(n)]
        if any(files_under(s, ".cursor/rules/")):
            guide_names.append(".cursor/rules/*")
        controls_out.append({
            "key": "guides", "label": "Agent rules / guides (" + ", ".join(guide_names) + ")",
            "direction": "feedforward", "execution": "inferential", "category": "cross",
            "stages": ["in-session"], "gating_default": "report",
            "note": "delegate authoring/trimming to agent-rules-architect",
        })

    findings = []
    content_findings(s, present, findings)
    gap_findings(s, present, stack, findings)

    return {"root": os.path.abspath(root), "stack": stack,
            "controls": controls_out, "hygiene": hygiene_report(s), "findings":
            [{"level": lv, "code": code, "message": m} for lv, code, m in findings]}


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

DIRS = ["feedforward", "feedback"]
EXECS = ["computational", "inferential", "mixed"]
CATS = ["maintainability", "architecture", "behaviour", "security", "cross"]
STAGES = ["in-session", "pre-commit", "CI", "continuous", "runtime"]


def render(rep: dict) -> str:
    L = []
    L.append(f"\nHarness inventory — {rep['root']}")
    L.append("Stack: " + (", ".join(rep["stack"]) or "unknown"))
    L.append("\nThis is a first pass. Confirm what each control ENFORCES by reading "
             "its config, and treat gaps as prompts to investigate.\n")

    L.append("Detected controls")
    L.append("-" * 72)
    if not rep["controls"]:
        L.append("  (none detected)")
    for c in rep["controls"]:
        stages = ",".join(c["stages"])
        L.append(f"  {c['label']}")
        L.append(f"      {c['direction']} · {c['execution']} · {c['category']} · "
                 f"runs: {stages} · default: {c['gating_default']}")
        if c["note"]:
            L.append(f"      ↳ {c['note']}")

    # direction × execution
    L.append("\nCoverage — direction × execution")
    L.append("-" * 72)
    grid = {(d, e): [] for d in DIRS for e in EXECS}
    for c in rep["controls"]:
        grid.setdefault((c["direction"], c["execution"]), []).append(c["label"])
    L.append(f"  {'':<14}{'computational':<30}{'inferential':<30}")
    for d in DIRS:
        comp = "; ".join(grid.get((d, "computational"), [])) or "—"
        inf = "; ".join(grid.get((d, "inferential"), []) +
                        grid.get((d, "mixed"), [])) or "—"
        L.append(f"  {d:<14}{comp[:28]:<30}{inf[:28]:<30}")

    # category × stage
    L.append("\nCoverage — category × stage")
    L.append("-" * 72)
    cell = {(cat, st): 0 for cat in CATS for st in STAGES}
    for c in rep["controls"]:
        for st in c["stages"]:
            if st in STAGES:
                cell[(c["category"], st)] = cell.get((c["category"], st), 0) + 1
    header = "  " + f"{'category':<16}" + "".join(f"{st:<12}" for st in STAGES)
    L.append(header)
    for cat in CATS:
        row = f"  {cat:<16}"
        for st in STAGES:
            n = cell.get((cat, st), 0)
            row += f"{('●×' + str(n)) if n else '·':<12}"
        L.append(row)

    # hygiene floor — always reported, pass or fail
    L.append("\nHygiene floor (checked on every run — fix failures first)")
    L.append("-" * 72)
    hyg_icon = {"PASS": "✓", "FAIL": "✗", "WARN": "!"}
    for h in rep["hygiene"]:
        L.append(f"  {hyg_icon.get(h['status'], '·')} {h['id']} {h['label']}")
        if h["status"] != "PASS":
            L.append(f"     {h['remedy']}")
        L.append(f"     {h['detail']}")
        if h["status"] != "PASS":
            L.append(f"     {h['doc']}")

    # findings
    L.append("\nFindings (gaps & flags)")
    L.append("-" * 72)
    icon = {"GAP": "✗", "WARN": "!", "INFO": "·"}
    order = {"GAP": 0, "WARN": 1, "INFO": 2}
    for f in sorted(rep["findings"], key=lambda x: order.get(x["level"], 3)):
        L.append(f"  [{f['level']:<4}] {icon.get(f['level'], '·')} {f['message']}")
    gaps = sum(1 for f in rep["findings"] if f["level"] == "GAP")
    warns = sum(1 for f in rep["findings"] if f["level"] == "WARN")
    hyg_fail = sum(1 for h in rep["hygiene"] if h["status"] != "PASS")
    L.append(f"\nSummary: {hyg_fail} hygiene failure(s), {gaps} gap(s), "
             f"{warns} config flag(s), {len(rep['findings']) - gaps - warns} info.")
    L.append("Next: fix hygiene failures, then confirm the rest against the code "
             "and assess & prioritize (see references/assessment-playbook.md).\n")
    return "\n".join(L)


def main(argv: list) -> int:
    args = [a for a in argv[1:] if not a.startswith("--")]
    as_json = "--json" in argv
    if len(args) != 1:
        print(__doc__)
        return 2
    root = args[0]
    if not os.path.isdir(root):
        print(f"error: not a directory: {root}")
        return 2
    rep = build_report(root)
    if as_json:
        print(json.dumps(rep, indent=2))
    else:
        print(render(rep))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

