const state = {
  cards: [],
  events: [],
  view: "needs-me",
  type: "all",
  project: "all",
  selectedId: null,
  detailOpen: false,
  pendingAction: null,
  version: null,
  swipe: null,
  mutedAgents: new Set(JSON.parse(localStorage.getItem("agentCardsMutedAgents") || "[]")),
  suppressClickUntil: 0,
  justHandled: new Set()
};

const views = {
  "needs-me": {
    title: "Needs Me",
    subtitle: "Review, correct, or approve agent actions before they run."
  },
  today: {
    title: "Today",
    subtitle: "Daily brief, active decisions, and open loops for today."
  },
  projects: {
    title: "Projects",
    subtitle: "Cards grouped by project and agent workflow."
  },
  archive: {
    title: "Archive",
    subtitle: "Completed, dismissed, expired, and historical cards."
  }
};

const actionable = new Set(["new", "waiting", "viewed", "in_progress", "edited"]);
const archived = new Set(["completed", "dismissed", "expired", "archived", "approved", "rejected", "responded"]);
const resolved = new Set([...archived, "responded"]);
const fallbackDailyActionLimit = 3;
const actionLabels = {
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
  request_changes: "Request changes",
  view: "View"
};
const actionStyles = {
  approve: "primary",
  send: "primary",
  more_like_this: "primary",
  reject: "danger"
};

const actionProgressLabels = {
  approve: "Approving",
  archive: "Archiving",
  answer: "Recording answer",
  choose: "Recording choice",
  edit: "Opening edit state",
  investigate: "Opening investigation",
  more_like_this: "Saving preference",
  pass: "Passing",
  request_changes: "Sending change request",
  reject: "Rejecting",
  send: "Sending"
};

const typeMeta = {
  approval: { label: "Approval", icon: "check-circle", accent: "blue" },
  choice: { label: "Choice", icon: "list-check", accent: "purple" },
  question: { label: "Question", icon: "message", accent: "teal" },
  status: { label: "Update", icon: "clock", accent: "green" },
  briefing: { label: "Briefing", icon: "file-text", accent: "slate" },
  comparison: { label: "Comparison", icon: "compare", accent: "indigo" }
};

const actionIcons = {
  approve: "check-circle",
  archive: "archive",
  answer: "message",
  choose: "check",
  edit: "edit",
  investigate: "search",
  more_like_this: "sparkles",
  pass: "x-circle",
  reject: "x-circle",
  send: "send",
  request_changes: "edit",
  view: "chevron-right"
};

