import type { AuditNote } from "./audit";
import type { Lang } from "./i18n";
import type { SessionUser } from "./session";

export type Bindings = {
  DB: D1Database;
  /** PBKDF2 iteration count for NEW password hashes. Workers Free = 10ms CPU/request,
   * so the default stays at 10000 (~4.5ms). Existing hashes keep their own count. */
  PBKDF2_ITERATIONS?: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    lang: Lang;
    user: SessionUser;
    perms: Set<string>;
    scopeAll: boolean;
    stateIds: number[];
    /** Home Cells the account's member list is limited to (empty = no limit). */
    homeCellIds: number[];
    /** Set by a route that knows more than the URL says (see src/audit.ts). */
    auditNote: AuditNote | undefined;
  };
};
