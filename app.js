const state = {
  cards: [],
  events: [],
  view: "needs-me",
  type: "all",
  selectedId: null,
  detailOpen: false,
  pendingAction: null,
  version: null,
  versionOpen: false,
  justHandled: new Set()
};

const views = {
  "needs-me": {
    title: "Needs Me",
    subtitle: "Cards waiting for a decision, answer, or review."
  },
  today: {
    title: "Today",
    subtitle: "Recent cards, updates, briefings, and active workflows."
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
const archived = new Set(["completed", "dismissed", "expired", "archived", "approved", "rejected"]);
const resolved = new Set([...archived, "responded"]);
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
  return String(card.status || "new").replaceAll("_", " ");
}

function isActionableCard(card) {
  return actionable.has(card.status) && !resolved.has(card.status);
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
    if (state.view === "needs-me") return actionable.has(card.status) || state.justHandled.has(card.id);
    if (state.view === "archive") return archived.has(card.status);
    return true;
  });

  const byType = state.type === "all" ? byView : byView.filter((card) => card.type === state.type);

  return byType.sort((a, b) => {
    const priority = { high: 3, medium: 2, low: 1 };
    return (priority[b.priority] || 0) - (priority[a.priority] || 0)
      || new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
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
    $("#api-status").textContent = "Live";
  } catch (error) {
    $(".status-dot").className = "status-dot offline";
    $("#api-status").textContent = "Offline";
    console.error(error);
  }
  render();
}

function renderVersion() {
  const version = state.version;
  const button = $("#version-button");
  const label = $("#version-label");
  const stateLabel = $("#version-state");
  const popover = $("#version-popover");
  const title = $("#version-title");
  const copy = $("#version-copy");
  const command = $("#version-command");
  const link = $("#version-link");
  const banner = $("#freshness-banner");
  const bannerTitle = $("#freshness-title");
  const bannerCopy = $("#freshness-copy");

  if (!version) {
    label.textContent = "v...";
    stateLabel.textContent = "Checking";
    button.classList.remove("has-update");
    button.classList.remove("is-stale");
    popover.hidden = true;
    banner.hidden = false;
    bannerTitle.textContent = "Version check unavailable";
    bannerCopy.textContent = "Do not claim this instance is latest until this URL returns /api/version.";
    return;
  }

  const stale = Boolean(version.stale);
  const updateAvailable = Boolean(version.updateAvailable);
  const git = version.git || {};
  const dirty = Boolean(git.dirty);
  const shortCommit = git.shortCommit ? `@${git.shortCommit}` : "";
  const reasons = version.staleReasons || [];

  label.textContent = version.sourceId || `v${version.currentVersion}${shortCommit}`;
  stateLabel.textContent = stale ? "Stale" : updateAvailable ? "Update" : dirty ? "Dirty" : "Current";
  button.classList.toggle("has-update", Boolean(version.updateAvailable));
  button.classList.toggle("is-stale", stale);
  button.setAttribute("aria-expanded", String(state.versionOpen));
  popover.hidden = !state.versionOpen;
  banner.hidden = !stale && !updateAvailable;
  bannerTitle.textContent = stale ? "Stale URL" : "Update available";
  bannerCopy.textContent = stale
    ? `This page was opened from ${version.requestUrl || "a non-canonical URL"}. Use ${version.canonicalUrl || "the canonical Agent Cards URL"} before claiming it is latest.`
    : `This checkout is behind ${git.upstream || "the configured latest source"}. Run the update command and restart Agent Cards.`;

  title.textContent = stale
    ? "This is not the canonical Agent Cards URL"
    : version.updateAvailable
    ? `Update available: v${version.latestVersion}`
    : dirty
    ? "Agent Cards has local changes"
    : "Agent Cards is current";
  copy.textContent = stale
    ? `Agents must verify /api/version on the exact URL they show. Canonical URL: ${version.canonicalUrl || "not configured"}.`
    : version.updateAvailable
    ? "A newer version is available. Run the update command from the project folder, then restart Agent Cards."
    : dirty
    ? `Running local uncommitted changes from ${version.servedFrom}.`
    : `Running ${version.sourceId || `v${version.currentVersion}`}.`;
  command.textContent = stale || version.updateAvailable
    ? version.updateCommand || "git pull && npm install"
    : `Running ${version.sourceId || `v${version.currentVersion}`}`;

  if (reasons.length) {
    command.textContent = `${command.textContent}\nreason: ${reasons.join(", ")}`;
  }

  if (version.updateUrl) {
    link.hidden = false;
    link.href = version.updateUrl;
  } else {
    link.hidden = true;
    link.removeAttribute("href");
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
  await wait(760);
  await api(`/api/cards/${cardId}/actions`, {
    method: "POST",
    body: JSON.stringify({ action, payload })
  });
  state.pendingAction = null;
  if (action !== "archive") state.justHandled.add(cardId);
  await load();
  state.selectedId = cardId;
  renderDetail();
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
}

function render() {
  const counts = {
    needs: state.cards.filter((card) => actionable.has(card.status)).length,
    today: state.cards.length,
    projects: new Set(state.cards.map((card) => card.project || "Inbox")).size,
    archive: state.cards.filter((card) => archived.has(card.status)).length
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

  $("#view-title").textContent = views[state.view].title;
  $("#view-subtitle").textContent = views[state.view].subtitle;

  const cards = visibleCards();
  $("#cards").innerHTML = cards.map(renderCard).join("");
  $("#empty-state").hidden = cards.length > 0;
  renderDetail();
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
          <span><strong>${escapeHtml(card.agent?.name || "Agent")}</strong><small>${escapeHtml(card.project || "Inbox")} · ${escapeHtml(time)}</small></span>
        </div>
        ${typeBadge(card)}
      </div>
      <h3>${escapeHtml(card.title)}</h3>
      <p class="summary">${escapeHtml(card.summary)}</p>
      ${renderCardBody(card)}
      ${state.justHandled.has(card.id) ? `<div class="handled-note">Recorded. Review the event in the inspector.</div>` : ""}
      <div class="meta-row">
        <span class="chip priority ${escapeHtml(card.priority || "low")}"><span class="risk-dot"></span>${escapeHtml(card.priority || "low")}</span>
        <span class="chip">${icon("clock")}${escapeHtml(cardStatus(card))}</span>
      </div>
      ${renderActions(card)}
      ${pending ? renderActionOverlay(pending) : ""}
    </article>
  `;
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
      ${isActionableCard(card) ? "</button>" : "</div>"}
    `).join("");
    const selected = (card.options || []).find((option) => option.id === selectedOptionId);
    const result = selected ? `
      <div class="handled-note">Choice recorded: ${escapeHtml(selected.title || selected.label || selected.id)}</div>
    ` : "";
    if (!isActionableCard(card)) return `${result}<div class="option-strip">${options}</div>`;
    return `<div class="option-strip">${options}</div>`;
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
    return `<ul class="briefing-list">${(card.items || []).slice(0, 4).map((item) => `<li>${icon("check-circle")}<span>${escapeHtml(item)}</span></li>`).join("")}</ul>`;
  }

  if (card.type === "comparison") {
    return renderComparison(card, false);
  }

  return "";
}

