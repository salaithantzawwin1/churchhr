import { describe, expect, it } from "vitest";
import { MemberPositionForm } from "../src/views/members";

/**
 * The position sheet's tabs are switched by public/app.js, which finds the
 * panes from a scope around the tab bar. That scope is the only link between
 * the markup and the script: when the rule's info dot added a wrapper row
 * around the bar, the script looked in the wrapper, found no panes and every
 * area rendered at once (clicking a tab did nothing). Nothing caught it because
 * no test ever compared the two halves.
 *
 * These tests render the real form and read the real, served app.js, then check
 * that the element the script will look in actually holds the panes. A future
 * wrapper, a moved pane or a revert to a narrower lookup fails here instead of
 * shipping.
 */

/* The file the layout serves at /app.js?v=<ASSET_V>, read as text. */
const APP_SOURCE = Object.values(
  import.meta.glob("../public/app.js", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
)[0];

type El = { tag: string; attrs: Map<string, string>; parent: El | null; children: El[] };

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/** Just enough of an HTML tree for the attribute lookups below. The sheet has
 *  no script/style text and no foreign content, so a tag-level scan is exact. */
function parseHtml(html: string): El {
  const root: El = { tag: "#root", attrs: new Map(), parent: null, children: [] };
  const stack: El[] = [root];
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const [, closing, rawTag, rawAttrs, selfClosing] = match;
    const tag = rawTag.toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const attrs = new Map<string, string>();
    const attrRe = /([^\s=]+)(?:\s*=\s*"([^"]*)")?/g;
    let attr: RegExpExecArray | null;
    while ((attr = attrRe.exec(rawAttrs ?? ""))) {
      if (attr[1] === "/") continue;
      attrs.set(attr[1].toLowerCase(), attr[2] ?? "");
    }
    const el: El = { tag, attrs, parent: stack[stack.length - 1], children: [] };
    el.parent!.children.push(el);
    if (!selfClosing && !VOID.has(tag)) stack.push(el);
  }
  return root;
}

function* descendants(el: El): Generator<El> {
  for (const child of el.children) {
    yield child;
    yield* descendants(child);
  }
}

function withAttr(root: El, name: string): El[] {
  return [...descendants(root)].filter((el) => el.attrs.has(name));
}

function contains(outer: El, inner: El): boolean {
  for (let el: El | null = inner; el; el = el.parent) if (el === outer) return true;
  return false;
}

function nearestForm(el: El | null): El | null {
  for (let node = el; node; node = node.parent) if (node.tag === "form") return node;
  return null;
}

function formHtml(): string {
  const def = (id: number, scopeType: string, code: string, en: string) => ({
    id, scopeType, code, nameMyanmar: en, nameEnglish: en, nameKorean: null,
    parentCode: null, active: 1, sortOrder: id, allowMultiple: 0, minHolders: 1,
  });
  return String(MemberPositionForm({
    member: {
      id: 1, name: "Daw Mya Mya Aung", homeCell: "YGN_HTY2", homeCellId: 1,
      townshipId: 1, townshipName: "Hlaing Thar Yar", regionalChurchId: 1,
      regionName: "Yangon", departmentId: 1,
    },
    assignments: {
      homeCell: "home_cell_leader", township: "", cluster: "", clusterId: null,
      region: "", regionId: 1, department: "", departmentId: null,
      memberDepartmentId: 1, church: "", churchId: null,
    },
    departments: [{ id: 1, name: "Women's Department", nameEn: "Women's Department", active: 1, sortOrder: 1, regionalChurchId: null }],
    positionDefs: [
      def(1, "home_cell", "home_cell_leader", "Home Cell Leader"),
      def(2, "home_cell", "home_cell_secretary", "Home Cell Secretary"),
      def(3, "township", "township_leader", "Township Leader"),
      def(4, "cluster", "cluster_leader", "Cluster Leader"),
      def(5, "region", "regional_secretary", "Regional Secretary"),
      def(6, "department", "department_head", "Department Head"),
      def(7, "church", "church_leader", "Church Leader"),
    ],
    regionalChurches: [{ id: 1, name: "Zion", nameEn: "Zion", regionId: 1, stateName: "Yangon", stateNameEn: "Yangon", active: 1, sortOrder: 1, isMain: 1 }],
    clusters: [{ id: 1, name: "Cluster A", nameEn: "Cluster A", regionId: 1, stateName: "Yangon", stateNameEn: "Yangon", active: 1, sortOrder: 1, cellCount: 3 }],
    canManageDepartments: false,
    canManagePositions: false,
    canManageRegional: false,
    initialTab: null,
    lang: "en",
  }));
}

/** The lookup public/app.js performs for the panes, read from the served script. */
function paneScope(bar: El, appSource: string): El {
  // Scoped to initTabs: other helpers in app.js also declare a `wrap`.
  const at = appSource.indexOf("function initTabs(root)");
  if (at < 0) {
    throw new Error("initTabs is gone from public/app.js; update test/position-tabs.test.ts.");
  }
  const expr = (appSource.slice(at).match(/var wrap = ([^;]+);/)?.[1] ?? "").replace(/\s+/g, " ").trim();
  if (expr === 'bar.closest("form") || bar.parentNode') {
    return nearestForm(bar) ?? (bar.parent as El);
  }
  if (expr === "bar.parentNode") return bar.parent as El;
  throw new Error(
    `public/app.js resolves tabs with "${expr}", which this test does not know. ` +
    `Update test/position-tabs.test.ts so the markup and the script stay in step.`,
  );
}

describe("position sheet tabs", () => {
  it("keeps every pane inside the scope the tab script looks in", () => {
    const root = parseHtml(formHtml());
    const bars = withAttr(root, "data-tabs");
    expect(bars).toHaveLength(1);
    const bar = bars[0];
    const scope = paneScope(bar, APP_SOURCE);

    const targets = withAttr(bar, "data-tab-target").map((b) => b.attrs.get("data-tab-target"));
    const panes = withAttr(root, "data-tab-pane");

    // Every tab needs its pane, and every pane needs its tab: the script hides
    // all panes that do not belong to the clicked tab.
    expect(targets.length).toBeGreaterThan(1);
    expect(new Set(targets).size).toBe(targets.length);
    expect(panes.map((p) => p.attrs.get("data-tab-pane")).sort()).toEqual([...targets].sort());

    // The whole point: the script must be able to reach them from the bar's
    // scope. A wrapper around the bar that leaves the panes outside it makes
    // clicking a tab do nothing while every area stays on screen.
    const unreachable = panes.filter((p) => !contains(scope, p)).map((p) => p.attrs.get("data-tab-pane"));
    expect(unreachable, `panes outside the tab bar's scope: ${unreachable.join(", ")}`).toEqual([]);
  });

  it("renders one pane per area tab", () => {
    const root = parseHtml(formHtml());
    const bar = withAttr(root, "data-tabs")[0];
    const targets = withAttr(bar, "data-tab-target").map((b) => b.attrs.get("data-tab-target"));
    expect(targets).toEqual(["home", "supervision", "regional", "department", "church"]);
    expect(withAttr(root, "data-tab-pane")).toHaveLength(targets.length);
  });
});
