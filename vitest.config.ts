import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/** Workers test harness: the Worker runs inside workerd with its real bindings,
 *  and every test file gets its own empty D1 database. The migrations are passed
 *  to the tests as a binding and applied in test/apply-migrations.ts, so tests
 *  always run against the schema production will have. */
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: { TEST_MIGRATIONS: await readD1Migrations(path.resolve("migrations")) },
      },
    })),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
