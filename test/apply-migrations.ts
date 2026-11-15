import { applyD1Migrations, env } from "cloudflare:test";

// Each test file starts with a private, empty D1 database; bring it up to the
// same schema production runs before any test seeds or queries it.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
