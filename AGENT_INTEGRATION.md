# Agent Integration Contract

This file tells agents how to create useful Agent Cards. The short version: do not send vague approval cards. Send the exact thing the human is approving.

## Core Rule

Every card should answer three questions:

1. What decision is needed?
2. What exact content, option, or action is being reviewed?
3. What will happen after the user taps an action?

If the user cannot confidently decide from the card detail panel, the card payload is incomplete.

## Persistent User Links

Agents must not send `localhost` links to the user. `localhost` only works on the same machine as the process and is not a durable daily-use link.

For private user-facing links, Agent Cards expects Tailscale Serve to be configured first:

```bash
npm start
tailscale serve --bg 4173
tailscale serve status
```

`tailscale serve status` returns the persistent private HTTPS base URL, usually:

```text
https://<machine-name>.<tailnet-name>.ts.net
```

Set that URL in the agent environment:

```bash
export AGENT_CARDS_URL="https://<machine-name>.<tailnet-name>.ts.net"
```

Agent rule:

- If `AGENT_CARDS_URL` is a Tailscale HTTPS URL, use it for user-facing links.
- If `AGENT_CARDS_URL` is unset or is `http://localhost:4173`, use it only for local API calls from the same machine.
- Before sending the user a link, verify the persistent Tailscale URL opens from a tailnet-connected device.
- Do not use Tailscale Funnel for approval/action links unless Agent Cards has app-level auth and action protection.

Good user-facing link:

```text
https://<machine-name>.<tailnet-name>.ts.net
```

Bad user-facing link:

```text
http://localhost:4173
```

## Freshness Rule

Agents must verify the exact Agent Cards URL before saying it is latest or sending the user a screenshot.

Required check:

```bash
curl "$AGENT_CARDS_URL/api/version"
```

If `AGENT_CARDS_URL` is unset, use the exact URL being shown in the browser. Do not verify `localhost` and then show or describe a different Tailscale/IP URL.

The response is the source of truth:

- `latest: true` means this URL is serving the current known checkout.
- `stale: true` means the URL is not canonical. Do not call it latest.
- `updateAvailable: true` means the checkout or configured package version is behind.
- Missing `/api/version`, `404`, or invalid JSON means the instance is stale or not Agent Cards.
- `git.dirty: true` means the app includes local uncommitted changes. Say "latest local working tree", not "latest committed version".

Good agent claim:

```text
Verified https://<machine>.<tailnet>.ts.net/api/version: sourceId 0.1.0+ae254a4.dirty, latest local working tree, served from /path/to/sipher.oc.
```

Bad agent claim:

```text
This is latest because the screenshot looks right.
```

## Local Simulation

You can generate realistic cards without a live agent:

```bash
npm run simulate
```

You can generate edge cases, including intentionally bad cards, with:

```bash
npm run simulate:edge
```

The source fixtures live in `simulations/agent-scenarios.json`. Add new scenarios there when a real agent creates a payload shape worth preserving as a regression case.

Generate a multi-agent feed with Hermes, OpenClaw, Atlas, Calendar Agent, and Deploy Agent:

```bash
npm run simulate -- multi-agent
```

Or with the CLI directly:

```bash
node cli/agent-cards.js simulate multi-agent
```

Reset the local feed when examples or test cards pile up:

```bash
node cli/agent-cards.js reset --yes
```

Reset is for agents/operators, not a normal user workflow. Users should clear individual cards by archiving them.

## Multi-Agent Feed Pattern

Sipher is one shared human action feed. Multiple agents can write cards into it as long as each card has a stable owner and a clear next step.

Recommended agent identities:

```json
{ "id": "hermes", "name": "Hermes", "avatarUrl": "/assets/hermes-avatar.svg" }
{ "id": "openclaw", "name": "OpenClaw" }
{ "id": "atlas", "name": "Atlas" }
{ "id": "calendar-agent", "name": "Calendar Agent" }
{ "id": "deploy-agent", "name": "Deploy Agent" }
```

Rules:

- One card should have one primary owning agent in `agent`.
- If another agent contributed evidence, put that in `metadata.contributors`.
- Use `project` to group related cards across agents, for example `Agent Cards`, `Family`, `Calendar`, or `Sipher`.
- If no real project exists, set `project` to `General`. Do not omit it.
- Use a briefing card when Hermes summarizes other agents' cards. Put linked card IDs in `metadata.sourceCards`.
- Use a status card for progress, a question card for missing information, a choice/comparison card for preferences, and an approval card only for consequential actions.
- If the same issue changes, update the existing card with `PATCH /api/cards/<id>` instead of creating duplicate cards.
- After a user action, read the event and close the loop with a status update, callback, or archived/completed card.
- Keep the human inbox small. Prefer one daily briefing plus a few concrete action cards over a wall of approvals.

