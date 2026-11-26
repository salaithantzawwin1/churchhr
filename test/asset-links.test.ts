import { describe, expect, it } from "vitest";
import { ASSET_V } from "../src/assets";
import versionedAssets from "../src/versioned-assets.json";
import { Layout } from "../src/views/layout";

/**
 * The layout and the digest share src/versioned-assets.json, so these tests
 * hold the two ends together: every listed asset is linked with the version, and
 * the page links nothing else with one. A hand-written `?v=` link (the way the
 * position sheet's stale footer shipped, and the reason the digest once parsed
 * the layout source) is reported here instead of quietly escaping the digest.
 */

const head = String(Layout({ title: "Assets" }));
const listed = [...versionedAssets.stylesheets, ...versionedAssets.scripts].map((asset) => `${asset.url}?v=${ASSET_V}`);

/** Versioned links in the markup that the list does not account for. */
function unlistedLinks(html: string): string[] {
  return (html.match(/[\w./-]+\?v=[^"']+/g) ?? []).filter((link) => !listed.includes(link));
}

describe("versioned asset links", () => {
  it("links every asset the list versions", () => {
    for (const link of listed) expect(head).toContain(link);
  });

  it("links no other asset with a version", () => {
    expect(unlistedLinks(head)).toEqual([]);
  });

  it("reports a versioned link the list does not have", () => {
    // The same check against markup of the shape a hand-edited tag would have.
    const handWritten = `<link rel="stylesheet" href="/logo.png?v=${ASSET_V}" />`;
    expect(unlistedLinks(handWritten)).toEqual([`/logo.png?v=${ASSET_V}`]);
    expect(unlistedLinks(handWritten.replace("/logo.png", "/app.js"))).toEqual([]);
  });
});
