# AGENTS.md

## Purpose

This repository contains fgz, a plain-text DSL for factor graphs and Bayes nets that compiles to TikZ.

Agents working here should optimize for:

- short, readable `.fgz` files
- stable geometry
- minimal overrides
- diagrams that look good in papers, not just parse correctly

## Agent Skill

This repository includes a repo-scoped Agent Skill at:

```txt
.agents/skills/fgz/SKILL.md
```

Use it when authoring, reviewing, or modifying `.fgz` diagrams, or when changing
the TypeScript parser, validator, formatter, TikZ generator, or CLI. Claude Code
users can load the same skill through `.claude/skills/fgz`.

## Authoring Rules

Prefer these defaults unless the user asks otherwise.

### 1. Start simple

Always begin with:

```txt
fgz 1
```

Only add:

- `theme` if a non-default palette is needed
- `style` if a figure really needs size/font tuning
- macros only when direct labels become noisy

### 2. Prefer direct labels first

Use direct names like:

```txt
variable x_{t+1} (3, 0)
```

Do not introduce macros early if the direct label is short and readable.

Introduce macros when:

- labels are repeated
- labels contain long math
- a figure becomes noisy without aliases

### 3. Use a clean grid

Author coordinates on a small repeated grid.

Good patterns:

- variables 3 or 4 units apart horizontally
- row spacing reused across the figure
- symmetric trees centered explicitly

Avoid irregular coordinates unless the figure really needs them.

### 4. Omit factor positions when midpoint inference is enough

For factors:

- omit the position if the midpoint of the first two variables is correct
- for higher-arity factors, remember the midpoint still comes from the first two variables
- use explicit positions only for unary factors or intentionally off-midpoint layouts

### 5. Use `offset` sparingly

Use:

```txt
factor {x, y} offset=(0,-0.35)
```

only when you want a bent binary factor connection. Do not use `offset` for general layout if a direct position or midpoint is cleaner.

### 6. Keep mixed diagrams legal

Allowed:

- factor-graph variables or knowns as parents of BN nodes

Not allowed:

- BN nodes inside factors
- symbols declared both as FG and BN nodes

### 7. Keep overrides minimal

Use:

- `curve` for geometry overrides
- `edge` for directed BN edge styling and labels

Do not add overrides unless the default implied edge is visually wrong or the user explicitly wants styling.

### 8. Use per-node overrides only for exceptional labels

Available per node:

- `color=...`
- `size=...`
- `font=...`

Use these rarely.

Good use:

- long probability labels like `p(X_i|M_i)`
- emphasized observed/active nodes

Bad use:

- every node in a figure getting unique tuning for no clear reason

### 9. Prefer readable source over exact SVG tracing

Do not trace imported images point-for-point if a slightly cleaner fgz layout communicates the same structure better.

When matching a reference figure:

- get topology right first
- then match major geometry
- then tune labels, spacing, and overrides

### 10. Check the guide before inventing syntax

Before adding new syntax, inspect:

- `/Users/dellaert/git/fgz/docs/REFERENCE.md`
- `/Users/dellaert/git/fgz/examples/examples.tex`
- `/Users/dellaert/git/fgz/examples/*.fgz`

If a new need can be solved with existing `style`, `curve`, `edge`, `size`, or `font`, use those first.

## Current Syntax Checklist

Agents should know the current implemented surface includes:

- `theme`
- `style node_size=... factor_size=... label_sep=... label_font=...`
- `variable` / `known` with optional `color`, `size`, `font`
- `factor` with optional explicit position, `offset`, `shape`, `color`
- `node` / `known_node` with optional `color`, `size`, `font`
- `curve` for implied edge geometry overrides
- `edge` for implied directed BN edge styling and labels

## Quality Bar

A good fgz file is:

- short enough to read in one screen when possible
- laid out on a predictable grid
- free of unnecessary macros
- free of unnecessary explicit factor positions
- visually balanced when rendered

If the figure still looks cramped after correct topology, widen the geometry before adding more syntax.
