// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { MembershipRole } from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";
import {
  commitSession,
  getSession,
  setAuthenticatedUserId,
} from "../../services/auth/session.server";
import { requireRole } from "../../services/organizations/require-role.server";

const TEST_SUBJECT = "auth0|require-role-integration-test";
const TEST_EMAIL = "require-role@approveaproof.test";
const TEST_SLUG = "require-role-integration-test";

describe("requireRole", () => {
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
        name: "Require Role Test",
      },
      create: {
        auth0Subject: TEST_SUBJECT,
        email: TEST_EMAIL,
        name: "Require Role Test",
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

  async function createRequestForRole(role: MembershipRole) {
    const organization = await db.organization.create({
      data: {
        name: "Require Role Test Organization",
        slug: TEST_SLUG,
      },
    });

    await db.membership.create({
      data: {
        organizationId: organization.id,
        userId,
        role,
      },
    });

    const session = await getSession();
    setAuthenticatedUserId(session, userId);

    const cookie = await commitSession(session);

    return new Request("http://localhost:5173/app", {
      headers: {
        Cookie: cookie,
      },
    });
  }

  it("allows an OWNER when OWNER is required", async () => {
    const request = await createRequestForRole("OWNER");

    const context = await requireRole(request, "OWNER");

    expect(context.membership.role).toBe("OWNER");
  });

  it("allows an OWNER when ADMIN is required", async () => {
    const request = await createRequestForRole("OWNER");

    const context = await requireRole(request, "ADMIN");

    expect(context.membership.role).toBe("OWNER");
  });

  it("allows an ADMIN when ADMIN is required", async () => {
    const request = await createRequestForRole("ADMIN");

    const context = await requireRole(request, "ADMIN");

    expect(context.membership.role).toBe("ADMIN");
  });

  it("allows an ADMIN when MEMBER is required", async () => {
    const request = await createRequestForRole("ADMIN");

    const context = await requireRole(request, "MEMBER");

    expect(context.membership.role).toBe("ADMIN");
  });

  it("allows a MEMBER when MEMBER is required", async () => {
    const request = await createRequestForRole("MEMBER");

    const context = await requireRole(request, "MEMBER");

    expect(context.membership.role).toBe("MEMBER");
  });

  it("denies an ADMIN when OWNER is required", async () => {
    const request = await createRequestForRole("ADMIN");

    try {
      await requireRole(request, "OWNER");
      expect.fail("Expected requireRole to deny access");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(403);
    }
  });

  it("denies a MEMBER when ADMIN is required", async () => {
    const request = await createRequestForRole("MEMBER");

    try {
      await requireRole(request, "ADMIN");
      expect.fail("Expected requireRole to deny access");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(403);
    }
  });

  it("denies a MEMBER when OWNER is required", async () => {
    const request = await createRequestForRole("MEMBER");

    try {
      await requireRole(request, "OWNER");
      expect.fail("Expected requireRole to deny access");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(403);
    }
  });
});