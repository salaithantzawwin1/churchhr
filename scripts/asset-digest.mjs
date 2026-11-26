/**
 * The digest that ends ASSET_V, in one place.
 *
 * It hashes the files listed in src/versioned-assets.json, which is the same
 * list src/views/layout.tsx renders its `?v=ASSET_V` links from, so an asset
 * cannot be linked without being versioned and neither side can drift.
 * scripts/asset-version.mjs writes ASSET_V from this digest and
 * checks/asset-version.test.ts recomputes it, so a change without the bump fails
 * `npm test`. It reads files from disk, which is why that test runs in the node
 * project rather than in workerd.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ASSET_LIST = "src/versioned-assets.json";

/**
 * sha256 over the versioned files, first 8 hex characters. Paths and NUL
 * separators keep one file's bytes out of the next, CRLF is normalised so a
 * Windows checkout hashes like the Linux one, and the files are hashed in path
 * order so moving a link around never moves the version.
 */
export function assetDigest(root = process.cwd()) {
  const { stylesheets, scripts } = JSON.parse(readFileSync(join(root, ASSET_LIST), "utf8"));
  const hash = createHash("sha256");
  for (const file of [...stylesheets, ...scripts].map((asset) => asset.file).sort()) {
    const path = join(root, file);
    if (!existsSync(path)) throw new Error(`${ASSET_LIST} versions ${file}, which does not exist.`);
    hash.update(`${file}\0`);
    hash.update(readFileSync(path, "utf8").replace(/\r\n/g, "\n"));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 8);
}
