import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "../verification/test-results/e2e.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5173/banner-studio/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--enable-unsafe-swiftshader",
        "--use-angle=swiftshader",
      ],
    },
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { viewport: { width: 1440, height: 1000 } },
    },
    { name: "chromium-mobile-emulation", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173/banner-studio/",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
