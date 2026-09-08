import path from "node:path";
import { defineConfig } from "vitest/config";

import { testDatabaseUrl } from "./tests/test-database.ts";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    // Integration tests share one Postgres database; running files one at a time keeps them isolated.
    fileParallelism: false,
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      TEST_DATABASE_URL: testDatabaseUrl(),
    },
  },
});
