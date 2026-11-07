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
- a standalone PDF with `fgz2pdf`

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

## CLI Commands

fgz currently ships three end-user commands.

### `fgz2tex`

Convert an fgz file into a readable TikZ snippet.

```bash
fgz2tex input.fgz
fgz2tex input.fgz -o output.tex
```

Rules:

- default output is `input.fgz.tex`
- no `--preamble` flag is supported
- generated TikZ assumes the consuming paper already does `\input{fgz.tikz.tex}`

### `fgz2svg`

Convert an fgz file into an SVG by running the shared TikZ pipeline through
`node-tikzjax`.

```bash
fgz2svg input.fgz
fgz2svg input.fgz -o output.svg
fgz2svg input.fgz --preamble path/to/preamble.tex
```

Rules:

- default output is `input.svg`
- `--preamble` is optional
- when `--preamble` is omitted, no extra preamble file is loaded
- the `--preamble` file is inserted verbatim into the TeX preamble
- treat that file as a TeX/TikZ preamble fragment, not just a bag of `\newcommand`s
- it may contain TeX macro definitions, `\colorlet`, `\usetikzlibrary`, `\tikzset`,
  and local overrides of fgz theme or drawing macros
- for SVG export, that fragment must stay within what `node-tikzjax` supports
- SVG is convenient for previews and Markdown guides, but it is not always as
  faithful as native LaTeX/TikZ rendering

### `fgz2pdf`

Convert an fgz file into a standalone PDF without leaving intermediate TeX files
next to the source.

```bash
fgz2pdf input.fgz
fgz2pdf input.fgz -o output.pdf
fgz2pdf input.fgz --preamble path/to/preamble.tex
fgz2pdf input.fgz --keep-temp
```

Rules:

- default output is `input.fgz.pdf`
- `--preamble` is optional
- the `--preamble` file is inserted verbatim into the standalone TeX preamble
- treat that file as a TeX/TikZ preamble fragment, not just a bag of `\newcommand`s
- it may contain TeX macro definitions, `\colorlet`, `\usetikzlibrary`, `\tikzset`,
  and local overrides of fgz theme or drawing macros
- `--keep-temp` preserves the temporary LaTeX build directory for debugging
- `pdflatex` must be installed and available on `PATH`
- `fgz2pdf` embeds the shared `fgz.tikz.tex` support macros automatically
- successful runs leave no auxiliary LaTeX files behind

## Interactive browser API

`fgz/browser` is an ESM entry point for applications. It has no Vue, Node.js,
TeX, or external asset requirements at render time.

- `toFactorGraph(parseFgz(source))` produces a serializable `FactorGraph`. Each
  variable has its authored ID, resolved label, position, and known flag. Each
  factor has its label, position, shape, ordered variable IDs, and a generated
  ID (`fgz_f1`, `fgz_f2`, … in factor declaration order). Both collections
  accept optional colors and have separate ID namespaces. A Bayes-net node also
  has a `parents` array (empty for a root). A factor with an authored `offset`
  carries a `bridgeControl` point for its first two endpoints.
- `renderFactorGraph(container, graph, { onSelect })` mounts an SVG and returns
  `{ svg, setSelection }`. It replaces the contents of the container. The callback
  receives the original variable ID when a user selects it, including by keyboard.
- `setSelection(id)` highlights the selected variable, its incident factors and
  their variables, and any adjacent parent–child arrows and their endpoints. `setSelection(null)` clears the highlight.
  Programmatic selection leaves the callback silent, so a host can synchronize
  its own timeline or 3D viewer. Unknown or unselectable variable IDs raise a `RangeError`.

### Embedding an existing app layout

A host can pass its positioned graph and optional `FactorGraphRenderOptions`
directly to `renderFactorGraph`. For example, a scrollable pose timeline can
keep frame selection synchronized with its player.

```js
const view = renderFactorGraph(container, graph, {
  viewport: { width: timelineWidth, height: 320 },
  isSelectable: variable => frameIds.has(variable.id),
  isHighlightable: factor => observationIds.has(factor.id),
  onSelect: id => player.seek(frameIndex.get(id))
});
view.setSelection(currentFrameId);
```

- `presentation: "classic"` uses the classic TikZ palette and glyph sizes, including
  authored variable fills. The default `"interactive"` presentation uses the
  browser palette and variable outlines from the pose/contact example.
- `viewport: { width, height }` uses SVG pixel coordinates, with the origin at
  the upper left and y increasing downward. The SVG keeps the supplied
  dimensions inside a scrollable container. Omitting this option uses fgz's
  y-up coordinates and fits the SVG to its contents.
- `edgeEndpoint(factor, variable)` optionally returns the point on the variable
  where this incidence line terminates, in the same coordinate system. Return
  `undefined` for the variable center. This allows, for example, observation
  lines to leave the bottom of a pose circle while motion lines meet its sides.
