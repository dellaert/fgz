import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { parseFgz, renderFactorGraph, toFactorGraph } from "fgz/browser";

const examples = [
  {
    name: "contact",
    title: "Pose and contact factors",
    description: "Select a robot pose to see which foot contacts constrain it, or select a stance to find the poses that observed it.",
    alt: "Four poses connected by motion factors, with the observations of the second pose highlighted."
  },
  {
    name: "slam-elimination",
    title: "SLAM variable elimination",
    description: "Step from a factor graph to a Bayes net as two landmarks and three poses are eliminated. Follow the new factor at each step.",
    alt: "Eliminating the first landmark produces two parent arrows and a red curved factor between two poses."
  }
];

// A clean site should expose exactly the examples available on this revision.
const templates = await readdir("examples/browser");
const available = examples.filter(({ name }) => templates.includes(`${name}.html`));
await rm("_site", { recursive: true, force: true });
await mkdir("_site");

for (const { name } of available) {
  await copyFile(`dist/${name}.html`, `_site/${name}.html`);
}
const dom = new JSDOM();
const contact = await readFile("examples/browser/contact.fgz", "utf8");
const { svg, setSelection } = renderFactorGraph(dom.window.document.createElement("div"), toFactorGraph(parseFgz(contact)));
setSelection("X_1");
await writeFile("_site/contact.svg", new dom.window.XMLSerializer().serializeToString(svg));
if (available.some(example => example.name === "slam-elimination")) {
  await copyFile("examples/slam-eliminate-l1.svg", "_site/slam-elimination.svg");
}

function card({ name, title, description, alt }) {
  const page = `./${name}.html`;
  return `<article class="example">
      <a class="preview" href="${page}" aria-label="Open ${title}"><img src="./${name}.svg" alt="${alt}"></a>
      <div class="details">
        <h2><a href="${page}">${title}</a></h2>
        <p>${description}</p>
        <div class="actions"><a class="open" href="${page}">Open demo</a><a href="${page}" download>Download HTML</a></div>
      </div>
    </article>`;
}

const template = await readFile("site/index.html", "utf8");
await writeFile("_site/index.html", template.replace("<!-- examples -->", () => available.map(card).join("\n")));
console.log(`Built ${available.length} interactive example(s) in _site/.`);
