// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "../../lib/db.server";
import { getCustomerForOrganization } from "../../services/customers/customer.server";

const ORG_A_SLUG = "tenant-isolation-org-a";
const ORG_B_SLUG = "tenant-isolation-org-b";

describe("customer tenant isolation", () => {
  beforeEach(async () => {
    await db.organization.deleteMany({
      where: {
        slug: {
          in: [ORG_A_SLUG, ORG_B_SLUG],
        },
      },
    });
  });

  afterAll(async () => {
    await db.organization.deleteMany({
      where: {
        slug: {
          in: [ORG_A_SLUG, ORG_B_SLUG],
        },
      },
    });

    await db.$disconnect();
  });

  it("allows access within the owning organization", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Tenant Isolation Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const customer = await db.customer.create({
      data: {
        organizationId: organization.id,
        name: "Organization A Customer",
        email: "customer-a@approveaproof.test",
      },
    });

    const result = await getCustomerForOrganization(organization.id, customer.id);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(customer.id);
    expect(result?.organizationId).toBe(organization.id);
  });

  it("does not expose a valid customer ID to another organization", async () => {
    const organizationA = await db.organization.create({
      data: {
        name: "Tenant Isolation Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const organizationB = await db.organization.create({
      data: {
        name: "Tenant Isolation Organization B",
        slug: ORG_B_SLUG,
      },
    });

    const customerA = await db.customer.create({
      data: {
        organizationId: organizationA.id,
        name: "Organization A Customer",
        email: "customer-a@approveaproof.test",
      },
    });

    const result = await getCustomerForOrganization(organizationB.id, customerA.id);

    expect(result).toBeNull();
  });

  it("keeps each organization's customers isolated", async () => {
    const organizationA = await db.organization.create({
      data: {
        name: "Tenant Isolation Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const organizationB = await db.organization.create({
      data: {
        name: "Tenant Isolation Organization B",
        slug: ORG_B_SLUG,
      },
    });

    const customerA = await db.customer.create({
      data: {
        organizationId: organizationA.id,
        name: "Organization A Customer",
      },
    });

    const customerB = await db.customer.create({
      data: {
        organizationId: organizationB.id,
        name: "Organization B Customer",
      },
    });

    const resultA = await getCustomerForOrganization(organizationA.id, customerA.id);

    const resultB = await getCustomerForOrganization(organizationB.id, customerB.id);

    const crossTenantA = await getCustomerForOrganization(organizationA.id, customerB.id);

    const crossTenantB = await getCustomerForOrganization(organizationB.id, customerA.id);

    expect(resultA?.id).toBe(customerA.id);
    expect(resultB?.id).toBe(customerB.id);

    expect(crossTenantA).toBeNull();
    expect(crossTenantB).toBeNull();
  });
});
