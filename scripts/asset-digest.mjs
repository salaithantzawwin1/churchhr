/**
 * The single definition of what ASSET_V versions and how it is hashed.
 *
 * scripts/asset-version.mjs writes the value from this, and
 * checks/asset-version.test.ts recomputes it with the same call, so the two
 * cannot drift apart and let a stale version pass the check. It reads files from
 * disk, which is why the test runs in the node project rather than in workerd.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Every file whose bytes a browser keeps under `?v=ASSET_V`. */
export const VERSIONED_ASSETS = [
  "public/app.js",
  "src/styles.ts",
  "public/vendor/flowbite-datepicker/datepicker.css",
  "public/vendor/flowbite-datepicker/Datepicker.umd.js",
];

/**
 * The digest that ends ASSET_V: sha256 over the versioned files, first 8 hex
 * characters. Filenames and NUL separators keep one file's bytes out of the
 * next, and CRLF is normalised so a Windows checkout hashes like the Linux one.
 */
export function assetDigest(root = process.cwd()) {
  const hash = createHash("sha256");
  for (const file of VERSIONED_ASSETS) {
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(root, file), "utf8").replace(/\r\n/g, "\n"));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 8);
}
