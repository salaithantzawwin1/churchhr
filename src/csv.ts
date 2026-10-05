/** Minimal RFC4180 CSV parser/serializer (quotes, embedded commas/newlines). */

export function parseCsv(input: string): string[][] {
  const s = input.startsWith("\uFEFF") ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === "") { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function esc(value: string | number | null | undefined): string {
  const v = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Serializes rows to CSV text (CRLF line endings, no BOM — caller adds it). */
export function buildCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

/** Rows -> field record keyed by normalized header, using a header→key alias map. */
export function headerIndex(headers: string[], aliases: Record<string, string>): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, idx) => {
    const norm = h.toLowerCase().replace(/\s+/g, " ").trim();
    const key = aliases[norm];
    if (key && !map.has(key)) map.set(key, idx);
  });
  return map;
}
