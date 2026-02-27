# fgz Reference Manual

This document describes the fgz language as it is implemented in this repository today.

## Overview

An fgz file is a plain-text description of a factor graph, a Bayes net, or a mixed diagram.
The file is converted into a readable TikZ snippet.

Every file starts with:

```txt
fgz 1
```

## File Structure

Statements are line-oriented and remain ordered as written.

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

Comments start with `#` and continue to end of line.

## Names and Labels

Names are single tokens without spaces. Direct LaTeX-style names are allowed:

```txt
variable x_{t+1} (0, 0)
known b_t (1, -1)
```

Rendering rule:

- if a macro exists for a name, the macro right-hand side is used as the label
- otherwise the name itself is used as the label
- labels are wrapped in `$...$` in TikZ output

Example:

```txt
x1 = x_1
variable x1 (0, 0)
```

renders the variable with label `$x_1$`.

## Theme

Theme selects a built-in visual palette.

```txt
theme classic
theme textbook
theme blog
```

## Style

`style` adjusts rendering defaults for the current fgz file.

```txt
style node_size=9mm factor_size=3mm label_sep=0.2pt label_font=small
```

Supported keys:

- `node_size`
- `factor_size`
- `label_sep`
- `label_font`

These are document-level defaults, not per-node settings.

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
```

Supported attributes:

- `offset=(dx,dy)`
- `shape=circle|square`
- `color=...`

Rules:

- factor position may be explicit or inferred
- if no position is given, the factor is placed at the midpoint of the first two variables
- this midpoint rule applies even for higher-arity factors
- `offset=(dx,dy)` starts from that midpoint and shifts the factor
- `offset` cannot be combined with an explicit position

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

## Validation Rules

The validator enforces:

- header must be `fgz 1`
- no duplicate factor-graph symbols
- no duplicate Bayes-net symbols
- a symbol cannot be both a factor-graph symbol and a Bayes-net symbol
- factors may only reference `variable` or `known`
- Bayes-net parents may reference BN symbols or factor-graph symbols
- undirected `curve` overrides must match an implied factor connection
- directed `curve` overrides must match an implied BN edge
- directed `edge` overrides must match an implied BN edge

## Geometry Guidance

fgz works best when files are authored on a simple grid.

Practical guidance:

- prefer a small set of repeated coordinates
- omit factor positions when midpoint inference is good enough
- use `offset` only when you need a bent binary factor edge
- widen trees when leaf labels are long
- use per-node `size=` and `font=` sparingly for exceptional labels

## Minimal Examples

Minimal factor graph:

```txt
fgz 1
variable x (0, 0)
variable y (2, 0)
factor {x, y}
```

Small mixed example:

```txt
fgz 1
variable x (0, 0)
node l {x} (1, 1)
```

Directed edge styling:

```txt
fgz 1
node x_1 {} (1, 0)
node x_0 {x_1} (0, 0)
edge x_1 -> x_0 style=dashed label=0 label_side=left label_pos=0.35
```
