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
  agent-cards simulate [scenario]
  agent-cards list
  agent-cards create <card.json>
  agent-cards update <card-id> <patch.json>
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

  if (command === "simulate") {
    const scenario = args[0] || "realistic";
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

  if (command === "action") {
    if (!args[0] || !args[1]) throw new Error("Usage: agent-cards action <card-id> <action> [payload.json]");
    const payload = args[2] ? await readJson(args[2]) : {};
    const result = await request(`/api/cards/${args[0]}/actions`, {
      method: "POST",
      body: JSON.stringify({ action: args[1], payload })
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
