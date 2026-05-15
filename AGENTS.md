# Agent Cards Agent Handoff

This repository now contains the Agent Cards MVP, not the old Sipher landing page.

## What This Is

Agent Cards is a local-first visual action feed for AI agents. Agents create structured cards through an HTTP API or CLI. A human reviews cards in the web UI and responds with approvals, rejections, choices, answers, or archive actions. Every response is stored as a structured event.

## Run It

```bash
npm start
```

Open `http://localhost:4173`.

For phone/Home Screen use, expose the app with Tailscale Serve and send the Tailscale HTTPS link, not localhost:

```bash
npm start
tailscale serve --bg 4173
tailscale serve status
export AGENT_CARDS_URL="https://<machine-name>.<tailnet-name>.ts.net"
export AGENT_CARDS_CANONICAL_URL="$AGENT_CARDS_URL"
curl -fsS "$AGENT_CARDS_URL/api/version"
```

User-facing link format: `https://<machine-name>.<tailnet-name>.ts.net/?view=today`.

To add Sipher to iPhone Home Screen: connect the phone to Tailscale, open the Tailscale URL in Safari, Share, Add to Home Screen. The icon comes from `apple-touch-icon.png` plus `manifest.webmanifest` icons.

Seed demo cards:

```bash
npm run seed
```

Generate a shared feed where Hermes, OpenClaw, Atlas, Calendar Agent, and Deploy Agent all write cards:

```bash
npm run simulate -- multi-agent
```

Reset local cards and event history:

```bash
node cli/agent-cards.js reset --yes
```

## Freshness Rule For Agents

Before claiming Agent Cards is latest, verify `/api/version` from the exact URL being shown or sent to the user.

```bash
curl "$AGENT_CARDS_URL/api/version"
```

If `AGENT_CARDS_URL` is unset, use the browser URL itself. Do not verify `localhost` and then show a Tailscale/IP URL. Missing `/api/version`, `404`, invalid JSON, `stale: true`, or `updateAvailable: true` means the instance is not latest. If `git.dirty` is true, call it the latest local working tree, not the latest committed version.

## Verify It

```bash
node --check server.js
node --check app.js
node --check cli/agent-cards.js
npm run seed
npm run list
npm test
```

Expected result: demo cards are listed, and the test suite passes static asset checks plus browser workflow/layout checks.

## Agent Integration Rules

Read `AGENT_INTEGRATION.md` before creating cards.

Approval cards must be reviewable. If the agent asks the user to approve an email, file change, command, publish action, purchase, or scheduling action, include the exact draft, diff, command, recipient, risk, or attachment in `details` or `metadata`.

Multiple agents may write into the same Sipher feed. Each card must have one primary owner in `agent`, stable `agent.id`, a clear `project`, and a clear next action. Use `metadata.sourceCards` or `metadata.contributors` for cross-agent context instead of vague shared ownership.

Agents can create, list, view, update, act on, archive, and delete cards through the HTTP API or CLI. Use `DELETE /api/cards/<id>` only for cards created in error; use the `archive` action for normal clearing. Today cards are controlled by patching the daily brief card's `metadata.dailyBrief.cards` entries with `enabled: true/false`.

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
      "to": "Riley <riley@example.com>",
      "subject": "Summer camp weekly summary",
      "body": "Hi Riley,\n\nHere are the confirmed dates..."
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
- `tests/*.spec.js`: Playwright workflow and layout tests
- `tests/*.test.js`: Node static tests
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
