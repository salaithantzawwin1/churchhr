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
 * Throws when a link cannot be read, so a cache-busted asset cannot be missed.
 */
function versionedAssets(root = process.cwd()) {
  const layout = readFileSync(join(root, LAYOUT), "utf8");
  const urls = [...layout.matchAll(/`(\/[^`?]*)\?v=\$\{ASSET_V\}`/g)].map((match) => match[1]);
  const uses = layout.match(/\$\{ASSET_V\}/g)?.length ?? 0;
  if (urls.length === 0 || urls.length !== uses) {
    throw new Error(
      `${LAYOUT} interpolates ASSET_V ${uses} time(s) but ${urls.length} link(s) could be read. ` +
      "Write each versioned asset as `/path?v=${ASSET_V}` so it is included.",
    );
  }
  return urls.map((url) => ({ url, file: sourceFile(url) }));
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
