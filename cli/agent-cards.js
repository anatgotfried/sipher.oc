#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");

const baseUrl = process.env.AGENT_CARDS_URL || "http://localhost:4173";

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(body.error || response.statusText);
  }
  return body;
}

function usage() {
  console.log(`Agent Cards CLI

Usage:
  agent-cards seed
  agent-cards reset --yes
  agent-cards simulate [scenario]
  agent-cards list
  agent-cards show <card-id>
  agent-cards create <card.json>
  agent-cards update <card-id> <patch.json>
  agent-cards delete <card-id>
  agent-cards action <card-id> <action> [payload.json]

Environment:
  AGENT_CARDS_URL  API server URL, default http://localhost:4173
`);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.resolve(file), "utf8"));
}

async function createCards(cards) {
  const created = [];
  for (const card of cards) {
    const result = await request("/api/cards", {
      method: "POST",
      body: JSON.stringify(card)
    });
    created.push(result.card);
  }
  return created;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }

  if (command === "seed") {
    const result = await request("/api/demo/seed", { method: "POST" });
    console.log(`Seeded ${result.cards.length} demo cards.`);
    return;
  }

  if (command === "reset") {
    if (args[0] !== "--yes") throw new Error("Refusing to reset without --yes.");
    const result = await request("/api/cards/reset", { method: "POST" });
    console.log(`Reset ${result.reset.cards} cards and ${result.reset.events} events.`);
    return;
  }

  if (command === "simulate") {
    const scenario = args[0] || "realistic";
    const scenarioFile = path.join(__dirname, "..", "simulations", `${scenario}.json`);
    let standaloneCards = null;
    try {
      standaloneCards = await readJson(scenarioFile);
    } catch {
      standaloneCards = null;
    }
    if (Array.isArray(standaloneCards)) {
      const created = await createCards(standaloneCards);
      console.log(`Simulated ${created.length} ${scenario} cards.`);
      for (const card of created) {
        console.log(`${card.id}\t${card.type}\t${card.title}`);
      }
      return;
    }
    const scenarios = await readJson(path.join(__dirname, "..", "simulations", "agent-scenarios.json"));
    if (scenario === "list") {
      console.log(Object.keys(scenarios).join("\n"));
      return;
    }
    const cards = scenarios[scenario];
    if (!cards) throw new Error(`Unknown scenario: ${scenario}. Run agent-cards simulate list.`);
    const created = await createCards(cards);
    console.log(`Simulated ${created.length} ${scenario} cards.`);
    for (const card of created) {
      console.log(`${card.id}\t${card.type}\t${card.title}`);
    }
    return;
  }

  if (command === "list") {
    const result = await request("/api/cards");
    for (const card of result.cards) {
      console.log(`${card.id}\t${card.type}\t${card.status}\t${card.title}`);
    }
    return;
  }

  if (command === "create") {
    if (!args[0]) throw new Error("Missing card JSON file.");
    const card = await readJson(args[0]);
    const result = await request("/api/cards", {
      method: "POST",
      body: JSON.stringify(card)
    });
    console.log(`Created ${result.card.id}`);
    return;
  }

  if (command === "show") {
    if (!args[0]) throw new Error("Usage: agent-cards show <card-id>");
    const result = await request(`/api/cards/${args[0]}`);
    console.log(JSON.stringify(result.card, null, 2));
    return;
  }

  if (command === "update") {
    if (!args[0] || !args[1]) throw new Error("Usage: agent-cards update <card-id> <patch.json>");
    const patch = await readJson(args[1]);
    const result = await request(`/api/cards/${args[0]}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    console.log(`Updated ${result.card.id}`);
    return;
  }

  if (command === "delete") {
    if (!args[0]) throw new Error("Usage: agent-cards delete <card-id>");
    const result = await request(`/api/cards/${args[0]}`, { method: "DELETE" });
    console.log(`Deleted ${result.card.id}`);
    return;
  }

  if (command === "action") {
    if (!args[0] || !args[1]) throw new Error("Usage: agent-cards action <card-id> <action> [payload.json]");
    const revisionFlag = args.indexOf("--revision");
    const revision = revisionFlag >= 0 ? Number(args[revisionFlag + 1]) : undefined;
    if (revisionFlag >= 0 && (!Number.isSafeInteger(revision) || revision < 1)) {
      throw new Error("--revision must be a positive integer from the card you reviewed.");
    }
    if (["approve", "send"].includes(args[1]) && revision === undefined) {
      throw new Error("Review the card with show, then pass --revision <number> to approve or send.");
    }
    const payloadFile = args[2] && args[2] !== "--revision" ? args[2] : null;
    const payload = payloadFile ? await readJson(payloadFile) : {};
    const result = await request(`/api/cards/${args[0]}/actions`, {
      method: "POST",
      body: JSON.stringify({ action: args[1], payload, revision })
    });
    console.log(`Recorded ${result.event.action} for ${result.card.id}; status=${result.card.status}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
