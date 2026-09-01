import { describe, expect, it } from "vitest";
import { injectOriginTrialMeta } from "./originTrialMeta";

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Intent Relay Workbench</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

// A structurally valid base64 stand-in; never a real token.
const FAKE_TOKEN = "QWxhZGRpbjpvcGVuIHNlc2FtZQ==";

describe("injectOriginTrialMeta", () => {
  it("returns the html unchanged when no token is provided", () => {
    expect(injectOriginTrialMeta(HTML, undefined)).toBe(HTML);
    expect(injectOriginTrialMeta(HTML, "")).toBe(HTML);
  });

  it("injects exactly one origin-trial meta tag into <head>", () => {
    const result = injectOriginTrialMeta(HTML, FAKE_TOKEN);
    const matches = result.match(/http-equiv="origin-trial"/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(result).toContain(`content="${FAKE_TOKEN}"`);
    expect(result.indexOf("origin-trial")).toBeLessThan(result.indexOf("</head>"));
  });

  it("rejects tokens with characters outside the base64 alphabet", () => {
    expect(() => injectOriginTrialMeta(HTML, 'abc"def')).toThrow(
      /origin trial token must be base64/i,
    );
    expect(() => injectOriginTrialMeta(HTML, "abc def")).toThrow(
      /origin trial token must be base64/i,
    );
    expect(() => injectOriginTrialMeta(HTML, "<script>")).toThrow(
      /origin trial token must be base64/i,
    );
  });

  it("fails loudly when the html has no closing head tag", () => {
    expect(() => injectOriginTrialMeta("<html><body></body></html>", FAKE_TOKEN)).toThrow(
      /<\/head>/,
    );
  });
});
