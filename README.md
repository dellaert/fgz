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

## Documentation

- Human reference manual: [docs/REFERENCE.md](/Users/dellaert/git/fgz/docs/REFERENCE.md)
- Agent authoring guidance: [AGENTS.md](/Users/dellaert/git/fgz/AGENTS.md)

## How To Use This In Your Own Project

There are two good starting points.

### Option 1: `npx`

This repository is not published to npm yet, so the lightest setup is to run the CLI directly
from the git repo.

```bash
npx --yes --package=git+https://github.com/<you>/fgz.git fgz2tex figures/example.fgz
```

That writes `figures/example.fgz.tex` by default.

Use this when:

- you want zero package setup
- you are experimenting
- you do not yet need strict version pinning

If your npm version does not support that form cleanly, the equivalent command is:

```bash
npm exec --yes --package=git+https://github.com/<you>/fgz.git -- fgz2tex figures/example.fgz
```

### Option 2: Pinned Dev Dependency

For a paper repo or any shared project, a pinned dev dependency is usually the better long-term choice.

```bash
npm install --save-dev git+https://github.com/<you>/fgz.git#main
```

Then add a script such as:

```json
{
  "scripts": {
    "figures": "fgz2tex figures/example.fgz"
  }
}
```

Use this when:

- multiple people work in the repo
- you want reproducible builds
- you may run fgz in CI

You can pin a specific branch, tag, or commit instead of `#main`.

You can also install from a local checkout:

```bash
npm install --save-dev ../fgz
```

In both cases, the generated `.fgz.tex` file assumes your LaTeX preamble already includes:

```tex
\input{fgz.tikz.tex}
```

For now, the simplest approach is to copy [tikz/fgz.tikz.tex](/Users/dellaert/git/fgz/tikz/fgz.tikz.tex)
into your own project and keep it alongside your paper sources.

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
