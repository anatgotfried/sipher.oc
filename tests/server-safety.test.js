const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const serverRoot = path.resolve(__dirname, "..");

async function startServer(initialDb, envExtra = {}) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-cards-safety-"));
  const dbPath = path.join(temp, "cards.json");
  if (initialDb) await fs.writeFile(dbPath, `${JSON.stringify(initialDb)}\n`);
  const port = 46000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: serverRoot,
    env: { ...process.env, PORT: String(port), AGENT_CARDS_DB_PATH: dbPath, ...envExtra },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 5000);
    child.stdout.once("data", () => { clearTimeout(timer); resolve(); });
    child.once("error", reject);
  });
  return { child, temp, base: `http://127.0.0.1:${port}` };
}

async function stopServer(instance) {
  instance.child.kill();
  await fs.rm(instance.temp, { recursive: true, force: true });
}

async function request(instance, pathname, options) {
  const response = await fetch(instance.base + pathname, options);
  return { response, body: await response.json() };
}

test("rejects unsupported actions, bad options, and missing answers", async (t) => {
  const instance = await startServer();
  t.after(() => stopServer(instance));
  const card = { type: "question", title: "Question", project: "Tests", priority: "low", agent: { id: "test", name: "Test" }, actions: ["answer"], input: { placeholder: "Answer" } };
  const created = await request(instance, "/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(card) });
  assert.equal(created.response.status, 201);
  const id = created.body.card.id;
  let result = await request(instance, `/api/cards/${id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send" }) });
  assert.equal(result.response.status, 400);
  result = await request(instance, `/api/cards/${id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "answer", payload: {} }) });
  assert.equal(result.response.status, 400);

  const choice = await request(instance, "/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "choice", title: "Choice", project: "Tests", priority: "low", agent: { id: "test", name: "Test" }, options: [{ id: "yes", title: "Yes" }], actions: ["choose"] }) });
  result = await request(instance, `/api/cards/${choice.body.card.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "choose", payload: { optionId: "no" } }) });
  assert.equal(result.response.status, 400);
});

test("enforces approval revision and records reviewed snapshot", async (t) => {
  const instance = await startServer();
  t.after(() => stopServer(instance));
  const input = { type: "approval", title: "Approve", details: "Review this", project: "Tests", priority: "high", agent: { id: "test", name: "Test" }, actions: ["approve"] };
  const created = await request(instance, "/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const card = created.body.card;
  assert.equal(card.revision, 1);
  let result = await request(instance, `/api/cards/${card.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", revision: 0 }) });
  assert.equal(result.response.status, 409);
  result = await request(instance, `/api/cards/${card.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", revision: 1 }) });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.event.reviewedRevision, 1);
  assert.equal(result.body.event.reviewedSnapshot.revision, 1);
  result = await request(instance, `/api/cards/${card.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", revision: 1 }) });
  assert.equal(result.response.status, 409);
});

test("gates consequential custom actions and preserves edited email draft", async (t) => {
  const instance = await startServer();
  t.after(() => stopServer(instance));
  const input = { type: "email_approval", title: "Email", details: "Review", project: "Tests", priority: "high", agent: { id: "test", name: "Test" }, actions: [{ id: "dispatch", consequential: true }], metadata: { draft: { to: "a@example.com", subject: "Old", body: "Body" } } };
  const created = await request(instance, "/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const card = created.body.card;
  let result = await request(instance, `/api/cards/${card.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "dispatch" }) });
  assert.equal(result.response.status, 400);
  const email = { ...input, actions: ["send"] };
  const emailCreated = await request(instance, "/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(email) });
  result = await request(instance, `/api/cards/${emailCreated.body.card.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send", revision: 1, payload: { draft: { subject: "New" } } }) });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.event.reviewedSnapshot.metadata.draft.subject, "New");
});

test("serves only explicit public files and assets", async (t) => {
  const instance = await startServer();
  t.after(() => stopServer(instance));
  let response = await fetch(instance.base + "/package.json");
  assert.equal(response.status, 404);
  response = await fetch(instance.base + "/../server.js");
  assert.equal(response.status, 404);
  response = await fetch(instance.base + "/.git/config");
  assert.equal(response.status, 404);
  response = await fetch(instance.base + "/.env");
  assert.equal(response.status, 404);
  response = await fetch(instance.base + "/index.html");
  assert.equal(response.status, 200);
});

test("migrates legacy cards without a revision", async (t) => {
  const instance = await startServer({ cards: [{ id: "legacy", type: "status", title: "Legacy", project: "Tests", priority: "low", agent: { id: "test", name: "Test" } }], events: [], agents: [] });
  t.after(() => stopServer(instance));
  const result = await request(instance, "/api/cards/legacy");
  assert.equal(result.response.status, 200);
  assert.equal(result.body.card.revision, 1);
});

test("version stays responsive while slow Git is timed out and remains unknown", async (t) => {
  const bin = await fs.mkdtemp(path.join(os.tmpdir(), "agent-cards-git-"));
  const fakeGit = path.join(bin, "git");
  await fs.writeFile(fakeGit, "#!/bin/sh\nsleep 3\n", { mode: 0o755 });
  const instance = await startServer(null, { PATH: `${bin}:${process.env.PATH}` });
  t.after(async () => { await stopServer(instance); await fs.rm(bin, { recursive: true, force: true }); });
  const started = Date.now();
  const result = await request(instance, "/api/version");
  assert.ok(Date.now() - started < 1000);
  assert.equal(result.body.latest, false);
  assert.equal(result.body.git.known, false);
});
