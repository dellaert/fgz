/** Bind an inline, semantically tagged TikZ SVG to its FGZ document and inspector controls. */
export function inspectGraph(svg, doc, details, clearButton) {
  const nodeTypes = { var: "Variable", known: "Known variable", node: "Bayes-net node", known_node: "Known Bayes-net node" };
  const declarations = new Map(doc.statements
    .filter(s => Object.hasOwn(nodeTypes, s.kind))
    .map(s => [s.name, s]));
  const factors = new Map(doc.statements
    .filter(s => s.kind === "factor")
    .map((s, i) => [`fgz_f${i + 1}`, s]));
  const markers = [...svg.querySelectorAll("[data-variable], [data-factor]")];
  const edges = [...svg.querySelectorAll("[data-factor-id], [data-parent][data-child]")];
  function factorName(id) {
    const number = id.slice("fgz_f".length);
    const { label } = factors.get(id);
    return label ? `Factor ${number} (${label})` : `Factor ${number}`;
  }

  let selected = null;

  function select(marker) {
    selected = marker;
    const variable = marker?.getAttribute("data-variable");
    const factor = marker?.getAttribute("data-factor");
    const activeVariables = new Set();
    const activeFactors = new Set();
    let description = "Select a variable or factor to inspect its connections.";
    if (variable != null) {
      const node = declarations.get(variable);
      activeVariables.add(variable);
      const parents = node.parents ?? [];
      const children = [...declarations.values()].filter(s => s.parents?.includes(variable)).map(s => s.name);
      for (const neighbor of [...parents, ...children]) activeVariables.add(neighbor);
      for (const [id, f] of factors) {
        if (!f.vars.includes(variable)) continue;
        activeFactors.add(id);
        for (const neighbor of f.vars) activeVariables.add(neighbor);
      }
      const connections = [
        parents.length && `Child of ${parents.join(", ")}.`,
        children.length && `Parent of ${children.join(", ")}.`,
        activeFactors.size && `Connected to ${[...activeFactors].map(factorName).join(", ")}.`
      ].filter(Boolean);
      description = `${nodeTypes[node.kind]} ${variable}. ${connections.join(" ") || "No connections."}`;
    } else if (factor != null) {
      activeFactors.add(factor);
      const endpoints = factors.get(factor).vars;
      for (const endpoint of endpoints) activeVariables.add(endpoint);
      description = `${factorName(factor)} connects ${endpoints.join(", ")}.`;
    }
    for (const item of markers) {
      const active = activeVariables.has(item.getAttribute("data-variable")) || activeFactors.has(item.getAttribute("data-factor"));
      item.classList.toggle("fgz-muted", !!marker && !active);
      item.setAttribute("aria-pressed", String(!!marker && item === marker));
    }
    for (const edge of edges) {
      const active = activeFactors.has(edge.getAttribute("data-factor-id")) ||
        (variable != null && (variable === edge.getAttribute("data-parent") || variable === edge.getAttribute("data-child")));
      edge.classList.toggle("fgz-muted", !!marker && !active);
    }
    details.textContent = description;
    clearButton.disabled = !marker;
  }

  details.setAttribute("role", "status");
  svg.classList.add("fgz-inspector");
  svg.setAttribute("role", "group");
  if (!svg.hasAttribute("aria-label") && !svg.hasAttribute("aria-labelledby")) svg.setAttribute("aria-label", "Interactive graph");
  const style = svg.ownerDocument.createElementNS(svg.namespaceURI, "style");
  style.textContent = `.fgz-inspector .fgz-muted { opacity: .25 }
.fgz-inspector [role="button"] { cursor: pointer }
.fgz-inspector [role="button"]:focus-visible, .fgz-inspector [aria-pressed="true"] { outline: 2px solid #1765a8; outline-offset: 2px }`;
  svg.append(style);
  for (const marker of markers) {
    const variable = marker.getAttribute("data-variable");
    const name = variable != null ? `${nodeTypes[declarations.get(variable).kind]} ${variable}` : factorName(marker.getAttribute("data-factor"));
    marker.setAttribute("role", "button");
    marker.setAttribute("tabindex", "0");
    marker.setAttribute("aria-label", name);
    const activate = () => select(marker === selected ? null : marker);
    marker.addEventListener("click", activate);
    marker.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) activate();
    });
  }
  svg.addEventListener("keydown", event => {
    if (event.key === "Escape") select(null);
  });
  clearButton.addEventListener("click", () => select(null));
  select(null);
}
