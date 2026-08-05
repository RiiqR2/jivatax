#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const apiRoot = path.join(__dirname, "..");
const srcRoot = path.join(apiRoot, "src");
const filters = process.argv.slice(2);

function findSpecFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSpecFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

let specFiles = findSpecFiles(srcRoot).sort();

if (filters.length > 0) {
  specFiles = specFiles.filter((file) =>
    filters.some((filter) => file.includes(filter)),
  );
}

if (specFiles.length === 0) {
  console.error(
    filters.length
      ? `No spec files matched filter(s): ${filters.join(", ")}`
      : "No spec files found.",
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    "--test",
    "-r",
    "ts-node/register",
    "-r",
    "tsconfig-paths/register",
    ...specFiles,
  ],
  {
    stdio: "inherit",
    cwd: apiRoot,
  },
);

process.exit(result.status ?? 1);
