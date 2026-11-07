import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const fontLicense = await readFile(new URL(import.meta.resolve("node-tikzjax/css/bakoma/LICENCE")), "utf8");
await mkdir("dist", { recursive: true });
for (const name of ["contact", "slam-elimination"]) {
  const { outputFiles } = await build({
    entryPoints: [`examples/browser/${name}.js`],
    bundle: true,
    format: "iife",
    loader: { ".fgz": "text", ".ttf": "dataurl" },
    minify: true,
    write: false
  });

  const template = await readFile(`examples/browser/${name}.html`, "utf8");
  const script = outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  const html = template
    .replace("<!-- font-license -->", () => fontLicense)
    .replace("<!-- inline-script -->", () => `<script>${script}</script>`);
  await writeFile(`dist/${name}.html`, html);
  console.log(`Open dist/${name}.html in a browser.`);
}
