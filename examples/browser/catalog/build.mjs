import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { parseFgz } from "fgz/browser";
import { renderInteractiveSvg } from "../../../packages/fgz-cli/dist/svg.js";
import { catalogExamples } from "../../catalog.mjs";

const escapeHtml = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const scriptText = text => text.replace(/<\/script/gi, "<\\/script");

export async function buildCatalog(fontLicense) {
  const examples = await catalogExamples();
  const template = await readFile("examples/browser/catalog/applet.html", "utf8");
  const preambleSource = await readFile("examples/macro.tex", "utf8");
  const { outputFiles } = await build({
    entryPoints: ["examples/browser/catalog/applet.js"],
    bundle: true, minify: true, format: "iife", write: false
  });
  const runtime = scriptText(outputFiles[0].text);
  await mkdir("dist/examples", { recursive: true });
  // The TikZ WASM renderer shares state and compiles one diagram at a time.
  for (const { id, title } of examples) {
    const source = await readFile(`examples/${id}.fgz`, "utf8");
    const svg = await renderInteractiveSvg(parseFgz(source), { preambleSource });
    const parts = { title: escapeHtml(title), source: escapeHtml(source), svg, runtime, license: scriptText(fontLicense) };
    const html = template.replace(/<!-- (title|source|svg|runtime|license) -->/g, (_, part) => parts[part]);
    await writeFile(`dist/examples/${id}.html`, html);
  }
  console.log(`Built ${examples.length} standalone applets in dist/examples.`);
}
