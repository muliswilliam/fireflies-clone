import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// Override with E2E_PORT when something else already listens on 3000.
const port = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  // Seeds the Sample Meetings the specs browse, exactly as the Docker entrypoint does.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI runs `pnpm build` first so e2e exercises the production server.
    command: isCI ? `pnpm start --port ${port}` : `pnpm dev --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    // A high cap so repeated local e2e runs against the same database never hit it.
    // Fault injection lets a Meeting title make one provider call fail (src/lib/ai/fault-injection.ts).
    env: {
      AI_PROVIDER: "fake",
      MAX_MEETINGS_PER_DAY: "1000",
      E2E_FAULT_INJECTION: "1",
    },
  },
});
