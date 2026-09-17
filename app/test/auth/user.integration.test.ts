// @vitest-environment node

import { afterAll, describe, expect, it } from "vitest";

import { db } from "../../lib/db.server";
import { resolveAuthenticatedUser } from "../../services/auth/user.server";

const TEST_SUBJECT = "auth0|approveaproof-user-integration-test";
const TEST_EMAIL = "auth-integration-test@approveaproof.test";

describe("authenticated user resolution", () => {
  afterAll(async () => {
    await db.user.deleteMany({
      where: {
        auth0Subject: TEST_SUBJECT,
      },
    });

    await db.$disconnect();
  });

  it("creates a user from a new authenticated identity", async () => {
    await db.user.deleteMany({
      where: {
        auth0Subject: TEST_SUBJECT,
      },
    });

    const user = await resolveAuthenticatedUser({
      subject: TEST_SUBJECT,
      email: TEST_EMAIL,
      name: "Auth Integration Test",
    });

    expect(user.auth0Subject).toBe(TEST_SUBJECT);
    expect(user.email).toBe(TEST_EMAIL);
    expect(user.name).toBe("Auth Integration Test");

    const storedUser = await db.user.findUnique({
      where: {
        auth0Subject: TEST_SUBJECT,
      },
    });

    expect(storedUser?.id).toBe(user.id);
  });

  it("resolves the same Auth0 subject to the existing user", async () => {
    const firstUser = await resolveAuthenticatedUser({
      subject: TEST_SUBJECT,
      email: TEST_EMAIL,
      name: "Original Name",
    });

    const secondUser = await resolveAuthenticatedUser({
      subject: TEST_SUBJECT,
      email: TEST_EMAIL,
      name: "Updated Name",
    });

    expect(secondUser.id).toBe(firstUser.id);
    expect(secondUser.name).toBe("Updated Name");
  });
});
