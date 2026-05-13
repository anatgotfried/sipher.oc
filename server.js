#!/usr/bin/env node
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const pkg = require("./package.json");

const root = __dirname;
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "agent-cards.json");
const port = Number(process.env.PORT || 4173);
const currentVersion = pkg.version || "0.0.0";
const latestVersion = process.env.AGENT_CARDS_LATEST_VERSION || currentVersion;
const updateCommand = process.env.AGENT_CARDS_UPDATE_COMMAND || "git pull && npm install";
const updateUrl = process.env.AGENT_CARDS_UPDATE_URL || "";
const canonicalUrl = process.env.AGENT_CARDS_CANONICAL_URL || "";
const serverStartedAt = new Date().toISOString();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
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

function compareVersions(a, b) {
  const left = String(a || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

function gitMetadata() {
  const branch = git(["branch", "--show-current"]);
  const commit = git(["rev-parse", "HEAD"]);
  const shortCommit = commit ? commit.slice(0, 7) : "";
  const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const upstreamCommit = upstream ? git(["rev-parse", "@{u}"]) : "";
  const dirty = Boolean(git(["status", "--porcelain"]));
  const aheadBehind = upstream ? git(["rev-list", "--left-right", "--count", "HEAD...@{u}"]) : "";
  const [ahead = "", behind = ""] = aheadBehind.split(/\s+/);
  return {
    branch,
    commit,
    shortCommit,
    upstream,
    upstreamCommit,
    dirty,
    ahead: Number(ahead) || 0,
    behind: Number(behind) || 0
  };
}

function requestOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  return `${protocol}://${req.headers.host}`;
}

function versionPayload(req) {
  const gitInfo = gitMetadata();
  const versionBehind = compareVersions(currentVersion, latestVersion) < 0;
  const gitBehind = gitInfo.behind > 0;
  let hostMismatch = false;

  if (canonicalUrl) {
    try {
      hostMismatch = new URL(requestOrigin(req)).host !== new URL(canonicalUrl).host;
    } catch {
      hostMismatch = false;
    }
  }

  return {
    app: "agent-cards",
    currentVersion,
    latestVersion,
    sourceId: `${currentVersion}${gitInfo.shortCommit ? `+${gitInfo.shortCommit}` : ""}${gitInfo.dirty ? ".dirty" : ""}`,
    latest: !versionBehind && !gitBehind && !hostMismatch,
    updateAvailable: versionBehind || gitBehind,
    stale: hostMismatch,
    staleReasons: [
      versionBehind ? "package_version_behind" : "",
      gitBehind ? "git_upstream_behind" : "",
      hostMismatch ? "non_canonical_url" : ""
    ].filter(Boolean),
    updateCommand,
    updateUrl,
    canonicalUrl,
    requestUrl: requestOrigin(req),
    servedFrom: root,
    serverStartedAt,
    git: gitInfo
  };
}

function nextStatus(action, card) {
  if (action === "archive") return "archived";
  if (action === "approve" || action === "send") return "approved";
  if (action === "reject") return "rejected";
  if (action === "edit" || action === "request_changes") return "edited";
  if (action === "answer" || action === "choose") return "responded";
  return card.status === "new" ? "viewed" : card.status;
}

function isResolved(card) {
  return ["approved", "archived", "completed", "dismissed", "expired", "rejected", "responded"].includes(card.status);
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
  const hermes = { id: "hermes", name: "Hermes", avatarUrl: "/assets/hermes-avatar.svg" };
  const openclaw = { id: "openclaw", name: "OpenClaw" };
  return [
    normalizeCard({
      id: "demo_send_email",
      type: "approval",
      title: "Send weekly summary to Eden?",
      summary: "Hermes drafted the update and needs approval before sending.",
      details: "The email goes to an external recipient. Review the recipient, subject, and draft body before approving.",
      priority: "high",
      project: "Executive Assistant",
      agent: hermes,
      actions: [
        { id: "send", label: "Send", style: "primary" },
        { id: "edit", label: "Edit", style: "neutral" },
        { id: "reject", label: "Reject", style: "danger" }
      ],
      metadata: {
        draft: {
          to: "Eden Shoham <eden@example.com>",
          subject: "Weekly update",
          body: "Hi Eden,\n\nHere's your weekly update.\n\n- Key progress on Project Atlas\n- Hiring update\n- Risks and blockers\n\nLet me know if you'd like anything else.\n\n- Anat"
        },
        risks: ["Medium risk"]
      },
      createdAt: time,
      updatedAt: time
    }),
    normalizeCard({
      id: "demo_weekend",
      type: "choice",
      title: "Which project should I prioritize this week?",
      summary: "Hermes narrowed the decision to four active workstreams.",
      details: "Tap an option to send structured priority feedback back to the agent.",
      priority: "medium",
      project: "Executive Assistant",
      agent: hermes,
      options: [
        { id: "atlas", title: "Project Atlas", description: "Unblocks the largest product decision" },
        { id: "hiring", title: "Hiring loop", description: "Needs feedback before interviews" },
        { id: "finance", title: "Finance cleanup", description: "Keeps the month-end close moving" },
        { id: "docs", title: "Ops docs", description: "Low risk, useful for delegation" }
      ],
      actions: [
        { id: "more_like_this", label: "More like this", style: "primary" },
        { id: "pass", label: "Pass", style: "neutral" }
      ]
    }),
    normalizeCard({
      id: "demo_question",
      type: "question",
      title: "What should be the theme of the Q2 offsite?",
      summary: "Hermes needs one direction before drafting the agenda.",
      details: "A short answer is enough. Example: operating clarity, customer empathy, or stronger execution rhythm.",
      priority: "medium",
      project: "Executive Assistant",
      agent: hermes,
      input: { kind: "short_text", placeholder: "Theme or direction" },
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
      id: "demo_comparison",
      type: "comparison",
      title: "Choose the best hosting option",
      summary: "OpenClaw compared three low-maintenance paths for the Agent Cards API.",
      details: "Recommendation favors the least operational overhead while keeping deployment simple.",
      priority: "medium",
      project: "Agent Cards",
      agent: openclaw,
      options: [
        { id: "local", title: "Local Node", description: "Fastest for private self-hosted use.", meta: "$0/month", recommended: true },
        { id: "fly", title: "Fly.io", description: "Good always-on deployment with a small ops surface.", meta: "Low cost" },
        { id: "vercel", title: "Vercel", description: "Great static hosting, API persistence needs storage.", meta: "Needs DB" }
      ],
      actions: [
        { id: "choose", label: "Choose", style: "primary" },
        { id: "investigate", label: "Compare more", style: "neutral" }
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

  if (req.method === "GET" && url.pathname === "/api/version") {
    return json(res, 200, versionPayload(req));
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

  if (req.method === "POST" && url.pathname === "/api/cards/reset") {
    const before = { cards: db.cards.length, events: db.events.length };
    await writeDb({ cards: [], events: [], agents: db.agents || [] });
    return json(res, 200, { ok: true, reset: before });
  }

  if (parts[0] === "api" && parts[1] === "cards" && parts[2]) {
    const card = db.cards.find((item) => item.id === parts[2]);
    if (!card) return notFound(res);

    if (req.method === "PATCH" && parts.length === 3) {
      const patch = await readBody(req);
      if (isResolved(card) && patch.status === "viewed") {
        return json(res, 409, { error: "card_resolved", card });
      }
      Object.assign(card, patch, { updatedAt: now() });
      db.events.push({ id: id("event"), cardId: card.id, action: "updated", payload: patch, createdAt: now() });
      await writeDb(db);
      return json(res, 200, { card });
    }

    if (req.method === "POST" && parts[3] === "actions") {
      const input = await readBody(req);
      if (isResolved(card) && input.action !== "archive") {
        return json(res, 409, { error: "card_resolved", card });
      }
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
