// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ActionFunctionArgs } from "react-router";

import { db } from "../../lib/db.server";
import { action } from "../../routes/app.onboarding";
import {
  commitSession,
  getSession,
  setAuthenticatedUserId,
} from "../../services/auth/session.server";

const TEST_SUBJECT = "auth0|onboarding-action-integration-test";
const TEST_EMAIL = "onboarding-action@approveaproof.test";
const TEST_SLUG_PREFIX = "onboarding-action-integration-test";

function createActionArgs(request: Request): ActionFunctionArgs {
  return {
    request,
    params: {},
  } as ActionFunctionArgs;
}

describe("app onboarding action", () => {
  let userId: string;

  beforeEach(async () => {
    await db.organization.deleteMany({
      where: {
        slug: {
          startsWith: TEST_SLUG_PREFIX,
        },
      },
    });

    const user = await db.user.upsert({
      where: {
        auth0Subject: TEST_SUBJECT,
      },
      update: {
        email: TEST_EMAIL,
        name: "Onboarding Action Test",
      },
      create: {
        auth0Subject: TEST_SUBJECT,
        email: TEST_EMAIL,
        name: "Onboarding Action Test",
      },
    });

    userId = user.id;
  });

  afterAll(async () => {
    await db.organization.deleteMany({
      where: {
        slug: {
          startsWith: TEST_SLUG_PREFIX,
        },
      },
    });

    await db.user.deleteMany({
      where: {
        auth0Subject: TEST_SUBJECT,
      },
    });

    await db.$disconnect();
  });

  async function createAuthenticatedRequest(organizationName: string) {
    const session = await getSession();
    setAuthenticatedUserId(session, userId);

    const cookie = await commitSession(session);

    const formData = new FormData();
    formData.set("organizationName", organizationName);

    return new Request("http://localhost:5173/app/onboarding", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: formData,
    });
  }

  it("creates an organization and OWNER membership", async () => {
    const request = await createAuthenticatedRequest("Onboarding Action Integration Test");

    try {
      await action(createActionArgs(request));
      expect.fail("Expected action to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");
    }

    const organization = await db.organization.findUnique({
      where: {
        slug: TEST_SLUG_PREFIX,
      },
    });

    expect(organization).not.toBeNull();
    expect(organization?.name).toBe("Onboarding Action Integration Test");

    const membership = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization!.id,
          userId,
        },
      },
    });

    expect(membership).not.toBeNull();
    expect(membership?.role).toBe("OWNER");
  });

  it("rejects an empty organization name", async () => {
    const request = await createAuthenticatedRequest("   ");

    const result = await action(createActionArgs(request));

    expect(result).toEqual({
      error: "Organization name is required.",
    });

    const memberships = await db.membership.findMany({
      where: {
        userId,
      },
    });

    expect(memberships).toHaveLength(0);
  });

  it("prevents an existing member from onboarding again", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Existing Organization",
        slug: `${TEST_SLUG_PREFIX}-existing`,
      },
    });

    await db.membership.create({
      data: {
        organizationId: organization.id,
        userId,
        role: "OWNER",
      },
    });

    const request = await createAuthenticatedRequest("Another Organization");

    try {
      await action(createActionArgs(request));
      expect.fail("Expected action to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");
    }

    const memberships = await db.membership.findMany({
      where: {
        userId,
      },
    });

    expect(memberships).toHaveLength(1);
  });
});
