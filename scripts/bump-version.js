#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const packagePath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const parts = String(pkg.version || "0.0.0").split(".").map((part) => Number.parseInt(part, 10) || 0);
while (parts.length < 3) parts.push(0);
parts[2] += 1;
pkg.version = parts.slice(0, 3).join(".");
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(pkg.version);
