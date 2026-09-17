// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";

import { db } from "../../lib/db.server";
import { loader } from "../../routes/app.onboarding";
import {
  commitSession,
  getSession,
  setAuthenticatedUserId,
} from "../../services/auth/session.server";

const TEST_SUBJECT = "auth0|onboarding-loader-integration-test";
const TEST_EMAIL = "onboarding-loader@approveaproof.test";
const TEST_SLUG = "onboarding-loader-integration-test";

function createLoaderArgs(request: Request): LoaderFunctionArgs {
  return {
    request,
    params: {},
  } as LoaderFunctionArgs;
}

describe("app onboarding loader", () => {
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
        name: "Onboarding Loader Test",
      },
      create: {
        auth0Subject: TEST_SUBJECT,
        email: TEST_EMAIL,
        name: "Onboarding Loader Test",
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

  it("allows an authenticated user with no memberships to onboard", async () => {
    const session = await getSession();
    setAuthenticatedUserId(session, userId);

    const cookie = await commitSession(session);

    const request = new Request(
      "http://localhost:5173/app/onboarding",
      {
        headers: {
          Cookie: cookie,
        },
      },
    );

    const result = await loader(createLoaderArgs(request));

    expect(result).toBeNull();
  });

  it("redirects an unauthenticated user to login", async () => {
    const request = new Request(
      "http://localhost:5173/app/onboarding",
    );

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

  it("redirects an already-onboarded user to the app", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Onboarding Loader Test Organization",
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

    const session = await getSession();
    setAuthenticatedUserId(session, userId);

    const cookie = await commitSession(session);

    const request = new Request(
      "http://localhost:5173/app/onboarding",
      {
        headers: {
          Cookie: cookie,
        },
      },
    );

    try {
      await loader(createLoaderArgs(request));
      expect.fail("Expected loader to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");
    }
  });
});