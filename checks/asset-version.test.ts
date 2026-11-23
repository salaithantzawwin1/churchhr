import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ASSET_V } from "../src/assets";

/**
 * Browsers keep /app.js, /styles.css and the datepicker files under
 * `?v=ASSET_V` for a year (the Worker even sends `immutable`), so a release that
 * changes one of them without changing that URL is invisible to anyone who has
 * visited before: the stale position-sheet footer and dead tabs both came back
 * that way. ASSET_V ends in the digest of those files and this test recomputes
 * it from disk, so forgetting the bump fails `npm test` (and therefore CI).
 *
 * This runs in the node project because it reads files; the Worker's own tests
 * cannot. Mirrors scripts/asset-version.mjs, which writes the value.
 */

const VERSIONED_FILES = [
  "public/app.js",
  "src/styles.ts",
  "public/vendor/flowbite-datepicker/datepicker.css",
  "public/vendor/flowbite-datepicker/Datepicker.umd.js",
];

function assetDigest(): string {
  const hash = createHash("sha256");
  for (const file of VERSIONED_FILES) {
    // Names and NULs keep one file's bytes out of the next; CRLF is normalised
    // so a Windows checkout hashes like the Linux one.
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n"));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 8);
}

describe("static asset version", () => {
  it("carries the digest of the assets it versions", () => {
    const digest = assetDigest();
    expect(
      ASSET_V.endsWith(`-${digest}`),
      `ASSET_V is "${ASSET_V}" but the versioned assets hash to "${digest}". ` +
      "Run `npm run assets:version`, or a returning browser keeps the cached copy.",
    ).toBe(true);
  });

  it("keeps the date-hash shape the layout links use", () => {
    expect(ASSET_V).toMatch(/^\d{8}-[0-9a-f]{8}$/);
  });
});
