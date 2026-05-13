#!/usr/bin/env node
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "agent-cards.json");
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

async function ensureDb() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await writeDb({ cards: [], events: [], agents: [] });
  }
}

async function readDb() {
  await ensureDb();
  return JSON.parse(await fs.readFile(dbPath, "utf8"));
}

async function writeDb(db) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  json(res, 404, { error: "not_found" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeCard(input) {
  const time = now();
  return {
    id: input.id || id("card"),
    type: input.type || "status",
    title: input.title || "Untitled card",
    summary: input.summary || "",
    details: input.details || "",
    status: input.status || "waiting",
    priority: input.priority || "medium",
    project: input.project || "Inbox",
    agent: input.agent || { id: "local-agent", name: "Local Agent" },
    actions: normalizeActions(input.actions || []),
    options: input.options || [],
    input: input.input || null,
    items: input.items || [],
    progress: input.progress || 0,
    blocker: input.blocker || "",
    callbackUrl: input.callbackUrl || "",
    metadata: input.metadata || {},
    createdAt: input.createdAt || time,
    updatedAt: input.updatedAt || time
  };
}

function normalizeActions(actions) {
  const labels = {
    approve: "Approve",
    archive: "Archive",
    answer: "Answer",
    choose: "Choose",
    edit: "Edit",
    investigate: "Investigate",
    more_like_this: "More like this",
    pass: "Pass",
    reject: "Reject",
    send: "Send",
    view: "View"
  };
  const styles = {
    approve: "primary",
    send: "primary",
    more_like_this: "primary",
    reject: "danger"
  };
  return actions.map((action) => {
    if (typeof action === "string") {
      return {
        id: action,
        label: labels[action] || titleize(action),
        style: styles[action] || "neutral"
      };
    }
    if (!action || typeof action !== "object") return null;
    return {
      id: action.id || action.action || "respond",
      label: action.label || labels[action.id] || titleize(action.id || action.action || "respond"),
      style: action.style || styles[action.id] || "neutral"
    };
  }).filter(Boolean);
}

function titleize(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function nextStatus(action, card) {
  if (action === "archive") return "archived";
  if (action === "approve" || action === "send") return "approved";
  if (action === "reject") return "rejected";
  if (action === "edit" || action === "request_changes") return "edited";
  if (action === "answer" || action === "choose") return "responded";
  return card.status === "new" ? "viewed" : card.status;
}

async function postCallback(card, event) {
  if (!card.callbackUrl) return;
  try {
    await fetch(card.callbackUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ card, event })
    });
  } catch (error) {
    console.error(`Callback failed for ${card.id}: ${error.message}`);
  }
}

