#!/usr/bin/env node
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { spawn } = require("node:child_process");
const pkg = require("./package.json");

const root = __dirname;
const dbPath = process.env.AGENT_CARDS_DB_PATH
  ? path.resolve(process.env.AGENT_CARDS_DB_PATH)
  : path.join(root, "data", "agent-cards.json");
const dataDir = path.dirname(dbPath);
const port = Number(process.env.PORT || 4173);
const currentVersion = pkg.version || "0.0.0";
const latestVersion = process.env.AGENT_CARDS_LATEST_VERSION || currentVersion;
const updateCommand = process.env.AGENT_CARDS_UPDATE_COMMAND || "git pull && npm install";
const updateUrl = process.env.AGENT_CARDS_UPDATE_URL || "";
const canonicalUrl = process.env.AGENT_CARDS_CANONICAL_URL || "";
const serverStartedAt = new Date().toISOString();
let apiQueue = Promise.resolve();
const execFileAsync = promisify(execFile);
const gitCache = { info: null, refreshedAt: 0, pending: null, fetchPending: null };
const gitRefreshIntervalMs = 60_000;
const staticRootFiles = new Set(["index.html", "privacy.html", "terms.html", "robots.txt", "manifest.webmanifest", "apple-touch-icon.png", "icon.png", "icon-192.png", "icon-512.png", "icon.svg", "style.css", "app.js"]);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
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
  const db = JSON.parse(await fs.readFile(dbPath, "utf8"));
  let migrated = false;
  for (const card of db.cards || []) {
    if (!Number.isInteger(card.revision) || card.revision < 1) {
      card.revision = 1;
      migrated = true;
    }
  }
  if (migrated) await writeDb(db);
  return db;
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
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  json(res, 404, { error: "not_found" });
}

function badRequest(res, message, details = {}) {
  return json(res, 400, { error: "bad_request", message, ...details });
}

function conflict(res, message, details = {}) {
  return json(res, 409, { error: "conflict", message, ...details });
}

function queueApi(task) {
  const run = apiQueue.then(task, task);
  apiQueue = run.catch(() => {});
  return run;
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
    neededAt: input.neededAt || input.dueAt || input.dueDate || null,
    project: input.project || "General",
    agent: input.agent || { id: "local-agent", name: "Local Agent" },
    actions: normalizeActions(input.actions || []),
    options: input.options || [],
    input: input.input || null,
    items: input.items || [],
    progress: input.progress || 0,
    blocker: input.blocker || "",
    callbackUrl: input.callbackUrl || "",
    metadata: input.metadata || {},
    expiresAt: input.expiresAt || input.expiration || null,
    createdAt: input.createdAt || time,
    updatedAt: input.updatedAt || time,
    revision: Number.isInteger(input.revision) && input.revision > 0 ? input.revision : 1
  };
}

function validateCardInput(input, existingCards = []) {
  if (input.id && existingCards.some((card) => card.id === input.id)) {
    return `Card id already exists: ${input.id}`;
  }
  if (!input.agent?.id || !input.agent?.name) {
    return "Cards must include agent.id and agent.name.";
  }
  if (!input.project) {
    return "Cards must include project, or use General when no project applies.";
  }
  if (!input.priority || !["low", "medium", "high"].includes(input.priority)) {
    return "Cards must include priority as low, medium, or high.";
  }
  if (input.type === "approval" || input.type === "email_approval") {
    const metadata = input.metadata || {};
    const review = metadata.review || {};
    const hasReviewPayload = Boolean(
      input.details
      || metadata.draft
      || review.draft
      || metadata.command
      || metadata.diff
      || metadata.sections?.length
      || review.sections?.length
      || metadata.risks?.length
      || review.risks?.length
    );
    if (!hasReviewPayload) {
      return "Approval cards must include reviewable details, draft, diff, command, sections, or risks.";
    }
  }
  return "";
}

