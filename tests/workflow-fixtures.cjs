const todayBriefId = "saas_morning_brief";

const dailyBriefMetadata = {
  dailyBrief: {
    greeting: {
      name: "Alex",
      salutation: "Good morning",
      subtitle: "Revenue is steady; one churn risk needs attention."
    },
    cards: [
      {
        id: "weather",
        enabled: true,
        data: {
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
        id: "priorities",
        enabled: true,
        data: {
          items: [
            {
              title: "Send churn-risk check-in",
              summary: "Acme Ops went quiet after onboarding. A personal note may restart usage before renewal.",
              dueDate: "2026-05-15"
            },
            {
              title: "Choose pricing experiment",
              summary: "Growth has three test paths ready. Pick one so the agent can use today's maker block.",
              dueDate: "2026-05-15"
            },
            {
              title: "Deploy billing export fix",
              summary: "The timezone patch is ready and low risk. Approval unblocks the billing export fix today.",
              dueDate: "2026-05-15"
            }
          ]
        }
      },
      {
        id: "newsfeed",
        enabled: true,
        data: {
          items: [
            {
              title: "Workflow news item",
              summary: "This fixture keeps the Today news card active in tests.",
              source: "Workflow Test",
              url: "https://example.com/workflow"
            }
          ]
        }
      }
    ]
  }
};

async function ensureDailyBrief(request) {
  const cardsResponse = await request.get("/api/cards");
  if (!cardsResponse.ok()) throw new Error(`Could not read cards: ${cardsResponse.status()}`);
  const db = await cardsResponse.json();
  const existing = db.cards.find((card) => card.id === todayBriefId);
  if (existing) return existing;

  const createResponse = await request.post("/api/cards", {
    data: {
      id: todayBriefId,
      type: "briefing",
      title: "Founder morning brief",
      summary: "Daily brief, active decisions, and open loops for today.",
      project: "Daily Brief",
      priority: "medium",
      agent: { id: "daily-brief-agent", name: "Daily Brief Agent" },
      actions: ["archive"],
      metadata: dailyBriefMetadata
    }
  });
  if (!createResponse.ok()) throw new Error(`Could not create daily brief: ${createResponse.status()} ${await createResponse.text()}`);
  return (await createResponse.json()).card;
}

module.exports = {
  dailyBriefMetadata,
  ensureDailyBrief,
  todayBriefId
};
