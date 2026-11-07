import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { catalogExamples } from "../examples/catalog.mjs";
import { buildManual } from "./build-manual.mjs";

const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const demos = [
  { id: "contact", title: "Pose and contact" },
  { id: "slam-elimination", title: "SLAM elimination" }
];
const manual = { id: "manual", title: "Reference manual", href: "./manual/" };
const examples = await catalogExamples();
const pages = [
  ...demos.map(d => ({ ...d, href: `./${d.id}.html` })),
  manual,
  ...examples.map(e => ({ ...e, href: `./examples/${encodeURIComponent(e.id)}.html` }))
];

await rm("_site", { recursive: true, force: true });
await mkdir("_site");
await copyFile("site/favicon.svg", "_site/favicon.svg");
for (const { id } of demos) await copyFile(`dist/${id}.html`, `_site/${id}.html`);
await mkdir("_site/examples");
for (const { id } of examples) await copyFile(`dist/examples/${id}.html`, `_site/examples/${id}.html`);
await buildManual();

const document = new JSDOM(await readFile("_site/manual/index.html", "utf8")).window.document;
const sections = Array.from(document.querySelectorAll("article h2[id], article h3[id]"), h => ({
  id: `manual/${h.id}`, title: (h.querySelector(".heading-text") ?? h).textContent.trim(), subsection: h.tagName === "H3"
}));
function link({ id, title, subsection }) {
  return `<a href="#${escape(id)}"${subsection ? ' class="subsection"' : ""}>${escape(title)}</a>`;
}
const navigation = [
  "<h2>Explore</h2>", ...demos.map(link), link(manual),
  `<div id="manual-sections" hidden>${sections.map(link).join("\n")}</div>`
];
for (const group of new Set(examples.map(e => e.group))) {
  navigation.push(`<h2>${escape(group)}</h2>`, ...examples.filter(e => e.group === group).map(link));
}

const panels = pages.map(({ id, title, href }, i) =>
  `<section id="${escape(id)}" aria-label="${escape(title)}"${i === 0 ? "" : " hidden"}>
      <iframe title="${escape(title)}" ${i === 0 ? "src" : "data-src"}="${escape(href)}"></iframe>
      ${id === "manual" ? "" : `<a href="${escape(href)}" download>Download standalone HTML</a>`}
    </section>`
);
const template = await readFile("site/index.html", "utf8");
await writeFile("_site/index.html", template
  .replace("<!-- tabs -->", () => navigation.join("\n"))
  .replace("<!-- panels -->", () => panels.join("\n")));