function comparisonItems(card) {
  const metadata = card.metadata || {};
  return card.options?.length ? card.options : metadata.comparison?.options || metadata.options || [];
}

function renderComparison(card, detail = false) {
  const items = comparisonItems(card).slice(0, detail ? 4 : 3);
  if (!items.length) return "";
  return `
    <div class="comparison-grid">
      ${items.map((item, index) => `
        <div class="comparison-option ${item.recommended || index === 0 ? "recommended" : ""}">
          <div class="comparison-top">
            <strong>${escapeHtml(item.title || item.label || item.id || "Option")}</strong>
            ${item.recommended || index === 0 ? `<span>${icon("check")}Best fit</span>` : ""}
          </div>
          <p>${escapeHtml(item.description || item.summary || "")}</p>
          ${item.meta || item.cost || item.risk ? `<small>${escapeHtml(item.meta || item.cost || item.risk)}</small>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderActions(card, options = {}) {
  if (!isActionableCard(card)) return "";
  const actions = (card.actions || [])
    .map(normalizeAction)
    .filter((action) => action && !isHandledInline(card, action));
  if (!actions.length) return "";
  const hasArchive = actions.some((action) => action.id === "archive");
  const className = options.detail ? "actions detail-actions" : "actions";
  const disabled = state.pendingAction?.cardId === card.id ? " disabled" : "";

  return `
    <div class="${className}">
      ${actions.map((action) => {
        const className = action.style === "danger" ? "danger-button" : action.style === "primary" ? "primary-button" : "soft-button";
        return `<button class="${className}" data-action="${escapeHtml(action.id)}" data-card-id="${escapeHtml(card.id)}" type="button"${disabled}>${icon(actionIcons[action.id] || "chevron-right")}${escapeHtml(action.label)}</button>`;
      }).join("")}
      ${hasArchive || options.detail ? "" : `<button class="ghost-button" data-action="archive" data-card-id="${escapeHtml(card.id)}" type="button"${disabled}>${icon("archive")}Archive</button>`}
    </div>
  `;
}

function isHandledInline(card, action) {
  if (action.id === "view") return true;
  if (card.type === "choice" && action.id === "choose") return true;
  if (card.type === "question" && action.id === "answer") return true;
  return false;
}

function renderDetail() {
  const card = state.cards.find((item) => item.id === state.selectedId) || visibleCards()[0];
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
        <span><strong>${escapeHtml(card.agent?.name || "Agent")}</strong><small>${escapeHtml(card.project || "Inbox")} · ${formatTime(card.updatedAt || card.createdAt)}</small></span>
      </div>
      <button class="close-detail" type="button" aria-label="Close detail">${icon("x-circle")}Close</button>
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

document.addEventListener("click", async (event) => {
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
      await respond(cardId, action, {});
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

  if (event.target.closest("#version-button")) {
    state.versionOpen = !state.versionOpen;
    renderVersion();
    return;
  }

  if (event.target.closest("[data-version-close]")) {
    state.versionOpen = false;
    renderVersion();
    return;
  }

  if (state.versionOpen && !event.target.closest(".version-menu")) {
    state.versionOpen = false;
    renderVersion();
    return;
  }

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

  if (event.target.closest(".close-detail")) {
    state.detailOpen = false;
    render();
    return;
  }

  if (!event.target.closest("[data-action][data-card-id]")) return;
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-question-form]");
  if (!form) return;
  event.preventDefault();
  const cardId = form.dataset.questionForm;
  const card = state.cards.find((item) => item.id === cardId);
  if (!card || !isActionableCard(card)) return;
  const answer = new FormData(form).get("answer");
  if (state.pendingAction) return;
  await respond(cardId, "answer", { answer });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.versionOpen) return;
  state.versionOpen = false;
  renderVersion();
});

$("#type-filter").addEventListener("change", (event) => {
  state.type = event.target.value;
  render();
});

$("#seed-demo").addEventListener("click", seedDemo);

load();
setInterval(load, 10000);
