import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseUrl = process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for database integration tests.");
}

if (!databaseUrl || databaseUrl !== testDatabaseUrl) {
  throw new Error("Database integration tests must run through the guarded integration runner.");
}

const adapter = new PrismaPg({
  connectionString: testDatabaseUrl,
});

export const db = new PrismaClient({ adapter });