const icons = {
  archive: `<path d="M4 7h16"/><path d="M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/><path d="M9 11h6"/><path d="M7 4h10l1 3H6l1-3Z"/>`,
  calendar: `<path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 8h16"/><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 12h3"/><path d="M13 12h3"/><path d="M8 16h3"/>`,
  "check": `<path d="m5 12 4 4L19 6"/>`,
  "check-circle": `<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.3 2.3 4.9-5.4"/>`,
  "chevron-right": `<path d="m9 18 6-6-6-6"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  compare: `<path d="M7 7h11"/><path d="m15 4 3 3-3 3"/><path d="M17 17H6"/><path d="m9 14-3 3 3 3"/>`,
  edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>`,
  "file-text": `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/>`,
  folder: `<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z"/>`,
  inbox: `<path d="M4 13.5 6.5 5h11L20 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M4 14h5l1.5 2h3L15 14h5"/>`,
  "list-check": `<path d="m4 7 1.5 1.5L8 6"/><path d="M11 7h9"/><path d="m4 13 1.5 1.5L8 12"/><path d="M11 13h9"/><path d="M11 19h9"/><path d="M5 19h.01"/>`,
  message: `<path d="M21 12a8 8 0 0 1-8 8H6l-3 3v-7a8 8 0 1 1 18-4Z"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>`,
  send: `<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>`,
  sparkles: `<path d="M12 3 10 9l-6 2 6 2 2 6 2-6 6-2-6-2-2-6Z"/><path d="M19 15v4"/><path d="M17 17h4"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>`,
  "x-circle": `<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>`
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const completionActions = new Set(["approve", "send", "reject", "answer", "choose", "archive", "pass", "request_changes", "edit"]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatRelativeTime(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (Number.isNaN(diff)) return "";
  if (diff < minute) return "now";
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < day * 7) return `${Math.round(diff / day)}d ago`;
  return formatTime(value);
}

function icon(name) {
  return `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons["chevron-right"]}</svg>`;
}

function typeBadge(card) {
  const meta = typeMeta[card.type] || { label: titleize(card.type), icon: "file-text", accent: "slate" };
  return `<span class="type-badge type-${escapeHtml(meta.accent)}">${icon(meta.icon)}${escapeHtml(meta.label)}</span>`;
}

function cardStatus(card) {
  if (card.status === "waiting") {
    if (card.type === "approval") return "approval pending";
    if (card.type === "question") return "needs answer";
    if (["choice", "comparison"].includes(card.type)) return "needs decision";
    if (card.type === "status") return "blocked";
  }
  if (card.status === "viewed") return "review opened";
  if (card.status === "edited") return "changes requested";
  return String(card.status || "new").replaceAll("_", " ");
}

function isActionableCard(card) {
  return actionable.has(card.status) && !resolved.has(card.status);
}

function projectName(card) {
  return card.project || "General";
}

function isDecisionCard(card) {
  return ["approval", "choice", "question", "comparison"].includes(card.type);
}

function isMutedCard(card) {
  return state.mutedAgents.has(card.agent?.id);
}

function persistMutedAgents() {
  localStorage.setItem("agentCardsMutedAgents", JSON.stringify([...state.mutedAgents]));
}

function isDailyBriefCard(card) {
  return card.type === "briefing" && projectName(card) === "Daily Brief";
}

function isNeedsMeCard(card) {
  return isActionableCard(card) && !isDailyBriefCard(card);
}

function neededAt(card) {
  const metadata = card.metadata || {};
  const value = card.neededAt
    || card.dueAt
    || card.dueDate
    || metadata.neededAt
    || metadata.dueAt
    || metadata.dueDate
    || card.expiresAt;
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareCards(a, b) {
  const aNeeded = neededAt(a);
  const bNeeded = neededAt(b);
  if (aNeeded && bNeeded && aNeeded !== bNeeded) return aNeeded - bNeeded;
  if (aNeeded && !bNeeded) return -1;
  if (!aNeeded && bNeeded) return 1;
  const priority = { high: 3, medium: 2, low: 1 };
  return (priority[b.priority] || 0) - (priority[a.priority] || 0)
    || new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
}

function latestDailyBrief() {
  return state.cards
    .filter((card) => card.type === "briefing" && !archived.has(card.status) && projectName(card) === "Daily Brief")
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0];
}

function dailyActionLimit() {
  const limit = Number(latestDailyBrief()?.metadata?.preferences?.maxApprovalBatch);
  return Number.isFinite(limit) && limit > 0 ? Math.min(8, Math.max(1, Math.floor(limit))) : fallbackDailyActionLimit;
}

function latestEvent(cardId, action) {
  return state.events
    .filter((event) => event.cardId === cardId && (!action || event.action === action))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
}

function titleize(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeAction(action) {
  if (typeof action === "string") {
    return {
      id: action,
      label: actionLabels[action] || titleize(action),
      style: actionStyles[action] || "neutral"
    };
  }
  if (!action || typeof action !== "object") return null;
  const id = action.id || action.action || "respond";
  return {
    id,
    label: action.label || actionLabels[id] || titleize(id),
    style: action.style || actionStyles[id] || "neutral"
  };
}

function renderAgentAvatar(agent = {}, size = "small") {
  const name = agent.name || "Agent";
  const initial = name.slice(0, 1).toUpperCase();
  const image = agent.avatarUrl || agent.imageUrl || agent.avatar;
  if (image) {
    return `<span class="avatar avatar-${size}"><img src="${escapeHtml(image)}" alt="${escapeHtml(name)} avatar"></span>`;
  }
  return `<span class="avatar avatar-${size}">${escapeHtml(initial)}</span>`;
}

function visibleCards() {
  const byView = state.cards.filter((card) => {
    if (isMutedCard(card) && state.view !== "archive") return false;
    if (state.view === "needs-me") return isNeedsMeCard(card) || state.justHandled.has(card.id);
    if (state.view === "archive") return archived.has(card.status);
    if (state.view === "today") return todayBriefCards().some((item) => item.id === card.id);
    return true;
  });

  const byType = state.type === "all" ? byView : byView.filter((card) => card.type === state.type);
  const byProject = state.project === "all" ? byType : byType.filter((card) => projectName(card) === state.project);

  return byProject.sort(compareCards);
}

function sortedOpenCards() {
  return state.cards
    .filter((card) => isNeedsMeCard(card) && !isMutedCard(card))
    .sort(compareCards);
}

function todayBriefCards() {
  return state.cards
    .filter((card) => card.type === "briefing" && !archived.has(card.status) && projectName(card) === "Daily Brief" && !isMutedCard(card))
    .sort(compareCards);
}

function dailyBriefCards() {
  const brief = latestDailyBrief();
  const sourceIds = brief?.metadata?.sourceCards || [];
  const sourceDecisionCards = sourceIds
    .map((cardId) => state.cards.find((card) => card.id === cardId))
    .filter((card) => card && isActionableCard(card) && isDecisionCard(card));
  const fallbackDecisionCards = sortedOpenCards()
    .filter((card) => isDecisionCard(card) && !sourceDecisionCards.some((sourceCard) => sourceCard.id === card.id));
  const contextCards = [
    brief,
    ...state.cards
    .filter((card) => !archived.has(card.status) && card.type === "status" && !isMutedCard(card))
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 1)
  ].filter(Boolean);
  const actionCards = [...sourceDecisionCards, ...fallbackDecisionCards].slice(0, dailyActionLimit());
  return [...contextCards, ...actionCards]
    .filter((card) => card && !archived.has(card.status))
    .filter((card, index, cards) => cards.findIndex((item) => item.id === card.id) === index);
}

function scopedOpenCards() {
  return sortedOpenCards().filter((card) => state.project === "all" || projectName(card) === state.project);
}

function dailyDecisionCount() {
  return todayBriefCards().length;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.status === 204 ? null : response.json();
}

async function load() {
  try {
    const [data, version] = await Promise.all([
      api("/api/cards"),
      api("/api/version").catch(() => null)
    ]);
    state.cards = data.cards;
    state.events = data.events;
    if (version) state.version = version;
    $(".status-dot").className = "status-dot online";
    $("#api-status").textContent = "Local";
  } catch (error) {
    $(".status-dot").className = "status-dot offline";
    $("#api-status").textContent = "Offline";
    console.error(error);
  }
  render();
}

function renderVersion() {
  const version = state.version;
  const button = $("#version-pill");
  const label = $("#version-label");
  const stateLabel = $("#version-state");
  const banner = $("#freshness-banner");
  const bannerTitle = $("#freshness-title");
  const bannerCopy = $("#freshness-copy");
  const updateButton = $("#update-app");

  if (!version) {
    label.textContent = "v...";
    stateLabel.textContent = "Checking";
    button.classList.remove("has-update");
    button.classList.remove("is-stale");
    banner.hidden = false;
    bannerTitle.textContent = "Version check unavailable";
    bannerCopy.textContent = "Do not claim this instance is latest until this URL returns /api/version.";
    updateButton.hidden = true;
    return;
  }

  const stale = Boolean(version.stale);
  const updateAvailable = Boolean(version.updateAvailable);
  const git = version.git || {};

  label.textContent = `v${version.currentVersion}`;
  stateLabel.textContent = stale ? "Stale" : updateAvailable ? "Update" : "Current";
  button.classList.toggle("has-update", Boolean(version.updateAvailable));
  button.classList.toggle("is-stale", stale);
  banner.hidden = !stale && !updateAvailable;
  if (!stale && !updateAvailable) {
    bannerTitle.textContent = "";
    bannerCopy.textContent = "";
    updateButton.hidden = true;
    updateButton.disabled = false;
    updateButton.textContent = "Update";
    return;
  }
  bannerTitle.textContent = stale ? "Stale URL" : "Update available";
  bannerCopy.textContent = stale
    ? `This page was opened from ${version.requestUrl || "a non-canonical URL"}. Use ${version.canonicalUrl || "the canonical Agent Cards URL"} before claiming it is latest.`
    : `This checkout is behind ${git.upstream || "origin/main"}. Latest known commit is ${(git.upstreamCommit || "").slice(0, 7) || "upstream"}.`;
  updateButton.hidden = stale || !updateAvailable;
  updateButton.disabled = false;
  updateButton.textContent = "Update";
}

async function updateApp() {
  const button = $("#update-app");
  button.disabled = true;
  button.textContent = "Updating...";
  try {
    const result = await api("/api/update", { method: "POST" });
    button.textContent = result.updated ? "Restarting..." : "Already current";
    setTimeout(load, result.updated ? 1600 : 400);
  } catch (error) {
    button.textContent = "Update failed";
    $("#freshness-copy").textContent = error.message;
    setTimeout(() => {
      button.disabled = false;
      button.textContent = "Update";
    }, 1800);
  }
}

async function respond(cardId, action, payload = {}) {
  const card = state.cards.find((item) => item.id === cardId);
  const actionConfig = (card?.actions || [])
    .map(normalizeAction)
    .find((item) => item.id === action);
  state.pendingAction = {
    cardId,
    action,
    label: actionProgressLabels[action] || `Recording ${titleize(action)}`,
    style: actionConfig?.style || actionStyles[action] || "neutral"
  };
  render();
  try {
    await wait(760);
    await api(`/api/cards/${cardId}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, payload })
    });
    if (action !== "archive") state.justHandled.add(cardId);
    await load();
    state.selectedId = cardId;
    renderDetail();
  } catch (error) {
    console.error(error);
    $(".status-dot").className = "status-dot offline";
    $("#api-status").textContent = "Action failed";
  } finally {
    state.pendingAction = null;
    render();
  }
}

async function updateCard(cardId, patch) {
  await api(`/api/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
  await load();
}

async function seedDemo() {
  await api("/api/demo/seed", { method: "POST" });
  await load();
  const button = $("#seed-demo");
  button.textContent = "Seeded";
  setTimeout(() => {
    button.textContent = "Seed demo";
  }, 1200);
}

function projectOptions() {
  return [...new Set(state.cards.map(projectName))].sort((a, b) => a.localeCompare(b));
}

function renderProjectFilter() {
  const select = $("#project-filter");
  select.hidden = state.view === "today";
  if (state.view === "today" && state.project !== "all") state.project = "all";
  const projects = projectOptions();
  const valid = state.project === "all" || projects.includes(state.project);
  if (!valid) state.project = "all";
  select.innerHTML = [
    `<option value="all">All projects</option>`,
    ...projects.map((project) => `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`)
  ].join("");
  select.value = state.project;
}

function renderBriefSummary() {
  const node = $("#brief-summary");
  node.hidden = true;
  node.innerHTML = "";
}

function render() {
  const completedToday = state.events.filter((event) => {
    const actionDate = new Date(event.createdAt);
    const today = new Date();
    return completionActions.has(event.action) && actionDate.toDateString() === today.toDateString();
  }).length;
  const counts = {
    needs: state.cards.filter((card) => isNeedsMeCard(card) && !isMutedCard(card)).length,
    today: dailyDecisionCount(),
    projects: new Set(state.cards.map(projectName)).size,
    archive: state.cards.filter((card) => archived.has(card.status)).length,
    completedToday
  };

  $("#needs-count").textContent = counts.needs;
  $("#today-count").textContent = counts.today;
  $("#project-count").textContent = counts.projects;
  $("#archive-count").textContent = counts.archive;

  $$(".nav-item, .bottom-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === state.view);
  });
  $("#app").classList.toggle("detail-open", state.detailOpen);
  renderVersion();
  renderProjectFilter();

  $("#view-title").textContent = views[state.view].title;
  $("#view-subtitle").textContent = views[state.view].subtitle;
  $("#type-filter").value = state.type;
  $("#seed-demo").hidden = !new URLSearchParams(window.location.search).has("dev");
  renderBriefSummary();
  renderTaskProgress(counts);

  const cards = visibleCards();
  $("#cards").innerHTML = cards.map(renderCard).join("");
  $("#empty-state").hidden = cards.length > 0;
  renderDetail();
}

function renderTaskProgress(counts) {
  const node = $("#task-progress");
  const show = state.view === "needs-me" || state.view === "projects";
  if (!show) {
    node.hidden = true;
    node.innerHTML = "";
    return;
  }
  const total = counts.needs + counts.completedToday;
  const percent = total ? Math.round((counts.completedToday / total) * 100) : 100;
  node.hidden = false;
  node.innerHTML = `
    <div>
      <strong>${counts.needs ? `${counts.needs} left` : "Inbox clear"}</strong>
      <span>${counts.completedToday} handled today</span>
    </div>
    <div class="task-progress-meter" aria-label="${percent}% complete">
      <span style="width:${percent}%"></span>
    </div>
  `;
}

function renderCard(card) {
  const meta = typeMeta[card.type] || { accent: "slate" };
  const time = formatRelativeTime(card.updatedAt || card.createdAt);
  const pending = state.pendingAction?.cardId === card.id ? state.pendingAction : null;
  const highRisk = card.type === "approval" && card.priority === "high";
  return `
    <article class="card card--${escapeHtml(card.type)} accent-${escapeHtml(meta.accent)} ${highRisk ? "risk-high" : ""} ${state.selectedId === card.id ? "selected" : ""} ${pending ? "is-responding" : ""}" data-card-id="${escapeHtml(card.id)}">
      <div class="card-header">
        <div class="agent-line">
          ${renderAgentAvatar(card.agent)}
          <span><strong>${escapeHtml(card.agent?.name || "Agent")}</strong><small>${escapeHtml(projectName(card))} · ${escapeHtml(time)}</small></span>
        </div>
        ${typeBadge(card)}
      </div>
      <h3>${escapeHtml(card.title)}</h3>
      ${card.type === "briefing" ? "" : `<p class="summary">${escapeHtml(card.summary)}</p>`}
      ${renderDecisionFrame(card)}
      ${renderCardBody(card)}
      ${state.justHandled.has(card.id) ? `<div class="handled-note">Recorded. Review the event in the inspector.</div>` : ""}
      ${renderSwipeHint(card)}
      <div class="meta-row">
        <span class="chip priority ${escapeHtml(card.priority || "low")}"><span class="risk-dot"></span>${escapeHtml(card.priority || "low")}</span>
        <span class="chip">${icon("clock")}${escapeHtml(cardStatus(card))}</span>
      </div>
      ${renderActions(card)}
      ${pending ? renderActionOverlay(pending) : ""}
    </article>
  `;
}

function actionVerb(card) {
  if (card.type === "approval") {
    const action = (card.actions || []).map(normalizeAction).find((item) => ["send", "approve"].includes(item.id));
    return action?.label || "Approve action";
  }
  if (card.type === "question") return "Answer blocker";
  if (card.type === "choice") return "Choose preference";
  if (card.type === "comparison") return "Choose path";
  if (card.type === "status") return card.blocker ? "Review blocker" : "Inspect update";
  return "Review";
}

function whyNow(card) {
  const metadata = card.metadata || {};
  const review = metadata.review || {};
  if (metadata.handoff?.onSend) return metadata.handoff.onSend;
  if (metadata.nextAgent) return `${card.agent?.name || "Agent"} will pass the decision to ${metadata.nextAgent}.`;
  if (review.reason) return review.reason;
  if (metadata.decision) return `Decision key: ${metadata.decision}.`;
  if (card.expiresAt) return `Useful until ${formatTime(card.expiresAt)}.`;
  return card.summary || "Waiting for human feedback before the agent continues.";
}

function primaryRisk(card) {
  const metadata = card.metadata || {};
  const review = metadata.review || {};
  const risk = metadata.risks?.[0] || review.risks?.[0] || card.blocker;
  if (risk) return risk;
  if (card.priority === "high") return "High priority";
  return "Low operational risk";
}

function renderDecisionFrame(card) {
  if (!isDecisionCard(card) && card.type !== "status") return "";
  return `
    <div class="decision-frame">
      <div><span>Agent wants to</span><strong>${escapeHtml(actionVerb(card))}</strong></div>
      <div><span>Why now</span><strong>${escapeHtml(whyNow(card))}</strong></div>
      <div><span>Risk</span><strong>${escapeHtml(primaryRisk(card))}</strong></div>
    </div>
  `;
}

function renderSwipeHint(card) {
  if (!isActionableCard(card)) return "";
  if (["choice", "comparison"].includes(card.type)) {
    return `<div class="swipe-hint"><span>Swipe right to choose</span><span>Left to pass</span><span>Up for more like this</span></div>`;
  }
  return `<div class="swipe-hint"><span>Swipe sideways to archive</span></div>`;
}

function renderActionOverlay(pending) {
  const overlayIcon = pending.style === "danger"
    ? "x-circle"
    : pending.action === "archive"
      ? "archive"
      : "check-circle";
  return `
    <div class="action-overlay action-${escapeHtml(pending.style)}" role="status" aria-live="polite">
      <span class="action-orb">${icon(overlayIcon)}</span>
      <strong>${escapeHtml(pending.label)}</strong>
      <span>Updating card event</span>
    </div>
  `;
}

function renderCardBody(card) {
  if (card.type === "approval") {
    const metadata = card.metadata || {};
    const review = metadata.review || {};
    const draft = metadata.draft || review.draft;
    const risks = metadata.risks || review.risks || [];
    const sections = metadata.sections || review.sections || [];
    if (!draft && !risks.length && !sections.length) return "";
    return `
      <div class="approval-preview">
        ${draft?.to ? `<div>${icon("user")}<span>To</span><strong>${escapeHtml(draft.to)}</strong></div>` : ""}
        ${draft?.subject ? `<div>${icon("file-text")}<span>Subject</span><strong>${escapeHtml(draft.subject)}</strong></div>` : ""}
        ${risks.length ? `<div>${icon("x-circle")}<span>Risk</span><strong><i class="risk-dot"></i>${escapeHtml(risks[0])}</strong></div>` : ""}
        ${sections.length ? `<div>${icon("check-circle")}<span>Review</span><strong>${escapeHtml(sections[0].title || "Proposed change")}</strong></div>` : ""}
      </div>
    `;
  }

  if (card.type === "choice") {
    const choice = latestEvent(card.id, "choose");
    const selectedOptionId = choice?.payload?.optionId;
    const options = (card.options || []).slice(0, 4).map((option) => `
      ${isActionableCard(card) ? `<button class="option-card" data-action="choose" data-card-id="${escapeHtml(card.id)}" data-option-id="${escapeHtml(option.id)}" type="button">` : `<div class="option-card option-card-readonly ${selectedOptionId === option.id ? "is-selected" : ""}">`}
        <span class="option-radio"></span>
        <strong>${escapeHtml(option.title || option.label || option.id || "Option")}</strong>
        <span>${escapeHtml(option.description || "")}</span>
        <em>Agent will ${escapeHtml(option.agentWill || option.outcome || inferOptionOutcome(card, option))}</em>
        ${isActionableCard(card) ? "<b>Apply choice</b>" : ""}
      ${isActionableCard(card) ? "</button>" : "</div>"}
    `).join("");
    const selected = (card.options || []).find((option) => option.id === selectedOptionId);
    const result = selected ? `
      <div class="handled-note">Choice recorded: ${escapeHtml(selected.title || selected.label || selected.id)}</div>
    ` : "";
    if (!isActionableCard(card)) return `${result}<div class="option-strip">${options}</div>`;
    return `<div class="option-strip">${options}</div>${renderPreferenceControls(card)}`;
  }

  if (card.type === "question") {
    const answer = latestEvent(card.id, "answer")?.payload?.answer;
    if (!isActionableCard(card)) {
      return answer ? `
        <div class="readonly-result">
          <strong>Answer recorded</strong>
          <p>${escapeHtml(answer)}</p>
        </div>
      ` : "";
    }
    return `
      <form class="question-form" data-question-form="${escapeHtml(card.id)}">
        <textarea rows="3" name="answer" placeholder="${escapeHtml(card.input?.placeholder || "Type your answer")}"></textarea>
        <button class="primary-button" type="submit">Answer</button>
      </form>
    `;
  }

  if (card.type === "status") {
    const progress = Number(card.progress || 0);
    return `
      <div class="status-meter">
        <div class="status-row"><strong>${Math.min(100, Math.max(0, progress))}% complete</strong><span>${escapeHtml(card.blocker || "No blocker")}</span></div>
        <div class="meter-track"><div class="meter-fill" style="width:${Math.min(100, Math.max(0, progress))}%"></div></div>
      </div>
    `;
  }

  if (card.type === "briefing") {
    return renderBriefing(card);
  }

  if (card.type === "comparison") {
    return `${renderComparison(card, false)}${renderPreferenceControls(card)}`;
  }

  return "";
}

function renderPreferenceControls(card) {
  if (!isActionableCard(card)) return "";
  return `
    <div class="preference-actions">
      <button class="soft-button" data-action="more_like_this" data-card-id="${escapeHtml(card.id)}" type="button">${icon("sparkles")}Teach preference</button>
      <button class="soft-button" data-action="pass" data-card-id="${escapeHtml(card.id)}" type="button">${icon("x-circle")}Pass</button>
    </div>
    <p class="learning-preview">Future rule preview: remember this preference for similar low-risk decisions.</p>
  `;
}

function renderBriefing(card) {
  const metadata = card.metadata || {};
  const brief = metadata.dailyBrief || {};
  const sections = metadata.sections || [];
  if (brief.weather || brief.calendar || brief.emails?.length || brief.news?.length || brief.openItems || brief.projects?.length) {
    return `
      <div class="daily-brief-board">
        ${brief.weather ? `
          <section class="daily-tile weather-tile">
            <div class="weather-icon">${escapeHtml(brief.weather.symbol || "☀")}</div>
            <div>
              <span class="weather-label">Weather</span>
              <strong>${escapeHtml(brief.weather.temp || brief.weather.title || "Weather")}</strong>
              <p>${escapeHtml(brief.weather.summary || "")}</p>
            </div>
          </section>
        ` : ""}
        ${brief.calendar ? `
          <section class="daily-tile">
            <span class="tile-icon">${icon("calendar")}</span>
            <div>
              <strong>${escapeHtml(brief.calendar.title || "Calendar")}</strong>
              <p>${escapeHtml(brief.calendar.summary || "")}</p>
            </div>
          </section>
        ` : ""}
        ${brief.emails?.length ? `
          <section class="daily-section">
            <div class="daily-section-title">${icon("message")}<strong>Important email</strong></div>
            ${brief.emails.slice(0, 3).map((item) => `
              <article>
                <strong>${escapeHtml(item.from || item.sender || "Agent")}: ${escapeHtml(item.subject || item.title || "Email")}</strong>
                <p>${escapeHtml(item.summary || item.whyItMatters || "")}</p>
              </article>
            `).join("")}
          </section>
        ` : ""}
        ${brief.openItems ? `
          <section class="daily-tile">
            <span class="tile-icon">${icon("inbox")}</span>
            <div>
              <strong>${escapeHtml(brief.openItems.title || "Needs Me")}</strong>
              <p>${escapeHtml(brief.openItems.summary || "")}</p>
            </div>
          </section>
        ` : ""}
        ${brief.news?.length ? `
          <section class="daily-section">
            <div class="daily-section-title">${icon("file-text")}<strong>Decision-aware news</strong></div>
            ${brief.news.slice(0, 3).map((item) => `
              <article>
                <strong>${escapeHtml(item.title || item)}</strong>
                <p>${escapeHtml(item.whyItMatters || item.summary || "")}</p>
              </article>
            `).join("")}
          </section>
        ` : ""}
        ${brief.projects?.length ? `
          <section class="daily-section">
            <div class="daily-section-title">${icon("folder")}<strong>Project pulse</strong></div>
            <div class="project-brief-grid">
              ${brief.projects.slice(0, 4).map((project) => `
                <div>
                  <strong>${escapeHtml(project.name || project.title || "Project")}</strong>
                  <span>${escapeHtml(project.status || project.summary || "")}</span>
                </div>
              `).join("")}
            </div>
          </section>
        ` : ""}
      </div>
    `;
  }
  if (sections.length) {
    return `
      <div class="daily-brief-board">
        ${sections.slice(0, 4).map((section) => `
          <section class="daily-tile">
            <span class="tile-icon">${icon(section.icon || "file-text")}</span>
            <div>
              <strong>${escapeHtml(section.title || "Brief")}</strong>
              <p>${escapeHtml(section.body || section.summary || "")}</p>
            </div>
          </section>
        `).join("")}
      </div>
    `;
  }
  return `<ul class="briefing-list">${(card.items || []).slice(0, 4).map((item) => `<li>${icon("check-circle")}<span>${escapeHtml(item)}</span></li>`).join("")}</ul>`;
}

function comparisonItems(card) {
  const metadata = card.metadata || {};
  return card.options?.length ? card.options : metadata.comparison?.options || metadata.options || [];
}

function inferOptionOutcome(card, option = {}) {
  const title = String(option.title || option.label || option.id || "this option").toLowerCase();
  if (card.id === "calendar_conflict_choice") {
    return title.includes("product")
      ? "keep product review and move the contractor call."
      : "keep the contractor call and ask product review for notes.";
  }
  if (card.type === "comparison") return `turn ${option.title || option.label || "this path"} into follow-up tasks.`;
  return `continue with ${option.title || option.label || "this choice"}.`;
}

function renderComparison(card, detail = false) {
  const items = comparisonItems(card).slice(0, detail ? 4 : 3);
  if (!items.length) return "";
  const choice = latestEvent(card.id, "choose");
  const selectedOptionId = choice?.payload?.optionId;
  return `
    <div class="comparison-grid">
      ${items.map((item, index) => `
        ${isActionableCard(card) ? `<button class="comparison-option ${item.recommended || index === 0 ? "recommended" : ""}" data-action="choose" data-card-id="${escapeHtml(card.id)}" data-option-id="${escapeHtml(item.id || item.title || item.label || `option-${index}`)}" type="button">` : `<div class="comparison-option ${selectedOptionId === item.id ? "is-selected" : ""} ${item.recommended || index === 0 ? "recommended" : ""}">`}
          <div class="comparison-top">
            <strong>${escapeHtml(item.title || item.label || item.id || "Option")}</strong>
            ${selectedOptionId === item.id ? `<span>${icon("check")}Chosen</span>` : item.recommended || index === 0 ? `<span>${icon("check")}Best fit</span>` : ""}
          </div>
          <p>${escapeHtml(item.description || item.summary || "")}</p>
          <em>Agent will ${escapeHtml(item.agentWill || item.outcome || inferOptionOutcome(card, item))}</em>
          ${item.meta || item.cost || item.risk ? `<small>${escapeHtml(item.meta || item.cost || item.risk)}</small>` : ""}
          ${isActionableCard(card) ? "<b>Apply choice</b>" : ""}
        ${isActionableCard(card) ? "</button>" : "</div>"}
      `).join("")}
    </div>
  `;
}

function renderActions(card, options = {}) {
  if (!isActionableCard(card)) return "";
  if (card.type === "approval" && !options.detail) {
    return `
      <div class="actions">
        <button class="primary-button" data-open-card="${escapeHtml(card.id)}" type="button">${icon("file-text")}Review</button>
        <button class="ghost-button" data-action="archive" data-card-id="${escapeHtml(card.id)}" type="button">${icon("archive")}Archive</button>
      </div>
    `;
  }
  const actions = (card.actions || [])
    .map(normalizeAction)
    .filter((action) => action && !isHandledInline(card, action));
  const renderedActions = actions.length ? actions : [];
  const hasArchive = actions.some((action) => action.id === "archive");
  const className = options.detail ? "actions detail-actions" : "actions";
  const disabled = state.pendingAction?.cardId === card.id ? " disabled" : "";

  return `
    <div class="${className}">
      ${renderedActions.map((action) => {
        const className = action.style === "danger" ? "danger-button" : action.style === "primary" ? "primary-button" : "soft-button";
        const changeAttr = ["edit", "request_changes"].includes(action.id) ? ` data-request-changes="true"` : "";
        return `<button class="${className}" data-action="${escapeHtml(action.id)}" data-card-id="${escapeHtml(card.id)}" type="button"${disabled}${changeAttr}>${icon(actionIcons[action.id] || "chevron-right")}${escapeHtml(action.label)}</button>`;
      }).join("")}
      ${hasArchive || options.detail ? "" : `<button class="ghost-button" data-action="archive" data-card-id="${escapeHtml(card.id)}" type="button"${disabled}>${icon("archive")}Archive</button>`}
    </div>
  `;
}

function isHandledInline(card, action) {
  if (action.id === "view") return true;
  if (card.type === "choice" && action.id === "choose") return true;
  if (card.type === "comparison" && action.id === "choose") return true;
  if (card.type === "question" && action.id === "answer") return true;
  return false;
}

function renderDetail() {
  const cards = visibleCards();
  const useDefaultSelection = window.matchMedia("(min-width: 761px)").matches;
  const card = cards.find((item) => item.id === state.selectedId) || ((state.detailOpen || useDefaultSelection) ? cards[0] : null);
  if (!card) {
    $("#detail-empty").hidden = false;
    $("#detail-card").hidden = true;
    return;
  }
  state.selectedId = card.id;
  const events = state.events.filter((event) => event.cardId === card.id);
  $("#detail-empty").hidden = true;
  $("#detail-card").hidden = false;
  $("#detail-card").innerHTML = `
    <div class="detail-agent">
      <div class="agent-line">
        ${renderAgentAvatar(card.agent, "large")}
        <span><strong>${escapeHtml(card.agent?.name || "Agent")}</strong><small>${escapeHtml(projectName(card))} · ${formatTime(card.updatedAt || card.createdAt)}</small></span>
      </div>
      <div class="detail-agent-actions">
        <button class="agent-mute-button" data-agent-mute="${escapeHtml(card.agent?.id || "")}" type="button">${icon("x-circle")}${state.mutedAgents.has(card.agent?.id) ? "Unmute agent" : "Mute agent"}</button>
        <button class="close-detail" type="button" aria-label="Close detail">${icon("x-circle")}Close</button>
      </div>
    </div>
    <h2>${escapeHtml(card.title)}</h2>
    <p class="summary">${escapeHtml(card.summary)}</p>
    <div class="meta-row">
      ${typeBadge(card)}
      <span class="chip">${escapeHtml(cardStatus(card))}</span>
    </div>
    <section class="detail-section">
      <h3>Context</h3>
      <p>${escapeHtml(card.details || "No extra detail provided.")}</p>
    </section>
    ${renderAccountabilityPanel(card)}
    ${renderReviewPayload(card)}
    ${card.type === "comparison" ? `<section class="detail-section"><h3>Comparison</h3>${renderComparison(card, true)}</section>` : ""}
    ${renderActions(card, { detail: true })}
    <details class="technical-details">
      <summary>Technical history</summary>
      <section class="detail-section">
        <h3>Callback</h3>
        <p>${escapeHtml(card.callbackUrl || "No callback URL configured. Events are stored locally.")}</p>
      </section>
      <section class="detail-section">
        <h3>Events</h3>
        <div class="event-list">
          ${events.length ? events.map((event) => `
            <div class="event">
              <strong>${escapeHtml(event.action)}</strong> · ${formatTime(event.createdAt)}<br>
              ${escapeHtml(JSON.stringify(event.payload || {}))}
            </div>
          `).join("") : `<div class="event">No feedback yet.</div>`}
        </div>
      </section>
    </details>
  `;
}

function renderAccountabilityPanel(card) {
  const events = state.events.filter((event) => event.cardId === card.id);
  const lastEvent = events.at(-1);
  return `
    <section class="detail-section">
      <h3>Agent Accountability</h3>
      <div class="accountability-grid">
        <div><span>Agent proposed</span><strong>${escapeHtml(actionVerb(card))}</strong></div>
        <div><span>Evidence</span><strong>${escapeHtml(whyNow(card))}</strong></div>
        <div><span>Risk reason</span><strong>${escapeHtml(primaryRisk(card))}</strong></div>
        <div><span>Last event</span><strong>${escapeHtml(lastEvent ? `${lastEvent.action} · ${formatRelativeTime(lastEvent.createdAt)}` : "No event yet")}</strong></div>
      </div>
    </section>
    <section class="detail-section">
      <h3>Teach This Agent</h3>
      <div class="preference-actions detail-preference-actions">
        <button class="soft-button" data-action="more_like_this" data-card-id="${escapeHtml(card.id)}" type="button">${icon("sparkles")}Prefer this pattern</button>
        <button class="soft-button" data-action="request_changes" data-card-id="${escapeHtml(card.id)}" data-request-changes="true" type="button">${icon("edit")}Correct agent</button>
      </div>
    </section>
  `;
}

function renderReviewPayload(card) {
  const metadata = card.metadata || {};
  const review = metadata.review || {};
  const draft = metadata.draft || review.draft;
  const risks = metadata.risks || review.risks || [];
  const attachments = metadata.attachments || review.attachments || [];
  const sections = metadata.sections || review.sections || [];

  if (!draft && !risks.length && !attachments.length && !sections.length && !Object.keys(metadata).length) return "";

  const draftHtml = draft ? `
    <section class="detail-section">
      <h3>Draft To Review</h3>
      <div class="review-box">
        ${draft.to ? `<div class="review-row"><strong>To</strong><span>${escapeHtml(draft.to)}</span></div>` : ""}
        ${draft.subject ? `<div class="review-row"><strong>Subject</strong><span>${escapeHtml(draft.subject)}</span></div>` : ""}
        ${draft.body ? `<pre class="draft-body">${escapeHtml(draft.body)}</pre>` : ""}
      </div>
    </section>
  ` : "";

  const risksHtml = risks.length ? `
    <section class="detail-section">
      <h3>Risks</h3>
      <ul class="detail-list">${risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>
    </section>
  ` : "";

  const attachmentsHtml = attachments.length ? `
    <section class="detail-section">
      <h3>Attachments</h3>
      <ul class="detail-list">${attachments.map((item) => `<li>${escapeHtml(item.name || item.title || item.url || item)}</li>`).join("")}</ul>
    </section>
  ` : "";

  const sectionsHtml = sections.length ? `
    <section class="detail-section">
      <h3>Review Notes</h3>
      ${sections.map((section) => `
        <div class="review-box">
          <strong>${escapeHtml(section.title || "Section")}</strong>
          <p>${escapeHtml(section.body || section.text || "")}</p>
        </div>
      `).join("")}
    </section>
  ` : "";

  const rawMetadataHtml = !draft && !risks.length && !attachments.length && !sections.length ? `
    <section class="detail-section">
      <h3>Metadata</h3>
      <pre class="draft-body">${escapeHtml(JSON.stringify(metadata, null, 2))}</pre>
    </section>
  ` : "";

  return `${draftHtml}${risksHtml}${attachmentsHtml}${sectionsHtml}${rawMetadataHtml}`;
}

function canSwipeArchive(card) {
  return card && !resolved.has(card.status);
}

function preferredOptionId(card) {
  const items = card.type === "comparison" ? comparisonItems(card) : (card.options || []);
  const item = items.find((option) => option.recommended) || items[0];
  return item?.id || item?.title || item?.label || null;
}

function swipeActionFor(card, dx, dy) {
  const horizontal = Math.abs(dx) > 96 && Math.abs(dx) > Math.abs(dy) * 1.25;
  const upward = -dy > 86 && -dy > Math.abs(dx) * 1.15;
  if (!horizontal && !upward) return null;
  if (["choice", "comparison"].includes(card.type)) {
    if (upward) return { action: "more_like_this", payload: { source: "swipe", gesture: "up" } };
    if (dx < 0) return { action: "pass", payload: { source: "swipe", gesture: "left" } };
    const optionId = preferredOptionId(card);
    return { action: "choose", payload: { source: "swipe", gesture: "right", optionId } };
  }
  if (horizontal) return { action: "archive", payload: { source: "swipe", gesture: dx > 0 ? "right" : "left" } };
  return null;
}

function interactiveTarget(target) {
  return target.closest("button, a, input, textarea, select, option, [role='button'], summary");
}

function resetSwipeNode(node) {
  if (!node) return;
  node.classList.remove("is-swiping", "swipe-archive-ready");
  node.style.transform = "";
  node.style.opacity = "";
}

document.addEventListener("click", async (event) => {
  if (Date.now() < state.suppressClickUntil) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const actionButton = event.target.closest("[data-action][data-card-id]");
  if (actionButton) {
    event.stopPropagation();
    if (state.pendingAction) return;

    const cardId = actionButton.dataset.cardId;
    const action = actionButton.dataset.action;
    const card = state.cards.find((item) => item.id === cardId);
    if (!card || !isActionableCard(card)) return;

    if (action === "archive") {
      await respond(cardId, "archive", {});
    } else if (action === "choose") {
      await respond(cardId, "choose", { optionId: actionButton.dataset.optionId });
    } else {
      const needsConfirmation = card?.type === "approval" && card?.priority === "high" && ["approve", "send"].includes(action);
      if (needsConfirmation && !confirm("Confirm this high-stakes action?")) return;
      if (actionButton.dataset.requestChanges === "true") {
        const requestChanges = prompt("What should the agent change?");
        if (requestChanges === null) return;
        await respond(cardId, action, { requestChanges: requestChanges.trim() });
      } else {
        await respond(cardId, action, {});
      }
    }
    return;
  }

  const closeDetail = event.target.closest(".close-detail");
  if (closeDetail) {
    event.preventDefault();
    state.selectedId = null;
    state.detailOpen = false;
    render();
    return;
  }

  const muteButton = event.target.closest("[data-agent-mute]");
  if (muteButton) {
    event.preventDefault();
    const agentId = muteButton.dataset.agentMute;
    if (!agentId) return;
    if (state.mutedAgents.has(agentId)) {
      state.mutedAgents.delete(agentId);
    } else {
      state.mutedAgents.add(agentId);
      state.selectedId = null;
      state.detailOpen = false;
    }
    persistMutedAgents();
    render();
    return;
  }

  const openButton = event.target.closest("[data-open-card]");
  if (openButton) {
    event.preventDefault();
    const card = state.cards.find((item) => item.id === openButton.dataset.openCard);
    if (!card) return;
    state.selectedId = card.id;
    state.detailOpen = true;
    if (isActionableCard(card) && card.status !== "viewed") {
      await updateCard(card.id, { status: "viewed" });
    } else {
      render();
    }
    return;
  }

  const nav = event.target.closest("[data-view]");
  if (nav) {
    state.view = nav.dataset.view;
    state.detailOpen = false;
    render();
    return;
  }

  const projectJump = event.target.closest("[data-project-jump]");
  if (projectJump) {
    state.project = projectJump.dataset.projectJump;
    state.view = "today";
    state.detailOpen = false;
    render();
    return;
  }

  if (interactiveTarget(event.target)) return;

  const cardNode = event.target.closest(".card[data-card-id]");
  if (cardNode) {
    const card = state.cards.find((item) => item.id === cardNode.dataset.cardId);
    state.selectedId = cardNode.dataset.cardId;
    state.detailOpen = true;
    if (card && isActionableCard(card) && card.status !== "viewed") {
      await updateCard(state.selectedId, { status: "viewed" });
    } else {
      render();
    }
    return;
  }

  if (!event.target.closest("[data-action][data-card-id]")) return;
});

document.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (interactiveTarget(event.target)) return;
  const node = event.target.closest(".card[data-card-id]");
  if (!node) return;
  const card = state.cards.find((item) => item.id === node.dataset.cardId);
  if (!canSwipeArchive(card) || state.pendingAction) return;
  state.swipe = {
    pointerId: event.pointerId,
    node,
    cardId: card.id,
    startX: event.clientX,
    startY: event.clientY,
    dx: 0,
    dy: 0,
    active: false
  };
  node.setPointerCapture?.(event.pointerId);
});