Good multi-agent sequence:

1. OpenClaw creates a comparison card for hosting options.
2. The user chooses `tailscale-serve`.
3. OpenClaw receives the `choose` event and posts a status card with the implementation plan.
4. Deploy Agent later creates an approval card with checks, release note, and rollback plan.
5. Hermes creates a briefing card that references the OpenClaw and Deploy cards in `metadata.sourceCards`.

Bad multi-agent sequence:

1. Five agents each create vague "What should I do?" cards.
2. Cards do not include `project`, stable `agent.id`, or callback information.
3. The user cannot tell which agent owns the next step.

## Practical Card Quality Bar

Agents should surface only things that are useful for a human to decide, review, or know now.

Create a card when at least one is true:

- The agent is blocked on a concrete answer.
- The next step has external or irreversible consequences.
- The user must choose between real options.
- The status changes what the user should expect today.
- A recurring brief summarizes actionable work across agents.

Do not create a card for:

- Internal scratch work.
- Generic "checking in" messages.
- Work the agent can safely complete without the user.
- Duplicate reminders for the same unresolved issue.
- Approvals without the exact draft, diff, command, recipient, release note, cost, or risk.

## Daily Brief And Approval Batching

The `Today` tab is the Daily Brief surface. It intentionally shows only a small working set of action cards at a time so the user is not overwhelmed.

Agent rules for Daily Brief:

- Create one `briefing` card per day for the summary. Set `project` to `Daily Brief`.
- Put weather, calendar, news, project status, and agent recommendations in `items` or structured `metadata.sections`.
- Link the underlying cards in `metadata.sourceCards`; do not hide consequential actions inside the brief.
- Use separate approval/question/choice cards for actions the user must explicitly decide.
- Respect the user's approval tolerance. If `metadata.preferences.maxApprovalBatch` is present on the daily brief, do not create more than that many active approval cards for the brief cycle.
- Respect detail preference. Use `metadata.preferences.detailLevel` as `brief`, `normal`, or `detailed`; default to `normal`.

Recommended Daily Brief metadata:

```json
{
  "type": "briefing",
  "title": "Daily brief",
  "summary": "Weather, calendar, open decisions, and agent recommendations.",
  "project": "Daily Brief",
  "items": [
    "Weather: mild morning, rain likely after 16:00.",
    "Calendar: one conflict needs a preference.",
    "Approvals: showing the next three only."
  ],
  "metadata": {
    "preferences": {
      "dailyBriefEnabled": true,
      "maxApprovalBatch": 3,
      "detailLevel": "normal"
    },
    "sections": [
      { "title": "Weather", "body": "18-23C, rain likely after 16:00." },
      { "title": "News", "body": "Only include items that change today's decisions." },
      { "title": "Open items", "body": "Three approvals are ready; four more are queued." }
    ],
    "sourceCards": ["calendar_conflict_2026_05_14"]
  },
  "expiresAt": "2026-05-13T20:59:59.000Z"
}
```

Every useful card should include:

- A title that names the decision or status.
- A summary that explains why it matters now.
- `details` or `metadata` with the evidence needed to decide.
- A small set of actions that map to what the agent will actually do next.
- A stable `agent.id`, `project`, and `priority`.
- `neededAt` when there is a specific date/time the human should act by.
- `callbackUrl` when useful.
- `expiresAt` when the card stops being useful after a deadline.

`Needs Me` is ordered by `neededAt`/due date first when present, otherwise by `priority`, then recency. Always send `priority` as `low`, `medium`, or `high`; Sipher rejects cards without it.

## Expiration

Use `expiresAt` for time-sensitive cards. It must be an ISO timestamp.

```json
{
  "type": "choice",
  "title": "Resolve tomorrow's calendar conflict",
  "summary": "Calendar Agent needs a preference before sending updates.",
  "expiresAt": "2026-05-14T06:30:00.000Z"
}
```

Expiration behavior:

- When `expiresAt` passes, Sipher marks the card `expired`.
- Expired cards leave `Needs Me` and move to `Archive`.
- Sipher records an `expired` event with the original `expiresAt`.
- Resolved cards do not expire later.

Recommended expiration windows:

