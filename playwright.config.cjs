const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4174",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "PORT=4174 AGENT_CARDS_DB_PATH=/tmp/sipher-agent-cards-playwright.json npm start",
    url: "http://localhost:4174",
    reuseExistingServer: false,
    timeout: 10_000
  }
});
