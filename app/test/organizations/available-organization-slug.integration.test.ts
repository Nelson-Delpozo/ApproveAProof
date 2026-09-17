// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "../../lib/db.server";
import { createAvailableOrganizationSlug } from "../../services/organizations/available-organization-slug.server";

const TEST_SLUG_PREFIX = "available-slug-integration-test";

describe("createAvailableOrganizationSlug", () => {
  beforeEach(async () => {
    await db.organization.deleteMany({
      where: {
        slug: {
          startsWith: TEST_SLUG_PREFIX,
        },
      },
    });
  });

  afterAll(async () => {
    await db.organization.deleteMany({
      where: {
        slug: {
          startsWith: TEST_SLUG_PREFIX,
        },
      },
    });

    await db.$disconnect();
  });

  it("returns the base slug when it is available", async () => {
    const slug = await createAvailableOrganizationSlug("Available Slug Integration Test");

    expect(slug).toBe(TEST_SLUG_PREFIX);
  });

  it("adds the next available numeric suffix", async () => {
    await db.organization.createMany({
      data: [
        {
          name: "Existing Organization",
          slug: TEST_SLUG_PREFIX,
        },
        {
          name: "Existing Organization 2",
          slug: `${TEST_SLUG_PREFIX}-2`,
        },
        {
          name: "Existing Organization 3",
          slug: `${TEST_SLUG_PREFIX}-3`,
        },
      ],
    });

    const slug = await createAvailableOrganizationSlug("Available Slug Integration Test");

    expect(slug).toBe(`${TEST_SLUG_PREFIX}-4`);
  });

  it("uses the first available suffix when there is a gap", async () => {
    await db.organization.createMany({
      data: [
        {
          name: "Existing Organization",
          slug: TEST_SLUG_PREFIX,
        },
        {
          name: "Existing Organization 3",
          slug: `${TEST_SLUG_PREFIX}-3`,
        },
      ],
    });

    const slug = await createAvailableOrganizationSlug("Available Slug Integration Test");

    expect(slug).toBe(`${TEST_SLUG_PREFIX}-2`);
  });

  it("rejects a name that cannot produce a valid slug", async () => {
    await expect(createAvailableOrganizationSlug("!!!")).rejects.toThrow(
      "Organization name cannot produce a valid slug",
    );
  });
});
