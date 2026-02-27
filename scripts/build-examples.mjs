import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const examplesDir = "examples";
const fgzFiles = readdirSync(examplesDir)
  .filter((name) => name.endsWith(".fgz"))
  .sort();

for (const file of fgzFiles) {
  execFileSync("node", ["packages/fgz-cli/dist/fgz2tex.js", join(examplesDir, file)], {
    stdio: "inherit"
  });
}

execFileSync(
  "pdflatex",
  ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", examplesDir, join(examplesDir, "examples.tex")],
  {
    stdio: "inherit"
  }
);
