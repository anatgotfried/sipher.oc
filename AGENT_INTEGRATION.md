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

## UX Expectations

- Tapping a card opens its detail panel.
- Action buttons record structured events.
- Cards that have just been handled stay visible briefly in the current session so the result does not feel like it vanished.
- Archive intentionally removes the card from Needs Me.
