# Copilot Instructions for fgz

## Project intent
fgz is a mermaid-inspired DSL + toolchain for graphical model diagrams (factor graphs + Bayes nets) targeting LaTeX papers. Core must be browser-compatible later.

## Language / runtime
- TypeScript
- Node 20+ for CLI and tests
- `packages/fgz-core` must be **pure** (no fs/path/process); suitable for browser use.

## Style
- Prioritize **elegance and simplicity**.
- Keep functions small and composable; avoid deeply nested logic.
- DRY: no copy/paste parsing branches—use shared helpers.
- Use clear types; avoid `any`.
- Prefer data-oriented code over class-heavy designs (classes only if they reduce complexity).

## Error handling
- Parser and validator errors must include **line numbers** and a concise message.
- Throw a single domain error type (e.g., `FgzError`) from core, with `{line, message}`.

## Formatting philosophy
- Non-invasive: **preserve statement order** exactly as authored.
- Formatting may normalize trivial whitespace, but must never reorder/sort blocks.

## TikZ generation philosophy
- Generated `.fgz.tex` must be **highly readable**:
  - minimal inline styling
  - rely on shared macros/styles defined in `tikz/fgz.tikz.tex`
  - one node/edge per line, consistent structure
- Assume `\input{fgz.tikz.tex}` is already in the paper preamble.

## Testing
- Use vitest.
- Prefer small, direct tests plus one snapshot/golden test for TikZ output.
- Tests should be deterministic; avoid flaky comparisons.

## Repo hygiene
- Keep core APIs documented with brief TSDoc.
- Keep dependencies minimal.
- No large frameworks or heavy build systems unless clearly justified.

## Output conventions
- Default CLI output for `fgz2tex input.fgz` is `input.fgz.tex`.
- Preserve numeric formatting where possible; do not force canonical decimals.

End.