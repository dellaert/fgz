import { parseFgz } from "fgz/browser";
import { inspectGraph } from "../inspect-graph.js";

const svg = document.querySelector("#diagram svg");
const source = document.querySelector("#source").textContent;
const zoom = document.querySelector("#zoom");
const { width, height } = svg.viewBox.baseVal;
svg.setAttribute("aria-labelledby", "title");
// Give small graphs a readable scale while fitting taller figures above the controls.
svg.style.setProperty("--fit", `${Math.min(svg.width.baseVal.value * 1.8, 420 * width / height)}px`);
zoom.addEventListener("change", () => svg.style.setProperty("--zoom", zoom.value));
inspectGraph(svg, parseFgz(source), document.querySelector("#selection"), document.querySelector("#clear"));
