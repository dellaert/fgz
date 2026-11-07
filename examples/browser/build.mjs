import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const { outputFiles } = await build({
  entryPoints: ["examples/browser/contact.js"],
  bundle: true,
  format: "iife",
  loader: { ".fgz": "text" },
  minify: true,
  write: false
});

const template = await readFile("examples/browser/contact.html", "utf8");
const script = outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
await mkdir("dist", { recursive: true });
await writeFile("dist/contact.html", template.replace("<!-- inline-script -->", () => `<script>${script}</script>`));
console.log("Open dist/contact.html in a browser.");