document.addEventListener("pointermove", (event) => {
  const swipe = state.swipe;
  if (!swipe || swipe.pointerId !== event.pointerId) return;
  swipe.dx = event.clientX - swipe.startX;
  swipe.dy = event.clientY - swipe.startY;
  const card = state.cards.find((item) => item.id === swipe.cardId);
  const horizontal = Math.abs(swipe.dx) > 14 && Math.abs(swipe.dx) > Math.abs(swipe.dy) * 1.25;
  const upward = card && ["choice", "comparison"].includes(card.type) && -swipe.dy > 14 && -swipe.dy > Math.abs(swipe.dx) * 1.15;
  if (!horizontal && !upward && !swipe.active) return;
  swipe.active = true;
  event.preventDefault();
  const clamped = horizontal ? Math.max(-150, Math.min(150, swipe.dx)) : Math.max(-120, Math.min(0, swipe.dy));
  swipe.node.classList.add("is-swiping");
  swipe.node.classList.toggle("swipe-archive-ready", Boolean(swipeActionFor(card, swipe.dx, swipe.dy)));
  swipe.node.style.transform = horizontal
    ? `translateX(${clamped}px) rotate(${clamped / 32}deg)`
    : `translateY(${clamped}px) scale(${1 - Math.abs(clamped) / 1200})`;
  swipe.node.style.opacity = String(Math.max(0.55, 1 - Math.abs(clamped) / 260));
});

