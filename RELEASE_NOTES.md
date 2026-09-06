# Local approval reliability release

This release repairs the local app. Cloud accounts and hosted agent access remain a later milestone.

## Approval behavior

Ordinary approval cards display their review content inline and show a confirmation before approve/send. Only offered actions appear. The confirmation is tied to the reviewed revision; changing a proposal invalidates old approvals. Decisions retain the reviewed card snapshot. Sending records approval for the agent to execute, not proof of delivery.

GET /api/cards and GET /api/cards/<id> include `revision`. POST /api/cards/<id>/actions must include that revision for `approve` and `send`:

```json
{"action":"approve","revision":1,"payload":{}}
```

A stale revision returns 409; refresh and review the new content. Missing revision, unsupported actions, invalid choices, and empty answers are rejected. The CLI requires an explicit reviewed revision:

```sh
node cli/agent-cards.js show <card-id>
node cli/agent-cards.js action <card-id> approve --revision 1
```

Use the number returned by `show`, not a hardcoded number. Existing local cards receive a starting revision automatically.

## Verification

```sh
npm ci
npx playwright install chromium
npm test
```

Tests use separate databases. Browser coverage includes reading and confirming a proposal on desktop and mobile-sized screens, rejecting a stale approval, and recording a rejection. Server coverage includes action validation, private static-file denial, revision handling, and nonblocking version checks. GitHub Actions runs the same tests.

The existing local single-user access model is unchanged. Keep deployment private through Tailscale Serve. This release does not add public authentication or multi-user isolation.
