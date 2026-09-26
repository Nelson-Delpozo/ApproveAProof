import "dotenv/config";

import { spawnSync } from "node:child_process";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for database integration tests.");
}

if (testDatabaseUrl === databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL must not be the same as DATABASE_URL. Database integration tests are destructive.",
  );
}

const vitestPath = "./node_modules/vitest/vitest.mjs";
const args = ["run", ...process.argv.slice(2)];

const result = spawnSync(process.execPath, [vitestPath, ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
