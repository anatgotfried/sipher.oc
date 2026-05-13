# Agent Cards Agent Handoff

This repository now contains the Agent Cards MVP, not the old Sipher landing page.

## What This Is

Agent Cards is a local-first visual action feed for AI agents. Agents create structured cards through an HTTP API or CLI. A human reviews cards in the web UI and responds with approvals, rejections, choices, answers, or archive actions. Every response is stored as a structured event.

## Run It

```bash
npm start
```

Open `http://localhost:4173`.

Seed demo cards:

```bash
npm run seed
```

## Verify It

```bash
node --check server.js
node --check app.js
node --check cli/agent-cards.js
npm run seed
npm run list
```

Expected result: five demo cards are listed, including approval, choice, question, status, and briefing cards.

## Agent Integration Rules

Read `AGENT_INTEGRATION.md` before creating cards.

Approval cards must be reviewable. If the agent asks the user to approve an email, file change, command, publish action, purchase, or scheduling action, include the exact draft, diff, command, recipient, risk, or attachment in `details` or `metadata`.

Bad approval card:

```json
{
  "type": "approval",
  "title": "Send weekly summary?",
  "summary": "Draft ready.",
  "actions": ["approve", "reject", "edit"]
}
```

Good approval card:

```json
{
  "type": "approval",
  "title": "Send weekly summary?",
  "summary": "Draft ready — review recipient and body.",
  "details": "This sends an external message.",
  "actions": ["send", "edit", "reject"],
  "metadata": {
    "draft": {
      "to": "Eden <eden@example.com>",
      "subject": "Summer camp weekly summary",
      "body": "Hi Eden,\n\nHere are the confirmed dates..."
    },
    "risks": ["External recipient"]
  }
}
```

## Important Files

- `AGENT_INTEGRATION.md`: contract for agents creating useful cards
- `index.html`: app shell
- `style.css`: responsive product UI
- `app.js`: browser state, rendering, and card interactions
- `server.js`: dependency-free Node HTTP API and static server
- `cli/agent-cards.js`: agent-facing CLI
- `examples/*.json`: card payload examples
- `data/agent-cards.json`: local runtime data, intentionally gitignored
- `README.md`: user and API docs
- `prd.txt`: original product requirements

## Product Direction

Keep the MVP constrained:

- Structured card schema, not arbitrary agent-generated UI
- Mobile-first feed
- Single-user local/self-hosted setup
- Approval, choice, question, status, briefing, and comparison cards
- HTTP API first, CLI second, MCP later
- Explicit confirmation for consequential actions

Do not turn this into a dashboard builder, marketplace, team product, or general chat replacement before the card interaction loop is strong.
