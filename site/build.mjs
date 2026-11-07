import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

const demos = [
  { id: "contact", title: "Pose and contact" },
  { id: "slam-elimination", title: "SLAM elimination" }
];
const templates = await readdir("examples/browser");
const available = demos.filter(demo => templates.includes(`${demo.id}.html`));
await rm("_site", { recursive: true, force: true });
await mkdir("_site");
await copyFile("site/favicon.svg", "_site/favicon.svg");
for (const { id } of available) {
  await copyFile(`dist/${id}.html`, `_site/${id}.html`);
}

const pages = [
  ...available.map(demo => ({ ...demo, href: `./${demo.id}.html`, downloadable: true })),
  { id: "manual", title: "Reference manual", href: "./manual/" }
];

const tabs = pages.map(({ id, title }, i) =>
  `<button type="button" role="tab" id="tab-${id}" aria-controls="${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${title}</button>`
);
const panels = pages.map(({ id, title, href, downloadable }, i) =>
  `<section role="tabpanel" id="${id}" aria-labelledby="tab-${id}"${i === 0 ? "" : " hidden"}>
      <iframe title="${title}" ${i === 0 ? "src" : "data-src"}="${href}"></iframe>
      ${downloadable ? `<a href="${href}" download>Download standalone HTML</a>` : ""}
    </section>`
);
const template = await readFile("site/index.html", "utf8");
await writeFile("_site/index.html", template
  .replace("<!-- tabs -->", () => tabs.join("\n"))
  .replace("<!-- panels -->", () => panels.join("\n")));
