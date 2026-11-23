import { describe, expect, it } from "vitest";
import { ASSET_V } from "../src/assets";
import { assetDigest, VERSIONED_ASSETS } from "../scripts/asset-digest.mjs";

/**
 * Browsers keep /app.js, /styles.css and the datepicker files under
 * `?v=ASSET_V` for a year (the Worker even sends `immutable`), so a release that
 * changes one of them without changing that URL is invisible to anyone who has
 * visited before: the stale position-sheet footer and dead tabs both came back
 * that way. ASSET_V ends in their digest, and this test recomputes it from disk
 * through scripts/asset-digest.mjs (the same call `npm run assets:version` uses),
 * so forgetting the bump fails `npm test` and therefore CI.
 *
 * It lives in the node project because reading files needs node; the Worker's
 * own tests run in workerd.
 */

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

  it("versions every file the layout links", () => {
    // A file linked with ?v=ASSET_V but missing here would ship stale forever.
    expect(VERSIONED_ASSETS).toEqual(
      expect.arrayContaining([
        "public/app.js",
        "src/styles.ts",
        "public/vendor/flowbite-datepicker/datepicker.css",
        "public/vendor/flowbite-datepicker/Datepicker.umd.js",
      ]),
    );
  });
});