document.addEventListener("pointerup", async (event) => {
  const swipe = state.swipe;
  if (!swipe || swipe.pointerId !== event.pointerId) return;
  state.swipe = null;
  swipe.node.releasePointerCapture?.(event.pointerId);

  const card = state.cards.find((item) => item.id === swipe.cardId);
  const swipeAction = swipe.active ? swipeActionFor(card, swipe.dx, swipe.dy) : null;
  if (!swipeAction) {
    resetSwipeNode(swipe.node);
    return;
  }

  state.suppressClickUntil = Date.now() + 450;
  swipe.node.classList.add("swipe-archive-ready");
  swipe.node.style.transform = swipeAction.payload.gesture === "up"
    ? "translateY(-120%) scale(0.98)"
    : `translateX(${swipe.dx > 0 ? 120 : -120}%) rotate(${swipe.dx > 0 ? 8 : -8}deg)`;
  swipe.node.style.opacity = "0";
  await respond(swipe.cardId, swipeAction.action, swipeAction.payload);
});

document.addEventListener("pointercancel", (event) => {
  const swipe = state.swipe;
  if (!swipe || swipe.pointerId !== event.pointerId) return;
  state.swipe = null;
  resetSwipeNode(swipe.node);
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-question-form]");
  if (!form) return;
  event.preventDefault();
  const cardId = form.dataset.questionForm;
  const card = state.cards.find((item) => item.id === cardId);
  if (!card || !isActionableCard(card)) return;
  const answer = String(form.elements.answer?.value || "").trim();
  if (card.input?.required && !answer) return;
  if (state.pendingAction) return;
  await respond(cardId, "answer", { answer });
});

$("#type-filter").addEventListener("change", (event) => {
  state.type = event.target.value;
  render();
});

$("#project-filter").addEventListener("change", (event) => {
  state.project = event.target.value;
  render();
});

$("#seed-demo").addEventListener("click", seedDemo);
$("#update-app").addEventListener("click", updateApp);

load();
setInterval(load, 10000);
