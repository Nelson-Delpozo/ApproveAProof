import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../generated/prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for database integration tests.");
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL must not be the same as DATABASE_URL. Database integration tests are destructive.",
  );
}

const adapter = new PrismaPg({
  connectionString: testDatabaseUrl,
});

export const db = new PrismaClient({ adapter });
