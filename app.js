const state = {
  cards: [],
  events: [],
  view: "needs-me",
  type: "all",
  selectedId: null,
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

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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

function cardStatus(card) {
  return String(card.status || "new").replaceAll("_", " ");
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
    const data = await api("/api/cards");
    state.cards = data.cards;
    state.events = data.events;
    $(".status-dot").className = "status-dot online";
    $("#api-status").textContent = "Live";
  } catch (error) {
    $(".status-dot").className = "status-dot offline";
    $("#api-status").textContent = "Offline";
    console.error(error);
  }
  render();
}

async function respond(cardId, action, payload = {}) {
  await api(`/api/cards/${cardId}/actions`, {
    method: "POST",
    body: JSON.stringify({ action, payload })
  });
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

  $("#view-title").textContent = views[state.view].title;
  $("#view-subtitle").textContent = views[state.view].subtitle;

  const cards = visibleCards();
  $("#cards").innerHTML = cards.map(renderCard).join("");
  $("#empty-state").hidden = cards.length > 0;
  renderDetail();
}

function renderCard(card) {
  return `
    <article class="card ${state.selectedId === card.id ? "selected" : ""}" data-card-id="${escapeHtml(card.id)}">
      <div class="card-header">
        <div class="agent-line">
          <span class="avatar">${escapeHtml((card.agent?.name || "A").slice(0, 1))}</span>
          <span>${escapeHtml(card.agent?.name || "Agent")} · ${escapeHtml(card.project || "Inbox")}</span>
        </div>
        <span class="priority ${escapeHtml(card.priority || "low")}">${escapeHtml(card.priority || "low")}</span>
      </div>
      <h3>${escapeHtml(card.title)}</h3>
      <p class="summary">${escapeHtml(card.summary)}</p>
      ${renderCardBody(card)}
      <div class="meta-row">
        <span class="chip">${escapeHtml(card.type)}</span>
        <span class="chip">${escapeHtml(cardStatus(card))}</span>
        <span class="chip">${formatTime(card.updatedAt || card.createdAt)}</span>
      </div>
      ${renderActions(card)}
    </article>
  `;
}

function renderCardBody(card) {
  if (card.type === "choice") {
    const options = (card.options || []).slice(0, 4).map((option) => `
      <button class="option-card" data-action="choose" data-card-id="${escapeHtml(card.id)}" data-option-id="${escapeHtml(option.id)}" type="button">
        <strong>${escapeHtml(option.title || option.label || option.id || "Option")}</strong>
        <span>${escapeHtml(option.description || "")}</span>
      </button>
    `).join("");
    return `
      <div class="swipe-hints">
        <span class="hint like">Right: like</span>
        <span class="hint pass">Left: pass</span>
        <span class="hint more">Up: more like this</span>
      </div>
      <div class="option-strip">${options}</div>
    `;
  }

  if (card.type === "question") {
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
        <div class="meter-track"><div class="meter-fill" style="width:${Math.min(100, Math.max(0, progress))}%"></div></div>
        <span class="chip">${progress}% · ${escapeHtml(card.blocker || "No blocker")}</span>
      </div>
    `;
  }

  if (card.type === "briefing") {
    return `<ul class="briefing-list">${(card.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  return "";
}

function renderActions(card) {
  const actions = (card.actions || [])
    .map(normalizeAction)
    .filter((action) => action && !isHandledInline(card, action));
  if (!actions.length || archived.has(card.status)) return "";
  const hasArchive = actions.some((action) => action.id === "archive");

  return `
    <div class="actions">
      ${actions.map((action) => {
        const className = action.style === "danger" ? "danger-button" : action.style === "primary" ? "primary-button" : "soft-button";
        return `<button class="${className}" data-action="${escapeHtml(action.id)}" data-card-id="${escapeHtml(card.id)}" type="button">${escapeHtml(action.label)}</button>`;
      }).join("")}
      ${hasArchive ? "" : `<button class="ghost-button" data-action="archive" data-card-id="${escapeHtml(card.id)}" type="button">Archive</button>`}
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
    <h2>${escapeHtml(card.title)}</h2>
    <p class="summary">${escapeHtml(card.summary)}</p>
    <div class="meta-row">
      <span class="chip">${escapeHtml(card.type)}</span>
      <span class="chip">${escapeHtml(cardStatus(card))}</span>
      <span class="chip">${escapeHtml(card.agent?.name || "Agent")}</span>
    </div>
    <section class="detail-section">
      <h3>Context</h3>
      <p>${escapeHtml(card.details || "No extra detail provided.")}</p>
    </section>
    ${renderReviewPayload(card)}
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
  const nav = event.target.closest("[data-view]");
  if (nav) {
    state.view = nav.dataset.view;
    render();
    return;
  }

  const cardNode = event.target.closest("[data-card-id]");
  if (cardNode && cardNode.classList.contains("card")) {
    state.selectedId = cardNode.dataset.cardId;
    await updateCard(state.selectedId, { status: "viewed" });
    return;
  }

  const actionButton = event.target.closest("[data-action][data-card-id]");
  if (!actionButton) return;

  const cardId = actionButton.dataset.cardId;
  const action = actionButton.dataset.action;
  const card = state.cards.find((item) => item.id === cardId);

  if (action === "archive") {
    await respond(cardId, "archive", {});
  } else if (action === "choose") {
    await respond(cardId, "choose", { optionId: actionButton.dataset.optionId });
  } else {
    const needsConfirmation = card?.type === "approval" && card?.priority === "high" && ["approve", "send"].includes(action);
    if (needsConfirmation && !confirm("Confirm this high-stakes action?")) return;
    await respond(cardId, action, {});
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-question-form]");
  if (!form) return;
  event.preventDefault();
  const cardId = form.dataset.questionForm;
  const answer = new FormData(form).get("answer");
  await respond(cardId, "answer", { answer });
});

$("#type-filter").addEventListener("change", (event) => {
  state.type = event.target.value;
  render();
});

$("#seed-demo").addEventListener("click", seedDemo);

load();
setInterval(load, 10000);
