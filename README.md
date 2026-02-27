# fgz

**fgz** is a mermaid-inspired, plain-text DSL + toolchain for factor graphs and Bayes nets, designed for robotics papers.

### Near-term Plan
- `fgz2svg` converter
- Editor tooling (perhaps in github pages)

## Installation

```bash
npm install
```

## Usage

Build the TypeScript packages:

```bash
npm run build
```

Convert an `.fgz` file to a TikZ snippet:

```bash
node packages/fgz-cli/dist/fgz2tex.js examples/basic.fgz
```

That writes `examples/basic.fgz.tex` by default.

Convert an `.fgz` file to SVG through the same TikZ pipeline:

```bash
node packages/fgz-cli/dist/fgz2svg.js examples/basic.fgz
```

That writes `examples/basic.svg` by default.

## Documentation

- Human reference manual: [docs/REFERENCE.md](/Users/dellaert/git/fgz/docs/REFERENCE.md)
- Agent authoring guidance: [AGENTS.md](/Users/dellaert/git/fgz/AGENTS.md)

## How To Use This In Your Own Project

The recommended setup is a pinned dev dependency, then short `npx` commands.

### Install Once

```bash
npm install --save-dev git+https://github.com/<you>/fgz.git#main
```

You can pin a specific branch, tag, or commit instead of `#main`.

You can also install from a local checkout:

```bash
npm install --save-dev ../fgz
```

### Then Use `npx`

After that, run:

```bash
npx fgz2tex figures/example.fgz
npx fgz2svg figures/example.fgz
```

Those write `figures/example.fgz.tex` and `figures/example.svg` by default.

If you prefer package scripts, add:

```json
{
  "scripts": {
    "figures:tex": "fgz2tex figures/example.fgz",
    "figures:svg": "fgz2svg figures/example.fgz"
  }
}
```

In both cases, the generated `.fgz.tex` file assumes your LaTeX preamble already includes:

```tex
\input{fgz.tikz.tex}
```

For now, the simplest approach is to copy [tikz/fgz.tikz.tex](/Users/dellaert/git/fgz/tikz/fgz.tikz.tex) into your own project and keep it alongside your paper sources. SVG export does not need that file on your LaTeX side, but the CLI still uses the shared support macros from this repository to keep SVG and TikZ output aligned.

## Example Document

The repository includes:

- a LaTeX user guide at [examples/examples.tex](/Users/dellaert/git/fgz/examples/examples.tex)
- a Markdown user guide at [examples/examples.md](/Users/dellaert/git/fgz/examples/examples.md)

Both guides render examples from [examples/](/Users/dellaert/git/fgz/examples).

Build all generated example snippets, regenerate SVG previews, and compile the PDF in one step:

```bash
npm run examples:pdf
```

That command:

- builds the TypeScript packages
- regenerates every `examples/*.fgz.tex`
- regenerates every `examples/*.svg`
- runs `pdflatex` on `examples/examples.tex`

If you only want the SVG outputs, run:

```bash
npm run examples:svg
```

The document inputs [tikz/fgz.tikz.tex](/Users/dellaert/git/fgz/tikz/fgz.tikz.tex), so no extra package setup is needed beyond a working LaTeX install with TikZ.

## Roadmap

- Plates support
- MRF (Markov Random Field) support
- Offline editor

## Attribution

If you use fgz in academic work, please cite/attribute this project.

## License

MIT License - see [LICENSE](LICENSE) for details.