function demoCards() {
  const time = now();
  const hermes = { id: "hermes", name: "Hermes" };
  const openclaw = { id: "openclaw", name: "OpenClaw" };
  return [
    normalizeCard({
      id: "demo_send_email",
      type: "approval",
      title: "Send this email?",
      summary: "Hermes drafted an outreach email to a contractor lead.",
      details: "The email asks for availability, budget range, and portfolio examples. Sending is external, so it requires explicit approval.",
      priority: "high",
      project: "Contractor outreach",
      agent: hermes,
      actions: [
        { id: "send", label: "Send", style: "primary" },
        { id: "edit", label: "Edit", style: "neutral" },
        { id: "reject", label: "Reject", style: "danger" }
      ],
      createdAt: time,
      updatedAt: time
    }),
    normalizeCard({
      id: "demo_weekend",
      type: "choice",
      title: "Pick a weekend idea.",
      summary: "Hermes found 4 kid-friendly options within 90 minutes.",
      details: "Swipe or tap an option. Feedback is stored as structured preference data for the agent.",
      priority: "medium",
      project: "Family logistics",
      agent: hermes,
      options: [
        { id: "farm", title: "Morning farm visit", description: "Animals, shade, 42 min drive" },
        { id: "science", title: "Science museum", description: "Indoor, hands-on, near lunch" },
        { id: "forest", title: "Forest picnic", description: "Short trail and playground" },
        { id: "beach", title: "Sunset beach walk", description: "Low effort, best after 17:00" }
      ],
      actions: [
        { id: "more_like_this", label: "More like this", style: "primary" },
        { id: "pass", label: "Pass", style: "neutral" }
      ]
    }),
    normalizeCard({
      id: "demo_question",
      type: "question",
      title: "What budget should I assume?",
      summary: "OpenClaw needs a budget ceiling before comparing hosting options.",
      details: "A short answer is enough. Example: under $25/month unless traffic spikes.",
      priority: "medium",
      project: "Agent Cards",
      agent: openclaw,
      input: { kind: "short_text", placeholder: "Budget ceiling" },
      actions: []
    }),
    normalizeCard({
      id: "demo_status",
      type: "status",
      title: "MVP build status",
      summary: "Static app shell is being replaced with a local API, card feed, and agent CLI.",
      details: "The next step is browser verification and README setup.",
      priority: "low",
      project: "Agent Cards",
      agent: openclaw,
      progress: 62,
      blocker: "No blocker",
      actions: [
        { id: "investigate", label: "Investigate", style: "neutral" },
        { id: "approve", label: "Looks good", style: "primary" }
      ]
    }),
    normalizeCard({
      id: "demo_briefing",
      type: "briefing",
      title: "Morning agent brief",
      summary: "Three things need attention before 10:00.",
      details: "A compact stack for recurring daily agent summaries.",
      priority: "medium",
      project: "Daily brief",
      agent: hermes,
      items: [
        "One contractor reply needs a send/no-send decision.",
        "Calendar has a 30-minute conflict at 09:30.",
        "Agent Cards local API is ready for first integration tests."
      ],
      actions: [
        { id: "investigate", label: "Investigate", style: "primary" },
        { id: "archive", label: "Archive", style: "neutral" }
      ]
    })
  ];
}

async function handleApi(req, res, url) {
  const db = await readDb();
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, cards: db.cards.length, events: db.events.length });
  }

  if (req.method === "GET" && url.pathname === "/api/cards") {
    return json(res, 200, db);
  }

  if (req.method === "POST" && url.pathname === "/api/cards") {
    const input = await readBody(req);
    const card = normalizeCard(input);
    db.cards.unshift(card);
    db.events.push({ id: id("event"), cardId: card.id, action: "created", payload: {}, createdAt: now() });
    await writeDb(db);
    return json(res, 201, { card });
  }

  if (req.method === "POST" && url.pathname === "/api/demo/seed") {
    const cards = demoCards();
    const existing = new Set(db.cards.map((card) => card.id));
    for (const card of cards) {
      if (!existing.has(card.id)) {
        db.cards.unshift(card);
        db.events.push({ id: id("event"), cardId: card.id, action: "created", payload: { demo: true }, createdAt: now() });
      }
    }
    await writeDb(db);
    return json(res, 201, { cards });
  }

  if (parts[0] === "api" && parts[1] === "cards" && parts[2]) {
    const card = db.cards.find((item) => item.id === parts[2]);
    if (!card) return notFound(res);

    if (req.method === "PATCH" && parts.length === 3) {
      const patch = await readBody(req);
      Object.assign(card, patch, { updatedAt: now() });
      db.events.push({ id: id("event"), cardId: card.id, action: "updated", payload: patch, createdAt: now() });
      await writeDb(db);
      return json(res, 200, { card });
    }

    if (req.method === "POST" && parts[3] === "actions") {
      const input = await readBody(req);
      const event = {
        id: id("event"),
        cardId: card.id,
        action: input.action || "respond",
        payload: input.payload || {},
        createdAt: now()
      };
      card.status = nextStatus(event.action, card);
      card.updatedAt = event.createdAt;
      db.events.push(event);
      await writeDb(db);
      postCallback(card, event);
      return json(res, 201, { card, event });
    }
  }

  return notFound(res);
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname === "/favicon.ico" ? "/icon.svg" : url.pathname;
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root)) return notFound(res);

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": mime[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  } catch {
    if (!path.extname(filePath)) {
      const index = await fs.readFile(path.join(root, "index.html"));
      res.writeHead(200, { "content-type": mime[".html"] });
      res.end(index);
    } else {
      notFound(res);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Agent Cards running at http://localhost:${port}`);
});
