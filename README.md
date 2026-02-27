# fgz

**fgz** is a mermaid-inspired, plain-text DSL + toolchain for factor graphs and Bayes nets, designed for robotics papers.

## Status

⚠️ **Early Development**: This repository is in flux.

### Near-term Plan
- DSL specification
- `fgz2tex` converter
- `fgz2svg` converter
- Editor tooling (separate repository)

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

## Example Document

The repository includes a LaTeX demo at [examples/examples.tex](/Users/dellaert/git/fgz/examples/examples.tex) that renders every example in [examples/](/Users/dellaert/git/fgz/examples).

Build all generated example snippets and compile the PDF in one step:

```bash
npm run examples:pdf
```

That command:

- builds the TypeScript packages
- regenerates every `examples/*.fgz.tex`
- runs `pdflatex` on `examples/examples.tex`

The document inputs [tikz/fgz.tikz.tex](/Users/dellaert/git/fgz/tikz/fgz.tikz.tex), so no extra package setup is needed beyond a working LaTeX install with TikZ.

## Roadmap

- Plates support
- MRF (Markov Random Field) support
- Offline editor

## Attribution

If you use fgz in academic work, please cite/attribute this project.

## License

MIT License - see [LICENSE](LICENSE) for details.
