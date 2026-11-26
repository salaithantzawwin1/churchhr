import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { auditMutations } from "../src/audit";
import type { AppEnv } from "../src/env";

/** The middleware only needs the values a handler would already have set: the
 *  signed-in user (so the entry can name them) and nothing else. */
type User = AppEnv["Variables"]["user"];

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  c.set("lang", "en");
  c.set("user", { id: 1, username: "admin" } as unknown as User);
  c.set("perms", new Set<string>());
  c.set("scopeAll", true);
  c.set("stateIds", []);
  c.set("homeCellIds", []);
  c.set("auditNote", undefined);
  await next();
});
app.use("*", auditMutations());

// Stand-ins for real handlers: the middleware judges the response, not the work.
app.post("/members/1", (c) => c.redirect("/members/1?ok=member.updated", 302));
app.post("/members/2", (c) => c.redirect("/members/2?ok=member.updated", 302));
app.post("/members/bad", (c) => c.redirect("/members?err=val.name", 302));
app.post("/members/boom", (c) => c.json({ error: "boom" }, 400));
app.post("/members/teapot", (c) => c.json({ error: "teapot" }, 418));
app.get("/members/9", (c) => c.text("ok"));
app.post("/login", (c) => c.redirect("/", 302));

type Row = {
  action: string;
  entity: string | null;
  entity_id: string | null;
  status: number | null;
  method: string | null;
  path: string | null;
  username: string | null;
};

async function entries(): Promise<Row[]> {
  const { results } = await env.DB.prepare(
    "SELECT action, entity, entity_id, status, method, path, username FROM audit_log ORDER BY id",
  ).all<Row>();
  return results ?? [];
}

const post = (path: string) => app.request(path, { method: "POST" }, env);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM audit_log").run();
});

describe("auditMutations", () => {
  it("writes exactly one entry for a successful change", async () => {
    const res = await post("/members/1");
    expect(res.status).toBe(302);

    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "member.update",
      entity: "member",
      entity_id: "1",
      status: 302,
      method: "POST",
      path: "/members/1",
      username: "admin",
    });
  });

  it("does not log twice when a change is made twice", async () => {
    // One request, one entry: the middleware must not also record the route's
    // own audit row when the route writes one.
    await post("/members/1");
    await post("/members/2");
    const rows = await entries();
    expect(rows.map((r) => r.entity_id)).toEqual(["1", "2"]);
  });

  it("skips the app's ?err= bounce-backs", async () => {
    const res = await post("/members/bad");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("err=");
    expect(await entries()).toHaveLength(0);
  });

  it("skips error statuses", async () => {
    expect((await post("/members/boom")).status).toBe(400);
    expect((await post("/members/teapot")).status).toBe(418);
    expect(await entries()).toHaveLength(0);
  });

  it("ignores read-only methods", async () => {
    expect((await app.request("/members/9", { method: "GET" }, env)).status).toBe(200);
    expect(await entries()).toHaveLength(0);
  });

  it("names the entity a sign-in belongs to, not the action prefix", async () => {
    // login.success is stored as the session entity; the prefix alone would
    // record "login" and break the entity filter.
    await post("/login");
    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "login.success", entity: "session" });
  });
});
