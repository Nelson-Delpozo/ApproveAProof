// @vitest-environment node

import { afterAll, describe, expect, it } from "vitest";

import { db } from "../../lib/db.server";
import { requireUser } from "../../services/auth/require-user.server";
import {
  commitSession,
  getSession,
  setAuthenticatedUserId,
} from "../../services/auth/session.server";

const TEST_SUBJECT = "auth0|require-user-integration-test";
const TEST_EMAIL = "require-user-integration@approveaproof.test";

describe("requireUser", () => {
  afterAll(async () => {
    await db.user.deleteMany({
      where: {
        auth0Subject: TEST_SUBJECT,
      },
    });

    await db.$disconnect();
  });

  it("returns the authenticated local user", async () => {
    const user = await db.user.upsert({
      where: {
        auth0Subject: TEST_SUBJECT,
      },
      update: {
        email: TEST_EMAIL,
        name: "Require User Test",
      },
      create: {
        auth0Subject: TEST_SUBJECT,
        email: TEST_EMAIL,
        name: "Require User Test",
      },
    });

    const session = await getSession();
    setAuthenticatedUserId(session, user.id);

    const cookie = await commitSession(session);

    const request = new Request("http://localhost:5173/app", {
      headers: {
        Cookie: cookie,
      },
    });

    const authenticatedUser = await requireUser(request);

    expect(authenticatedUser.id).toBe(user.id);
    expect(authenticatedUser.auth0Subject).toBe(TEST_SUBJECT);
  });

  it("redirects when the session has no authenticated user", async () => {
    const request = new Request("http://localhost:5173/app");

    try {
      await requireUser(request);
      expect.fail("Expected requireUser to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/login");
    }
  });

  it("redirects when the session references a nonexistent user", async () => {
    const session = await getSession();

    setAuthenticatedUserId(session, "00000000-0000-0000-0000-000000000000");

    const cookie = await commitSession(session);

    const request = new Request("http://localhost:5173/app", {
      headers: {
        Cookie: cookie,
      },
    });

    try {
      await requireUser(request);
      expect.fail("Expected requireUser to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/login");
    }
  });
});
