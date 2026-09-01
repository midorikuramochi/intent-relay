/**
 * Deployment-time helper: inject a Chrome Origin Trial token as a
 * `<meta http-equiv="origin-trial">` tag into a built index.html.
 *
 * Token values are deployment configuration. They are provided per app via
 * `VITE_WEBMCP_ORIGIN_TRIAL_TOKEN` at build time and are never committed to
 * the repository. When no token is provided (local dev, tests, the
 * clean-checkout gate) the html is returned unchanged.
 */
const BASE64_TOKEN = /^[A-Za-z0-9+/=]+$/;

export function injectOriginTrialMeta(html: string, token: string | undefined): string {
  if (token === undefined || token === "") {
    return html;
  }
  if (!BASE64_TOKEN.test(token)) {
    throw new Error("origin trial token must be base64 (unexpected characters found)");
  }
  if (!html.includes("</head>")) {
    throw new Error("cannot inject origin trial meta: no </head> in html");
  }
  return html.replace(
    "</head>",
    `  <meta http-equiv="origin-trial" content="${token}" />\n  </head>`,
  );
}
