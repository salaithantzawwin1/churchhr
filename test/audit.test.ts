import { describe, expect, it } from "vitest";
import { classify } from "../src/audit";
import { auditActionLabel } from "../src/views/audit";

describe("classify", () => {
  it("returns null for the root path", () => {
    expect(classify("POST", "/")).toBeNull();
  });

  it("classifies member routes and keeps the row id", () => {
    expect(classify("POST", "/members/new"))
      .toEqual({ action: "member.create", entity: "member", entityId: null });
    expect(classify("POST", "/members"))
      .toEqual({ action: "member.create", entity: "member", entityId: null });
    expect(classify("POST", "/members/42"))
      .toEqual({ action: "member.update", entity: "member", entityId: "42" });
    expect(classify("POST", "/members/42/delete"))
      .toEqual({ action: "member.delete", entity: "member", entityId: "42" });
    expect(classify("POST", "/members/42/position"))
      .toEqual({ action: "member.position", entity: "member", entityId: "42" });
    expect(classify("POST", "/members/42/photo"))
      .toEqual({ action: "member.photo", entity: "member", entityId: "42" });
    expect(classify("POST", "/members/import"))
      .toEqual({ action: "member.import", entity: "member", entityId: null });
    expect(classify("POST", "/members/bulk"))
      .toEqual({ action: "member.bulk", entity: "member", entityId: null });
  });

  it("treats a non-numeric segment as a create, not a record id", () => {
    // "new" is the create form; anything else non-numeric falls through to the
    // generic branch rather than claiming a row id that does not exist.
    expect(classify("POST", "/members/abc")).toEqual({
      action: "members.update",
      entity: "members",
      entityId: null,
    });
  });

  it("classifies report routes", () => {
    expect(classify("POST", "/reports"))
      .toEqual({ action: "report.create", entity: "report", entityId: null });
    expect(classify("POST", "/reports/7/review"))
      .toEqual({ action: "report.review", entity: "report", entityId: "7" });
    expect(classify("POST", "/reports/7/submit"))
      .toEqual({ action: "report.submit", entity: "report", entityId: "7" });
    expect(classify("POST", "/reports/7/edit"))
      .toEqual({ action: "report.update", entity: "report", entityId: "7" });
    expect(classify("POST", "/reports/7/delete"))
      .toEqual({ action: "report.delete", entity: "report", entityId: "7" });
  });

  it("classifies admin families by their record type", () => {
    expect(classify("POST", "/admin/users/new"))
      .toEqual({ action: "user.create", entity: "user", entityId: null });
    expect(classify("POST", "/admin/users/5"))
      .toEqual({ action: "user.update", entity: "user", entityId: "5" });
    expect(classify("POST", "/admin/users/5/delete"))
      .toEqual({ action: "user.delete", entity: "user", entityId: "5" });
    expect(classify("POST", "/admin/users/5/password"))
      .toEqual({ action: "user.password", entity: "user", entityId: "5" });
    expect(classify("POST", "/admin/households/9"))
      .toEqual({ action: "household.update", entity: "household", entityId: "9" });
    expect(classify("POST", "/admin/age-groups"))
      .toEqual({ action: "age_group.create", entity: "age_group", entityId: null });
  });

  it("classifies organization routes, including pastor history", () => {
    expect(classify("POST", "/organization/pastors"))
      .toEqual({ action: "pastor.create", entity: "pastor", entityId: null });
    expect(classify("POST", "/organization/pastors/3"))
      .toEqual({ action: "pastor.update", entity: "pastor", entityId: "3" });
    expect(classify("POST", "/organization/pastors/3/photo"))
      .toEqual({ action: "pastor.photo", entity: "pastor", entityId: "3" });
    expect(classify("POST", "/organization/pastors/3/history"))
      .toEqual({ action: "pastor.history.create", entity: "pastor", entityId: "3" });
    expect(classify("POST", "/organization/pastors/3/history/11"))
      .toEqual({ action: "pastor.history.update", entity: "pastor", entityId: "3" });
    expect(classify("POST", "/organization/pastors/3/history/11/delete"))
      .toEqual({ action: "pastor.history.delete", entity: "pastor", entityId: "3" });
    expect(classify("POST", "/organization/home-cells/4"))
      .toEqual({ action: "home_cell.update", entity: "home_cell", entityId: "4" });
  });

  it("names the entity a login and a profile save really belong to", () => {
    // The action prefix is not the entity here: login.success is a session and
    // account.update is a user, which is why the middleware prefers the
    // classified entity over action.split(".")[0].
    expect(classify("POST", "/login"))
      .toEqual({ action: "login.success", entity: "session", entityId: null });
    expect(classify("POST", "/logout"))
      .toEqual({ action: "session.logout", entity: "session", entityId: null });
    expect(classify("POST", "/profile"))
      .toEqual({ action: "account.update", entity: "user", entityId: null });
  });

  it("falls back to the route for anything unrecognised", () => {
    expect(classify("POST", "/widgets/12"))
      .toEqual({ action: "widgets.update", entity: "widgets", entityId: "12" });
    expect(classify("PUT", "/widgets/12"))
      .toEqual({ action: "widgets.put", entity: "widgets", entityId: "12" });
  });
});

describe("auditActionLabel", () => {
  /** Identity dictionary: the label must be built from keys, not the raw action. */
  const t = (key: string) => key;

  it("labels sign-in rows instead of showing the raw action key", () => {
    // Regression: login.* has no ENTITY_KEYS entry of its own, so these rows used
    // to render "login.success" verbatim next to translated rows.
    expect(auditActionLabel(t, "login.success")).toBe("audit.g.signins · audit.v.success");
    expect(auditActionLabel(t, "login.failed")).toBe("audit.g.signins · audit.v.failed");
    expect(auditActionLabel(t, "login.locked")).toBe("audit.g.signins · audit.v.locked");
  });

  it("gives a sign-out its own label", () => {
    // Regression: the session prefix is the sign-in's name, so a logout row used
    // to read "Sign-in · signed out" next to the sign-in rows.
    expect(auditActionLabel(t, "session.logout")).toBe("audit.e.signOut");
  });

  it("labels ordinary entity actions", () => {
    expect(auditActionLabel(t, "member.update")).toBe("audit.e.member · audit.v.update");
    expect(auditActionLabel(t, "household.photo")).toBe("audit.e.household · audit.v.photo");
  });

  it("labels pastor history verbs", () => {
    expect(auditActionLabel(t, "pastor.history.create"))
      .toBe("audit.e.pastor · audit.v.history audit.v.create");
    expect(auditActionLabel(t, "pastor.history.delete"))
      .toBe("audit.e.pastor · audit.v.history audit.v.delete");
  });

  it("shows an unknown action readably rather than hiding it", () => {
    expect(auditActionLabel(t, "widgets.frobnicate")).toBe("widgets.frobnicate");
  });
});
