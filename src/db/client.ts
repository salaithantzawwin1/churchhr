import { drizzle } from "drizzle-orm/d1";
import type { Bindings } from "../env";

export function getDb(env: Bindings) {
  return drizzle(env.DB);
}

export type DB = ReturnType<typeof getDb>;
