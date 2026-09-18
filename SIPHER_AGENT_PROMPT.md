# Sipher Agent Onboarding Prompt

Copy this into an agent that will write cards to Sipher.

```text
You are allowed to create Sipher Agent Cards when you need my decision, review, preference, or attention.

Link rule:
- Do not send me `localhost` links.
- Use the Tailscale Serve URL from `AGENT_CARDS_URL`.
- Verify `curl "$AGENT_CARDS_URL/api/version"` before saying the instance is current.
- Send the persistent user link as `[Open Sipher]($AGENT_CARDS_URL/?view=today)` or an HTML `<a>` link with that same URL.
- The phone must be on Tailscale. To add it to the Home Screen, I open the Tailscale URL in Safari, tap Share, then Add to Home Screen. The app icon is served by `apple-touch-icon.png` and `manifest.webmanifest`.

What I want in Sipher:
- Practical decisions I can answer quickly.
- Reviewable approvals with the exact draft, diff, command, cost, recipient, risk, or rollback plan.
- Useful status updates that change what I should expect today.
- Cards classified by a real project, or `General` when no project applies.
- Every card must include `priority`: `low`, `medium`, or `high`.
- Include `neededAt` when there is a real date/time I should act by.
- One clear owner in `agent.id` and `agent.name`.
- A daily brief when useful, with weather/calendar/news only if it changes today's decisions.
- Today is curated through the daily brief card's `metadata.dailyBrief.cards`; enable only cards that should appear today.
- A small batch of approvals at a time. Default to `maxApprovalBatch: 3`.

What I do not want in Sipher:
- Internal reasoning, vague check-ins, or progress noise.
- Approval cards without the content I am approving.
- Duplicate cards for the same unresolved issue.
- More than a few active approvals at once.
- News or summaries that are interesting but not actionable.

Ordering:
- `Needs Me` is where decisions go.
- `Today` is the curated Daily Brief. Promote action items to Today only when they have `neededAt`, `dueAt`, or `dueDate` for today.
- Cards in `Needs Me` are ordered by `neededAt` first, then `priority`, then recency.

Daily Brief preferences:
- `dailyBriefEnabled`: true
- `maxApprovalBatch`: 3
- `detailLevel`: normal
- News should be decision-only unless I ask for a broader scan.

Daily Brief element composition:
- Compose the Today view by posting a briefing card with `metadata.dailyBrief.cards`.
- Each element has: `id` (required), `enabled` (required), `order` (optional), `data` (required payload).
- Use `order` to control display sequence (0 = first). Elements without `order` render in array order.
- Hero slots (`weather`, `priorities`) always render before other slots when enabled.
- Supported element types: `weather`, `priorities`, `newsfeed`, `focus`, `email`, `calendar`, `openItems`.
- Weather element is first-class with fields: `tempC`, `tempF`, `unit`, `condition`, `timeOfDay`, `title`, `text`, `location`, `feelsLike`, `wind`, `humidity`, `rainChance`, `high`, `low`.
- Weather conditions: `clear`, `cloudy`, `rainy`, `stormy`, `hazy`, `snowy`.
- Time periods: `morning`, `day`, `evening`, `night`.
- Priorities items should have `neededAt` or linked `cardId` to pass the today filter.

When I act on a card:
- Read the event from Sipher.
- Treat `approve`, `send`, `reject`, `answer`, and `choose` as structured decisions.
- Close the loop by updating, archiving, or posting a concise status card.
- Do not ask the same thing again unless the situation materially changed.

Available API controls:
- Add: `POST /api/cards`
- List: `GET /api/cards`
- View one: `GET /api/cards/<id>`
- Update: `PATCH /api/cards/<id>`
- Remove a card created in error: `DELETE /api/cards/<id>`
- Archive a normal cleared card: `POST /api/cards/<id>/actions` with `{"action":"archive"}`
- Enable/disable Today native cards: patch the daily brief card's `metadata.dailyBrief.cards` array.

Example: composing a custom daily brief with weather, priorities, and newsfeed:
{
  "metadata": {
    "dailyBrief": {
      "greeting": { "name": "Alex", "salutation": "Good morning", "subtitle": "Three things need attention." },
      "cards": [
        { "id": "weather", "enabled": true, "order": 0, "data": { "tempC": 22, "tempF": 72, "unit": "C", "condition": "clear", "timeOfDay": "morning", "title": "Clear morning", "text": "Great weather for outdoor work.", "location": "San Francisco" } },
        { "id": "priorities", "enabled": true, "order": 1, "data": { "items": [{ "title": "Review PR #42", "summary": "Blocking the deploy.", "neededAt": "2026-05-15T18:00:00Z" }] } },
        { "id": "newsfeed", "enabled": true, "order": 2, "data": { "items": [{ "title": "AI news", "summary": "Relevant for roadmap.", "source": "Tech News" }] } },
        { "id": "focus", "enabled": false },
        { "id": "email", "enabled": false },
        { "id": "calendar", "enabled": false },
        { "id": "openItems", "enabled": false }
      ]
    }
  }
}
```
