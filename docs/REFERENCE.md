# fgz Reference Manual

This document describes the fgz language as implemented in this repository today.

## Overview

An fgz file is a plain-text description of a factor graph, a Bayes net, or a
mixed diagram with lightweight annotations.

Every file starts with:

```txt
fgz 1
```

The file can be converted into:

- a readable TikZ snippet with `fgz2tex`
- an SVG with `fgz2svg`

Statements are line-oriented and remain ordered exactly as written.

Supported statement kinds:

- `theme`
- `style`
- macro definitions
- `variable`
- `known`
- `factor`
- `node`
- `known_node`
- `curve`
- `edge`
- `text`
- `box`
- `plate`

Comments start with `#` and continue to the end of the line.

## Names and Labels

Names are single tokens without spaces. Direct LaTeX-style names are allowed:

```txt
variable x_{t+1} (0, 0)
known b_t (1, -1)
```

Rendering rule:

- if a macro exists for a name, the macro right-hand side is used as the label
- otherwise the name itself is used as the label
- labels are wrapped in `$...$` in generated output

Example:

```txt
x1 = x_1
variable x1 (0, 0)
```

## Theme

Theme selects a built-in visual palette.

```txt
theme classic
theme textbook
theme blog
```

## Style

`style` adjusts file-level rendering defaults.

```txt
style node_size=9mm factor_size=3mm label_sep=0.2pt label_font=small
```

Supported keys:

- `node_size`
- `factor_size`
- `label_sep`
- `label_font`

These are document-level defaults, not per-node overrides.

## Macros

Macros map short names to richer LaTeX labels.

```txt
q = q_0
node q {} (0, 0)
```

Syntax:

```txt
<lhs> = <rhs>
```

The right-hand side is kept as authored.

## Factor-Graph Declarations

### Variables

```txt
variable x (0, 0)
known z (2, 0)
```

Optional attributes:

- `color=...`
- `size=...`
- `font=...`

Example:

```txt
variable p_l0 (0, 0) size=16mm font=scriptsize
```

### Factors

```txt
factor {x, y}
factor {x, y} (1, 0)
factor {x, y} offset=(0,-0.35)
factor {x, y, z} shape=square color=red
factor {x, y} shape=square color=red!20 label=g1 size=6.8mm font=scriptsize
```

Supported attributes:

- `offset=(dx,dy)`
- `shape=circle|square`
- `color=...`
- `label=...`
- `size=...`
- `font=...`

Rules:

- factor position may be explicit or inferred
- if no position is given, the factor is placed at the midpoint of the first two variables
- this midpoint rule applies even for higher-arity factors
- `offset=(dx,dy)` starts from that midpoint and shifts the factor
- `offset` cannot be combined with an explicit position
- factor labels are rendered inside the factor node

## Bayes-Net Declarations

```txt
node x_1 {x_0, m_1} (3, 0)
known_node m_1 {} (1.5, 1.5)
```

Optional attributes:

- `color=...`
- `size=...`
- `font=...`

Parents must be listed in braces:

```txt
node x {}
```

For empty parent lists:

```txt
node x {} (0, 0)
```

## Mixed Diagrams

Mixed diagrams are allowed with one restriction:

- factor-graph symbols (`variable`, `known`) may be parents of Bayes-net nodes
- Bayes-net nodes do not participate in factors

This is valid:

```txt
variable x (0, 0)
node l {x} (1, 1)
```

This is not valid:

```txt
node l {} (1, 1)
factor {l, x}
```

## Curve Overrides

`curve` changes the geometry of one implied edge.

### Undirected factor-graph curve

```txt
curve x -- y via (1, 1)
```

This must match an implied factor-graph connection.

### Directed Bayes-net curve

```txt
curve a -> b via (1, 2)
```

This must match an implied Bayes-net parent edge.

Optional attribute:

- `color=...`

## Directed Edge Overrides

`edge` changes the styling of one implied directed Bayes-net edge.

```txt
edge a -> b style=dashed label=0 label_side=left label_pos=0.35
```

Supported keys:

- `style=solid|dashed`
- `label=...`
- `label_side=left|right`
- `label_pos=<number between 0 and 1>`

Rules:

- only directed BN edges are supported today
- the edge must already be implied by a `node` or `known_node` parent list
- `label_pos` controls where the label sits along the edge

## Annotation Statements

These statements cover free text, separators, outlines, and repeated-model plates.

### Text

```txt
phase = k-1
text phase (0, 2) font=small
```

Optional attributes:

- `color=...`
- `font=...`

`text` uses the same label resolution rule as node names:

- if the name has a macro, the macro value is rendered
- otherwise the name itself is rendered

### Box

```txt
box (2, 0) (5, 3)
box (2, 0) (5, 3) color=black!60
box (1, 0) (1, 3) style=dashed color=black!50
```

Optional attributes:

- `style=solid|dashed`
- `color=...`

`box` is a plain rectangular outline. A zero-width or zero-height box is a useful
way to draw a straight separator without introducing a separate `line` statement.

### Plate

`plate` is a semantic rectangular outline for repeated substructure.

```txt
s = s=1..n_s
plate (6.35, 0.72) (13.0, 3.12) color=black!60 label=s font=small
```

Optional attributes:

- `color=...`
- `label=...`
- `font=...`

Rules:

- plates require a label
- the label is placed near the top-right corner
- the label is interpreted with the normal macro and LaTeX-style label rules

## Validation Rules

The validator enforces:

- header must be `fgz 1`
- no duplicate factor-graph symbols
- no duplicate Bayes-net symbols
- a symbol cannot be both a factor-graph symbol and a Bayes-net symbol
- factors may only reference `variable` or `known`
- Bayes-net parents may reference BN symbols or factor-graph symbols
- factors without explicit positions must reference at least two variables
- `offset` cannot be combined with an explicit factor position
- undirected `curve` overrides must match an implied factor connection
- directed `curve` overrides must match an implied BN edge
- directed `edge` overrides must match an implied BN edge
- `edge label_pos` must be strictly between `0` and `1`
- `box` styles must be `solid` or `dashed`
- plates require labels

## Geometry Guidance

- start with a simple repeated grid
- omit factor positions when midpoint placement is correct
- use `offset` only when the default midpoint geometry is too stiff
- prefer labeled square factors over fake known variables when the visual object is semantically a factor
- use `text`, `box`, and `plate` sparingly, only where the graph primitives do not express the intended structure
