// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "../../lib/db.server";
import { getUserMemberships } from "../../services/organizations/user-membership.server";

const TEST_SUBJECT = "auth0|user-membership-integration-test";
const TEST_EMAIL = "user-membership@approveaproof.test";
const TEST_SLUG_PREFIX = "user-membership-integration-test";

describe("getUserMemberships", () => {
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
        name: "Membership Integration Test",
      },
      create: {
        auth0Subject: TEST_SUBJECT,
        email: TEST_EMAIL,
        name: "Membership Integration Test",
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

  it("returns no memberships for a user who has not joined an organization", async () => {
    const memberships = await getUserMemberships(userId);

    expect(memberships).toEqual([]);
  });

  it("returns the user's memberships with their organizations", async () => {
    const firstOrganization = await db.organization.create({
      data: {
        name: "First Test Organization",
        slug: `${TEST_SLUG_PREFIX}-first`,
      },
    });

    const secondOrganization = await db.organization.create({
      data: {
        name: "Second Test Organization",
        slug: `${TEST_SLUG_PREFIX}-second`,
      },
    });

    await db.membership.create({
      data: {
        organizationId: firstOrganization.id,
        userId,
        role: "OWNER",
      },
    });

    await db.membership.create({
      data: {
        organizationId: secondOrganization.id,
        userId,
        role: "MEMBER",
      },
    });

    const memberships = await getUserMemberships(userId);

    expect(memberships).toHaveLength(2);

    expect(memberships[0].organization.id).toBe(
      firstOrganization.id,
    );
    expect(memberships[0].role).toBe("OWNER");

    expect(memberships[1].organization.id).toBe(
      secondOrganization.id,
    );
    expect(memberships[1].role).toBe("MEMBER");
  });
});