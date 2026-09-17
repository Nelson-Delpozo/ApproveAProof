// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "../../lib/db.server";
import {
  commitSession,
  getSession,
  setAuthenticatedUserId,
} from "../../services/auth/session.server";
import { requireOrganization } from "../../services/organizations/require-organization.server";

const TEST_SUBJECT = "auth0|require-organization-integration-test";
const TEST_EMAIL = "require-organization@approveaproof.test";
const TEST_SLUG = "require-organization-integration-test";

describe("requireOrganization", () => {
  let userId: string;

  beforeEach(async () => {
    await db.organization.deleteMany({
      where: {
        slug: TEST_SLUG,
      },
    });

    const user = await db.user.upsert({
      where: {
        auth0Subject: TEST_SUBJECT,
      },
      update: {
        email: TEST_EMAIL,
        name: "Require Organization Test",
      },
      create: {
        auth0Subject: TEST_SUBJECT,
        email: TEST_EMAIL,
        name: "Require Organization Test",
      },
    });

    userId = user.id;
  });

  afterAll(async () => {
    await db.organization.deleteMany({
      where: {
        slug: TEST_SLUG,
      },
    });

    await db.user.deleteMany({
      where: {
        auth0Subject: TEST_SUBJECT,
      },
    });

    await db.$disconnect();
  });

  async function createAuthenticatedRequest() {
    const session = await getSession();
    setAuthenticatedUserId(session, userId);

    const cookie = await commitSession(session);

    return new Request("http://localhost:5173/app", {
      headers: {
        Cookie: cookie,
      },
    });
  }

  it("returns the authenticated user's organization context", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Require Organization Test",
        slug: TEST_SLUG,
      },
    });

    const membership = await db.membership.create({
      data: {
        organizationId: organization.id,
        userId,
        role: "OWNER",
      },
    });

    const request = await createAuthenticatedRequest();

    const context = await requireOrganization(request);

    expect(context.user.id).toBe(userId);
    expect(context.organization.id).toBe(organization.id);
    expect(context.membership.id).toBe(membership.id);
    expect(context.membership.role).toBe("OWNER");
  });

  it("redirects a user with no membership to onboarding", async () => {
    const request = await createAuthenticatedRequest();

    try {
      await requireOrganization(request);
      expect.fail("Expected requireOrganization to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/app/onboarding",
      );
    }
  });

  it("redirects an unauthenticated request to login", async () => {
    const request = new Request("http://localhost:5173/app");

    try {
      await requireOrganization(request);
      expect.fail("Expected requireOrganization to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/login");
    }
  });
});