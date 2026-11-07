import { parseFgz, renderFactorGraph, toFactorGraph } from "fgz/browser";
import original from "../slam-original-factor-graph.fgz";
import l1 from "../slam-eliminate-l1.fgz";
import l2 from "../slam-eliminate-l2.fgz";
import x1 from "../slam-eliminate-x1.fgz";
import x2 from "../slam-eliminate-x2.fgz";
import x3 from "../slam-eliminate-x3.fgz";
import mathItalic from "node-tikzjax/css/bakoma/ttf/cmmi10.ttf";
import subscript from "node-tikzjax/css/bakoma/ttf/cmr7.ttf";

const stages = [
  [original, "Original graph", "Three poses observe two landmarks.",
    "Nine factors constrain the five variables. Start with the landmark observed from both x₁ and x₂."],
  [l1, "Eliminate ℓ₁", "Eliminating ℓ₁ adds a second factor between x₁ and x₂.",
    "The arrows encode p(ℓ₁ | x₁, x₂). The curved red factor carries the landmark information forward alongside the original pose-to-pose factor."],
  [l2, "Eliminate ℓ₂", "Only x₃ observes the second landmark.",
    "Eliminating ℓ₂ gives p(ℓ₂ | x₃) and leaves the red unary factor on x₃."],
  [x1, "Eliminate x₁", "The information from x₁ passes to x₂.",
    "The factors incident on x₁ combine into p(x₁ | x₂) and a new unary factor on x₂."],
  [x2, "Eliminate x₂", "The remaining pose factors meet at x₃.",
    "Eliminating x₂ gives p(x₂ | x₃). The new red factor and the earlier landmark contribution both constrain x₃."],
  [x3, "Eliminate x₃", "The Bayes net is rooted at x₃.",
    "The last two factors combine into p(x₃). Following the arrows from x₃ gives a sampling order for the joint posterior."]
];

// Embed the two Computer Modern faces used in the checked-in TikZ references.
for (const [family, url] of [["fgz-CMMI", mathItalic], ["fgz-CMR7", subscript]]) {
  const font = new FontFace(family, `url("${url}")`);
  document.fonts.add(font);
}

const host = document.querySelector("#graph");
const diagrams = stages.map(([source, name]) => {
  const { svg } = renderFactorGraph(document.createElement("div"), toFactorGraph(parseFgz(source)), {
    presentation: "classic", isSelectable: () => false
  });
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", name);
  return svg;
});

// Use the union of the stage bounds so that poses and landmarks stay put as factors disappear.
const boxes = diagrams.map(svg => svg.viewBox.baseVal);
const left = Math.min(...boxes.map(b => b.x));
const top = Math.min(...boxes.map(b => b.y));
const width = Math.max(...boxes.map(b => b.x + b.width)) - left;
const height = Math.max(...boxes.map(b => b.y + b.height)) - top;
for (const svg of diagrams) {
  svg.setAttribute("viewBox", `${left} ${top} ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
}

const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
let current = 0;
function show(index) {
  if (index < 0 || index >= stages.length) return;
  current = index;
  const [source, name, title, explanation] = stages[index];
  host.replaceChildren(diagrams[index]);
  document.querySelector("#step").textContent = `${index + 1} / ${stages.length}  ·  ${name}`;
  document.querySelector("h1").textContent = title;
  document.querySelector("#explanation").textContent = explanation;
  document.querySelector("code").textContent = source;
  previous.disabled = index === 0;
  next.disabled = index === stages.length - 1;
}
previous.onclick = () => show(current - 1);
next.onclick = () => show(current + 1);
document.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  show(current + (event.key === "ArrowRight" ? 1 : -1));
});
show(0);