function normalizeActions(actions) {
  const labels = {
    approve: "Approve",
    archive: "Archive",
    answer: "Answer",
    choose: "Choose",
    complete: "Complete",
    edit: "Request changes",
    investigate: "Investigate",
    mark_read: "Mark as read",
    more_like_this: "More like this",
    pass: "Pass",
    request_changes: "Request changes",
    reject: "Reject",
    save_draft: "Save as draft",
    send: "Send",
    view: "View"
  };
  const styles = {
    approve: "primary",
    complete: "primary",
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
    const actionId = action.id || action.action || "respond";
    const label = action.label && action.label.toLowerCase() !== "edit"
      ? action.label
      : labels[actionId] || titleize(actionId);
    return {
      id: actionId,
      label,
      style: action.style || styles[actionId] || "neutral",
      consequential: Boolean(action.consequential),
      confirmLabel: action.confirmLabel || ""
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

function refreshGitMetadata() {
  if (gitCache.fetchPending) return gitCache.fetchPending;
  gitCache.fetchPending = execFileAsync("git", ["fetch", "--quiet", "origin"], { cwd: root, timeout: 5000, killSignal: "SIGKILL" })
    .finally(() => { gitCache.fetchPending = null; });
  return gitCache.fetchPending;
}

async function gitAsync(args) {
  try {
    const result = await execFileAsync("git", args, { cwd: root, encoding: "utf8", timeout: 1500, killSignal: "SIGKILL" });
    return String(result.stdout || "").trim();
  } catch { return null; }
}

async function gitMetadataAsync() {
  const [branch, commit, upstream, dirtyOutput] = await Promise.all([
    gitAsync(["branch", "--show-current"]), gitAsync(["rev-parse", "HEAD"]),
    gitAsync(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]), gitAsync(["status", "--porcelain"])
  ]);
  if ([branch, commit, upstream, dirtyOutput].some((value) => value === null)) return null;
  const [upstreamCommit, aheadBehind] = await Promise.all([
    upstream ? gitAsync(["rev-parse", "@{u}"]) : "", upstream ? gitAsync(["rev-list", "--left-right", "--count", "HEAD...@{u}"]) : ""
  ]);
  if (upstream && (upstreamCommit === null || aheadBehind === null)) return null;
  const [ahead = "", behind = ""] = (aheadBehind || "").split(/\s+/);
  return { branch, commit, shortCommit: commit ? commit.slice(0, 7) : "", upstream, upstreamCommit, dirty: Boolean(dirtyOutput), ahead: Number(ahead) || 0, behind: Number(behind) || 0 };
}

function cachedGitMetadata() {
  if (!gitCache.pending && (gitCache.refreshedAt === 0 || Date.now() - gitCache.refreshedAt >= gitRefreshIntervalMs)) {
    gitCache.pending = (async () => {
      try {
        await refreshGitMetadata();
        return await gitMetadataAsync();
      } catch {
        return null;
      }
    })().then((info) => { gitCache.info = info; gitCache.refreshedAt = Date.now(); return info; }).finally(() => { gitCache.pending = null; });
  }
  return gitCache.info;
}

function restartServerSoon() {
  if (!process.argv[1]) return;
  const env = { ...process.env };
  setTimeout(() => {
    const child = spawn(process.execPath, [process.argv[1]], {
      cwd: root,
      env,
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    process.exit(0);
  }, 250);
}

function requestOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  return `${protocol}://${req.headers.host}`;
}

function versionPayload(req) {
  const gitInfo = cachedGitMetadata();
  const versionBehind = compareVersions(currentVersion, latestVersion) < 0;
  const gitBehind = Boolean(gitInfo && gitInfo.behind > 0);
  const gitKnown = Boolean(gitInfo);
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
    sourceId: `${currentVersion}${gitInfo?.shortCommit ? `+${gitInfo.shortCommit}` : ""}${gitInfo?.dirty ? ".dirty" : ""}`,
    latest: gitKnown && !versionBehind && !gitBehind && !hostMismatch,
    updateAvailable: versionBehind || gitBehind,
    stale: hostMismatch,
    staleReasons: [
      versionBehind ? "package_version_behind" : "",
      gitBehind ? "git_upstream_behind" : "",
      !gitKnown ? "git_info_unavailable" : "",
      hostMismatch ? "non_canonical_url" : ""
    ].filter(Boolean),
    updateCommand,
    updateUrl,
    canonicalUrl,
    requestUrl: requestOrigin(req),
    servedFrom: root,
    serverStartedAt,
    git: gitInfo || { known: false }
  };
}

function nextStatus(action, card) {
  if (action === "archive") return "archived";
  if (action === "approve" || action === "send") return "approved";
  if (action === "complete") return "completed";
  if (action === "mark_read") return "completed";
  if (action === "save_draft") return "completed";
  if (action === "reject" || action === "pass") return "rejected";
  if (action === "edit" || action === "request_changes") return "waiting_on_agent";
  if (action === "answer" || action === "choose") return "responded";
  if (action === "more_like_this") return card.status;
  if (action === "investigate") return "in_progress";
  return card.status === "new" ? "viewed" : card.status;
}

function isResolved(card) {
  return ["approved", "archived", "completed", "dismissed", "expired", "rejected", "responded", "waiting_on_agent", "changes_requested"].includes(card.status);
}

function shouldExpire(card, timestamp = Date.now()) {
  return card.expiresAt && !isResolved(card) && new Date(card.expiresAt).getTime() <= timestamp;
}

async function expireDueCards(db) {
  const timestamp = Date.now();
  const expiredAt = now();
  let changed = false;
  for (const card of db.cards) {
    if (!shouldExpire(card, timestamp)) continue;
    card.status = "expired";
    card.updatedAt = expiredAt;
    db.events.push({
      id: id("event"),
      cardId: card.id,
      action: "expired",
      payload: { expiresAt: card.expiresAt },
      createdAt: expiredAt
    });
    changed = true;
  }
  if (changed) await writeDb(db);
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
      type: "email_approval",
      title: "Send weekly summary to Riley?",
      summary: "Hermes drafted the update and needs approval before sending.",
      details: "The email goes to an external recipient. Review the recipient, subject, and draft body before approving.",
      priority: "high",
      project: "Executive Assistant",
      agent: hermes,
      actions: [
        { id: "send", label: "Send", style: "primary" },
        { id: "save_draft", label: "Save as draft", style: "neutral" }
      ],
      metadata: {
        draft: {
          to: "Riley Stone <riley@example.com>",
          subject: "Weekly update",
          body: "Hi Riley,\n\nHere's your weekly update.\n\n- Key progress on Project Atlas\n- Hiring update\n- Risks and blockers\n\nLet me know if you'd like anything else.\n\n- Alex"
        },
        risks: ["Medium risk"]
      },
      createdAt: time,
      updatedAt: time
    }),
    normalizeCard({
      id: "demo_regular_approval",
      type: "approval",
      title: "Approve docs cleanup?",
      summary: "OpenClaw wants to simplify the integration docs before the next agent starts using them.",
      details: "This lets OpenClaw rewrite the README integration section for clarity.",
      priority: "medium",
      project: "Agent Cards",
      agent: openclaw,
      actions: [
        { id: "approve", label: "Approve", style: "primary" },
        { id: "reject", label: "Not approve", style: "neutral" }
      ],
      metadata: {
        sections: [
          {
            title: "Docs cleanup",
            body: "Simplify the agent integration instructions and remove outdated approval examples."
          }
        ]
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
      actions: []
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
        { id: "choose", label: "Choose", style: "primary" }
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
      metadata: {
        dailyBrief: {
          greeting: {
            name: "Alex",
            salutation: "Good morning",
            subtitle: "Three things need attention before 10:00."
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
                  { title: "Choose Agent Cards hosting path", summary: "This decides how agents and phone access will reach the local feed.", color: "purple", cardId: "demo_weekend" },
                  { title: "Choose the best hosting option", summary: "OpenClaw compared low-maintenance deployment paths and needs a selection.", color: "green", cardId: "demo_comparison" },
                  { title: "Send weekly summary to Riley?", summary: "Hermes drafted the family logistics note and needs a send or hold decision.", color: "blue", cardId: "demo_send_email" }
                ]
              }
            },
            {
              id: "newsfeed",
              enabled: true,
              data: {
                items: [
                  {
                    title: "OpenAI launches Deployment Company",
                    summary: "OpenAI launched a new Deployment Company to help organizations build and roll out AI systems inside core workflows. The daily-brief signal is clear: enterprise AI is moving from model access to operational implementation.",
                    source: "OpenAI, May 11, 2026",
                    url: "https://openai.com/index/openai-launches-the-deployment-company/"
                  },
                  {
                    title: "Anthropic partners with Gates Foundation",
                    summary: "Anthropic announced a $200 million Gates Foundation partnership using Claude credits, grant funding, and technical support for health, education, and economic mobility programs. It is a useful sign that major AI labs are packaging deployment around measurable workflows, not just chat features.",
                    source: "Anthropic, May 14, 2026",
                    url: "https://www.anthropic.com/news/gates-foundation-partnership"
                  },
                  {
                    title: "Google brings Gemini Intelligence to Android",
                    summary: "Google introduced Gemini Intelligence as a more proactive AI layer across Android apps and devices. For Sipher, the relevant pattern is mobile agents becoming part of the operating surface, with briefings and actions expected to travel across phone, watch, car, and laptop.",
                    source: "Google, May 12, 2026",
                    url: "https://blog.google/products-and-platforms/platforms/android/gemini-intelligence/"
                  }
                ]
              }
            }
          ],
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
        }
      },
      actions: [
        { id: "investigate", label: "Investigate", style: "primary" },
        { id: "archive", label: "Archive", style: "neutral" }
      ]
    })
  ];
}

