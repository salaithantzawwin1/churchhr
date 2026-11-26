import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/** Workers test harness: the Worker runs inside workerd with its real bindings,
 *  and every test file gets its own empty D1 database. The migrations are passed
 *  to the tests as a binding and applied in test/apply-migrations.ts, so tests
 *  always run against the schema production will have.
 *
 *  A second project runs plain node tests. They are the ones that can read the
 *  repository (checks/), which workerd cannot: the asset-version test hashes
 *  public/app.js and the stylesheet to prove ASSET_V was bumped with them. */
const workerPlugins = () =>
  cloudflareTest(async () => ({
    wrangler: { configPath: "./wrangler.jsonc" },
    miniflare: {
      bindings: { TEST_MIGRATIONS: await readD1Migrations(path.resolve("migrations")) },
    },
  }));

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [workerPlugins()],
        test: {
          name: "worker",
          include: ["test/**/*.test.ts"],
          // This file applies the migrations itself, from a pre-0040 schema, so
          // the shared all-migrations setup must not run first.
          exclude: ["test/migration-data.test.ts"],
          setupFiles: ["./test/apply-migrations.ts"],
        },
      },
      {
        plugins: [workerPlugins()],
        test: {
          name: "migration",
          include: ["test/migration-data.test.ts"],
        },
      },
      {
        test: {
          name: "repo",
          include: ["checks/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
