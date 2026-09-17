// @vitest-environment node

import { afterAll, describe, expect, it } from "vitest";

import { db } from "../../lib/db.server";
import { createOrganizationForUser } from "../../services/organizations/create-organization.server";

const TEST_SUBJECT = "auth0|create-organization-integration-test";
const TEST_EMAIL = "create-organization@approveaproof.test";
const TEST_SLUG = "create-organization-integration-test";

describe("createOrganizationForUser", () => {
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

  it("creates an organization and OWNER membership atomically", async () => {
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
        name: "Organization Integration Test",
      },
      create: {
        auth0Subject: TEST_SUBJECT,
        email: TEST_EMAIL,
        name: "Organization Integration Test",
      },
    });

    const result = await createOrganizationForUser({
      userId: user.id,
      name: "Integration Test Print Shop",
      slug: TEST_SLUG,
    });

    expect(result.organization.name).toBe("Integration Test Print Shop");
    expect(result.organization.slug).toBe(TEST_SLUG);

    expect(result.membership.organizationId).toBe(result.organization.id);
    expect(result.membership.userId).toBe(user.id);
    expect(result.membership.role).toBe("OWNER");

    const storedMembership = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: result.organization.id,
          userId: user.id,
        },
      },
      include: {
        organization: true,
      },
    });

    expect(storedMembership).not.toBeNull();
    expect(storedMembership?.role).toBe("OWNER");
    expect(storedMembership?.organization.id).toBe(result.organization.id);
  });
});
