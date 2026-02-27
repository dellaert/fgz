# PRD: fgz (DSL + TikZ + SVG for graphical-model diagrams)

## Summary
**fgz** is an open-source, mermaid-inspired **plain-text DSL** and toolchain for authoring **graphical model diagrams** used in robotics papers:
- **Factor graphs** (bipartite: variables + factors)
- **Bayes nets** (directed)

The DSL stores **fixed layout** in **TikZ units**, supports **LaTeX labels**, and converts `.fgz` to:
- **Readable TikZ** (`.fgz.tex`) that compiles with **pdflatex**
- **SVG** via a TikZ-based renderer (TikZJax / node-tikzjax) for faithful preview/export

The project prioritizes:
1) human-readable `.fgz` files with clean git diffs  
2) pdflatex-compatible output  
3) TikZ output readability and reuse via a shared support file included in LaTeX preambles  

---

## Users
- Primary: robotics academics writing LaTeX papers (you, students)
- Secondary: broader research community (open source)

---

## Goals
### G1. Readable, diff-friendly source format
- `.fgz` is compact and human-editable.
- Deterministic formatting for stable diffs.

### G2. Fixed, round-trippable layout
- Node positions are explicit and preserved (no auto-layout in core toolchain).
- Layout stored in **TikZ units** (e.g., centimeters).

### G3. High-fidelity LaTeX/TikZ output for pdflatex
- Generated `.fgz.tex` compiles with **pdflatex**.
- Output is **as readable as possible** (minimal inline styling, clear structure).
- Styling is factored into a **shared TikZ support file** (upgradeable and reusable across papers).

### G4. Faithful SVG output
- SVG matches TikZ geometry closely by rendering the generated TikZ (TikZJax / node-tikzjax path).
- SVG export supports paper figures, slides, and web.

### G5. Graphical-model-focused features
- Factor graphs and Bayes nets in v1.
- Support **known** nodes (observed variables) for both:
  - factor graph: `known` variables (square instead of circle)
  - Bayes net: `known_node` (square instead of circle)

---

## Non-goals (v1)
- Automatic layout
- MRFs, DBNs/time-slicing, plates (planned later)
- Importers (DOT, gtsam dumps)
- Rich GUI editor (separate repo: `fgz-editor`)
- Full general TikZ/LaTeX compatibility beyond supported primitives

---

## Product components
### 1) File format: `.fgz`
A mermaid-inspired DSL tailored to graphical models.

### Required capabilities (v1)

- **Header + optional theme**
  - `fgz 1`
  - `theme classic|textbook|blog` (optional; defaults to `classic`)

- **Macro/alias definitions (for readable symbols + complex LaTeX)**
  - `x1 = x_1`
  - A symbol token (e.g., `x1`) is used for references in the file; its rendered label becomes `$x_1$`.
  - If no alias is defined, the token itself is rendered as LaTeX (wrapped in `$…$`).
  - **No separate IDs**: the token is the reference name.

- **Factor graph declarations (layout fixed in TikZ units)**
  - `variable <name> (<x>,<y>)` — open circle
  - `known <name> (<x>,<y>)` — square (observed)
  - `factor {a,b,...} (<x>,<y>)` — small filled mark (shape controlled by style; default filled circle)
  - Factors connect only to `variable`/`known` symbols.

- **Bayes net declarations (layout fixed in TikZ units)**
  - `node <name> {p1,p2,...} (<x>,<y>)` — open circle
  - `known_node <name> {p1,p2,...} (<x>,<y>)` — square (observed)
  - Parent set `{...}` may be empty `{}`.
  - BN edges are always directed (parents → child).

- **Edges / curves (single control point)**
  - Straight edges are implied by `factor {…}` and `node child {parents}`.
  - Optional curve override / explicit curved edge:
    - `curve A -- B via (<cx>,<cy>)` (undirected; for factor graph)
    - `curve A -> B via (<cx>,<cy>)` (directed; for Bayes net)
  - Only one control point is supported in v1.

- **Deterministic, non-invasive formatting**
  - Tools must **preserve statement order** as written (no reordering/sorting).
  - Formatting may normalize whitespace and numeric formatting, but must not restructure the file.
  
---

### 2) TikZ support file (shared, upgradeable)
fgz relies heavily on a shared TikZ style file included in a paper preamble, e.g.:

- `fgz.tikz.tex` (or `fgz.sty` + `\input`)
- Provides:
  - node styles (`fgz var`, `fgz known`, `fgz factor`, `fgz bn`, `fgz bn known`)
  - edge styles (undirected, directed, curved)
  - theme selectors (e.g., `\fgzsettheme{classic}`)

**Requirement:** generated `.fgz.tex` should be *readable* and mostly consist of:
- `\fgzsettheme{...}`
- `\fgznode{...}{...}{...}` / `\fgzfactor{...}` / `\fgzedge{...}` calls
(or clean `\node[...]` / `\draw[...]` if macros are not used—BUT prefer fgz macros.)

---

### 3) Converters
#### fgz2tex
- Input: `diagram.fgz`
- Output: `diagram.fgz.tex` (TikZ snippet)
- Constraints:
  - pdflatex compatible
  - readable output
  - minimal inline styling; defer to support file

#### fgz2svg
- Input: `diagram.fgz`
- Output: `diagram.svg`
- Implementation preference:
  - Generate TikZ via same pipeline as fgz2tex
  - Render via node-tikzjax (or equivalent)
  - Output deterministic SVG

---

## Quality requirements
- Error reporting includes line number + message.
- Validation catches:
  - unknown symbols
  - duplicates
  - factor graph bipartite constraints (factors connect only to variables/known)
  - BN constraints (parents/child are node/known_node)
- LaTeX pass-through:
  - labels and CPDs are treated as LaTeX and emitted with minimal escaping.

---

## Example DSL (illustrative)
```txt
fgz 1
theme classic

# Aliases/macros for readable references and LaTeX labels
x1 = x_1
x2 = x_2
z1 = z_1
z2 = z_2

# Factor graph
known x1 (12.0, 8.0)
variable x2 (24.0, 8.0)
factor {x1, x2} (18.0, 14.0)

# Bayes net
known_node z1 {} (12.0, 24.0)
node z2 {z1} (24.0, 24.0)

# Optional curve (single control point)
curve z1 -> z2 via (18.0, 22.0)
```

## Milestones

### M0: Scaffold (done)

Docs + repo layout.

### M1: Core pipeline (first functional release)
	•	Parser + AST + validator + formatter
	•	fgz2tex produces pdflatex-compilable snippet
	•	TikZ support file included in repo and used by generator
	•	Examples + golden tests for .tex

### M2: SVG export
	•	fgz2svg renders SVG via TikZ renderer
	•	Example outputs validated (existence + basic sanity checks)

### M3: Polish for paper use
	•	Theme tweaks
	•	Better error messages
	•	More examples (common robotics diagrams)

### Acceptance criteria (for M1)
	•	A representative .fgz diagram using variable/known/factor and node/known_node compiles under pdflatex with the shared support file.
	•	Generated .fgz.tex is readable:
	•	short
	•	consistent structure
	•	minimal inline style noise
	•	fgzfmt (or equivalent formatter) yields stable diffs (formatting is deterministic).