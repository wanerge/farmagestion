import { defineConfig, devices } from "@playwright/test";

const timeoutTotalMs = Number(process.env.E2E_TEST_TIMEOUT_MS ?? 180_000);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: timeoutTotalMs,
  expect: {
    timeout: 20_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
