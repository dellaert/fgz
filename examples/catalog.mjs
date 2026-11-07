import { readdir } from "node:fs/promises";

// Keep the guide's teaching order. Other .fgz files are included automatically.
const groups = {
  "Getting started": {
    "guide-minimal": "Minimal factor graph",
    basic: "A mixed graphical model",
    knowns: "Known variables and observed nodes",
    "guide-theme-known": "Themes and known variables",
    "guide-factor-shape": "Factor shapes",
    "guide-style-size": "Node and factor sizes",
    "guide-macros": "LaTeX label aliases"
  },
  "Factors and Bayes nets": {
    "guide-curved-binary-factor": "Curved binary factor",
    "guide-fg-parents-bn": "Factor-graph variables as parents",
    "guide-directed-curve": "Curved directed edge",
    "guide-color-accents": "Color accents",
    "guide-colored-chain": "Colored chain model",
    "guide-gray-bayes-net": "Gray Bayes net",
    "guide-compact-factor-graph": "Compact factor graph",
    "guide-directed-triangle": "Directed triangle",
    "guide-dashed-bayes-net": "Labeled and dashed edges"
  },
  "Dynamics and tracking": {
    "guide-textbook-dynamics": "Recursive robot dynamics",
    "guide-tracking-temporal-chain": "Temporal chain",
    "guide-tracking-association-star": "Association star",
    "guide-tracking-bipartite-block": "Bipartite block",
    "guide-tracking-lifted-box": "Lifted tracking model"
  },
  "SLAM stages": {
    "slam-original-factor-graph": "Original factor graph",
    "slam-eliminate-l1": "Eliminate ℓ₁",
    "slam-eliminate-l2": "Eliminate ℓ₂",
    "slam-eliminate-x1": "Eliminate x₁",
    "slam-eliminate-x2": "Eliminate x₂",
    "slam-eliminate-x3": "Eliminate x₃"
  }
};

export async function catalogExamples() {
  const files = await readdir(new URL("./", import.meta.url));
  const ids = new Set(files.filter(file => file.endsWith(".fgz")).map(file => file.slice(0, -4)).sort());
  const examples = [];
  for (const [group, titles] of Object.entries(groups)) {
    for (const [id, title] of Object.entries(titles)) {
      if (ids.delete(id)) examples.push({ id, title, group });
    }
  }
  for (const id of ids) examples.push({ id, title: id.replaceAll("-", " "), group: "Other examples" });
  return examples;
}
