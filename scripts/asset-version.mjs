#!/usr/bin/env node
/**
 * Rewrites ASSET_V in src/assets.ts from the digest of the versioned assets.
 *
 * The layout links app.js, styles.css and the datepicker files as
 * `/file?v=ASSET_V`, and the Worker serves them as immutable for a year, so a
 * release that changes one of them without changing that URL leaves returning
 * browsers on the old copy (the position sheet's old footer and tab script kept
 * coming back this way). The version ends in the digest of those files and
 * checks/asset-version.test.ts fails when it does not match, so the bump cannot
 * be forgotten. Both use the file list and hashing in asset-digest.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assetDigest } from "./asset-digest.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const digest = assetDigest(root);

const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const version = `${today}-${digest}`;

const target = join(root, "src/assets.ts");
const source = readFileSync(target, "utf8");
const line = /export const ASSET_V = "[^"]*";/;
if (!line.test(source)) {
  console.error("src/assets.ts has no ASSET_V line to rewrite.");
  process.exit(1);
}
const next = source.replace(line, `export const ASSET_V = "${version}";`);
// Running twice in a day, or after a comment-only edit, leaves the value as it
// was; that is not a missing line, so do not report it as one.
if (next === source) {
  console.log(`ASSET_V already ${version}`);
} else {
  writeFileSync(target, next);
  console.log(`ASSET_V -> ${version}`);
}
