const { test, expect } = require("@playwright/test");
const { ensureDailyBrief, todayBriefId } = require("./workflow-fixtures.cjs");

const workflowPrefix = `workflow_${Date.now()}`;
const agent = { id: "workflow-agent", name: "Workflow Agent" };

function card(overrides) {
  return {
    id: `${workflowPrefix}_${overrides.id}`,
    type: "status",
    title: "Workflow test card",
    summary: "Created by the workflow test.",
    project: "Workflow Tests",
    priority: "medium",
    agent,
    actions: [],
    ...overrides,
    id: `${workflowPrefix}_${overrides.id}`
  };
}

async function createCard(request, payload) {
  const response = await request.post("/api/cards", { data: payload });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).card;
}

async function deleteIfExists(request, id) {
  const response = await request.delete(`/api/cards/${id}`);
  if (![200, 404].includes(response.status())) {
    throw new Error(`Could not delete ${id}: ${response.status()} ${await response.text()}`);
  }
}

async function restoreDailyBrief(request, metadata) {
  if (!metadata) return;
  const response = await request.patch(`/api/cards/${todayBriefId}`, { data: { metadata } });
  expect(response.ok()).toBeTruthy();
}

test.describe.serial("agent workflow control", () => {
  let originalDailyBriefMetadata;
  const createdIds = [];

  test.beforeAll(async ({ request }) => {
    const brief = await ensureDailyBrief(request);
    originalDailyBriefMetadata = brief.metadata;
  });

  test.afterAll(async ({ request }) => {
    await restoreDailyBrief(request, originalDailyBriefMetadata);
    for (const id of createdIds.reverse()) {
      await deleteIfExists(request, id);
    }
  });

  test("agents can create multiple card types and users can act on them", async ({ page, request }) => {
    const dueToday = new Date();
    dueToday.setHours(18, 0, 0, 0);

    const approval = await createCard(request, card({
      id: "approval",
      type: "approval",
      title: "Approve workflow release note?",
      summary: "The agent wants to publish the release note today.",
      details: "Publish this exact note to the private changelog.",
      priority: "high",
      neededAt: dueToday.toISOString(),
      actions: ["approve", "request_changes", "archive"],
      metadata: {
        draft: {
          channel: "Private changelog",
          body: "Today card weather and workflow tests are ready."
        },
        risks: ["Visible to internal users"]
      }
    }));

    const choice = await createCard(request, card({
      id: "choice",
      type: "choice",
      title: "Choose workflow follow-up",
      summary: "The agent needs one path to continue.",
      neededAt: dueToday.toISOString(),
      actions: ["choose"],
      options: [
        { id: "ship", label: "Ship now", description: "Use the current local build." },
        { id: "hold", label: "Hold", description: "Wait for another visual pass." }
      ]
    }));

    const question = await createCard(request, card({
      id: "question",
      type: "question",
      title: "What should the agent call this workflow?",
      summary: "A short label is needed before saving the template.",
      neededAt: dueToday.toISOString(),
      actions: ["answer"],
      input: { label: "Workflow name", placeholder: "Morning ops" }
    }));

    const checklist = await createCard(request, card({
      id: "checklist",
      type: "checklist",
      title: "Workflow test checklist",
      summary: "The agent is tracking setup steps.",
      items: [
        { title: "Create cards", status: "done" },
        { title: "Verify Today routing", status: "in_progress" }
      ],
      metadata: { showProgress: true }
    }));

    createdIds.push(approval.id, choice.id, question.id, checklist.id);

    await page.goto("/?view=needs-me");
    await expect(page.getByText("Approve workflow release note?")).toBeVisible();
    await expect(page.getByText("Choose workflow follow-up")).toBeVisible();
    await expect(page.getByText("What should the agent call this workflow?")).toBeVisible();

    let response = await request.post(`/api/cards/${approval.id}/actions`, {
      data: { action: "request_changes", payload: { requestChanges: "Tighten the release note before publishing." } }
    });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).card.status).toBe("waiting_on_agent");

    response = await request.post(`/api/cards/${choice.id}/actions`, {
      data: { action: "choose", payload: { optionId: "ship" } }
    });
    expect(response.ok()).toBeTruthy();
    const choiceResult = await response.json();
    expect(choiceResult.card.status).toBe("responded");
    expect(choiceResult.event.option.label).toBe("Ship now");

    response = await request.post(`/api/cards/${question.id}/actions`, {
      data: { action: "answer", payload: { answer: "Morning workflow" } }
    });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).card.status).toBe("responded");

    response = await request.patch(`/api/cards/${checklist.id}`, {
      data: { progress: 100, status: "completed" }
    });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).card.progress).toBe(100);
  });

  test("agents can enable and disable Today native cards through the daily brief", async ({ page, request }) => {
    const metadata = {
      ...originalDailyBriefMetadata,
      dailyBrief: {
        ...originalDailyBriefMetadata.dailyBrief,
        greeting: {
          name: "Alex",
          salutation: "Good morning",
          subtitle: "Workflow test enabled only weather and news."
        },
        cards: [
          {
            id: "weather",
            enabled: true,
            data: {
              tempC: 16,
              tempF: 61,
              unit: "C",
              title: "Rainy day",
              text: "Showers are likely; keep travel buffers open.",
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
            id: "priorities",
            enabled: false,
            data: { items: [{ title: "Hidden priority", summary: "This should not render." }] }
          },
          {
            id: "newsfeed",
            enabled: true,
            data: {
              items: [
                {
                  title: "Workflow news item",
                  summary: "This confirms an agent can control the Today newsfeed.",
                  source: "Workflow Test",
                  url: "https://example.com/workflow"
                }
              ]
            }
          },
          { id: "email", enabled: false, data: { items: [{ subject: "Hidden email" }] } },
          { id: "calendar", enabled: false, data: { title: "Hidden calendar" } },
          { id: "openItems", enabled: false, data: { items: [{ title: "Hidden open item" }] } },
          { id: "focus", enabled: false, data: { title: "Hidden focus" } }
        ]
      }
    };

    const response = await request.patch(`/api/cards/${todayBriefId}`, { data: { metadata } });
    expect(response.ok()).toBeTruthy();

    await page.goto("/?view=today&workflow=today-toggle");
    await expect(page.getByText("Rainy day")).toBeVisible();
    await expect(page.getByText("Workflow news item")).toBeVisible();
    const cardOrder = await page.locator(".today-brief-card").evaluateAll((cards) =>
      cards.map((card) => Array.from(card.classList).find((className) => className !== "today-brief-card" && className.startsWith("today-") && className.endsWith("-card")))
    );
    expect(cardOrder[0]).toBe("today-weather-card");
    await expect(page.getByText("Top 3 priorities")).toHaveCount(0);
    await expect(page.getByText("Hidden priority")).toHaveCount(0);
    await expect(page.getByText("Hidden email")).toHaveCount(0);
    await expect(page.getByText("Hidden calendar")).toHaveCount(0);
  });

  test("agents can view and delete individual cards", async ({ page, request }) => {
    const removable = await createCard(request, card({
      id: "delete",
      title: "Remove this workflow card",
      summary: "This card should disappear after DELETE.",
      actions: ["archive"]
    }));
    createdIds.push(removable.id);

    let response = await request.get(`/api/cards/${removable.id}`);
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).card.title).toBe("Remove this workflow card");

    await page.goto("/?view=projects");
    await expect(page.getByText("Remove this workflow card")).toBeVisible();

    response = await request.delete(`/api/cards/${removable.id}`);
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).deleted).toBeTruthy();
    createdIds.splice(createdIds.indexOf(removable.id), 1);

    await page.reload();
    await expect(page.getByText("Remove this workflow card")).toHaveCount(0);

    response = await request.get(`/api/cards/${removable.id}`);
    expect(response.status()).toBe(404);
  });

  test("API rejects invalid agent payloads and unsafe action shapes", async ({ request }) => {
    let response = await request.post("/api/cards", {
      data: {
        id: `${workflowPrefix}_missing_agent`,
        type: "status",
        title: "Missing agent",
        summary: "This should fail.",
        project: "Workflow Tests",
        priority: "medium"
      }
    });
    expect(response.status()).toBe(400);
    let body = await response.json();
    expect(body.error).toBe("bad_request");
    expect(body.message).toContain("agent.id");

    response = await request.post("/api/cards", {
      data: {
        id: `${workflowPrefix}_missing_project`,
        type: "status",
        title: "Missing project",
        summary: "This should fail.",
        priority: "medium",
        agent
      }
    });
    expect(response.status()).toBe(400);
    body = await response.json();
    expect(body.message).toContain("project");

    response = await request.post("/api/cards", {
      data: {
        id: `${workflowPrefix}_bad_priority`,
        type: "status",
        title: "Bad priority",
        summary: "This should fail.",
        project: "Workflow Tests",
        priority: "urgent",
        agent
      }
    });
    expect(response.status()).toBe(400);
    body = await response.json();
    expect(body.message).toContain("priority");

    response = await request.post("/api/cards", {
      data: card({
        id: "bad_approval",
        type: "approval",
        title: "Approve mystery action?",
        summary: "No reviewable payload is provided.",
        actions: ["approve", "reject"]
      })
    });
    expect(response.status()).toBe(400);
    body = await response.json();
    expect(body.message).toContain("Approval cards");

    const duplicate = await createCard(request, card({
      id: "duplicate",
      title: "Duplicate id source",
      summary: "The second create should fail."
    }));
    createdIds.push(duplicate.id);

    response = await request.post("/api/cards", {
      data: card({
        id: "duplicate",
        title: "Duplicate id target",
        summary: "This should fail."
      })
    });
    expect(response.status()).toBe(400);
    body = await response.json();
    expect(body.message).toContain("already exists");

    const editable = await createCard(request, card({
      id: "request_changes_payload",
      type: "approval",
      title: "Approve payload validation?",
      summary: "Request changes must include the requested change.",
      details: "Review payload is present.",
      actions: ["request_changes"],
      metadata: { risks: ["Validation test"] }
    }));
    createdIds.push(editable.id);

    response = await request.post(`/api/cards/${editable.id}/actions`, {
      data: { action: "request_changes", payload: {} }
    });
    expect(response.status()).toBe(400);
    body = await response.json();
    expect(body.message).toContain("requestChanges");

    const invalidJsonResponse = await fetch("http://localhost:4174/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad json"
    });
    expect(invalidJsonResponse.status).toBe(400);
    body = await invalidJsonResponse.json();
    expect(body.message).toBe("Invalid JSON");
  });

  test("API protects missing and resolved cards", async ({ request }) => {
    let response = await request.get(`/api/cards/${workflowPrefix}_missing`);
    expect(response.status()).toBe(404);

    response = await request.delete(`/api/cards/${workflowPrefix}_missing`);
    expect(response.status()).toBe(404);

    const answerCard = await createCard(request, card({
      id: "resolved_guard",
      type: "question",
      title: "Resolved guard question",
      summary: "Once answered, this should reject another answer.",
      actions: ["answer"],
      input: { placeholder: "Answer" }
    }));
    createdIds.push(answerCard.id);

    response = await request.post(`/api/cards/${answerCard.id}/actions`, {
      data: { action: "answer", payload: { answer: "Done" } }
    });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).card.status).toBe("responded");

    response = await request.post(`/api/cards/${answerCard.id}/actions`, {
      data: { action: "answer", payload: { answer: "Again" } }
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe("card_resolved");

    response = await request.patch(`/api/cards/${answerCard.id}`, {
      data: { status: "viewed" }
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe("card_resolved");

    response = await request.post(`/api/cards/${answerCard.id}/actions`, {
      data: { action: "archive", payload: { source: "test" } }
    });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).card.status).toBe("archived");
  });
});
