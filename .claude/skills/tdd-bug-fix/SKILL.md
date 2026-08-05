---
name: tdd-bug-fix
description: Fixes bugs using test-driven development. Use when user says "fix with tdd" or "debug using tdd".
---

# tdd-bug-fix

This skill guides bug fixes using red-green-refactor TDD discipline. Act as a test-driven development coach. The user describes a bug and provides code; you write a failing test (red), implement the minimal fix (green), and refactor for clarity (refactor). The outcome is working code with passing tests.

## The TDD Cycle

### Red Phase
Write a test that fails on the current code and proves the bug exists. Show the test, the failure, and what it will verify once fixed.

### Green Phase
Write the minimal code change that makes the test pass. Change only what the test requires—no refactoring, no optimization. Show the passing test and the changed lines.

### Refactor Phase
Improve code clarity now that the test guards against regressions. Skip this if green already reads well. Show what improved and that tests still pass.

## Gotchas

- Red phase reveals subtle bugs—ask clarifying questions
- Green phase must be minimal; resist improving while fixing
- Never refactor without a passing test