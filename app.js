const state = {
  cards: [],
  events: [],
  view: "today",
  type: "all",
  project: "all",
  selectedId: null,
  detailOpen: false,
  pendingAction: null,
  version: null,
  swipe: null,
  mutedAgents: new Set(JSON.parse(localStorage.getItem("agentCardsMutedAgents") || "[]")),
  notificationSettings: JSON.parse(localStorage.getItem("agentCardsNotificationSettings") || "{\"enabled\":false,\"urgentOnly\":true,\"expiryMinutes\":30}"),
  notifiedCardIds: new Set(JSON.parse(localStorage.getItem("agentCardsNotifiedCards") || "[]")),
  suppressClickUntil: 0,
  justHandled: new Set(),
  pendingSelections: {},
  checklistChecks: JSON.parse(localStorage.getItem("agentCardsChecklistChecks") || "{}"),
  emailDraftEdits: {},
  questionDrafts: {},
  expandedChecklistItems: new Set(),
  questionErrors: {},
  consequenceSheet: null,
  initializedNotifications: false
};

const views = {
  today: {
    title: "Today",
    subtitle: "Daily brief, active decisions, and open loops for today."
  },
  "needs-me": {
    title: "Needs Me",
    subtitle: "Review, correct, or approve agent actions before they run."
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

const requestedView = new URLSearchParams(window.location.search).get("view");
if (views[requestedView]) state.view = requestedView;

const actionable = new Set(["new", "waiting", "viewed", "in_progress", "edited"]);
const archived = new Set(["completed", "dismissed", "expired", "archived", "approved", "rejected", "responded"]);
const resolved = new Set([...archived, "responded"]);
const fallbackDailyActionLimit = 3;
const actionLabels = {
  approve: "Approve",
  archive: "Archive",
  answer: "Answer",
  choose: "Choose",
  complete: "Complete",
  edit: "Request changes",
  investigate: "Investigate",
  mark_read: "Mark as read",
  reject: "Reject",
  save_draft: "Save as draft",
  send: "Send",
  request_changes: "Request changes",
  view: "View"
};
const actionStyles = {
  approve: "primary",
  complete: "primary",
  send: "primary",
  reject: "danger"
};

const actionProgressLabels = {
  approve: "Approving",
  archive: "Archiving",
  answer: "Recording answer",
  choose: "Recording choice",
  complete: "Completing",
  edit: "Sending change request",
  investigate: "Opening investigation",
  mark_read: "Marking read",
  request_changes: "Sending change request",
  reject: "Rejecting",
  save_draft: "Saving draft",
  send: "Sending"
};

const typeMeta = {
  approval: { label: "Approval", icon: "check-circle", accent: "blue" },
  email_approval: { label: "Email approval", icon: "send", accent: "blue" },
  choice: { label: "Choice", icon: "list-check", accent: "purple" },
  question: { label: "Question", icon: "message", accent: "teal" },
  status: { label: "Update", icon: "clock", accent: "green" },
  checklist: { label: "Checklist", icon: "list-check", accent: "green" },
  briefing: { label: "Briefing", icon: "file-text", accent: "slate" },
  comparison: { label: "Comparison", icon: "compare", accent: "indigo" }
};

const actionIcons = {
  approve: "check-circle",
  archive: "archive",
  answer: "message",
  choose: "check",
  complete: "check-circle",
  edit: "edit",
  investigate: "search",
  mark_read: "check-circle",
  reject: "x-circle",
  save_draft: "file-text",
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
  flag: `<path d="M5 21V5"/><path d="M5 5c2.8-1.2 5.2 1.2 8 0 1.8-.8 3.3-.8 5 0v8c-1.7-.8-3.2-.8-5 0-2.8 1.2-5.2-1.2-8 0"/>`,
  bell: `<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>`,
  folder: `<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z"/>`,
  inbox: `<path d="M4 13.5 6.5 5h11L20 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M4 14h5l1.5 2h3L15 14h5"/>`,
  "list-check": `<path d="m4 7 1.5 1.5L8 6"/><path d="M11 7h9"/><path d="m4 13 1.5 1.5L8 12"/><path d="M11 13h9"/><path d="M11 19h9"/><path d="M5 19h.01"/>`,
  message: `<path d="M21 12a8 8 0 0 1-8 8H6l-3 3v-7a8 8 0 1 1 18-4Z"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>`,
  send: `<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>`,
  sparkles: `<path d="M12 3 10 9l-6 2 6 2 2 6 2-6 6-2-6-2-2-6Z"/><path d="M19 15v4"/><path d="M17 17h4"/>`,
  star: `<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>`,
  target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>`,
  "x-circle": `<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>`
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const completionActions = new Set(["approve", "send", "save_draft", "reject", "answer", "choose", "archive", "request_changes", "edit", "complete", "mark_read"]);
const consequentialMetadataKeys = ["draft", "command", "diff", "rollback", "cost", "recipient", "external"];

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
  if (card.status === "waiting_on_agent") return "waiting on agent";
  if (card.status === "changes_requested") return "changes requested";
  if (card.status === "waiting") {
    if (["approval", "email_approval"].includes(card.type)) return "waiting";
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

function isUserProject(project) {
  return !isDailyBriefProject(project);
}

function isDecisionCard(card) {
  return ["approval", "email_approval", "choice", "question", "comparison"].includes(card.type);
}

function isMutedCard(card) {
  return false;
}

function persistMutedAgents() {
  localStorage.setItem("agentCardsMutedAgents", JSON.stringify([...state.mutedAgents]));
}

function isDailyBriefCard(card) {
  return card.type === "briefing" && isDailyBriefProject(projectName(card));
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

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function isNeededToday(card) {
  const deadline = neededAt(card);
  if (!deadline) return false;
  const { start, end } = todayBounds();
  return deadline >= start && deadline < end;
}

function isTodayDecisionCard(card) {
  return isActionableCard(card) && isDecisionCard(card) && isNeededToday(card);
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
  const briefs = state.cards
    .filter((card) => card.type === "briefing" && isDailyBriefProject(projectName(card)) && !isMutedCard(card))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const activeBriefs = briefs.filter((card) => !archived.has(card.status));
  return activeBriefs.find((card) => card.metadata?.dailyBrief)
    || briefs.find((card) => card.metadata?.dailyBrief)
    || activeBriefs[0]
    || briefs[0];
}

function isDailyBriefProject(project) {
  return String(project || "").trim().toLowerCase() === "daily brief";
}

function expiresSoon(card, hours = 24) {
  if (!card.expiresAt || archived.has(card.status) || isMutedCard(card)) return false;
  const expiresAt = new Date(card.expiresAt).getTime();
  if (Number.isNaN(expiresAt)) return false;
  const diff = expiresAt - Date.now();
  return diff > 0 && diff <= hours * 60 * 60 * 1000;
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
      style: actionStyles[action] || "neutral",
      consequential: false,
      confirmLabel: ""
    };
  }
  if (!action || typeof action !== "object") return null;
  const id = action.id || action.action || "respond";
  const label = action.label && action.label.toLowerCase() !== "edit"
    ? action.label
    : actionLabels[id] || titleize(id);
  return {
    id,
    label,
    style: action.style || actionStyles[id] || "neutral",
    consequential: Boolean(action.consequential),
    confirmLabel: action.confirmLabel || ""
  };
}

function renderAgentAvatar(agent = {}, size = "small") {
  const name = agent.name || "Agent";
  const initial = name.slice(0, 1).toUpperCase();
  const image = agentImageUrl(agent);
  const safeName = escapeHtml(name);
  if (image) {
    return `<span class="avatar avatar-${size}" aria-label="${safeName}">${escapeHtml(initial)}<img src="${escapeHtml(image)}" alt="" onerror="this.remove()"></span>`;
  }
  return `<span class="avatar avatar-${size}" aria-label="${safeName}">${escapeHtml(initial)}</span>`;
}

function agentImageUrl(agent = {}) {
  const image = agent.avatarUrl
    || agent.imageUrl
    || agent.photoUrl
    || agent.picture
    || agent.logoUrl
    || agent.image
    || agent.logo
    || agent.avatar;
  if (typeof image === "string") return image;
  if (image && typeof image === "object" && typeof image.url === "string") return image.url;
  return "";
}

function visibleCards() {
  const byView = state.cards.filter((card) => {
    if (isMutedCard(card) && state.view !== "archive") return false;
    if (state.view === "needs-me") return isNeedsMeCard(card) || state.justHandled.has(card.id);
    if (state.view === "archive") return archived.has(card.status);
    if (state.view === "today") return !isDailyBriefCard(card) && todayDigestCards().some((item) => item.id === card.id);
    return true;
  });

  const byProject = state.project === "all" ? byView : byView.filter((card) => projectName(card) === state.project);

  return byProject.sort(compareCards);
}

function sortedOpenCards() {
  return state.cards
    .filter((card) => isNeedsMeCard(card) && !isMutedCard(card))
    .sort(compareCards);
}

function todayDigestCards() {
  const brief = latestDailyBrief();
  const sourceIds = brief?.metadata?.sourceCards || [];
  const sourceDecisionCards = sourceIds
    .map((cardId) => state.cards.find((card) => card.id === cardId))
    .filter((card) => card && isTodayDecisionCard(card));
  const fallbackDecisionCards = sortedOpenCards()
    .filter((card) => isTodayDecisionCard(card) && !sourceDecisionCards.some((sourceCard) => sourceCard.id === card.id));
  const expiringCards = state.cards
    .filter((card) => isTodayDecisionCard(card) && expiresSoon(card) && !sourceDecisionCards.some((sourceCard) => sourceCard.id === card.id))
    .sort(compareCards);
  const contextCards = [
    brief,
    ...state.cards
    .filter((card) => !archived.has(card.status) && card.type === "status" && !isMutedCard(card))
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 1)
  ].filter(Boolean);
  const actionCards = [...sourceDecisionCards, ...expiringCards, ...fallbackDecisionCards].slice(0, dailyActionLimit());
  return [...contextCards, ...actionCards]
    .filter((card) => card && !archived.has(card.status))
    .filter((card, index, cards) => cards.findIndex((item) => item.id === card.id) === index);
}

function todayBriefCards() {
  return todayDigestCards();
}

function todayActionCards() {
  return todayDigestCards().filter((card) => isTodayDecisionCard(card));
}

function todayContextCards() {
  return todayDigestCards().filter((card) => !isDecisionCard(card));
}

function scopedOpenCards() {
  return sortedOpenCards().filter((card) => state.project === "all" || projectName(card) === state.project);
}

function dailyDecisionCount() {
  return todayActionCards().length;
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
    const previousCards = state.cards;
    state.cards = data.cards;
    state.events = data.events;
    if (version) state.version = version;
    handleNotificationCandidates(previousCards, state.cards);
    $(".status-dot").className = "status-dot online";
    $("#api-status").textContent = "Local";
  } catch (error) {
    $(".status-dot").className = "status-dot offline";
    $("#api-status").textContent = "Offline";
    console.error(error);
  }
  render();
}

function persistNotificationSettings() {
  localStorage.setItem("agentCardsNotificationSettings", JSON.stringify(state.notificationSettings));
}

function persistNotifiedCards() {
  localStorage.setItem("agentCardsNotifiedCards", JSON.stringify([...state.notifiedCardIds].slice(-200)));
}

function notificationSupported() {
  return "Notification" in window;
}

function notificationPermissionGranted() {
  return notificationSupported() && Notification.permission === "granted";
}

function notifyForCard(card, reason) {
  if (!state.notificationSettings.enabled || !notificationPermissionGranted() || isMutedCard(card)) return;
  const key = `${reason}:${card.id}`;
  if (state.notifiedCardIds.has(key)) return;
  state.notifiedCardIds.add(key);
  persistNotifiedCards();
  const notification = new Notification(reason === "daily_brief" ? "Daily brief ready" : reason === "expiring" ? "Card expiring soon" : "High-priority card", {
    body: `${card.agent?.name || "Agent"}: ${card.title}`,
    tag: key
  });
      notification.onclick = () => {
        window.focus();
        if (isDailyBriefCard(card)) state.view = "today";
        else if (archived.has(card.status)) state.view = "archive";
    else state.view = "needs-me";
    render();
  };
}

function handleNotificationCandidates(previousCards, currentCards) {
  if (!state.initializedNotifications) {
    state.initializedNotifications = true;
    return;
  }
  const previousIds = new Set(previousCards.map((card) => card.id));
  currentCards.forEach((card) => {
    if (previousIds.has(card.id)) return;
    if (card.priority === "high" && isNeedsMeCard(card)) notifyForCard(card, "high_priority");
    if (isDailyBriefCard(card)) notifyForCard(card, "daily_brief");
  });
  currentCards
    .filter((card) => expiresSoon(card, state.notificationSettings.expiryMinutes / 60))
    .forEach((card) => notifyForCard(card, "expiring"));
}

async function toggleNotifications() {
  if (!notificationSupported()) return;
  if (!state.notificationSettings.enabled) {
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return;
    state.notificationSettings.enabled = true;
  } else {
    state.notificationSettings.enabled = false;
  }
  persistNotificationSettings();
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
    if (action === "archive") {
      state.justHandled.delete(cardId);
    } else {
      state.justHandled.add(cardId);
    }
    delete state.pendingSelections[cardId];
    await load();
  } catch (error) {
    console.error(error);
    $(".status-dot").className = "status-dot offline";
    $("#api-status").textContent = "Action failed";
  } finally {
    state.pendingAction = null;
    render();
  }
}

function reviewPayload(card) {
  const metadata = card.metadata || {};
  const review = metadata.review || {};
  const draft = editableEmailDraft(card) || metadata.draft || review.draft;
  const risks = metadata.risks || review.risks || [];
  const sections = metadata.sections || review.sections || [];
  const command = metadata.command || review.command;
  const diff = metadata.diff || review.diff;
  const rollback = metadata.rollback || review.rollback;
  const target = draft?.to
    || metadata.recipient
    || review.recipient
    || metadata.target
    || review.target
    || command
    || sections[0]?.title
    || card.details
    || card.summary
    || "This card's proposed action";
  return { metadata, review, draft, risks, sections, command, diff, rollback, target };
}

function editableEmailDraft(card) {
  const metadata = card.metadata || {};
  const review = metadata.review || {};
  const draft = metadata.draft || review.draft;
  if (!draft) return null;
  const edits = state.emailDraftEdits[card.id] || {};
  return { ...draft, ...edits };
}

function emailDraftReady(card) {
  const draft = editableEmailDraft(card);
  return Boolean(
    String(draft?.to || "").trim()
    && String(draft?.subject || "").trim()
    && String(draft?.body || "").trim()
  );
}

function hasReviewableContent(card) {
  const payload = reviewPayload(card);
  return Boolean(
    card.details
    || payload.draft
    || payload.command
    || payload.diff
    || payload.rollback
    || payload.sections.length
    || payload.risks.length
  );
}

function shouldConfirmAction(card, action) {
  if (action === "save_draft") return false;
  if (["approve", "reject", "send"].includes(action)) return false;
  const actionConfig = (card.actions || []).map(normalizeAction).find((item) => item.id === action);
  const metadata = card.metadata || {};
  const review = metadata.review || {};
  const hasConsequentialMetadata = consequentialMetadataKeys.some((key) => metadata[key] || review[key]);
  return Boolean(
    actionConfig?.consequential
    || hasConsequentialMetadata
    || reviewPayload(card).risks.length
  );
}

function confirmationSnapshot(card, action) {
  const actionConfig = (card.actions || []).map(normalizeAction).find((item) => item.id === action);
  const payload = reviewPayload(card);
  const isRequestChanges = ["edit", "request_changes"].includes(action);
  return {
    risks: payload.risks,
    target: payload.target,
    agentWill: isRequestChanges
      ? `${card.agent?.name || "Agent"} will revise the proposed work and post an updated card.`
      : whyNow(card),
    actionLabel: actionConfig?.confirmLabel || actionConfig?.label || actionLabels[action] || titleize(action)
  };
}

function openConsequenceSheet(cardId, action, options = {}) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;
  state.consequenceSheet = {
    cardId,
    action,
    payload: options.payload || {},
    mode: options.mode || (["edit", "request_changes"].includes(action) ? "request_changes" : "confirm"),
    requestChanges: ""
  };
  render();
  setTimeout(() => {
    const target = $("#sheet-request-changes") || $("[data-confirm-sheet='true']") || $(".sheet-close-button");
    target?.focus();
  }, 0);
}

function closeConsequenceSheet() {
  state.consequenceSheet = null;
  render();
}

async function submitConsequenceSheet() {
  const sheet = state.consequenceSheet;
  if (!sheet || state.pendingAction) return;
  const card = state.cards.find((item) => item.id === sheet.cardId);
  if (!card || !isActionableCard(card)) {
    closeConsequenceSheet();
    await load();
    return;
  }
  const snapshot = confirmationSnapshot(card, sheet.action);
  if (sheet.mode === "confirm" && ["approval", "email_approval"].includes(card.type) && !hasReviewableContent(card)) return;
  if (sheet.mode === "request_changes" && !sheet.requestChanges.trim()) {
    state.consequenceSheet.error = "Tell the agent what to change before sending.";
    render();
    return;
  }
  const payload = {
    ...sheet.payload,
    ...(sheet.mode === "confirm" ? { confirmed: true, confirmationShown: snapshot } : {}),
    ...(sheet.mode === "request_changes" ? { requestChanges: sheet.requestChanges.trim() } : {})
  };
  state.consequenceSheet = null;
  await respond(sheet.cardId, sheet.action, payload);
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

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  const main = $(".main-grid");
  if (main) main.scrollTop = 0;
}

function projectOptions() {
  return [...new Set(state.cards.map(projectName).filter(isUserProject))].sort((a, b) => a.localeCompare(b));
}

function renderProjectFilter() {
  const select = $("#project-filter");
  select.hidden = state.view === "today" || state.view === "projects";
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
  if (state.view === "today") {
    node.hidden = false;
    node.innerHTML = renderTodayDashboard();
    return;
  }
  if (state.view === "projects") {
    node.hidden = false;
    node.innerHTML = renderProjectPills();
    return;
  }
  node.hidden = true;
  node.innerHTML = "";
}

function textIncludes(value, terms) {
  const text = String(value || "").toLowerCase();
  return terms.some((term) => text.includes(term));
}

function cardSearchText(card) {
  return [
    card.title,
    card.summary,
    card.details,
    projectName(card),
    card.agent?.name,
    JSON.stringify(card.metadata || {})
  ].filter(Boolean).join(" ");
}

function formatTodayDate() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function todayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning, Alex";
  if (hour < 17) return "Good afternoon, Alex";
  return "Good evening, Alex";
}

function dashboardMetric({ tone = "orange", iconName = "check-circle", title, detail, actionLabel, cardId }) {
  return `
    <div class="today-metric metric-${escapeHtml(tone)}">
      <span class="metric-icon">${icon(iconName)}</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(detail)}</p>
      ${cardId
        ? `<button type="button" data-open-card="${escapeHtml(cardId)}">${escapeHtml(actionLabel || "Open")} ${icon("chevron-right")}</button>`
        : `<span class="metric-note">${escapeHtml(actionLabel || "All clear")}</span>`}
    </div>
  `;
}

function dashboardList(items, limit = 3) {
  return items.slice(0, limit).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

const weatherCardImages = {
  clear_morning: "/assets/generated/today/optimized/weather_generated_clear_morning.webp",
  clear_day: "/assets/generated/today/optimized/weather_generated_clear_day.webp",
  clear_evening: "/assets/generated/today/optimized/weather_generated_clear_evening.webp",
  clear_night: "/assets/generated/today/optimized/weather_generated_clear_evening.webp",
  cloudy_morning: "/assets/generated/today/optimized/weather_generated_cloudy_day.webp",
  cloudy_day: "/assets/generated/today/optimized/weather_generated_cloudy_day.webp",
  cloudy_evening: "/assets/generated/today/optimized/weather_generated_cloudy_day.webp",
  cloudy_night: "/assets/generated/today/optimized/weather_generated_cloudy_day.webp",
  rainy_morning: "/assets/generated/today/optimized/weather_generated_rainy_day.webp",
  rainy_day: "/assets/generated/today/optimized/weather_generated_rainy_day.webp",
  rainy_evening: "/assets/generated/today/optimized/weather_generated_rainy_day.webp",
  rainy_night: "/assets/generated/today/optimized/weather_generated_rainy_day.webp",
  stormy_morning: "/assets/generated/today/optimized/weather_generated_stormy_evening.webp",
  stormy_day: "/assets/generated/today/optimized/weather_generated_stormy_evening.webp",
  stormy_evening: "/assets/generated/today/optimized/weather_generated_stormy_evening.webp",
  stormy_night: "/assets/generated/today/optimized/weather_generated_stormy_evening.webp",
  hazy_morning: "/assets/generated/today/optimized/weather_generated_hazy_morning.webp",
  hazy_day: "/assets/generated/today/optimized/weather_generated_hazy_morning.webp",
  hazy_evening: "/assets/generated/today/optimized/weather_generated_hazy_morning.webp",
  hazy_night: "/assets/generated/today/optimized/weather_generated_hazy_morning.webp",
  snowy_morning: "/assets/generated/today/optimized/weather_generated_snowy_day.webp",
  snowy_day: "/assets/generated/today/optimized/weather_generated_snowy_day.webp",
  snowy_evening: "/assets/generated/today/optimized/weather_generated_snowy_day.webp",
  snowy_night: "/assets/generated/today/optimized/weather_generated_snowy_day.webp"
};

function currentTimeOfDay(date = new Date()) {
  const hour = date.getHours();
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "day";
  if (hour < 21) return "evening";
  return "night";
}

function normalizeWeatherCondition(weather = {}) {
  const explicit = String(weather.condition || weather.weather || "").trim().toLowerCase();
  if (/(snow|sleet|flurr)/.test(explicit)) return "snowy";
  if (/(storm|thunder|lightning)/.test(explicit)) return "stormy";
  if (/(rain|drizzle|shower)/.test(explicit)) return "rainy";
  if (/(fog|haze|mist|dust|smog)/.test(explicit)) return "hazy";
  if (/(cloud|overcast)/.test(explicit)) return "cloudy";
  if (/(sun|clear|fair)/.test(explicit)) return "clear";
  const text = [
    weather.title,
    weather.summary,
    weather.text,
    weather.message,
    weather.description
  ].filter(Boolean).join(" ").toLowerCase();
  if (/(snow|sleet|flurr)/.test(text)) return "snowy";
  if (/(storm|thunder|lightning)/.test(text)) return "stormy";
  if (/(rain|drizzle|shower)/.test(text)) return "rainy";
  if (/(fog|haze|mist|dust|smog)/.test(text)) return "hazy";
  if (/(cloud|overcast|fog|haze|mist)/.test(text)) return "cloudy";
  return "clear";
}

function normalizeTimeOfDay(value, weather = {}) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["morning", "day", "afternoon", "evening", "night"].includes(normalized)) {
    return normalized === "afternoon" ? "day" : normalized;
  }
  const weatherText = [
    weather.title,
    weather.summary,
    weather.text,
    weather.message,
    weather.description
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\bmorning\b/.test(weatherText)) return "morning";
  if (/\b(noon|afternoon|day)\b/.test(weatherText)) return "day";
  if (/\bevening\b/.test(weatherText)) return "evening";
  if (/\b(night|overnight)\b/.test(weatherText)) return "night";
  return currentTimeOfDay();
}

function weatherImageFor(weather = {}) {
  const condition = normalizeWeatherCondition(weather);
  const timeOfDay = normalizeTimeOfDay(weather.timeOfDay || weather.period, weather);
  const imageKey = weather.imageKey || weather.assetKey || `${condition}_${timeOfDay}`;
  return weatherCardImages[imageKey]
    || weatherCardImages[`${condition}_${timeOfDay}`]
    || weatherCardImages.clear_evening;
}

function numericTemperature(source = {}) {
  const value = source.tempC ?? source.temperatureC ?? source.celsius ?? source.temp ?? source.temperature;
  const match = String(value ?? "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function weatherTemperatureView(source = {}) {
  const unit = String(source.unit || source.units || source.temperatureUnit || "C").toUpperCase().startsWith("F") ? "F" : "C";
  const explicitC = source.tempC ?? source.temperatureC ?? source.celsius;
  const explicitF = source.tempF ?? source.temperatureF ?? source.fahrenheit;
  const base = numericTemperature(source);
  const celsius = explicitC !== undefined ? Number(String(explicitC).match(/-?\d+(\.\d+)?/)?.[0]) : unit === "C" ? base : explicitF !== undefined ? Math.round((Number(String(explicitF).match(/-?\d+(\.\d+)?/)?.[0]) - 32) * 5 / 9) : null;
  const fahrenheit = explicitF !== undefined ? Number(String(explicitF).match(/-?\d+(\.\d+)?/)?.[0]) : unit === "F" ? base : celsius !== null ? Math.round((celsius * 9 / 5) + 32) : null;
  const primaryValue = unit === "F" ? fahrenheit : celsius;
  const secondaryValue = unit === "F" ? celsius : fahrenheit;
  if (primaryValue !== null && Number.isFinite(primaryValue)) {
    return {
      primary: `${Math.round(primaryValue)}°${unit}`,
      secondary: secondaryValue !== null && Number.isFinite(secondaryValue) ? `${Math.round(secondaryValue)}°${unit === "F" ? "C" : "F"}` : ""
    };
  }
  const fallback = source.temp || source.temperature || "22°";
  return {
    primary: /[CF]\b/.test(String(fallback)) ? String(fallback) : `${fallback}${unit}`,
    secondary: ""
  };
}

function weatherDetailItems(source = {}) {
  const details = Array.isArray(source.details) ? source.details : Array.isArray(source.metrics) ? source.metrics : [];
  const normalized = details.map((item) => typeof item === "string" ? item : [item.label || item.title, item.value || item.text].filter(Boolean).join(" "));
  const direct = [
    source.feelsLike ? `Feels ${source.feelsLike}` : "",
    source.wind ? `Wind ${source.wind}` : "",
    source.humidity ? `Humidity ${source.humidity}` : "",
    source.precipitation || source.rainChance ? `Rain ${source.precipitation || source.rainChance}` : ""
  ].filter(Boolean);
  return [...normalized, ...direct].filter(Boolean).slice(0, 4);
}

function weatherBriefViewModel(weather) {
  const source = weather && typeof weather === "object" ? weather : {};
  const condition = normalizeWeatherCondition(source);
  const timeOfDay = normalizeTimeOfDay(source.timeOfDay || source.period, source);
  const title = source.title || `${titleize(condition)} ${timeOfDay}`;
  const text = source.text || source.message || source.summary || source.description || "Good window for errands after 17:30.";
  const location = source.location || source.place || "Sample City";
  const temp = weatherTemperatureView(source);
  return {
    temp: temp.primary,
    tempAlt: source.tempAlt || source.temperatureAlt || temp.secondary,
    title,
    text,
    location,
    details: weatherDetailItems(source),
    imageUrl: weatherImageFor(source),
    tone: `${condition}-${timeOfDay}`
  };
}

const todayCardSlots = ["weather", "priorities", "newsfeed", "focus", "email", "calendar", "openItems"];

function todayGreetingViewModel(daily = {}, brief = null) {
  const configured = daily.greeting || daily.header || {};
  if (typeof configured === "string") {
    return {
      title: configured,
      subtitle: daily.openItems?.summary || brief?.summary || ""
    };
  }
  const name = configured.name || configured.recipientName || daily.name || daily.recipientName || "Alex";
  const salutation = configured.salutation || configured.text || todayGreeting().replace(/, .*/, "");
  const title = configured.title || `${salutation}, ${name}!`;
  return {
    title,
    subtitle: configured.subtitle || configured.summary || daily.openItems?.summary || brief?.summary || ""
  };
}

function todayCardConfigMap(daily = {}) {
  return (daily.cards || daily.enabledCards || [])
    .filter((item) => item && typeof item === "object")
    .reduce((map, item) => {
      const id = item.id || item.type || item.card;
      if (todayCardSlots.includes(id)) map[id] = item;
      return map;
    }, {});
}

function todaySlotData(daily = {}, slot, fallback = {}) {
  const config = todayCardConfigMap(daily)[slot] || {};
  return config.data || config.content || config[slot] || fallback;
}

function todaySlotEnabled(daily = {}, slot, fallbackEnabled = false) {
  const configs = todayCardConfigMap(daily);
  if (Object.keys(configs).length) return configs[slot]?.enabled === true;
  return fallbackEnabled;
}

function cardForBriefItem(item) {
  const cardId = item?.cardId || item?.id || item?.sourceCardId;
  return cardId ? state.cards.find((card) => card.id === cardId) : null;
}

function isTodayBriefItem(item) {
  const card = cardForBriefItem(item);
  if (card) return isTodayDecisionCard(card);
  return Boolean(item?.neededAt || item?.dueAt || item?.dueDate) && isNeededToday(item);
}

function todayEmailItems(daily = {}, cards = []) {
  const configured = todaySlotData(daily, "email", daily.email || daily.emails || []);
  const items = Array.isArray(configured?.items) ? configured.items : Array.isArray(configured) ? configured : daily.emails || [];
  if (items.length) return items.slice(0, 3);
  return cards
    .filter((card) => !isDailyBriefCard(card) && (card.type === "email_approval" || textIncludes(cardSearchText(card), ["email", "inbox", "reply"])))
    .slice(0, 3)
    .map((card) => ({
      from: card.agent?.name || "Agent",
      subject: card.title,
      summary: card.summary,
      cardId: card.id
    }));
}

function todayCalendarItems(daily = {}) {
  const calendar = todaySlotData(daily, "calendar", daily.calendar || {});
  if (Array.isArray(calendar)) return calendar.slice(0, 3);
  if (Array.isArray(calendar.items)) return calendar.items.slice(0, 3);
  if (Array.isArray(calendar.events)) return calendar.events.slice(0, 3);
  return calendar.title || calendar.summary ? [calendar] : [];
}

function todayOpenItemRows(daily = {}, actionCards = [], topPriorities = []) {
  const configured = todaySlotData(daily, "openItems", daily.openItems || {});
  if (Array.isArray(configured)) return configured.filter(isTodayBriefItem).slice(0, 4);
  if (Array.isArray(configured.items)) return configured.items.filter(isTodayBriefItem).slice(0, 4);
  if (daily.projects?.length) {
    return daily.projects.filter(isTodayBriefItem).slice(0, 4).map((project) => ({
      title: project.name || project.title || "Project",
      summary: project.status || project.summary || ""
    }));
  }
  return (topPriorities.length ? topPriorities : actionCards).slice(0, 4).map((card) => ({
    title: card.title,
    summary: cardActionSentence(card),
    cardId: card.id
  }));
}

function todayPriorityRows(daily = {}, topPriorities = [], actionCards = []) {
  const configured = todaySlotData(daily, "priorities", daily.priorities || {});
  if (Array.isArray(configured)) return configured.filter(isTodayBriefItem).slice(0, 3);
  if (Array.isArray(configured.items)) return configured.items.filter(isTodayBriefItem).slice(0, 3);
  if (Array.isArray(configured.cards)) return configured.cards.filter(isTodayBriefItem).slice(0, 3);
  return (topPriorities.length ? topPriorities : actionCards).slice(0, 3).map((card) => ({
    title: card.title,
    summary: cardActionSentence(card),
    cardId: card.id,
    color: card.priority === "high" ? "purple" : card.priority === "medium" ? "green" : "blue"
  }));
}

function todayNewsfeedItems(daily = {}) {
  const configured = todaySlotData(daily, "newsfeed", daily.newsfeed || daily.news || []);
  const items = Array.isArray(configured?.items) ? configured.items : Array.isArray(configured) ? configured : daily.news || [];
  return items.slice(0, 3);
}

function todayFocusItem(daily = {}, topPriorities = [], calendar = {}) {
  const configured = todaySlotData(daily, "focus", daily.focus || daily.recommendation || {});
  if (typeof configured === "string") return { title: "Start here", summary: configured };
  if (configured.title || configured.summary || configured.text) return configured;
  const first = topPriorities[0];
  return {
    title: calendar?.title || "Start here",
    summary: calendar?.summary || cardActionSentence(first) || "No priority decisions queued.",
    cardId: first?.id || ""
  };
}

function enabledTodaySlots(daily = {}, { emails = [], calendarItems = [], openItems = [], hasFocus = true } = {}) {
  const hasExplicitConfig = Object.keys(todayCardConfigMap(daily)).length > 0;
  if (hasExplicitConfig) return todayCardSlots.filter((slot) => todaySlotEnabled(daily, slot));
  return [
    daily.weather ? "weather" : "",
    openItems.length ? "priorities" : "",
    daily.news?.length || daily.newsfeed?.length ? "newsfeed" : "",
    hasFocus ? "focus" : "",
    emails.length ? "email" : "",
    calendarItems.length ? "calendar" : "",
    openItems.length ? "openItems" : ""
  ].filter(Boolean);
}

function briefCardAction(cardId, label = "Open card") {
  return cardId ? `<button type="button" data-open-card="${escapeHtml(cardId)}">${escapeHtml(label)} ${icon("chevron-right")}</button>` : "";
}

function renderTodayEmailCard(emails = []) {
  return `
    <article class="today-brief-card today-email-card">
      <header><span>${icon("message")}</span><div><strong>Top email</strong><p>${emails.length} item${emails.length === 1 ? "" : "s"} surfaced</p></div></header>
      <div class="today-list">
        ${emails.slice(0, 3).map((item) => `
          <div>
            <b>${escapeHtml(item.from || item.sender || "Agent")}</b>
            <strong>${escapeHtml(item.subject || item.title || "Email")}</strong>
            <p>${escapeHtml(item.summary || item.whyItMatters || "")}</p>
            ${briefCardAction(item.cardId)}
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderTodayCalendarCard(items = []) {
  return `
    <article class="today-brief-card today-calendar-card">
      <header><span>${icon("calendar")}</span><div><strong>Calendar</strong><p>${items.length ? "Timing that may affect the day" : "No calendar notes"}</p></div></header>
      <div class="today-list compact">
        ${items.length ? items.map((item) => `
          <div>
            <b>${escapeHtml(item.time || item.when || "Today")}</b>
            <strong>${escapeHtml(item.title || "Calendar note")}</strong>
            <p>${escapeHtml(item.summary || item.detail || "")}</p>
          </div>
        `).join("") : `<div><strong>Clear today</strong><p>No schedule conflicts were included in this brief.</p></div>`}
      </div>
    </article>
  `;
}

function renderTodayOpenItemsCard(items = []) {
  return `
    <article class="today-brief-card today-open-card">
      <header><span>${icon("inbox")}</span><div><strong>Needs attention</strong><p>${items.length} item${items.length === 1 ? "" : "s"} from agents</p></div></header>
      <div class="today-list">
        ${items.length ? items.map((item) => `
          <div>
            <strong>${escapeHtml(item.title || item.name || "Open item")}</strong>
            <p>${escapeHtml(item.summary || item.status || item.body || "")}</p>
            ${briefCardAction(item.cardId)}
          </div>
        `).join("") : `<div><strong>Nothing waiting</strong><p>No follow-ups were included in this brief.</p></div>`}
      </div>
    </article>
  `;
}

function renderTodayPrioritiesCard(items = []) {
  return `
    <article class="today-brief-card today-priorities-card">
      <header><span>${icon("star")}</span><div><strong>Top 3 priorities</strong><p>${items.length} item${items.length === 1 ? "" : "s"} to orient the day</p></div></header>
      <ol class="today-priority-list">
        ${items.length ? items.slice(0, 3).map((item) => `
          <li>
            ${item.cardId ? `<button class="today-priority-row" type="button" data-open-card="${escapeHtml(item.cardId)}">` : `<div class="today-priority-row">`}
              <span>
                <strong>${escapeHtml(item.title || item.name || item.summary || "Priority")}</strong>
                ${(item.summary || item.description) && (item.summary || item.description) !== item.title ? `<p>${escapeHtml(item.summary || item.description)}</p>` : ""}
              </span>
            ${item.cardId ? "</button>" : "</div>"}
          </li>
        `).join("") : `<li><span class="priority-dot priority-green">${icon("check-circle")}</span><div><strong>No priority decisions queued.</strong></div></li>`}
      </ol>
      <span class="priorities-mountain" aria-hidden="true"></span>
    </article>
  `;
}

function renderTodayNewsfeedCard(items = []) {
  return `
    <article class="today-brief-card today-newsfeed-card">
      <header><span>${icon("file-text")}</span><div><strong>Newsfeed</strong><p>${items.length} update${items.length === 1 ? "" : "s"} worth knowing</p></div></header>
      <div class="today-news-list">
        ${items.length ? items.map((item) => {
          const sourceUrl = item.url || item.href || item.link || "";
          return `
            <div>
              <strong>${escapeHtml(item.title || item.headline || "Update")}</strong>
              <p>${escapeHtml(item.summary || item.whyItMatters || item.body || "")}</p>
              ${item.source ? `<span>${escapeHtml(item.source)}</span>` : ""}
              ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Read source ${icon("chevron-right")}</a>` : ""}
              ${item.cardId ? briefCardAction(item.cardId) : ""}
            </div>
          `;
        }).join("") : `<div><strong>No updates</strong><p>The agent did not include news for this brief.</p></div>`}
      </div>
    </article>
  `;
}

function renderTodayFocusCard(focus = {}) {
  return `
    <article class="today-brief-card today-focus-card">
      <header><span>${icon("target")}</span><div><strong>First move</strong><p>${escapeHtml(focus.label || "Recommended by the agent")}</p></div></header>
      <h3>${escapeHtml(focus.title || "Start here")}</h3>
      <p>${escapeHtml(focus.summary || focus.text || "")}</p>
      ${briefCardAction(focus.cardId, focus.actionLabel || "Open card")}
    </article>
  `;
}

function renderTodayWeatherCard(weather) {
  return `
    <article class="today-brief-card today-weather-card weather-${escapeHtml(weather.tone)}">
      <img class="weather-image" src="${escapeHtml(weather.imageUrl)}" alt="" loading="lazy">
      <div class="weather-overlay" aria-hidden="true"></div>
      <div class="weather-content">
        <div class="weather-card-head">
          <strong>${escapeHtml(weather.temp)}</strong>
          ${weather.tempAlt ? `<span>${escapeHtml(weather.tempAlt)}</span>` : ""}
        </div>
        <div class="weather-card-copy">
          <span>${escapeHtml(weather.location)}</span>
          <h3>${escapeHtml(weather.title)}</h3>
          <p>${escapeHtml(weather.text)}</p>
          ${weather.details?.length ? `<ul class="weather-details">${weather.details.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        </div>
      </div>
    </article>
  `;
}

function firstCardId(cards) {
  return cards.find(Boolean)?.id || "";
}

function cardActionSentence(card) {
  if (!card) return "";
  const agent = card.agent?.name || "the agent";
  if (card.type === "email_approval") return `Review the email from ${agent}, then send it or save it as a draft.`;
  if (card.type === "approval") return `Decide whether to approve: ${card.summary || card.title}`;
  if (card.type === "comparison") return `Choose the best path for ${projectName(card)}.`;
  if (card.type === "choice") return `Pick one option so ${agent} knows what to do next.`;
  if (card.type === "question") return `Answer the blocker so ${agent} can continue.`;
  if (card.type === "checklist") return `Finish the checklist for ${projectName(card)}.`;
  if (card.type === "status") return `Read the latest update from ${agent}.`;
  return card.summary || card.title;
}

function renderTodayDashboard() {
  const cards = todayDigestCards();
  const actionCards = todayActionCards();
  const brief = latestDailyBrief();
  const daily = brief?.metadata?.dailyBrief || {};
  const weatherSource = todaySlotData(daily, "weather", daily.weather);
  const weather = weatherBriefViewModel(weatherSource);
  const calendar = todaySlotData(daily, "calendar", daily.calendar || {});
  const deadlines = cards.filter((card) => expiresSoon(card) || neededAt(card));
  const meetingPrep = cards.filter((card) => textIncludes(cardSearchText(card), ["meeting", "prep", "review", "call"]));
  const topPriorities = actionCards
    .slice()
    .sort(compareCards)
    .slice(0, 3);
  const summary = daily.openItems?.summary || brief?.summary || `${actionCards.length} decision${actionCards.length === 1 ? "" : "s"} need review today.`;
  const emails = todayEmailItems(daily, cards);
  const calendarItems = todayCalendarItems(daily);
  const openItems = todayOpenItemRows(daily, actionCards, topPriorities);
  const priorityItems = todayPriorityRows(daily, topPriorities, actionCards);
  const newsfeed = todayNewsfeedItems(daily);
  const focus = todayFocusItem(daily, topPriorities, calendar);
  const greeting = todayGreetingViewModel(daily, brief);
  const enabledSlots = enabledTodaySlots(daily, { emails, calendarItems, openItems, hasFocus: Boolean(focus) })
    .filter((slot) => slot !== "priorities" || priorityItems.length)
    .filter((slot) => slot !== "openItems" || openItems.length)
    .filter((slot) => slot !== "focus" || focus.cardId || focus.title || focus.summary || focus.text);
  const slotRenderers = {
    weather: () => renderTodayWeatherCard(weather),
    priorities: () => renderTodayPrioritiesCard(priorityItems),
    newsfeed: () => renderTodayNewsfeedCard(newsfeed),
    focus: () => renderTodayFocusCard(focus),
    email: () => renderTodayEmailCard(emails),
    calendar: () => renderTodayCalendarCard(calendarItems),
    openItems: () => renderTodayOpenItemsCard(openItems)
  };
  const heroSlots = ["weather", "priorities"].filter((slot) => enabledSlots.includes(slot));
  const restSlots = enabledSlots.filter((slot) => !heroSlots.includes(slot));

  return `
    <section class="today-dashboard">
      <div class="today-brief-grid">
        <div class="today-brief-header">
          <div>
            <span>${escapeHtml(formatTodayDate())}</span>
            <h2>${escapeHtml(greeting.title)}</h2>
            <p>${escapeHtml(greeting.subtitle || summary)}</p>
          </div>
          <aside>
            <strong>${enabledSlots.length}</strong>
            <span>brief cards</span>
          </aside>
        </div>
        ${[...heroSlots, ...restSlots].map((slot) => slotRenderers[slot]?.() || "").join("")}
      </div>
    </section>
  `;
}

function renderProjectPills() {
  const projects = projectOptions();
  if (!projects.length) return "";
  return `
    <div class="project-pill-row" aria-label="Projects">
      ${projects.map((project) => `
        <button class="project-pill ${state.project === project ? "active" : ""}" type="button" data-project-jump="${escapeHtml(project)}">
          ${escapeHtml(project)}
        </button>
      `).join("")}
    </div>
  `;
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
    projects: projectOptions().length,
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
  $("#app").classList.toggle("view-today", state.view === "today");
  $("#app").classList.toggle("detail-open", false);
  if (state.view === "projects" && state.project === "all") {
    state.project = projectOptions()[0] || "all";
  }
  renderVersion();
  renderNotificationButton();
  renderProjectFilter();

  $("#view-title").textContent = views[state.view].title;
  $("#view-subtitle").textContent = views[state.view].subtitle;
  const devMode = new URLSearchParams(window.location.search).has("dev");
  $("#seed-demo").hidden = !devMode;
  $(".toolbar").hidden = !devMode && (state.view === "today" || state.view === "projects");
  renderTaskProgress(counts);
  renderBriefSummary();

  const cards = visibleCards();
  $("#cards").innerHTML = cards.map(renderCard).join("");
  renderEmptyState(cards);
  renderConsequenceSheet();
}

function renderNotificationButton() {
  const button = $("#notification-toggle");
  if (!button) return;
  button.hidden = !notificationSupported();
  if (button.hidden) return;
  const enabled = state.notificationSettings.enabled && notificationPermissionGranted();
  button.classList.toggle("is-on", enabled);
  button.innerHTML = `${icon("bell")}<span>${enabled ? "Alerts on" : "Alerts off"}</span>`;
  button.setAttribute("aria-label", enabled ? "Disable alerts" : "Enable alerts");
}

function renderEmptyState(cards) {
  const node = $("#empty-state");
  node.hidden = cards.length > 0;
  if (cards.length > 0) return;
  const hasAnyCards = state.cards.length > 0;
  const devMode = new URLSearchParams(window.location.search).has("dev");
  const title = hasAnyCards ? "No cards match this view" : "No cards yet";
  const copy = hasAnyCards
    ? "Try All projects, or open another section."
    : "Try the demo or connect an agent to create your first card.";
  node.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(copy)}</p>
    <div class="empty-actions">
      ${devMode ? `<button id="empty-seed-demo" class="primary-button" type="button">${icon("sparkles")}Try demo</button>` : ""}
      <a class="ghost-button" href="/AGENT_INTEGRATION.md" target="_blank" rel="noreferrer">${icon("file-text")}Connect an agent</a>
    </div>
    <div class="empty-command-list" aria-label="Create your first card">
      <code>npm run seed</code>
      <code>node cli/agent-cards.js create examples/approval-card.json</code>
      <code>POST /api/cards</code>
    </div>
  `;
}

function renderTaskProgress(counts) {
  const node = $("#task-progress");
  const show = state.view === "needs-me";
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
  return `
    <article class="card card--${escapeHtml(card.type)} accent-${escapeHtml(meta.accent)} ${state.selectedId === card.id ? "selected" : ""} ${pending ? "is-responding" : ""}" data-card-id="${escapeHtml(card.id)}">
      <div class="card-header">
        <div class="agent-line">
          ${renderAgentAvatar(card.agent)}
          <span><strong>${escapeHtml(card.agent?.name || "Agent")}</strong><small>${escapeHtml(projectName(card))} · ${escapeHtml(time)}</small></span>
        </div>
        ${typeBadge(card)}
      </div>
      <h3>${escapeHtml(card.title)}</h3>
      ${card.type === "briefing" ? "" : `<p class="summary">${escapeHtml(card.summary)}</p>`}
      ${renderCardBody(card)}
      ${shouldShowHandledMessage(card) ? `<div class="handled-note">${escapeHtml(handledMessage(card))}</div>` : ""}
      ${renderSwipeHint(card)}
      ${renderActions(card)}
      ${pending ? renderActionOverlay(pending) : ""}
    </article>
  `;
}

function shouldShowHandledMessage(card) {
  if (!state.justHandled.has(card.id)) return false;
  if (card.type === "choice" && latestEvent(card.id, "choose")) return false;
  return true;
}

function handledMessage(card) {
  const event = latestEvent(card.id);
  if (event?.action === "mark_read") return "Marked as read.";
  if (event?.action === "save_draft") return "Saved as draft.";
  if (event?.action === "send") return "Sent.";
  if (event?.action === "approve") return "Approved.";
  if (event?.action === "reject") return "Not approved.";
  if (event?.action === "answer") return "Answer sent.";
  if (event?.action === "choose") return "Choice submitted.";
  if (event?.action === "complete") return "Completed.";
  return "Done.";
}

function actionVerb(card) {
  if (["approval", "email_approval"].includes(card.type)) {
    const action = (card.actions || []).map(normalizeAction).find((item) => ["send", "approve"].includes(item.id));
    return action?.label || "Approve action";
  }
  if (card.type === "question") return "Answer blocker";
  if (card.type === "choice") return "Choose option";
  if (card.type === "comparison") return "Choose path";
  if (card.type === "checklist") return "Track checklist";
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
  return "";
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

function renderConsequenceSheet() {
  const root = $("#modal-root");
  const sheet = state.consequenceSheet;
  if (!sheet) {
    root.innerHTML = "";
    return;
  }
  const card = state.cards.find((item) => item.id === sheet.cardId);
  if (!card) {
    root.innerHTML = "";
    return;
  }
  const actionConfig = (card.actions || []).map(normalizeAction).find((item) => item.id === sheet.action) || normalizeAction(sheet.action);
  const isRequestChanges = sheet.mode === "request_changes";
  const title = isRequestChanges ? "Request changes" : (actionConfig?.label || titleize(sheet.action));
  const primaryLabel = isRequestChanges ? "Send request" : (actionConfig?.label || titleize(sheet.action));
  const detailText = card.details || card.summary || "";
  root.innerHTML = `
    <div class="modal-backdrop" role="presentation" data-close-sheet="true"></div>
    <section class="consequence-sheet" role="dialog" aria-modal="true" aria-labelledby="consequence-title">
      <button class="sheet-close-button" type="button" data-close-sheet="true" aria-label="Cancel">Cancel</button>
      <div class="sheet-header">
        <div>
          <span>${escapeHtml(card.agent?.name || "Agent")} · ${escapeHtml(projectName(card))}</span>
          <h2 id="consequence-title">${escapeHtml(title)}</h2>
        </div>
      </div>
      ${detailText ? `<p class="sheet-copy">${escapeHtml(detailText)}</p>` : ""}
      <section class="sheet-section">
        <h3>What should change?</h3>
        <textarea class="sheet-textarea" id="sheet-request-changes" rows="4" placeholder="Tell the agent exactly what to change.">${escapeHtml(sheet.requestChanges)}</textarea>
        ${sheet.error ? `<p class="sheet-error">${escapeHtml(sheet.error)}</p>` : ""}
      </section>
      <div class="sheet-actions">
        <button class="${actionConfig?.style === "danger" ? "danger-button" : "primary-button"}" type="button" data-confirm-sheet="true">${icon(actionIcons[sheet.action] || "check-circle")}${escapeHtml(primaryLabel)}</button>
      </div>
    </section>
  `;
}

function renderSheetReviewSummary(card) {
  const payload = reviewPayload(card);
  const lines = [];
  if (payload.draft?.to) lines.push(["To", payload.draft.to]);
  if (payload.draft?.subject) lines.push(["Subject", payload.draft.subject]);
  if (payload.command) lines.push(["Command", payload.command]);
  if (payload.diff) lines.push(["Diff", payload.diff]);
  if (payload.rollback) lines.push(["Rollback", payload.rollback]);
  if (!lines.length && payload.sections.length) lines.push([payload.sections[0].title || "Review", payload.sections[0].body || payload.sections[0].text || "Review notes provided"]);
  if (!lines.length) lines.push(["Context", card.details || card.summary || "No extra review payload provided."]);
  return `
    <section class="sheet-section">
      <h3>Review payload</h3>
      <div class="review-box sheet-review-box">
        ${lines.slice(0, 4).map(([label, value]) => `
          <div class="review-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>
        `).join("")}
      </div>
    </section>
  `;
}

function hasRequestChangesAction(card) {
  return (card?.actions || []).map(normalizeAction).some((action) => ["edit", "request_changes"].includes(action.id));
}

function renderCardBody(card) {
  if (card.type === "email_approval") {
    const draft = editableEmailDraft(card);
    if (!draft) return "";
    const body = String(draft.body || "").trim();
    return `
      <div class="email-preview">
        <div class="email-preview-meta">
          <label>
            <span>To</span>
            <input class="email-field-editor" data-email-field="${escapeHtml(card.id)}" data-email-key="to" value="${escapeHtml(draft.to || "")}" aria-label="Email recipient">
          </label>
          <label>
            <span>Subject</span>
            <input class="email-field-editor email-subject-editor" data-email-field="${escapeHtml(card.id)}" data-email-key="subject" value="${escapeHtml(draft.subject || "")}" aria-label="Email subject">
          </label>
        </div>
        <textarea class="email-body-editor" data-email-body="${escapeHtml(card.id)}" aria-label="Email body">${escapeHtml(body)}</textarea>
      </div>
    `;
  }

  if (card.type === "approval") {
    return "";
  }

  if (card.type === "choice") {
    const choice = latestEvent(card.id, "choose");
    const selectedOptionId = choice?.payload?.optionId;
    const pendingOptionId = isActionableCard(card) ? state.pendingSelections[card.id] : null;
    const options = (card.options || []).slice(0, 4).map((option) => `
      ${isActionableCard(card) ? `<button class="option-card${pendingOptionId === option.id ? " is-selected" : ""}" data-select-option="${escapeHtml(card.id)}" data-option-id="${escapeHtml(option.id)}" type="button">` : `<div class="option-card option-card-readonly ${selectedOptionId === option.id ? "is-selected" : ""}">`}
        <span class="option-radio"></span>
        <strong>${escapeHtml(option.title || option.label || option.id || "Option")}</strong>
        <span>${escapeHtml(option.description || "")}</span>
      ${isActionableCard(card) ? "</button>" : "</div>"}
    `).join("");
    const selected = (card.options || []).find((option) => option.id === selectedOptionId);
    const result = selected ? `
      <div class="handled-note">Choice recorded.</div>
    ` : "";
    const submitButton = `
      <div class="actions choice-submit">
        <button class="primary-button" data-action="choose" data-card-id="${escapeHtml(card.id)}" data-option-id="${escapeHtml(pendingOptionId || "")}" type="button"${pendingOptionId ? "" : " disabled"}>${icon("check")}Submit</button>
      </div>
    `;
    if (!isActionableCard(card)) return `${result}<div class="option-strip">${options}</div>`;
    return `<div class="option-strip">${options}</div>${submitButton}`;
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
    const answerValue = state.questionDrafts[card.id] || "";
    return `
      <form class="question-form" data-question-form="${escapeHtml(card.id)}">
        <textarea rows="3" name="answer" placeholder="${escapeHtml(card.input?.placeholder || "Type your answer")}">${escapeHtml(answerValue)}</textarea>
        ${state.questionErrors[card.id] ? `<p class="field-error">${escapeHtml(state.questionErrors[card.id])}</p>` : ""}
        <button class="primary-button" type="submit"${answerValue.trim() ? "" : " disabled"}>Answer</button>
      </form>
    `;
  }

  if (card.type === "status") {
    if (!card.showProgress && !card.metadata?.showProgress) return "";
    const progress = Number(card.progress || 0);
    return `
      <div class="status-meter">
        <div class="status-row"><strong>${Math.min(100, Math.max(0, progress))}% complete</strong><span>${escapeHtml(card.blocker || "No blocker")}</span></div>
        <div class="meter-track"><div class="meter-fill" style="width:${Math.min(100, Math.max(0, progress))}%"></div></div>
      </div>
    `;
  }

  if (card.type === "checklist") {
    return renderChecklist(card);
  }

  if (card.type === "briefing") {
    return renderBriefing(card);
  }

  if (card.type === "comparison") {
    const pendingOptionId = isActionableCard(card) ? state.pendingSelections[card.id] : null;
    const submitButton = isActionableCard(card) ? `<div class="actions"><button class="primary-button" data-action="choose" data-card-id="${escapeHtml(card.id)}" data-option-id="${escapeHtml(pendingOptionId || "")}" type="button"${pendingOptionId ? "" : " disabled"}>${icon("check")}Submit choice</button></div>` : "";
    return `${renderComparison(card, false)}${submitButton}`;
  }

  return "";
}

function checklistItems(card) {
  const metadata = card.metadata || {};
  const sourceItems = metadata.checklist || metadata.items || card.checklist || card.items || [];
  const checks = state.checklistChecks[card.id] || {};
  return sourceItems.map((item, index) => {
    if (typeof item === "string") {
      const id = `item-${index}`;
      return { id, title: item, status: checks[id] ? "done" : "todo" };
    }
    const id = item.id || `item-${index}`;
    return {
      id,
      title: item.title || item.label || item.task || `Item ${index + 1}`,
      detail: item.detail || item.description || item.summary || "",
      owner: item.owner || item.agent || "",
      status: checks[id] === undefined ? (item.status || (item.done || item.completed ? "done" : "todo")) : (checks[id] ? "done" : "todo")
    };
  });
}

function isChecklistItemDone(item) {
  return ["done", "completed", "approved"].includes(String(item.status).toLowerCase());
}

function renderChecklist(card) {
  const items = checklistItems(card).slice(0, 6);
  if (!items.length) return "";
  const done = items.filter(isChecklistItemDone).length;
  const percent = Math.round((done / items.length) * 100);
  const completeDisabled = done === items.length ? "" : " disabled";
  return `
    <div class="checklist-card-body">
      <div class="checklist-meter">
        <strong>${done}/${items.length} complete</strong>
        <span>${percent}%</span>
      </div>
      <div class="meter-track"><div class="meter-fill" style="width:${percent}%"></div></div>
      <ul class="checklist-list">
        ${items.map((item) => {
          const doneItem = isChecklistItemDone(item);
          const itemKey = `${card.id}:${item.id}`;
          const expanded = state.expandedChecklistItems.has(itemKey);
          return `
            <li class="${doneItem ? "is-done" : ""} ${expanded ? "is-expanded" : ""}">
              <div class="checklist-item-row">
                <button class="checklist-check-button" data-checklist-item="${escapeHtml(card.id)}" data-item-id="${escapeHtml(item.id)}" type="button" aria-label="${doneItem ? "Mark incomplete" : "Mark complete"}">
                  <span class="checklist-check">${icon(doneItem ? "check-circle" : "clock")}</span>
                </button>
                <span>
                  <strong>${escapeHtml(item.title)}</strong>
                  <small>${doneItem ? "Checked" : "Not checked"}</small>
                  ${expanded && (item.detail || item.owner) ? `<em>${escapeHtml([item.detail, item.owner ? `Owner: ${item.owner}` : ""].filter(Boolean).join(" · "))}</em>` : ""}
                </span>
                ${(item.detail || item.owner) ? `<button class="checklist-detail-toggle" data-checklist-detail="${escapeHtml(card.id)}" data-item-id="${escapeHtml(item.id)}" type="button" aria-label="${expanded ? "Hide details" : "Show details"}" aria-expanded="${expanded ? "true" : "false"}">${icon("chevron-right")}</button>` : ""}
              </div>
            </li>
          `;
        }).join("")}
      </ul>
      <div class="actions checklist-submit">
        <button class="primary-button" data-action="complete" data-card-id="${escapeHtml(card.id)}" type="button"${completeDisabled}>${icon("check")}Complete</button>
      </div>
    </div>
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
            <div class="weather-icon"><img src="/assets/generated/daily-weather-icon.png" alt=""></div>
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
  return `<ul class="briefing-list">${(card.items || []).slice(0, 5).map((item) => `<li>${icon("check-circle")}<span>${escapeHtml(item)}</span></li>`).join("")}</ul>`;
}

function comparisonItems(card) {
  const metadata = card.metadata || {};
  return card.options?.length ? card.options : metadata.comparison?.options || metadata.options || [];
}

function comparisonFallbackOption() {
  return {
    id: "none_of_these",
    title: "None of these are good",
    description: "Tell the agent to go back to the drawing board and keep trying.",
    agentWill: "go back to the drawing board and bring back better options.",
    meta: "Keep trying",
    fallback: true
  };
}

function visibleComparisonItems(card, detail = false) {
  const items = comparisonItems(card).slice(0, detail ? 4 : 3);
  const hasFallback = items.some((item) => ["none_of_these", "keep_trying", "try_again"].includes(String(item.id || "")));
  return hasFallback ? items : [...items, comparisonFallbackOption()];
}

function inferOptionOutcome(card, option = {}) {
  if (option.fallback || option.id === "none_of_these") return "go back to the drawing board and bring back better options.";
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
  const items = visibleComparisonItems(card, detail);
  if (!items.length) return "";
  const choice = latestEvent(card.id, "choose");
  const selectedOptionId = choice?.payload?.optionId;
  const pendingOptionId = isActionableCard(card) ? state.pendingSelections[card.id] : null;
  return `
    <div class="comparison-grid">
      ${items.map((item, index) => {
        const optionId = item.id || item.title || item.label || `option-${index}`;
        const isPending = isActionableCard(card) && pendingOptionId === optionId;
        const isChosen = !isActionableCard(card) && selectedOptionId === item.id;
        return `
          ${isActionableCard(card) ? `<button class="comparison-option${isPending ? " is-selected" : ""} ${item.fallback ? "is-fallback" : ""}" data-select-option="${escapeHtml(card.id)}" data-option-id="${escapeHtml(optionId)}" type="button">` : `<div class="comparison-option ${isChosen ? "is-selected" : ""} ${item.fallback ? "is-fallback" : ""}">`}
            <div class="comparison-top">
              <strong>${escapeHtml(item.title || item.label || item.id || "Option")}</strong>
              ${isChosen ? `<span>${icon("check")}Chosen</span>` : ""}
            </div>
            <p>${escapeHtml(item.description || item.summary || "")}</p>
          ${isActionableCard(card) ? "</button>" : "</div>"}
        `;
      }).join("")}
    </div>
  `;
}

function renderActions(card, options = {}) {
  if (!isActionableCard(card)) {
    if (!state.justHandled.has(card.id)) return "";
    return options.detail ? `<div class="actions detail-actions"><button class="ghost-button close-detail" type="button">${icon("x-circle")}Close</button></div>` : "";
  }
  if (card.type === "email_approval" && !options.detail) {
    const disabled = emailDraftReady(card) ? "" : " disabled";
    return `
      <div class="actions">
        <button class="soft-button" data-action="save_draft" data-card-id="${escapeHtml(card.id)}" type="button"${disabled}>${icon("file-text")}Save as draft</button>
        <button class="primary-button" data-action="send" data-card-id="${escapeHtml(card.id)}" type="button"${disabled}>${icon("send")}Send</button>
      </div>
    `;
  }
  if (card.type === "approval" && !options.detail) {
    return `
      <div class="actions">
        <button class="soft-button" data-action="reject" data-card-id="${escapeHtml(card.id)}" type="button">${icon("x-circle")}Not approve</button>
        <button class="primary-button" data-action="approve" data-card-id="${escapeHtml(card.id)}" type="button">${icon("check-circle")}Approve</button>
      </div>
    `;
  }
  if (card.type === "status" && !options.detail) {
    return `
      <div class="actions">
        <button class="soft-button" data-action="mark_read" data-card-id="${escapeHtml(card.id)}" type="button">${icon("check-circle")}Mark as read</button>
      </div>
    `;
  }
  if (card.type === "choice" && !options.detail) return "";
  if (card.type === "checklist" && !options.detail) return "";
  const actions = (card.actions || [])
    .map(normalizeAction)
    .filter((action) => action?.id !== "archive")
    .filter((action) => action?.id !== "more_like_this")
    .filter((action) => action?.id !== "pass")
    .filter((action) => !(card.type === "comparison" && action?.id === "investigate"))
    .filter((action) => action && !isHandledInline(card, action));
  const renderedActions = actions.length ? actions : [];
  const className = options.detail ? "actions detail-actions" : "actions";
  const disabled = state.pendingAction?.cardId === card.id ? " disabled" : "";

  return `
    <div class="${className}">
      ${orderCardActions(renderedActions).map((action) => {
        const className = action.style === "danger" ? "danger-button" : action.style === "primary" ? "primary-button" : "soft-button";
        const changeAttr = ["edit", "request_changes"].includes(action.id) ? ` data-request-changes="true"` : "";
        return `<button class="${className}" data-action="${escapeHtml(action.id)}" data-card-id="${escapeHtml(card.id)}" type="button"${disabled}${changeAttr}>${icon(actionIcons[action.id] || "chevron-right")}${escapeHtml(action.label)}</button>`;
      }).join("")}
      ${options.detail ? `<button class="ghost-button close-detail" type="button">${icon("x-circle")}Close</button>` : ""}
    </div>
  `;
}

function orderCardActions(actions) {
  return [...actions].sort((a, b) => {
    const rank = (action) => action.style === "primary" ? 2 : action.style === "danger" ? 1 : 0;
    return rank(a) - rank(b);
  });
}

function isHandledInline(card, action) {
  if (action.id === "view") return true;
  if (card.type === "choice" && action.id === "choose") return true;
  if (card.type === "comparison" && action.id === "choose") return true;
  if (card.type === "question" && action.id === "answer") return true;
  return false;
}

function renderDetail() {
  return;
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
        <button class="close-detail" type="button" aria-label="Close detail">${icon("x-circle")}Close</button>
      </div>
    </div>
    <h2>${escapeHtml(card.title)}</h2>
    <p class="summary">${escapeHtml(card.summary)}</p>
    <div class="meta-row">
      <span class="chip">${escapeHtml(cardStatus(card))}</span>
    </div>
    <section class="detail-section">
      <h3>Context</h3>
      <p>${escapeHtml(card.details || "No extra detail provided.")}</p>
    </section>
    ${renderReviewPayload(card)}
    ${card.type === "comparison" ? `<section class="detail-section"><h3>Comparison</h3>${renderComparison(card, true)}</section>` : ""}
    ${card.type === "checklist" ? `<section class="detail-section"><h3>Checklist</h3>${renderChecklist(card)}</section>` : ""}
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
  `;
}

function renderReviewPayload(card) {
  const metadata = card.metadata || {};
  const review = metadata.review || {};
  const draft = metadata.draft || review.draft;
  const risks = metadata.risks || review.risks || [];
  const attachments = metadata.attachments || review.attachments || [];
  const sections = metadata.sections || review.sections || [];
  const eventPreview = metadata.eventPreview || review.eventPreview;

  if (!draft && !risks.length && !attachments.length && !sections.length && !eventPreview && !Object.keys(metadata).length) return "";

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

  const eventPreviewHtml = eventPreview ? `
    <section class="detail-section">
      <h3>Structured Event Preview</h3>
      <p>When you act, Sipher records a structured event the agent can use.</p>
      <pre class="draft-body">${escapeHtml(JSON.stringify(eventPreview, null, 2))}</pre>
    </section>
  ` : "";

  return `${eventPreviewHtml}${draftHtml}${risksHtml}${attachmentsHtml}${sectionsHtml}${rawMetadataHtml}`;
}

function canSwipeArchive(card) {
  return false;
}

function preferredOptionId(card) {
  const items = card.type === "comparison" ? comparisonItems(card) : (card.options || []);
  const item = items.find((option) => option.recommended) || items[0];
  return item?.id || item?.title || item?.label || null;
}

function swipeActionFor(card, dx, dy) {
  const horizontal = Math.abs(dx) > 96 && Math.abs(dx) > Math.abs(dy) * 1.25;
  if (!horizontal) return null;
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

function openReferencedCard(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;
  state.view = archived.has(card.status) ? "archive" : isNeedsMeCard(card) ? "needs-me" : "projects";
  state.type = "all";
  state.project = state.view === "projects" ? projectName(card) : "all";
  state.selectedId = card.id;
  state.detailOpen = false;
  render();
  requestAnimationFrame(() => {
    document.querySelector(`.card[data-card-id="${CSS.escape(card.id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

document.addEventListener("click", async (event) => {
  if (Date.now() < state.suppressClickUntil) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const selectButton = event.target.closest("[data-select-option][data-option-id]");
  if (selectButton) {
    event.stopPropagation();
    const cardId = selectButton.dataset.selectOption;
    const card = state.cards.find((item) => item.id === cardId);
    if (!card || !isActionableCard(card)) return;
    state.pendingSelections[cardId] = selectButton.dataset.optionId;
    render();
    return;
  }

  const checklistDetailButton = event.target.closest("[data-checklist-detail][data-item-id]");
  if (checklistDetailButton) {
    event.preventDefault();
    event.stopPropagation();
    const key = `${checklistDetailButton.dataset.checklistDetail}:${checklistDetailButton.dataset.itemId}`;
    if (state.expandedChecklistItems.has(key)) {
      state.expandedChecklistItems.delete(key);
    } else {
      state.expandedChecklistItems.add(key);
    }
    render();
    return;
  }

  const checklistButton = event.target.closest("[data-checklist-item][data-item-id]");
  if (checklistButton) {
    event.preventDefault();
    event.stopPropagation();
    const cardId = checklistButton.dataset.checklistItem;
    const itemId = checklistButton.dataset.itemId;
    const card = state.cards.find((item) => item.id === cardId);
    if (!card || !isActionableCard(card)) return;
    const items = checklistItems(card);
    const item = items.find((entry) => entry.id === itemId);
    const nextDone = !isChecklistItemDone(item || {});
    state.checklistChecks[cardId] = { ...(state.checklistChecks[cardId] || {}), [itemId]: nextDone };
    localStorage.setItem("agentCardsChecklistChecks", JSON.stringify(state.checklistChecks));
    render();
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
    } else if (actionButton.dataset.requestChanges === "true") {
      openConsequenceSheet(cardId, action, { mode: "request_changes" });
    } else if (shouldConfirmAction(card, action)) {
      openConsequenceSheet(cardId, action, { mode: "confirm", payload: card.type === "email_approval" ? { draft: editableEmailDraft(card) } : {} });
    } else {
      await respond(cardId, action, card.type === "email_approval" ? { draft: editableEmailDraft(card) } : {});
    }
    return;
  }

  const sheetText = event.target.closest("#sheet-request-changes");
  if (sheetText) return;

  const sheetRequestChanges = event.target.closest("[data-sheet-request-changes]");
  if (sheetRequestChanges && state.consequenceSheet) {
    event.preventDefault();
    const sheetCard = state.cards.find((item) => item.id === state.consequenceSheet.cardId);
    const requestAction = (sheetCard?.actions || [])
      .map(normalizeAction)
      .find((item) => ["request_changes", "edit"].includes(item.id));
    state.consequenceSheet.mode = "request_changes";
    state.consequenceSheet.action = requestAction?.id || "request_changes";
    render();
    return;
  }

  const confirmSheet = event.target.closest("[data-confirm-sheet]");
  if (confirmSheet) {
    event.preventDefault();
    const textarea = $("#sheet-request-changes");
    if (textarea && state.consequenceSheet) state.consequenceSheet.requestChanges = textarea.value;
    await submitConsequenceSheet();
    return;
  }

  const closeSheet = event.target.closest("[data-close-sheet]");
  if (closeSheet) {
    event.preventDefault();
    closeConsequenceSheet();
    return;
  }

  const emptySeedDemo = event.target.closest("#empty-seed-demo");
  if (emptySeedDemo) {
    event.preventDefault();
    await seedDemo();
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

  const openButton = event.target.closest("[data-open-card]");
  if (openButton) {
    event.preventDefault();
    openReferencedCard(openButton.dataset.openCard);
    return;
  }

  const nav = event.target.closest("[data-view]");
  if (nav) {
    state.view = nav.dataset.view;
    state.type = "all";
    state.project = "all";
    state.detailOpen = false;
    state.selectedId = null;
    render();
    scrollToTop();
    return;
  }

  const projectJump = event.target.closest("[data-project-jump]");
  if (projectJump) {
    state.project = projectJump.dataset.projectJump;
    state.view = "projects";
    state.type = "all";
    state.detailOpen = false;
    state.selectedId = null;
    render();
    scrollToTop();
    return;
  }

  if (interactiveTarget(event.target)) return;

  const cardNode = event.target.closest(".card[data-card-id]");
  if (cardNode) {
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
  if (!horizontal && !swipe.active) return;
  swipe.active = true;
  event.preventDefault();
  const clamped = Math.max(-150, Math.min(150, swipe.dx));
  swipe.node.classList.add("is-swiping");
  swipe.node.classList.toggle("swipe-archive-ready", Boolean(swipeActionFor(card, swipe.dx, swipe.dy)));
  swipe.node.style.transform = `translateX(${clamped}px) rotate(${clamped / 32}deg)`;
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
  swipe.node.style.transform = `translateX(${swipe.dx > 0 ? 120 : -120}%) rotate(${swipe.dx > 0 ? 8 : -8}deg)`;
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
  if (card.input?.required && !answer) {
    state.questionErrors[cardId] = "Add an answer before sending it to the agent.";
    render();
    return;
  }
  delete state.questionErrors[cardId];
  if (state.pendingAction) return;
  state.questionDrafts[cardId] = answer;
  await respond(cardId, "answer", { answer });
});

document.addEventListener("input", (event) => {
  if (event.target.id === "sheet-request-changes" && state.consequenceSheet) {
    state.consequenceSheet.requestChanges = event.target.value;
    state.consequenceSheet.error = "";
    return;
  }
  const emailBody = event.target.closest("[data-email-body]");
  if (emailBody) {
    const cardId = emailBody.dataset.emailBody;
    state.emailDraftEdits[cardId] = {
      ...(state.emailDraftEdits[cardId] || {}),
      body: emailBody.value
    };
    updateEmailActionDisabled(cardId);
    return;
  }
  const emailField = event.target.closest("[data-email-field][data-email-key]");
  if (emailField) {
    const cardId = emailField.dataset.emailField;
    const key = emailField.dataset.emailKey;
    state.emailDraftEdits[cardId] = {
      ...(state.emailDraftEdits[cardId] || {}),
      [key]: emailField.value
    };
    updateEmailActionDisabled(cardId);
    return;
  }
  const questionField = event.target.closest("[data-question-form] textarea[name='answer']");
  if (questionField) {
    const form = questionField.closest("[data-question-form]");
    const cardId = form.dataset.questionForm;
    state.questionDrafts[cardId] = questionField.value;
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = !questionField.value.trim();
  }
});

function updateEmailActionDisabled(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  const disabled = !card || !emailDraftReady(card);
  document.querySelectorAll(`[data-card-id="${CSS.escape(cardId)}"][data-action="send"], [data-card-id="${CSS.escape(cardId)}"][data-action="save_draft"]`)
    .forEach((button) => {
      button.disabled = disabled;
    });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.consequenceSheet) {
      closeConsequenceSheet();
      return;
    }
    if (state.detailOpen) {
      state.detailOpen = false;
      state.selectedId = null;
      render();
    }
  }
});

$("#project-filter").addEventListener("change", (event) => {
  state.project = event.target.value;
  render();
  scrollToTop();
});

$("#seed-demo").addEventListener("click", seedDemo);
$("#update-app").addEventListener("click", updateApp);
$("#notification-toggle")?.addEventListener("click", toggleNotifications);

load();
setInterval(load, 10000);
