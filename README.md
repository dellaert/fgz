# fgz

**fgz** is a mermaid-inspired, plain-text DSL + toolchain for rendering factor graphs and Bayes nets, designed for robotics papers.

## Example Document

The repository includes:

- a LaTeX user guide at [examples/examples.tex](examples/examples.tex)
- a Markdown user guide at [examples/examples.md](examples/examples.md)

Both guides render examples from [examples/](examples/).

If you clone this repo, you can build all generated example snippets, regenerate SVG previews, and compile the PDF in one step:

```bash
npm run examples:pdf
```

The run command:

- builds the TypeScript packages
- regenerates every `examples/*.fgz.tex`
- regenerates every `examples/*.svg`
- runs `pdflatex` on `examples/examples.tex`

If you only want the SVG outputs, run:

```bash
npm run examples:svg
```

The document inputs [tikz/fgz.tikz.tex](tikz/fgz.tikz.tex), so no extra package setup is needed beyond a working LaTeX install with TikZ.

## Documentation

- Human reference manual: [docs/REFERENCE.md](docs/REFERENCE.md)
- Agent authoring guidance: [AGENTS.md](AGENTS.md)

## In This Repo

Build once:

```bash
npm run build
```

Then use the short wrapper scripts:

```bash
npm run fgz2tex -- examples/guide-minimal.fgz
npm run fgz2svg -- examples/guide-minimal.fgz
```

## How To Use This In Your Own Project

The recommended setup is a pinned dev dependency, then short `npx` commands.

### Install Once

```bash
npm install --save-dev git+https://github.com/dellaert/fgz.git#main
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

For now, the simplest approach is to copy [tikz/fgz.tikz.tex](tikz/fgz.tikz.tex) into your own project and keep it alongside your paper sources. SVG export does not need that file on your LaTeX side, but the CLI still uses the shared support macros from this repository to keep SVG and TikZ output aligned.

## Roadmap

- Plates support
- MRF (Markov Random Field) support
- Offline editor tooling (perhaps in github pages)


## Attribution

If you use fgz in academic work, please cite/attribute this project:

> fgz: A mini-DSL for rendering factor graphs and Bayes Nets, Frank Dellaert, February 2026, https://github.com/dellaert/fgz

## License

MIT License - see [LICENSE](LICENSE) for details.
