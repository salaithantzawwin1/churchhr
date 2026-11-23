/** Cache-busting version for static assets in public/. It ends in the digest of
 * the versioned files (app.js, the stylesheet, the datepicker pair) because the
 * Worker serves them as immutable for a year: a changed file under an unchanged
 * version never reaches a returning browser. Run `npm run assets:version` after
 * changing any of them; test/asset-version.test.ts fails in CI when the value
 * and the files disagree. */
export const ASSET_V = "20261123-082b315f";
