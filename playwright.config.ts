import { defineConfig } from "@playwright/test"

const baseURL = "http://127.0.0.1:3196"

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { baseURL, channel: process.env.WEDPLAN_TEST_BROWSER, trace: "retain-on-failure" },
  webServer: [{
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3196",
    url: baseURL + "/vendor/subscription",
    env: { NEXT_PUBLIC_API_URL: baseURL },
    timeout: 120_000,
  }, {
    command: "npm exec -- next dev tests/fixtures/uploader --hostname 127.0.0.1 --port 3195",
    url: "http://127.0.0.1:3195",
    env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:3195" },
    timeout: 120_000,
  }],
})