async function handleApi(req, res, url) {
  const db = await readDb();
  await expireDueCards(db);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, cards: db.cards.length, events: db.events.length });
  }

  if (req.method === "GET" && url.pathname === "/api/version") {
    return json(res, 200, versionPayload(req));
  }

  if (req.method === "POST" && url.pathname === "/api/update") {
    try {
      await refreshGitMetadata();
    } catch (error) {
      return json(res, 502, { error: "git_fetch_failed", message: error.message });
    }
    const before = await gitMetadataAsync();
    if (!before) return json(res, 503, { error: "git_unavailable", message: "Git metadata is unavailable." });
    const versionBehind = compareVersions(currentVersion, latestVersion) < 0;
    if (!versionBehind && before.behind === 0) {
      return json(res, 200, { ok: true, updated: false, before, after: before, output: "Already current." });
    }
    if (before.dirty) {
      return json(res, 409, { error: "dirty_worktree", message: "Commit or stash local changes before updating.", before });
    }
    const pulled = await gitAsync(["pull", "--ff-only"]);
    if (pulled === null) return json(res, 502, { error: "git_pull_failed", message: "Git pull failed.", before });
    const after = await gitMetadataAsync();
    if (!after) return json(res, 503, { error: "git_unavailable", message: "Git metadata is unavailable after update.", before });
    const updated = before.commit !== after.commit;
    if (updated) restartServerSoon();
    return json(res, 200, { ok: true, updated, before, after, output: pulled });
  }

  if (req.method === "GET" && url.pathname === "/api/cards") {
    return json(res, 200, db);
  }

  if (req.method === "POST" && url.pathname === "/api/cards") {
    const input = await readBody(req);
    const validationError = validateCardInput(input, db.cards);
    if (validationError) return badRequest(res, validationError);
    const card = normalizeCard(input);
    db.cards.unshift(card);
    db.events.push({
      id: id("event"),
      cardId: card.id,
      action: "created",
      payload: {},
      agent: card.agent,
      project: card.project,
      cardType: card.type,
      cardTitle: card.title,
      cardStatus: card.status,
      createdAt: now()
    });
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
    const cardIndex = db.cards.findIndex((item) => item.id === parts[2]);
    const card = db.cards[cardIndex];
    if (!card) return notFound(res);

    if (req.method === "GET" && parts.length === 3) {
      return json(res, 200, { card });
    }

    if (req.method === "PATCH" && parts.length === 3) {
      const patch = await readBody(req);
      if (patch.id !== undefined && patch.id !== card.id) return badRequest(res, "Card id cannot be changed.");
      if (isResolved(card) && patch.status === "viewed") {
        return json(res, 409, { error: "card_resolved", card });
      }
      if (patch.revision !== undefined && patch.revision !== card.revision) {
        return conflict(res, "Card revision is stale.", { card });
      }
      delete patch.revision;
      const candidate = { ...card, ...patch };
      const validationError = validateCardInput(candidate, db.cards.filter((item) => item.id !== card.id));
      if (validationError) return badRequest(res, validationError);
      const meaningful = Object.keys(patch).some((key) => key !== "updatedAt");
      Object.assign(card, patch, { updatedAt: now() });
      if (meaningful) card.revision = (Number.isInteger(card.revision) ? card.revision : 1) + 1;
      db.events.push({ id: id("event"), cardId: card.id, action: "updated", payload: patch, createdAt: now() });
      await writeDb(db);
      return json(res, 200, { card });
    }

    if (req.method === "DELETE" && parts.length === 3) {
      const [deleted] = db.cards.splice(cardIndex, 1);
      db.events.push({
        id: id("event"),
        cardId: deleted.id,
        action: "deleted",
        payload: {},
        agent: deleted.agent,
        project: deleted.project,
        cardType: deleted.type,
        cardTitle: deleted.title,
        cardStatus: deleted.status,
        createdAt: now()
      });
      await writeDb(db);
      return json(res, 200, { deleted: true, card: deleted });
    }

    if (req.method === "POST" && parts[3] === "actions") {
      const input = await readBody(req);
      const action = String(input.action || "");
      const declared = normalizeActions(card.actions || []).some((item) => item.id === action);
      const builtIn = action === "archive"
        || (card.type === "email_approval" && ["send", "save_draft"].includes(action))
        || (card.type === "status" && action === "mark_read")
        || (card.type === "checklist" && action === "complete")
        || (["choice", "comparison"].includes(card.type) && action === "choose")
        || (card.type === "question" && action === "answer");
      if (!action || (!declared && !builtIn)) return badRequest(res, "Unsupported action for this card.");
      if (isResolved(card) && action !== "archive") {
        return json(res, 409, { error: "card_resolved", card });
      }
      if (["edit", "request_changes"].includes(action) && !String(input.payload?.requestChanges || "").trim()) {
        return badRequest(res, "Request changes actions must include requestChanges text.");
      }
      if (action === "answer" && !String(input.payload?.answer || "").trim()) {
        return badRequest(res, "Answer actions must include answer text.");
      }
      const optionId = input.payload?.optionId;
      const option = optionId
        ? (card.options || []).find((item) => item.id === optionId)
          || (card.metadata?.comparison?.options || []).find((item) => item.id === optionId)
          || (card.metadata?.options || []).find((item) => item.id === optionId)
        : null;
      if (action === "choose" && !option) return badRequest(res, "Choose actions must include a valid optionId.");
      if (optionId && !option) return badRequest(res, "Invalid optionId.");
      if (["approve", "send"].includes(action) && !Number.isInteger(input.revision)) {
        return badRequest(res, "Approve and send actions require revision.");
      }
      if (input.revision !== undefined && input.revision !== card.revision) {
        return conflict(res, "Card revision is stale.", { card, expectedRevision: card.revision });
      }
      const actionConfig = normalizeActions(card.actions || []).find((item) => item.id === action);
      const event = {
        id: id("event"),
        cardId: card.id,
        action,
        payload: input.payload || {},
        agent: card.agent,
        project: card.project,
        cardType: card.type,
        cardTitle: card.title,
        actionLabel: actionConfig?.label || input.action || "Respond",
        option: option ? {
          id: option.id,
          label: option.label || option.title || option.id,
          description: option.description || option.summary || ""
        } : null,
        createdAt: now()
      };
      if (["approve", "send"].includes(action) || actionConfig?.consequential) {
        if (!Number.isInteger(input.revision)) return badRequest(res, "Consequential actions require revision.");
        event.reviewedRevision = card.revision;
        event.reviewedSnapshot = JSON.parse(JSON.stringify(card));
        if (action === "send" && card.type === "email_approval") {
          const draft = { ...(event.reviewedSnapshot.metadata?.draft || event.reviewedSnapshot.metadata?.review?.draft || {}), ...(input.payload?.draft || {}) };
          if (!["to", "subject", "body"].every((key) => String(draft[key] || "").trim())) {
            return badRequest(res, "Send actions require draft to, subject, and body.");
          }
          event.reviewedSnapshot.metadata = { ...(event.reviewedSnapshot.metadata || {}), draft };
        }
      }
      const previousStatus = card.status;
      card.status = nextStatus(event.action, card);
      if (actionConfig?.consequential && card.status === previousStatus) card.status = "approved";
      card.updatedAt = event.createdAt;
      event.cardStatus = card.status;
      db.events.push(event);
      await writeDb(db);
      postCallback(card, event);
      return json(res, 201, { card, event });
    }
  }

  return notFound(res);
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname === "/favicon.ico" ? "/icon-192.png" : url.pathname;
  const relative = requested.replace(/^\/+/, "");
  if (!relative || relative.split("/").some((segment) => segment.startsWith("."))) return notFound(res);
  if (!relative.startsWith("assets/") && !staticRootFiles.has(relative)) return notFound(res);
  const filePath = path.resolve(root, relative);
  const allowedRoot = path.resolve(root);
  const allowedAssets = path.resolve(root, "assets");
  if (!filePath.startsWith(`${allowedRoot}${path.sep}`)) return notFound(res);
  const headers = {
    "content-type": mime[path.extname(filePath)] || "application/octet-stream",
    "cache-control": "no-store"
  };

  try {
    const realPath = await fs.realpath(filePath);
    if (relative.startsWith("assets/")) {
      if (!realPath.startsWith(`${allowedAssets}${path.sep}`)) return notFound(res);
    } else if (realPath !== filePath) return notFound(res);
    const content = await fs.readFile(realPath);
    res.writeHead(200, headers);
    res.end(content);
  } catch {
    if (!path.extname(filePath)) {
      const index = await fs.readFile(path.join(root, "index.html"));
      res.writeHead(200, { "content-type": mime[".html"], "cache-control": "no-store" });
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
      await queueApi(() => handleApi(req, res, url));
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    if (["Invalid JSON", "Body too large"].includes(error.message)) {
      return badRequest(res, error.message);
    }
    json(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Agent Cards running at http://localhost:${port}`);
});
