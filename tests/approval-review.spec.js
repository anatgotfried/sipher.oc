const { test, expect } = require("@playwright/test");

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`review and approve exact proposal at ${viewport.width}px`, async ({ page, request }, testInfo) => {
    await page.setViewportSize(viewport);
    const response = await request.post("/api/cards", { data: {
      type: "approval", title: "Review a release", priority: "high", project: "Review Tests",
      agent: { id: "review-test", name: "Review Agent" }, actions: ["approve", "reject"],
      metadata: { draft: { to: "reader@example.com", body: "Exact release text" },
        command: "publish --dry-run", diff: "+ reviewed change", risks: ["External recipient"] }
    }});
    const { card } = await response.json();
    try {
      await page.goto("/?view=needs-me");
      const tile = page.locator(`article[data-card-id="${card.id}"]`);
      await expect(tile.getByText("Exact release text", { exact: true })).toBeVisible();
      await expect(tile.getByText("publish --dry-run", { exact: true })).toBeVisible();
      await expect(tile.getByText("+ reviewed change", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path: testInfo.outputPath("approval-review.png"), fullPage: true });
      await tile.getByRole("button", { name: "Approve", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Exact release text", { exact: true })).toBeVisible();
      expect((await (await request.get(`/api/cards/${card.id}`)).json()).card.status).toBe("waiting");
      await dialog.getByRole("button", { name: "Approve", exact: true }).click();
      await expect.poll(async () => (await (await request.get(`/api/cards/${card.id}`)).json()).card.status).toBe("approved");
      await page.reload();
      expect((await (await request.get("/api/cards")).json()).events.filter(e => e.cardId === card.id && e.action === "approve")).toHaveLength(1);
    } finally { await request.delete(`/api/cards/${card.id}`); }
  });
}

test("a proposal changed during review cannot be approved", async ({ page, request }) => {
  const { card } = await (await request.post("/api/cards", { data: {
    type: "approval", title: "Changing proposal", priority: "high", project: "Review Tests",
    agent: { id: "review-test", name: "Review Agent" }, actions: ["approve", "reject"],
    metadata: { draft: { body: "Original proposal" } }
  }})).json();
  try {
    await page.goto("/?view=needs-me");
    const tile = page.locator(`article[data-card-id="${card.id}"]`);
    await tile.getByRole("button", { name: "Approve", exact: true }).click();
    await request.patch(`/api/cards/${card.id}`, { data: { metadata: { draft: { body: "Changed proposal" } } } });
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await expect(tile.getByRole("alert")).toContainText("changed");
    expect((await (await request.get(`/api/cards/${card.id}`)).json()).card.status).toBe("waiting");
    await expect(tile.getByText("Changed proposal", { exact: true })).toBeVisible();
    await tile.getByRole("button", { name: "Reject", exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/cards/${card.id}`)).json()).card.status).toBe("rejected");
  } finally { await request.delete(`/api/cards/${card.id}`); }
});


test("email approval records the edited draft shown in confirmation", async ({ page, request }) => {
  const { card } = await (await request.post("/api/cards", { data: {
    type: "email_approval", title: "Review edited email", priority: "high", project: "Review Tests",
    agent: { id: "review-test", name: "Review Agent" }, actions: ["send", "save_draft"],
    metadata: { draft: { to: "first@example.com", subject: "Review", body: "Original text" } }
  }})).json();
  try {
    await page.goto("/?view=needs-me");
    const tile = page.locator(`article[data-card-id="${card.id}"]`);
    await tile.getByLabel("Email recipient").fill("approved@example.com");
    await tile.getByLabel("Email body").fill("Approved edited text");
    await tile.getByRole("button", { name: "Send", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("approved@example.com", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Approved edited text", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/cards/${card.id}`)).json()).card.status).toBe("approved");
    const { events } = await (await request.get("/api/cards")).json();
    const event = events.find(e => e.cardId === card.id && e.action === "send");
    expect(event.reviewedSnapshot.metadata.draft).toEqual(event.payload.draft);
    expect(event.payload.draft.to).toBe("approved@example.com");
  } finally { await request.delete(`/api/cards/${card.id}`); }
});
