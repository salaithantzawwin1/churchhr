/**
 * What ASSET_V versions, and how it is hashed.
 *
 * The layout is the list: every asset the template serves as
 * `/path?v=${ASSET_V}` is read straight out of src/views/layout.tsx, so a new
 * link is picked up without touching this file, and a link the digest cannot
 * read is an error rather than a silent gap. scripts/asset-version.mjs writes
 * ASSET_V from this digest and checks/asset-version.test.ts recomputes it, so
 * the two cannot drift. It reads files from disk, which is why the test runs in
 * the node project rather than in workerd.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LAYOUT = "src/views/layout.tsx";

/** Where the bytes behind a linked URL live; the stylesheet is built from TS. */
function sourceFile(url) {
  return url === "/styles.css" ? "src/styles.ts" : `public${url}`;
}

/**
 * Every asset the layout links as `/path?v=${ASSET_V}`, as { url, file }.
 *
 * It reads the href/src attributes that mention ASSET_V rather than grepping
 * for the canonical spelling, so a link written another way (`"/app.js?v=" +
 * ASSET_V`, spaces inside the braces) is reported instead of silently left out
 * of the digest.
 */
function versionedAssets(root = process.cwd()) {
  const layout = readFileSync(join(root, LAYOUT), "utf8");
  const assets = [];
  // A JSX value runs to the end of the tag, so `${ASSET_V}` is not taken as its
  // closing brace the way a plain `\{[^}]*\}` would.
  for (const [, attribute] of layout.matchAll(/(?:href|src)=(\{[^>]*\}|"[^"]*")/g)) {
    if (!attribute.includes("ASSET_V")) continue;
    const linked = /^\{`(\/[^`?]+)\?v=\$\{ASSET_V\}`\}$/.exec(attribute);
    if (!linked) {
      throw new Error(
        `${LAYOUT} links ${attribute} with ASSET_V; write it as \`/path?v=\${ASSET_V}\` so the digest can read it.`,
      );
    }
    assets.push({ url: linked[1], file: sourceFile(linked[1]) });
  }
  if (assets.length === 0) throw new Error(`${LAYOUT} links no asset with ?v=\${ASSET_V}.`);
  // Sorted by file, not by where the link happens to sit: reordering the tags
  // changes nothing a browser can see, so it must not move ASSET_V and bust
  // every visitor's cache. Plain comparisons keep the order locale-free.
  return assets.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/**
 * The digest that ends ASSET_V: sha256 over the versioned files, first 8 hex
 * characters. Filenames and NUL separators keep one file's bytes out of the
 * next, and CRLF is normalised so a Windows checkout hashes like the Linux one.
 */
export function assetDigest(root = process.cwd()) {
  const hash = createHash("sha256");
  for (const { url, file } of versionedAssets(root)) {
    const path = join(root, file);
    if (!existsSync(path)) throw new Error(`Linked asset ${url} has no source at ${file}.`);
    hash.update(`${file}\0`);
    hash.update(readFileSync(path, "utf8").replace(/\r\n/g, "\n"));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 8);
}
