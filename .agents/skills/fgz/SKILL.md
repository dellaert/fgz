---
name: fgz
description: Use when authoring, reviewing, or modifying fgz plain-text diagrams for factor graphs, Bayes nets, mixed graphical-model figures, or when changing the fgz TypeScript compiler/CLI that parses fgz and emits readable TikZ, SVG, or PDF output.
---

# fgz

## Purpose

fgz is a plain-text DSL and TypeScript toolchain for graphical-model diagrams,
especially factor graphs and Bayes nets for papers. Optimize for short readable
`.fgz` files, stable geometry, minimal overrides, and diagrams that look good in
LaTeX/TikZ, not just diagrams that parse.

Before inventing syntax or patterns, inspect the local project docs:

- `docs/REFERENCE.md` for implemented syntax and CLI behavior
- `examples/examples.tex`, `examples/examples.md`, and `examples/*.fgz` for idioms
- `.github/copilot-instructions.md` and `AGENTS.md` when working in the repo

## Authoring Workflow

1. Start every fgz file with:

   ```txt
   fgz 1
   ```

2. Get topology right first: variables/knowns/nodes/factors and parent lists.
3. Lay out on a simple repeated grid. Prefer 3 or 4 units horizontally, reused row
   spacing, and explicitly centered symmetric structures.
4. Render or compile, then tune major geometry.
5. Add overrides only for clear visual problems.

Use direct labels first:

```txt
variable x_{t+1} (3, 0)
```

Introduce macros only when labels repeat, contain long math, or make the figure
source noisy:

```txt
x1 = x_1
variable x1 (0, 0)
```

## Current Syntax

Core statements:

- `theme classic|textbook|blog`
- `style node_size=... factor_size=... label_sep=... label_font=...`
- `<lhs> = <rhs>` macros
- `variable name (x, y)` and `known name (x, y)`
- `factor {a, b, ...}` with optional `(x, y)`
- `node name {parents} (x, y)` and `known_node name {parents} (x, y)`
- `curve a -- b via (x, y)` for factor-graph edges
- `curve a -> b via (x, y)` for directed Bayes-net edges
- `edge a -> b style=dashed label=0 label_side=left label_pos=0.35`
- `text label (x, y)`, `box (x1, y1) (x2, y2)`, and `plate ... label=...`

Common attributes:

- Nodes: `color=...`, `size=...`, `font=...`
- Factors: `offset=(dx,dy)`, `shape=circle|square`, `color=...`,
  `label=...`, `size=...`, `font=...`
- Text: `color=...`, `font=...`
- Box: `style=solid|dashed`, `color=...`
- Plate: `color=...`, `label=...`, `font=...`

## Geometry Rules

- Omit factor positions when midpoint inference is correct.
- For any factor without an explicit position, fgz uses the midpoint of the first
  two variables, even for higher-arity factors.
- Use explicit factor positions for unary factors or intentionally off-midpoint
  layouts.
- Use `offset=(dx,dy)` sparingly, mainly for bent binary factor connections.
  Do not combine `offset` with an explicit factor position.
- Widen or regularize geometry before adding many overrides.

Good minimal factor graph:

```fgz
fgz 1
variable x (0, 0)
variable y (3.5, 0)
factor {x, y}
```

Good compact Bayes net:

```fgz
fgz 1
known_node m_1 {} (1.5, 1.5)
node x_1 {m_1} (3, 0)
node x_0 {m_1, x_1} (0, 0)
```

## Mixed Diagram Rules

Allowed:

- factor-graph `variable` or `known` symbols as parents of Bayes-net nodes

Not allowed:

- Bayes-net nodes inside `factor {...}`
- declaring the same symbol as both a factor-graph symbol and a Bayes-net node

Prefer legal mixed diagrams like:

```fgz
fgz 1
variable x (0, 0)
node l {x} (1, 1)
```

## Styling Guidance

- Start without `theme`; add one only when a non-default palette is needed.
- Add `style` only for real size or font tuning.
- Use `curve` for edge geometry overrides.
- Use `edge` for directed Bayes-net edge styling and labels.
- Use per-node `color`, `size`, and `font` only for exceptional labels or
  meaningful emphasis.
- Prefer labeled square factors over fake known variables when the visual object
  is semantically a factor.
- Use `text`, `box`, and `plate` sparingly when graph primitives do not express
  the intended structure.

## Rendering And CLI

Inside the fgz repo:

```bash
npm run build
npm run fgz2tex -- examples/guide-minimal.fgz
npm run fgz2svg -- examples/guide-minimal.fgz
npm run fgz2pdf -- examples/guide-minimal.fgz
```

Outside the repo, use installed commands:

```bash
npx fgz2tex figures/example.fgz
npx fgz2svg figures/example.fgz
npx fgz2pdf figures/example.fgz
```

Default outputs:

- `fgz2tex input.fgz` writes `input.fgz.tex`
- `fgz2svg input.fgz` writes `input.svg`
- `fgz2pdf input.fgz` writes `input.fgz.pdf`

For SVG/PDF labels that need LaTeX macros or TikZ setup, pass a preamble
fragment explicitly:

```bash
npx fgz2svg figures/example.fgz --preamble figures/preamble.tex
npx fgz2pdf figures/example.fgz --preamble figures/preamble.tex
```

Generated `.fgz.tex` assumes the paper preamble already includes:

```tex
\input{fgz.tikz.tex}
```

## Compiler And CLI Development

The implementation is TypeScript. `packages/fgz-core` must stay pure and
browser-compatible: no `fs`, `path`, `process`, or Node-only APIs. Keep core APIs
briefly documented with TSDoc.

Code style:

- Keep functions small and composable.
- Prefer clear data-oriented code over class-heavy designs.
- Avoid `any`.
- Avoid copy/paste parser branches; use shared helpers.
- Keep dependencies minimal.

Error handling:

- Parser and validator failures should include line numbers and concise messages.
- Core should throw a single domain error type such as `FgzError` with
  `{line, message}`.

Formatting:

- Preserve statement order exactly as authored.
- Trivial whitespace normalization is fine.
- Never reorder or sort blocks.

TikZ generation:

- Generated `.fgz.tex` should be readable.
- Emit one node or edge per line with consistent structure.
- Prefer shared macros/styles from `tikz/fgz.tikz.tex` over inline styling.
- Do not assume the generated snippet owns the paper preamble.

## Tests

Use Vitest. Prefer small direct tests plus one snapshot/golden test for TikZ
output. Keep comparisons deterministic.

Repo scripts:

```bash
npm run build
npm run test
npm run examples:svg
npm run examples:pdf
```

If the repo provides a generated `build` directory with `make` targets, follow the
local agent instruction and run targeted tests as:

```bash
make -j6 testXXX.run
```

For Python tooling in this workspace, use the `py312` conda environment.

## Repo Hygiene

- For GitHub work in this repo, `gh` CLI is available.
- For PRs, keep the branch focused, run relevant tests, and write clear commit and
  PR descriptions.
- Do not route suspected security vulnerabilities through public GitHub issues;
  follow `SECURITY.md` and report them privately to the maintainer.
