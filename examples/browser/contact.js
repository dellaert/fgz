import { parseFgz, renderFactorGraph, toFactorGraph } from "fgz/browser";
import source from "./contact.fgz";

const graph = toFactorGraph(parseFgz(source));
const menu = document.querySelector("select");
const host = document.querySelector("#graph");

for (const variable of graph.variables) {
  const option = new Option(variable.id, variable.id);
  menu.add(option);
}

const view = renderFactorGraph(host, graph, {
  onSelect(id) {
    menu.value = id;
  }
});
menu.onchange = () => view.setSelection(menu.value || null);
menu.value = "X_1";
view.setSelection(menu.value);
