# Agent Integration Contract

This file tells agents how to create useful Agent Cards. The short version: do not send vague approval cards. Send the exact thing the human is approving.

## Core Rule

Every card should answer three questions:

1. What decision is needed?
2. What exact content, option, or action is being reviewed?
3. What will happen after the user taps an action?

If the user cannot confidently decide from the card detail panel, the card payload is incomplete.

## Minimal Card Shape

```json
{
  "type": "approval",
  "title": "Send weekly summary to Eden?",
  "summary": "Draft ready — covers dates, pickup logistics, and what to pack.",
  "details": "This will send an external message. Review the full draft before approving.",
  "priority": "medium",
  "project": "Family",
  "agent": { "id": "hermes", "name": "Hermes" },
  "actions": ["approve", "reject", "edit"],
  "metadata": {}
}
```

`actions` may be strings or objects. Prefer objects when a label needs to be specific.

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
  "agent": { "id": "hermes", "name": "Hermes" },
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
