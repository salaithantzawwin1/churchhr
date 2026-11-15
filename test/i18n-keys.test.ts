import { describe, expect, it } from "vitest";
import { FLASH_KEYS } from "../src/flash";
import { EN, MM } from "../src/i18n";
import { KO } from "../src/i18n.ko";

/** A lookup whose key no dictionary defines is shown to the user as the key
 *  itself ("photo.badType", "flash.errInvalid"), and a key present in one
 *  language but not another silently changes language mid-sentence. So every
 *  code a route can put in a banner, a form error or a redirect has to resolve
 *  in all three dictionaries.
 *
 *  The keys are read from the source text at build time: a new `msg("val.x")`
 *  or a new `adm.*` error added to a route is covered without touching this
 *  file. */

const DICTS = { mm: MM, en: EN, kr: KO } as const;
type DictLang = keyof typeof DICTS;
const LANGS = Object.keys(DICTS) as DictLang[];

const sources = import.meta.glob("../src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Dictionaries do not "use" keys; only the code that renders them counts. */
const CODE_SOURCES = Object.entries(sources)
  .filter(([path]) => !path.endsWith("i18n.ts") && !path.endsWith("i18n.ko.ts"))
  .map(([, text]) => text);

const CODE_TEXT = CODE_SOURCES.join("\n");

function missingIn(key: string): DictLang[] {
  return LANGS.filter((lang) => !(key in DICTS[lang]));
}

/** Admin create/edit pages redirect and re-render with these keys directly. */
function adminKeysInSource(): string[] {
  const matches = CODE_TEXT.matchAll(/"adm\.[A-Za-z0-9_]+"/g);
  return [...new Set([...matches].map((m) => m[0].slice(1, -1)))].sort();
}

/** Validator and import messages, e.g. msg("val.name") / td("hh.val.phone");
 *  a message outside the dictionaries is rendered verbatim. */
function messageKeysInSource(): string[] {
  const keys = new Set<string>();
  const call = /\b(?:msg|td|translate)\(\s*"([A-Za-z][A-Za-z0-9_.]*)"/g;
  for (const m of CODE_TEXT.matchAll(call)) {
    const key = m[1]!;
    if (/^(val|imp|photo|hh\.val|flash|adm)\./.test(key)) keys.add(key);
  }
  return [...keys].sort();
}

describe("i18n keys", () => {
  it("defines every flash code's dictionary key in all three languages", () => {
    const missing = Object.entries(FLASH_KEYS)
      .map(([code, key]) => ({ code, key, langs: missingIn(key) }))
      .filter((row) => row.langs.length > 0);
    expect(missing, `flash codes with an untranslated key: ${JSON.stringify(missing)}`).toEqual([]);
  });

  it("defines every admin error key used in the source in all three languages", () => {
    const keys = adminKeysInSource();
    // Guard the extractor itself: an empty list would make this test vacuous.
    expect(keys.length).toBeGreaterThan(20);
    const missing = keys
      .map((key) => ({ key, langs: missingIn(key) }))
      .filter((row) => row.langs.length > 0);
    expect(missing, `admin keys without a dictionary entry: ${JSON.stringify(missing)}`).toEqual([]);
  });

  it("defines every validator and message key used in the source in all three languages", () => {
    const keys = messageKeysInSource();
    expect(keys).toContain("val.name");
    expect(keys.length).toBeGreaterThan(20);
    const missing = keys
      .map((key) => ({ key, langs: missingIn(key) }))
      .filter((row) => row.langs.length > 0);
    expect(missing, `message keys without a dictionary entry: ${JSON.stringify(missing)}`).toEqual([]);
  });

  it("keeps the three dictionaries on the same key set", () => {
    const gaps: Record<string, string[]> = {};
    for (const lang of LANGS) {
      const others = LANGS.filter((other) => other !== lang);
      const missing = [...new Set(others.flatMap((other) => Object.keys(DICTS[other])))]
        .filter((key) => !(key in DICTS[lang]))
        .sort();
      if (missing.length > 0) gaps[lang] = missing;
    }
    expect(gaps, `keys missing from a dictionary: ${JSON.stringify(gaps)}`).toEqual({});
  });
});
