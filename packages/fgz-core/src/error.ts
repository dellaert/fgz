/** Domain error thrown by fgz-core operations. */
export class FgzError extends Error {
  readonly line: number | undefined;

  constructor(message: string, line?: number) {
    super(line === undefined ? message : `line ${line}: ${message}`);
    this.name = "FgzError";
    this.line = line;
  }
}