- Scheduling cards: expire before the first affected event.
- Draft-send approvals: expire when the draft becomes stale.
- Shopping, booking, or pricing decisions: expire when price or availability may change.
- Daily briefs: expire at the end of the day.
- Status cards: expire only if the status is no longer useful after a known time.

## Minimal Card Shape

```json
{
  "type": "approval",
  "title": "Send weekly summary to Eden?",
  "summary": "Draft ready — covers dates, pickup logistics, and what to pack.",
  "details": "This will send an external message. Review the full draft before approving.",
  "priority": "medium",
  "project": "Family",
  "agent": { "id": "hermes", "name": "Hermes", "avatarUrl": "/assets/hermes-avatar.svg" },
  "actions": ["approve", "reject", "edit"],
  "expiresAt": "2026-05-14T18:00:00.000Z",
  "metadata": {}
}
```

`actions` may be strings or objects. Prefer objects when a label needs to be specific.

Agents should send stable identity. Include `agent.name`, and include `agent.avatarUrl` when the agent has an image. The app supports local paths such as `/assets/hermes-avatar.svg` and remote image URLs.

```json
[
  { "id": "send", "label": "Send", "style": "primary" },
  { "id": "edit", "label": "Edit", "style": "neutral" },
  { "id": "reject", "label": "Reject", "style": "danger" }
]
```

## Approval Cards Must Include Review Payloads

For approvals, include the draft, command, diff, or exact proposed change in `metadata`. Do not ask for approval of something the user cannot inspect.

Recommended email/message approval:

```json
{
  "type": "approval",
  "title": "Send weekly summary to Eden?",
  "summary": "Draft ready — covers dates, pickup logistics, and what to pack.",
  "details": "This sends an external message. Confirm the recipient and body before approving.",
  "priority": "medium",
  "project": "Family",
  "agent": { "id": "hermes", "name": "Hermes", "avatarUrl": "/assets/hermes-avatar.svg" },
  "actions": [
    { "id": "send", "label": "Send", "style": "primary" },
    { "id": "edit", "label": "Edit", "style": "neutral" },
    { "id": "reject", "label": "Reject", "style": "danger" }
  ],
  "metadata": {
    "draft": {
      "to": "Eden <eden@example.com>",
      "subject": "Summer camp weekly summary",
      "body": "Hi Eden,\n\nHere are the confirmed dates, pickup logistics, and packing notes..."
    },
    "risks": [
      "External recipient",
      "Contains family logistics"
    ],
    "attachments": [
      { "name": "camp_schedule.pdf" }
    ]
  }
}
```

Recommended file/code approval:

```json
{
  "type": "approval",
  "title": "Apply README changes?",
  "summary": "Hermes wants to update setup instructions.",
  "details": "Review the affected file and diff before approving.",
  "actions": ["approve", "reject", "edit"],
  "metadata": {
    "sections": [
      {
        "title": "File",
        "body": "README.md"
      },
      {
        "title": "Proposed diff",
        "body": "- npm run dev\n+ npm start"
      }
    ],
    "risks": [
      "Changes public setup instructions"
    ]
  }
}
```

## Choice Cards

Choice cards need stable option IDs. Use `title` or `label`, plus `description`.

```json
{
  "type": "choice",
  "title": "Which project should I prioritize this week?",
  "summary": "Pick one focus area.",
  "actions": ["choose"],
  "options": [
    {
      "id": "anat-os",
      "title": "Anat OS",
      "description": "Memory, skills, kanban, proactive loop"
    }
  ]
}
```

## Question Cards

Question cards should include the exact expected answer format.

```json
{
  "type": "question",
  "title": "What's the Burnrate hosting budget for Q3?",
  "summary": "Needed to spec infrastructure.",
  "input": {
    "placeholder": "e.g. $50/month",
    "required": true
  },
  "actions": ["answer"]
}
```

## Lifecycle Guidance

- Use `waiting` for cards that need human action.
- Use `status` cards for updates that do not need a decision.
- Do not create approval cards without the exact reviewable content.
- Do not use approvals for low-stakes FYI updates.
- After receiving an action event, the agent should close the loop with a status update or archived/completed card.
- Do not keep asking the same question in new cards. Update or archive the previous card first.
- Do not create cards for internal reasoning. Create cards only for decisions, reviewable actions, status the user needs, or preferences that unblock the agent.

## UX Expectations

- Tapping a card opens its detail panel.
- Action buttons record structured events.
- Swiping a card sideways archives it.
- Cards that have just been handled stay visible briefly in the current session so the result does not feel like it vanished.
- Archive intentionally removes the card from Needs Me.
