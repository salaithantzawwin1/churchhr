import { describe, expect, it } from "vitest";
import { splitCoverageRows } from "../src/views/organization";

describe("Home Cell coverage rows", () => {
  it("ranks the weakest coverage first and counts churches without Home Cells", () => {
    const rows = [
      { name: "Full", pct: 100, total: 4 },
      { name: "None", pct: 0, total: 3 },
      { name: "Half", pct: 50, total: 2 },
      { name: "Empty", pct: 0, total: 0 },
      { name: "Empty 2", pct: 0, total: 0 },
    ];
    const { ranked, withoutCells } = splitCoverageRows(rows);
    // Churches with no Home Cell carry no percentage at all, so they never
    // reach the chart: they are counted into a single line instead of 0/0 rows.
    expect(ranked.map((row) => row.name)).toEqual(["None", "Half", "Full"]);
    expect(withoutCells).toBe(2);
    expect(ranked.some((row) => row.total === 0)).toBe(false);
  });

  it("breaks ties on the bigger church, then on the name", () => {
    const { ranked } = splitCoverageRows([
      { name: "Bravo", pct: 0, total: 1 },
      { name: "Alpha", pct: 0, total: 1 },
      { name: "Big", pct: 0, total: 9 },
    ]);
    expect(ranked.map((row) => row.name)).toEqual(["Big", "Alpha", "Bravo"]);
  });
});
