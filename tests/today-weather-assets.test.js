const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "style.css"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));

const expectedWeatherAssets = {
  clear_morning: "weather_generated_clear_morning.webp",
  clear_day: "weather_generated_clear_day.webp",
  clear_evening: "weather_generated_clear_evening.webp",
  clear_night: "weather_generated_clear_evening.webp",
  cloudy_morning: "weather_generated_cloudy_day.webp",
  cloudy_day: "weather_generated_cloudy_day.webp",
  cloudy_evening: "weather_generated_cloudy_day.webp",
  cloudy_night: "weather_generated_cloudy_day.webp",
  rainy_morning: "weather_generated_rainy_day.webp",
  rainy_day: "weather_generated_rainy_day.webp",
  rainy_evening: "weather_generated_rainy_day.webp",
  rainy_night: "weather_generated_rainy_day.webp",
  stormy_morning: "weather_generated_stormy_evening.webp",
  stormy_day: "weather_generated_stormy_evening.webp",
  stormy_evening: "weather_generated_stormy_evening.webp",
  stormy_night: "weather_generated_stormy_evening.webp",
  hazy_morning: "weather_generated_hazy_morning.webp",
  hazy_day: "weather_generated_hazy_morning.webp",
  hazy_evening: "weather_generated_hazy_morning.webp",
  hazy_night: "weather_generated_hazy_morning.webp",
  snowy_morning: "weather_generated_snowy_day.webp",
  snowy_day: "weather_generated_snowy_day.webp",
  snowy_evening: "weather_generated_snowy_day.webp",
  snowy_night: "weather_generated_snowy_day.webp"
};

test("Today weather selector covers every condition and period with generated assets", () => {
  for (const [key, fileName] of Object.entries(expectedWeatherAssets)) {
    assert.match(appSource, new RegExp(`${key}: "/assets/generated/today/optimized/${fileName}"`));
  }
});

test("generated weather assets exist and are web-sized", () => {
  const uniqueFiles = new Set(Object.values(expectedWeatherAssets));
  for (const fileName of uniqueFiles) {
    const assetPath = path.join(root, "assets/generated/today/optimized", fileName);
    assert.equal(fs.existsSync(assetPath), true, `${fileName} should exist`);
    assert.ok(fs.statSync(assetPath).size > 10_000, `${fileName} should not be an empty placeholder`);
  }
});

test("weather condition normalization includes snow before generic fallbacks", () => {
  assert.match(appSource, /snow\|sleet\|flurr/);
  assert.match(appSource, /return "snowy"/);
});

test("mobile Today weather card is bounded by its grid container", () => {
  assert.match(styleSource, /\.view-today \.today-brief-grid,[\s\S]*?max-width: 100%;[\s\S]*?overflow: hidden;/);
  assert.match(styleSource, /\.view-today \.today-weather-card \{[\s\S]*?aspect-ratio: auto;[\s\S]*?max-width: 100%;/);
});

test("Home Screen install metadata points at Today and has icons", () => {
  assert.equal(manifest.name, "Sipher");
  assert.equal(manifest.short_name, "Sipher");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/?view=today");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.icons.some((icon) => icon.src === "/icon-192.png" && icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.src === "/icon-512.png" && icon.sizes === "512x512"));
  assert.match(indexSource, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
  assert.match(indexSource, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  for (const fileName of ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "manifest.webmanifest"]) {
    assert.equal(fs.existsSync(path.join(root, fileName)), true, `${fileName} should exist`);
  }
});
