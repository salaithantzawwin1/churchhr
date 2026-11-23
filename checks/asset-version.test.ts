import { describe, expect, it } from "vitest";
import { ASSET_V } from "../src/assets";
import { assetDigest } from "../scripts/asset-digest.mjs";

/**
 * Browsers keep every asset the layout links under `?v=ASSET_V` for a year (the
 * Worker even sends `immutable`), so a release that changes one of them without
 * changing that URL is invisible to anyone who has visited before: the stale
 * position-sheet footer and dead tabs both came back that way. ASSET_V ends in
 * their digest, recomputed here through the same call `npm run assets:version`
 * uses, so forgetting the bump fails `npm test` and therefore CI.
 *
 * The asset list comes from src/views/layout.tsx, so adding a link needs no
 * change here; a link without a source file throws from the digest. This runs in
 * the node project because reading files needs node; the Worker tests run in
 * workerd.
 */

describe("static asset version", () => {
  it("carries the digest of every asset the layout versions", () => {
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
