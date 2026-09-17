// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";

import { db } from "../../lib/db.server";
import { loader } from "../../routes/app";
import {
  commitSession,
  getSession,
  setAuthenticatedUserId,
} from "../../services/auth/session.server";

const TEST_SUBJECT = "auth0|app-loader-integration-test";
const TEST_EMAIL = "app-loader@approveaproof.test";
const TEST_SLUG = "app-loader-integration-test";

function createLoaderArgs(request: Request): LoaderFunctionArgs {
  return {
    request,
    params: {},
  } as LoaderFunctionArgs;
}

describe("app loader", () => {
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
        name: "App Loader Test",
      },
      create: {
        auth0Subject: TEST_SUBJECT,
        email: TEST_EMAIL,
        name: "App Loader Test",
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

  it("redirects an unauthenticated request to login", async () => {
    const request = new Request("http://localhost:5173/app");

    try {
      await loader(createLoaderArgs(request));
      expect.fail("Expected loader to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/login");
    }
  });

  it("redirects an authenticated user without a membership to onboarding", async () => {
    const request = await createAuthenticatedRequest();

    try {
      await loader(createLoaderArgs(request));
      expect.fail("Expected loader to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/app/onboarding",
      );
    }
  });

  it("returns tenant-scoped app data for an organization member", async () => {
    const organization = await db.organization.create({
      data: {
        name: "App Loader Test Organization",
        slug: TEST_SLUG,
      },
    });

    await db.membership.create({
      data: {
        organizationId: organization.id,
        userId,
        role: "OWNER",
      },
    });

    const request = await createAuthenticatedRequest();

    const result = await loader(createLoaderArgs(request));

    expect(result.user.id).toBe(userId);
    expect(result.user.email).toBe(TEST_EMAIL);

    expect(result.organization.id).toBe(organization.id);
    expect(result.organization.name).toBe(
      "App Loader Test Organization",
    );
    expect(result.organization.slug).toBe(TEST_SLUG);

    expect(result.membership.role).toBe("OWNER");
  });
});