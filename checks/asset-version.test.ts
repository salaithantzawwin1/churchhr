import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
 * The list comes from src/versioned-assets.json, which the layout renders from;
 * this runs in the node project because reading files needs node.
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

  it("refuses a listed asset that has no file", () => {
    const root = mkdtempSync(join(tmpdir(), "asset-digest-"));
    try {
      mkdirSync(join(root, "src"));
      writeFileSync(
        join(root, "src", "versioned-assets.json"),
        JSON.stringify({ stylesheets: [{ url: "/styles.css", file: "src/styles.ts" }], scripts: [] }),
      );
      expect(() => assetDigest(root)).toThrow(/versions src\/styles\.ts, which does not exist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
