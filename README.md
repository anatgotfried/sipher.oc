# Agent Cards

Agent Cards is a local, self-hostable visual action feed for AI agents. Agents create structured cards through an HTTP API or CLI; the user approves, rejects, answers, chooses, archives, or asks for more; every response is recorded as a structured event.

## For agents

Start with `AGENTS.md` and `AGENT_INTEGRATION.md`, then run the app locally with `npm start`. The fastest verification path is `npm run seed`, `npm run list`, and opening `http://localhost:4173`.

Do not create approval cards without reviewable content. If an agent wants the user to approve an email, file change, command, purchase, or publish action, it must include the exact draft, diff, command, recipient, risk, or attachment in `details` or `metadata`. See `AGENT_INTEGRATION.md` for payload examples.

## Run locally

Requires Node 18+.

```bash
npm start
```

Open `http://localhost:4173`.

Seed the demo cards:

```bash
npm run seed
```

Simulate a richer Hermes-like agent feed:

```bash
npm run simulate
```

Simulate edge cases and intentionally bad payloads:

```bash
npm run simulate:edge
```

## Agent CLI

```bash
node cli/agent-cards.js seed
node cli/agent-cards.js simulate realistic
node cli/agent-cards.js simulate edge
node cli/agent-cards.js simulate list
node cli/agent-cards.js list
node cli/agent-cards.js create examples/approval-card.json
node cli/agent-cards.js create examples/choice-card.json
node cli/agent-cards.js action demo_send_email send
```

Set `AGENT_CARDS_URL` when the API is not on `http://localhost:4173`.

## HTTP API

### Create a card

```bash
curl -X POST http://localhost:4173/api/cards \
  -H 'content-type: application/json' \
  -d @examples/approval-card.json
```

### List cards and events

```bash
curl http://localhost:4173/api/cards
```

### Update a card

```bash
curl -X PATCH http://localhost:4173/api/cards/<card-id> \
  -H 'content-type: application/json' \
  -d '{"status":"in_progress","progress":75}'
```

### Record a user or agent action

```bash
curl -X POST http://localhost:4173/api/cards/<card-id>/actions \
  -H 'content-type: application/json' \
  -d '{"action":"approve","payload":{"source":"cli"}}'
```

If a card includes `callbackUrl`, Agent Cards posts `{ card, event }` to that URL after an action is recorded.

## Card schema

Core fields:

- `type`: `approval`, `choice`, `question`, `status`, `briefing`, or `comparison`
- `title`: short user-facing title
- `summary`: concise action context
- `details`: optional deeper review context
- `priority`: `low`, `medium`, or `high`
- `project`: grouping label
- `agent`: `{ "id": "hermes", "name": "Hermes" }`
- `actions`: buttons such as approve, reject, edit, send, investigate
- `options`: choice-card options
- `input`: question-card input metadata
- `items`: briefing-card bullet items
- `callbackUrl`: optional webhook for structured feedback events
- `metadata`: agent-owned structured context

For approval cards, use `metadata.draft`, `metadata.risks`, `metadata.attachments`, or `metadata.sections` so the detail panel can show what is being approved.

## MVP scope implemented

- Mobile-first PWA-style web app
- Needs Me, Today, Projects, Archive views
- Approval, choice, question, status, and briefing cards
- Tap actions and option selection
- Text answers for question cards
- Local JSON persistence
- Structured event history
- Callback webhook hook
- Agent CLI and example payloads

## Notes

This is intentionally single-user and local-first. It avoids arbitrary agent-generated UI: agents provide structured content and actions, while Agent Cards controls layout, lifecycle, and interaction patterns.
