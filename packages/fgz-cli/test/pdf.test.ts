import { describe, expect, it } from "vitest";
import { parseFgz } from "../../fgz-core/src/index.js";
import { renderDocumentToPdf } from "../src/pdf.js";

describe.sequential("renderDocumentToPdf", () => {
  it(
    "renders a basic fgz diagram to PDF",
    { timeout: 60_000 },
    () => {
      const pdf = renderDocumentToPdf(
        parseFgz(`fgz 1
variable x_0 (0, 0)
variable x_1 (2, 0)
factor {x_0, x_1}
`)
      );

      expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    }
  );

  it(
    "renders with an explicit TeX/TikZ preamble fragment when provided",
    { timeout: 60_000 },
    () => {
      const pdf = renderDocumentToPdf(
        parseFgz(`fgz 1
t = \\twist
variable t (0, 0)
`),
        {
          preambleSource: "\\newcommand{\\twist}{\\mathcal{V}}"
        }
      );

      expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    }
  );
});
