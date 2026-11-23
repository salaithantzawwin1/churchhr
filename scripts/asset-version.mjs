#!/usr/bin/env node
/**
 * Rewrites ASSET_V in src/assets.ts from a digest of the versioned assets.
 *
 * The layout links app.js, styles.css and the datepicker files as
 * `/file?v=ASSET_V`, and the Worker serves them as immutable for a year, so a
 * release that changes one of them without changing that URL leaves returning
 * browsers on the old copy (the position sheet's old footer and tab script kept
 * coming back this way). The version now ends in the digest of those files and
 * test/asset-version.test.ts fails when it does not match, so the bump cannot
 * be forgotten.
 *
 * Keep the file list and the hashing below in step with that test.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every file whose bytes a browser keeps under `?v=ASSET_V`. */
const ASSET_FILES = [
  "public/app.js",
  "src/styles.ts",
  "public/vendor/flowbite-datepicker/datepicker.css",
  "public/vendor/flowbite-datepicker/Datepicker.umd.js",
];

const hash = createHash("sha256");
for (const file of ASSET_FILES) {
  // The name and a NUL keep a file from moving bytes into the next one; CRLF is
  // normalised so a Windows checkout hashes like the Linux one.
  hash.update(`${file}\0`);
  hash.update(readFileSync(join(root, file), "utf8").replace(/\r\n/g, "\n"));
  hash.update("\0");
}
const digest = hash.digest("hex").slice(0, 8);

const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const version = `${today}-${digest}`;

const target = join(root, "src/assets.ts");
const source = readFileSync(target, "utf8");
const next = source.replace(/export const ASSET_V = "[^"]*";/, `export const ASSET_V = "${version}";`);
if (next === source) {
  console.error("src/assets.ts has no ASSET_V line to rewrite.");
  process.exit(1);
}
writeFileSync(target, next);
console.log(`ASSET_V -> ${version}`);
