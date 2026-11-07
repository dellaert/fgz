import { execFileSync } from "node:child_process";
import { cp } from "node:fs/promises";

export async function buildManual() {
  const prefix = (process.env.SITE_BASE_PATH ?? "").replace(/\/+$/, "");
  // Invoked by npm run build:site. Using the npm CLI path also works on Windows.
  execFileSync(process.execPath, [process.env.npm_execpath, "exec", "--yes", "--package=mystmd@1.12.0", "--", "myst", "build", "--html"], {
    env: { ...process.env, BASE_URL: `${prefix}/manual` },
    stdio: "inherit"
  });
  await cp("_build/html", "_site/manual", { recursive: true });
}