- `isSelectable(variable)` determines which variables can take focus or be
  selected. Other variables can still be highlighted as neighbors.
- `isHighlightable(factor)` determines which factors respond to selection.
  Excluded factors and their edges retain their ordinary appearance and do
  not highlight neighboring variables. Both predicates default to true and
  are evaluated when the graph is mounted.

The returned SVG exposes `[data-variable]` and `[data-factor]` groups keyed by
ID. Straight incidence lines carry `data-factor-id` and `data-variable-id`.
A curved bridge carries `data-factor-id` and connects the first two variables
through a single path. Directed arrows carry `data-parent` and `data-child`.
Hosts can style `[data-active="true"]` and `[aria-pressed="true"]` and attach
their own timestamps or fixed-pose marks to the corresponding groups.

The browser supports factor graphs, Bayes nets, and mixed diagrams with
`variable`, `known`, `factor`, `node`, and `known_node`. For each parent in a
node declaration it draws an arrow from parent to child. It supports aliases,
the classic theme, explicit positions, and factor shape. A factor with no
position uses the midpoint of its first two variables. Adding `offset` moves
the factor and draws a cubic bridge through it. Any remaining incidences are
straight. Coordinates from the DSL retain their authored y-up frame. Simple
trailing subscripts such as `X_0` or `X_{t+1}` use SVG text. Other math
displays literally.

Colors can be `gray!N` (N percent gray mixed with white, from 0 to 100) or any
of the predefined names `black`, `blue`, `brown`, `cyan`, `darkgray`, `gray`,
`green`, `lightgray`, `lime`, `magenta`, `olive`, `orange`, `pink`, `purple`,
`red`, `teal`, `violet`, `white`, and `yellow`.

Explicit `curve` and `edge` overrides, annotations, TeX style overrides, and
nondefault DSL themes are available through the TikZ exporters. The browser
adapter reports unsupported constructs with their source line.

### Standalone example applets

`npm run example:browser` creates an interactive HTML file in `dist/examples/`
for each top-level `examples/*.fgz` file. These applets use the full TikZ
renderer and `examples/macro.tex` at build time, so their math, colors, plates,
and edge styles match the paper figures. At viewing time, JavaScript uses the
authored graph to highlight incident edges, neighboring variables, or a factor's
scope. Select a graph element by click, Enter, or Space. Escape clears the
selection. Each file embeds its figure, fonts, source, and interaction code.

The [SLAM elimination demo](../examples/browser/slam-elimination.js) renders
the six authored stages in a common frame. The [pose/contact demo](../examples/browser/contact.js)
shows how to synchronize selection with a host application.

## External Use

To export figures from another repository, use the installed CLI:

```bash
npx fgz2tex figures/example.fgz
npx fgz2svg figures/example.fgz
npx fgz2pdf figures/example.fgz
```

If your SVG or PDF labels depend on LaTeX macros, pass them explicitly:

```bash
npx fgz2svg figures/example.fgz --preamble figures/preamble.tex
npx fgz2pdf figures/example.fgz --preamble figures/preamble.tex
```

`fgz2pdf` also supports:

```bash
npx fgz2pdf figures/example.fgz --keep-temp
```

to keep the temporary LaTeX build directory for debugging.

### Overriding fgz Support Macros

The `--preamble` fragment can also override pieces of the shared fgz support
file when you want local presentation changes without editing `fgz.tikz.tex`.

Example:

```tex
\makeatletter
\renewcommand{\fgz@theme@textbook}{%
  \colorlet{fgz@stroke}{black!85}%
  \colorlet{fgz@var@draw}{kinNodeDraw}%
  \colorlet{fgz@var@fill}{kinPoseFill}%
  \colorlet{fgz@known@draw}{kinNodeDraw}%
  \colorlet{fgz@known@fill}{kinPoseFill}%
  \colorlet{fgz@factor@draw}{fgzTextbookFactorDraw}%
  \colorlet{fgz@factor@fill}{fgzTextbookFactorFill}%
  \def\fgz@node@line@width{0.65pt}%
  \def\fgz@edge@line@width{0.7pt}%
}
\renewcommand{\fgzKnown}[4]{%
  \node[fgz known, rounded corners=1pt, minimum width=9mm, minimum height=8mm, inner sep=0pt] (#1) at (#2,#3) {#4};%
}
\makeatother

\usetikzlibrary{arrows.meta,calc,positioning,bending,shapes.geometric}
\colorlet{kinPoseFill}{red!8}
\colorlet{kinNodeDraw}{black}
\tikzset{
  tikzPanel/.style={draw=black!25, fill=black!2, rounded corners=3pt}
}
```

Typical uses:

- local palette changes for a paper
- thinner or heavier node/edge strokes
- rounded-corner known nodes or factor boxes
- custom panel styling
- loading extra TikZ libraries needed by local overrides

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
