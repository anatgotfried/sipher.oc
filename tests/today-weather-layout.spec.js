const { test, expect } = require("@playwright/test");
const { ensureDailyBrief, todayBriefId: cardId } = require("./workflow-fixtures.cjs");

const scenarios = [
  {
    key: "clear-day",
    asset: "weather_generated_clear_day.webp",
    weather: {
      tempC: 28,
      tempF: 82,
      unit: "C",
      title: "Clear day",
      text: "Bright and dry through the afternoon, with a light breeze.",
      location: "Sample City",
      condition: "clear",
      timeOfDay: "day",
      feelsLike: "29°C",
      wind: "10 km/h",
      humidity: "34%",
      rainChance: "0%"
    }
  },
  {
    key: "clear-evening",
    asset: "weather_generated_clear_evening.webp",
    weather: {
      tempC: 22,
      tempF: 72,
      unit: "C",
      title: "Clear evening",
      text: "Clear and comfortable after 17:30, with light wind and low rain risk.",
      location: "Sample City",
      condition: "clear",
      timeOfDay: "evening",
      feelsLike: "21°C",
      wind: "8 km/h",
      humidity: "47%",
      rainChance: "5%"
    }
  },
  {
    key: "cloudy-day",
    asset: "weather_generated_cloudy_day.webp",
    weather: {
      tempC: 19,
      tempF: 66,
      unit: "C",
      title: "Cloudy day",
      text: "Cooler and overcast, good for focused indoor work.",
      location: "Sample City",
      condition: "cloudy",
      timeOfDay: "day",
      feelsLike: "18°C",
      wind: "12 km/h",
      humidity: "61%",
      rainChance: "15%"
    }
  },
  {
    key: "rainy-day",
    asset: "weather_generated_rainy_day.webp",
    weather: {
      tempC: 16,
      tempF: 61,
      unit: "C",
      title: "Rainy day",
      text: "Showers are likely; keep travel buffers open and finish outside errands early.",
      location: "Sample City",
      condition: "rainy",
      timeOfDay: "day",
      feelsLike: "15°C",
      wind: "18 km/h",
      humidity: "82%",
      rainChance: "78%"
    }
  },
  {
    key: "stormy-evening",
    asset: "weather_generated_stormy_evening.webp",
    weather: {
      tempC: 14,
      tempF: 57,
      unit: "C",
      title: "Stormy evening",
      text: "Thunder risk later, so finish outside errands early.",
      location: "Sample City",
      condition: "stormy",
      timeOfDay: "evening",
      feelsLike: "13°C",
      wind: "26 km/h",
      humidity: "88%",
      rainChance: "86%"
    }
  },
  {
    key: "hazy-morning",
    asset: "weather_generated_hazy_morning.webp",
    weather: {
      tempC: 21,
      tempF: 70,
      unit: "C",
      title: "Hazy morning",
      text: "Soft haze clears slowly; visibility improves by late morning.",
      location: "Sample City",
      condition: "hazy",
      timeOfDay: "morning",
      feelsLike: "22°C",
      wind: "6 km/h",
      humidity: "55%",
      rainChance: "3%"
    }
  },
  {
    key: "snowy-day",
    asset: "weather_generated_snowy_day.webp",
    weather: {
      tempC: 1,
      tempF: 34,
      unit: "C",
      title: "Snowy day",
      text: "Snow is tapering off, but roads may stay slow.",
      location: "Sample City",
      condition: "snowy",
      timeOfDay: "day",
      feelsLike: "-2°C",
      wind: "14 km/h",
      humidity: "91%",
      rainChance: "64%"
    }
  }
];

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

test.describe.serial("Today weather card", () => {
  let originalMetadata;

  test.beforeAll(async ({ request }) => {
    const brief = await ensureDailyBrief(request);
    originalMetadata = brief.metadata;
  });

  test.afterAll(async ({ request }) => {
    if (!originalMetadata) return;
    await request.patch(`/api/cards/${cardId}`, { data: { metadata: originalMetadata } });
  });

  for (const scenario of scenarios) {
    for (const viewport of viewports) {
      test(`${scenario.key} fits on ${viewport.name}`, async ({ page, request }) => {
        const patchResponse = await request.patch(`/api/cards/${cardId}`, {
          data: {
            metadata: {
              ...originalMetadata,
              dailyBrief: {
                ...originalMetadata.dailyBrief,
                cards: (originalMetadata.dailyBrief.cards || []).map((card) =>
                  card.id === "weather"
                    ? { ...card, enabled: true, data: scenario.weather }
                    : card
                ),
                weather: scenario.weather
              }
            }
          }
        });
        expect(patchResponse.ok()).toBeTruthy();

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/?view=today&weather-test=${scenario.key}`);
        await page.locator(".today-weather-card").waitFor({ state: "visible" });

        const metrics = await page.evaluate(() => {
          const card = document.querySelector(".today-weather-card").getBoundingClientRect();
          const image = document.querySelector(".today-weather-card .weather-image");
          const chips = Array.from(document.querySelectorAll(".today-weather-card .weather-details li"))
            .map((node) => node.getBoundingClientRect());
          return {
            cardLeft: card.left,
            cardRight: card.right,
            cardTop: card.top,
            cardBottom: card.bottom,
            viewportWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            imageSrc: image?.getAttribute("src") || "",
            text: document.querySelector(".today-weather-card")?.innerText || "",
            chipsInsideCard: chips.every((chip) =>
              chip.left >= card.left
              && chip.right <= card.right
              && chip.top >= card.top
              && chip.bottom <= card.bottom
            )
          };
        });

        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
        expect(metrics.cardLeft).toBeGreaterThanOrEqual(0);
        expect(metrics.cardRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
        expect(metrics.imageSrc).toContain(scenario.asset);
        expect(metrics.text).toContain(scenario.weather.title);
        expect(metrics.text).toContain(scenario.weather.location);
        expect(metrics.text).toContain(`${scenario.weather.tempC}°C`);
        expect(metrics.chipsInsideCard).toBeTruthy();
      });
    }
  }
});
