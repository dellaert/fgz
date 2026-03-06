import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const npmCli = process.env.npm_execpath;

function run(command, args, cwd) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: "pipe"
    });
  } catch (error) {
    const stdout = error && typeof error === "object" && "stdout" in error ? error.stdout : "";
    const stderr = error && typeof error === "object" && "stderr" in error ? error.stderr : "";
    const details = [stdout, stderr]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .join("\n");

    throw new Error(details || `command failed: ${command} ${args.join(" ")}`);
  }
}

function runNpm(args, cwd) {
  if (npmCli) {
    return run(process.execPath, [npmCli, ...args], cwd);
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return run(npmCommand, args, cwd);
}

function moveFile(sourcePath, destinationPath) {
  try {
    renameSync(sourcePath, destinationPath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EXDEV") {
      copyFileSync(sourcePath, destinationPath);
      rmSync(sourcePath, { force: true });
      return;
    }
    throw error;
  }
}

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "fgz-package-"));
const packDir = join(tempRoot, "pack");
const consumerDir = join(tempRoot, "consumer");

try {
  mkdirSync(packDir);
  mkdirSync(consumerDir);

  const packOutput = runNpm(["pack"], repoRoot);
  const tarballName = packOutput
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".tgz"))
    .at(-1);

  if (!tarballName) {
    throw new Error("npm pack did not produce a tarball");
  }

  const producedTarballPath = join(repoRoot, tarballName);
  const tarballPath = join(packDir, tarballName);
  moveFile(producedTarballPath, tarballPath);

  runNpm(["init", "-y"], consumerDir);
  runNpm(["install", "--save-dev", tarballPath], consumerDir);

  const installedCli = join(consumerDir, "node_modules", "fgz", "packages", "fgz-cli", "dist", "fgz2svg.js");
  const installedCore = join(consumerDir, "node_modules", "fgz", "packages", "fgz-core", "dist", "index.js");
  const installedTikz = join(consumerDir, "node_modules", "fgz", "tikz", "fgz.tikz.tex");

  for (const requiredPath of [installedCli, installedCore, installedTikz]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`packed install is missing ${requiredPath}`);
    }
  }

  const inputPath = join(consumerDir, "sample.fgz");
  writeFileSync(
    inputPath,
    `fgz 1
variable x_0 (0, 0)
variable x_1 (2, 0)
factor {x_0, x_1}
`,
    "utf8"
  );

  runNpm(["exec", "--", "fgz2tex", inputPath], consumerDir);
  runNpm(["exec", "--", "fgz2svg", inputPath], consumerDir);

  const texPath = `${inputPath}.tex`;
  const svgPath = join(consumerDir, "sample.svg");

  if (!existsSync(texPath)) {
    throw new Error(`fgz2tex did not create ${texPath}`);
  }

  if (!existsSync(svgPath)) {
    throw new Error(`fgz2svg did not create ${svgPath}`);
  }

  const svg = readFileSync(svgPath, "utf8");
  if (!svg.includes("<svg")) {
    throw new Error("fgz2svg output is not an SVG document");
  }

  console.log(`package install smoke test passed for ${resolve(tarballPath)}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
