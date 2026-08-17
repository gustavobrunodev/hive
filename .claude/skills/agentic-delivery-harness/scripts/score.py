#!/usr/bin/env python3
"""Score judge results against a frozen baseline.

The model finds and reports. This script decides what that is worth.

Beyond arithmetic, it enforces the judge's integrity rules mechanically, so they
stop being instructions a model can drift away from:

  * a match with no evidence is forced to false  (evidence-or-zero)
  * a baseline check the judge never answered counts as false, and is named
  * a result whose id is not in the baseline is a hard error
  * a baseline_id mismatch is a hard error       (you scored the wrong run)

Usage
-----
    score.py --baseline baseline.json --results run-1.json run-2.json run-3.json
    score.py --baseline baseline.json --validate-only
    score.py --baseline baseline.json --results run-*.json --json
    score.py --baseline baseline.json --results run-*.json --markdown report.md

Exit codes: 0 clean, 1 integrity violations found, 2 malformed input.
Stdlib only.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean, stdev

DEFAULT_WEIGHTS = {
    "implementation": 0.6,
    "test": 0.4,
    "priority": {"P0": 3, "P1": 2, "P2": 1},
}

# Evidence that points at a location looks like "path/to/file.ext:123".
LOCATION_RE = re.compile(r"[\w./\\-]+\.\w+:\d+")


class BaselineError(Exception):
    """The baseline or a results file is malformed — nothing can be scored."""


# --------------------------------------------------------------------------- #
# Model
# --------------------------------------------------------------------------- #


@dataclass
class Check:
    id: str
    kind: str  # "i" | "t"
    text: str
    criterion_id: str
    story_id: str


@dataclass
class Criterion:
    id: str
    statement: str
    i_checks: list[Check] = field(default_factory=list)
    t_checks: list[Check] = field(default_factory=list)


@dataclass
class Story:
    id: str
    title: str
    priority: str
    criteria: list[Criterion] = field(default_factory=list)


@dataclass
class Baseline:
    baseline_id: str
    stories: list[Story]
    weights: dict
    source: str = ""
    frozen_at: str = ""
    frozen_by: str = ""

    @property
    def checks(self) -> dict[str, Check]:
        out: dict[str, Check] = {}
        for story in self.stories:
            for crit in story.criteria:
                for chk in (*crit.i_checks, *crit.t_checks):
                    out[chk.id] = chk
        return out


@dataclass
class Issue:
    severity: str  # "error" | "violation" | "warning"
    code: str
    message: str


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #


def _read_json(path: Path) -> dict:
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        raise BaselineError(f"file not found: {path}")
    except json.JSONDecodeError as exc:
        raise BaselineError(f"{path}: invalid JSON — {exc}")


def _merge_weights(raw: dict | None) -> dict:
    weights = json.loads(json.dumps(DEFAULT_WEIGHTS))
    if not raw:
        return weights
    for key in ("implementation", "test"):
        if key in raw:
            weights[key] = float(raw[key])
    if "priority" in raw:
        weights["priority"] = {str(k): float(v) for k, v in raw["priority"].items()}
    total = weights["implementation"] + weights["test"]
    if abs(total - 1.0) > 1e-9:
        raise BaselineError(
            f"weights.implementation + weights.test must equal 1.0 (got {total})"
        )
    return weights


def load_baseline(path: Path) -> tuple[Baseline, list[Issue]]:
    raw = _read_json(path)
    issues: list[Issue] = []

    baseline_id = raw.get("baseline_id")
    if not baseline_id:
        raise BaselineError(f"{path}: missing required field 'baseline_id'")

    raw_stories = raw.get("stories")
    if not isinstance(raw_stories, list) or not raw_stories:
        raise BaselineError(f"{path}: 'stories' must be a non-empty list")

    weights = _merge_weights(raw.get("weights"))
    seen_ids: set[str] = set()
    stories: list[Story] = []

    for s_idx, raw_story in enumerate(raw_stories):
        story_id = raw_story.get("id") or f"story[{s_idx}]"
        priority = str(raw_story.get("priority", "")).upper()
        if priority not in weights["priority"]:
            issues.append(
                Issue(
                    "warning",
                    "unknown-priority",
                    f"{story_id}: priority {priority!r} has no weight defined; using 1.0",
                )
            )
        story = Story(
            id=story_id,
            title=raw_story.get("title", ""),
            priority=priority,
        )

        raw_criteria = raw_story.get("criteria")
        if not isinstance(raw_criteria, list) or not raw_criteria:
            raise BaselineError(f"{path}: {story_id} has no 'criteria' list")

        for c_idx, raw_crit in enumerate(raw_criteria):
            crit_id = raw_crit.get("id") or f"{story_id}.criterion[{c_idx}]"
            crit = Criterion(id=crit_id, statement=raw_crit.get("statement", ""))

            for kind, key, bucket in (
                ("i", "i_checks", crit.i_checks),
                ("t", "t_checks", crit.t_checks),
            ):
                for chk in raw_crit.get(key, []) or []:
                    chk_id = chk.get("id")
                    if not chk_id:
                        raise BaselineError(f"{path}: {crit_id} has a check without an 'id'")
                    if chk_id in seen_ids:
                        raise BaselineError(f"{path}: duplicate check id {chk_id!r}")
                    seen_ids.add(chk_id)
                    bucket.append(
                        Check(
                            id=chk_id,
                            kind=kind,
                            text=chk.get("check", ""),
                            criterion_id=crit_id,
                            story_id=story.id,
                        )
                    )

            if not crit.i_checks and not crit.t_checks:
                issues.append(
                    Issue(
                        "warning",
                        "empty-criterion",
                        f"{crit_id}: no checks — excluded from scoring",
                    )
                )
            story.criteria.append(crit)
        stories.append(story)

    baseline = Baseline(
        baseline_id=baseline_id,
        stories=stories,
        weights=weights,
        source=raw.get("source", ""),
        frozen_at=raw.get("frozen_at", ""),
        frozen_by=raw.get("frozen_by", ""),
    )
    return baseline, issues


# --------------------------------------------------------------------------- #
# Scoring
# --------------------------------------------------------------------------- #


def _priority_weight(baseline: Baseline, story: Story) -> float:
    return float(baseline.weights["priority"].get(story.priority, 1.0))


def score_run(baseline: Baseline, path: Path, strict: bool = False) -> dict:
    """Score one judge results file. Returns a per-run report dict."""
    raw = _read_json(path)
    issues: list[Issue] = []

    run_baseline_id = raw.get("baseline_id")
    if run_baseline_id and run_baseline_id != baseline.baseline_id:
        raise BaselineError(
            f"{path}: baseline_id {run_baseline_id!r} does not match "
            f"the baseline {baseline.baseline_id!r} — wrong baseline for this run"
        )

    run_id = raw.get("run_id") or path.stem
    known = baseline.checks

    verdicts: dict[str, bool] = {}
    for entry in raw.get("results", []) or []:
        chk_id = entry.get("id")
        if not chk_id:
            raise BaselineError(f"{path}: a result entry has no 'id'")
        if chk_id not in known:
            issues.append(
                Issue(
                    "error",
                    "unknown-check",
                    f"{chk_id}: not present in the baseline — the judge invented a check",
                )
            )
            continue
        if chk_id in verdicts:
            issues.append(
                Issue("error", "duplicate-result", f"{chk_id}: judged more than once")
            )
            continue

        matched = bool(entry.get("match"))
        evidence = (entry.get("evidence") or "").strip()

        if matched and not evidence:
            matched = False
            issues.append(
                Issue(
                    "violation",
                    "unsupported-match",
                    f"{chk_id}: matched with no evidence — forced to false",
                )
            )
        elif matched and not LOCATION_RE.search(evidence):
            issue = Issue(
                "violation" if strict else "warning",
                "unlocated-evidence",
                f"{chk_id}: evidence cites no file:line ({evidence[:60]!r})"
                + (" — forced to false" if strict else ""),
            )
            issues.append(issue)
            if strict:
                matched = False
        elif not matched and not evidence:
            issues.append(
                Issue(
                    "warning",
                    "unjustified-miss",
                    f"{chk_id}: reported absent without showing the search",
                )
            )

        verdicts[chk_id] = matched

    for chk_id in known:
        if chk_id not in verdicts:
            verdicts[chk_id] = False
            issues.append(
                Issue(
                    "violation",
                    "unjudged-check",
                    f"{chk_id}: never answered by the judge — counted as false",
                )
            )

    wi = baseline.weights["implementation"]
    wt = baseline.weights["test"]

    story_reports = []
    weighted_sum = 0.0
    weight_total = 0.0

    for story in baseline.stories:
        crit_reports = []
        for crit in story.criteria:
            i_total, t_total = len(crit.i_checks), len(crit.t_checks)
            if i_total == 0 and t_total == 0:
                continue
            i_hit = sum(1 for c in crit.i_checks if verdicts[c.id])
            t_hit = sum(1 for c in crit.t_checks if verdicts[c.id])
            i_ratio = i_hit / i_total if i_total else None
            t_ratio = t_hit / t_total if t_total else None

            # Renormalize over the dimensions the baseline actually defined, so a
            # criterion with no test dimension is not capped at the impl weight.
            if i_ratio is not None and t_ratio is not None:
                value = wi * i_ratio + wt * t_ratio
            elif i_ratio is not None:
                value = i_ratio
            else:
                value = t_ratio

            crit_reports.append(
                {
                    "id": crit.id,
                    "statement": crit.statement,
                    "score": round(value, 4),
                    "i_matched": i_hit,
                    "i_total": i_total,
                    "t_matched": t_hit,
                    "t_total": t_total,
                }
            )

        story_score = mean(c["score"] for c in crit_reports) if crit_reports else 0.0
        pw = _priority_weight(baseline, story)
        weighted_sum += story_score * pw
        weight_total += pw
        story_reports.append(
            {
                "id": story.id,
                "title": story.title,
                "priority": story.priority,
                "weight": pw,
                "score": round(story_score, 4),
                "criteria": crit_reports,
            }
        )

    if weight_total == 0:
        raise BaselineError("total priority weight is zero — nothing to score")

    total = weighted_sum / weight_total
    matched_total = sum(1 for v in verdicts.values() if v)

    return {
        "run_id": run_id,
        "source_file": str(path),
        "judge_model": raw.get("judge_model", ""),
        "score": round(total, 4),
        "checks_matched": matched_total,
        "checks_total": len(verdicts),
        "stories": story_reports,
        "issues": [i.__dict__ for i in issues],
    }


def aggregate(runs: list[dict]) -> dict:
    scores = [r["score"] for r in runs]
    agg = {
        "runs": len(scores),
        "mean": round(mean(scores), 4),
        "min": round(min(scores), 4),
        "max": round(max(scores), 4),
        "spread": round(max(scores) - min(scores), 4),
        "stdev": round(stdev(scores), 4) if len(scores) > 1 else 0.0,
    }
    per_story: dict[str, list[float]] = {}
    for run in runs:
        for story in run["stories"]:
            per_story.setdefault(story["id"], []).append(story["score"])
    agg["per_story"] = {
        sid: {
            "mean": round(mean(vals), 4),
            "spread": round(max(vals) - min(vals), 4),
        }
        for sid, vals in per_story.items()
    }
    return agg


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #


def render_markdown(baseline: Baseline, runs: list[dict], agg: dict | None) -> str:
    out: list[str] = [f"# Score — {baseline.baseline_id}", ""]
    if baseline.source:
        out.append(f"- **Frozen input:** `{baseline.source}`")
    if baseline.frozen_at:
        out.append(f"- **Frozen at:** {baseline.frozen_at}")
    if baseline.frozen_by:
        out.append(f"- **Frozen by:** {baseline.frozen_by}")
    w = baseline.weights
    out.append(
        f"- **Weights:** implementation {w['implementation']}, test {w['test']}, "
        f"priority {w['priority']}"
    )
    out.append("")

    if agg:
        out += [
            "## Aggregate",
            "",
            f"**{agg['mean']:.4f}** mean over {agg['runs']} run(s) — "
            f"min {agg['min']:.4f}, max {agg['max']:.4f}, "
            f"spread {agg['spread']:.4f}, stdev {agg['stdev']:.4f}",
            "",
        ]
        if agg["spread"] >= 0.10:
            out += [
                "> Spread ≥ 0.10 across runs. Report this rather than the mean: "
                "something upstream of the judge is still open.",
                "",
            ]
        out += ["| Story | Mean | Spread |", "| --- | --- | --- |"]
        for sid, vals in agg["per_story"].items():
            out.append(f"| {sid} | {vals['mean']:.4f} | {vals['spread']:.4f} |")
        out.append("")

    for run in runs:
        out += [
            f"## Run `{run['run_id']}`",
            "",
            f"**Score {run['score']:.4f}** — "
            f"{run['checks_matched']}/{run['checks_total']} checks matched"
            + (f" — judge `{run['judge_model']}`" if run["judge_model"] else ""),
            "",
            "| Story | Priority | Weight | Score | Criteria (I / T) |",
            "| --- | --- | --- | --- | --- |",
        ]
        for story in run["stories"]:
            detail = "; ".join(
                f"{c['id']} {c['i_matched']}/{c['i_total']}·{c['t_matched']}/{c['t_total']}"
                for c in story["criteria"]
            )
            out.append(
                f"| {story['id']} {story['title']} | {story['priority']} | "
                f"{story['weight']:g} | {story['score']:.4f} | {detail} |"
            )
        out.append("")

        blocking = [i for i in run["issues"] if i["severity"] in ("error", "violation")]
        warnings = [i for i in run["issues"] if i["severity"] == "warning"]
        if blocking:
            out += ["**Integrity violations**", ""]
            out += [f"- `{i['code']}` {i['message']}" for i in blocking]
            out.append("")
        if warnings:
            out += ["<details><summary>Warnings</summary>", ""]
            out += [f"- `{i['code']}` {i['message']}" for i in warnings]
            out += ["", "</details>", ""]

    return "\n".join(out)


def render_text(baseline: Baseline, runs: list[dict], agg: dict | None) -> str:
    out = [f"baseline: {baseline.baseline_id}"]
    for run in runs:
        out.append(
            f"  {run['run_id']:<16} {run['score']:.4f}  "
            f"({run['checks_matched']}/{run['checks_total']} checks)"
        )
        for issue in run["issues"]:
            if issue["severity"] in ("error", "violation"):
                out.append(f"      ! {issue['code']}: {issue['message']}")
    if agg and agg["runs"] > 1:
        out.append(
            f"  {'AGGREGATE':<16} {agg['mean']:.4f}  "
            f"(±{agg['stdev']:.4f}, spread {agg['spread']:.4f}, n={agg['runs']})"
        )
        if agg["spread"] >= 0.10:
            out.append(
                "      ! spread >= 0.10 — report the range, not the mean; "
                "something upstream is still open"
            )
    return "\n".join(out)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Score judge results against a frozen baseline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--results", nargs="*", type=Path, default=[])
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="check the baseline's shape and exit (use right after freezing)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="also force matches to false when evidence cites no file:line",
    )
    parser.add_argument("--json", action="store_true", help="emit the full report as JSON")
    parser.add_argument("--markdown", type=Path, help="write a Markdown report to this path")
    args = parser.parse_args(argv)

    try:
        baseline, load_issues = load_baseline(args.baseline)
    except BaselineError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    for issue in load_issues:
        print(f"warning: {issue.code}: {issue.message}", file=sys.stderr)

    checks = baseline.checks
    if args.validate_only or not args.results:
        i_count = sum(1 for c in checks.values() if c.kind == "i")
        t_count = sum(1 for c in checks.values() if c.kind == "t")
        crits = sum(len(s.criteria) for s in baseline.stories)
        print(
            f"{baseline.baseline_id}: {len(baseline.stories)} stories, {crits} criteria, "
            f"{len(checks)} checks ({i_count} I / {t_count} T) — baseline is well-formed"
        )
        if not args.results and not args.validate_only:
            print("no --results given; nothing scored", file=sys.stderr)
        return 0

    runs: list[dict] = []
    try:
        for path in args.results:
            runs.append(score_run(baseline, path, strict=args.strict))
    except BaselineError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    agg = aggregate(runs) if runs else None
    report = {"baseline_id": baseline.baseline_id, "runs": runs, "aggregate": agg}

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(render_text(baseline, runs, agg))

    if args.markdown:
        args.markdown.write_text(render_markdown(baseline, runs, agg), encoding="utf-8")
        print(f"\nwrote {args.markdown}", file=sys.stderr)

    blocking = sum(
        1
        for run in runs
        for issue in run["issues"]
        if issue["severity"] in ("error", "violation")
    )
    if blocking:
        print(
            f"\n{blocking} integrity violation(s) — the score above already "
            "accounts for them, but the judge's output needs review.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
