// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cleanupTestOrganizations } from "../helpers/cleanup-test-organizations";

import { db } from "../../lib/db.server";
import { getProofForOrganization } from "../../services/proofs/proof.server";

const ORG_A_SLUG = "proof-tenant-isolation-org-a";
const ORG_B_SLUG = "proof-tenant-isolation-org-b";

describe("proof tenant isolation", () => {
  beforeEach(async () => {
    await cleanupTestOrganizations(db, [ORG_A_SLUG, ORG_B_SLUG]);
  });

  afterAll(async () => {
    await cleanupTestOrganizations(db, [ORG_A_SLUG, ORG_B_SLUG]);
    await db.$disconnect();
  });

  it("allows access within the owning organization", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Proof Tenant Isolation Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Organization A Proof",
      },
    });

    const result = await getProofForOrganization(organization.id, proof.id);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(proof.id);
    expect(result?.organizationId).toBe(organization.id);
  });

  it("does not expose a valid proof ID to another organization", async () => {
    const organizationA = await db.organization.create({
      data: {
        name: "Proof Tenant Isolation Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const organizationB = await db.organization.create({
      data: {
        name: "Proof Tenant Isolation Organization B",
        slug: ORG_B_SLUG,
      },
    });

    const proofA = await db.proof.create({
      data: {
        organizationId: organizationA.id,
        recipientName: "Customer A",
        title: "Organization A Proof",
      },
    });

    const result = await getProofForOrganization(organizationB.id, proofA.id);

    expect(result).toBeNull();
  });

  it("keeps each organization's proofs isolated", async () => {
    const organizationA = await db.organization.create({
      data: {
        name: "Proof Tenant Isolation Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const organizationB = await db.organization.create({
      data: {
        name: "Proof Tenant Isolation Organization B",
        slug: ORG_B_SLUG,
      },
    });

    const proofA = await db.proof.create({
      data: {
        organizationId: organizationA.id,
        recipientName: "Customer A",
        title: "Organization A Proof",
      },
    });

    const proofB = await db.proof.create({
      data: {
        organizationId: organizationB.id,
        recipientName: "Customer B",
        title: "Organization B Proof",
      },
    });

    const resultA = await getProofForOrganization(organizationA.id, proofA.id);
    const resultB = await getProofForOrganization(organizationB.id, proofB.id);

    const crossTenantA = await getProofForOrganization(organizationA.id, proofB.id);
    const crossTenantB = await getProofForOrganization(organizationB.id, proofA.id);

    expect(resultA?.id).toBe(proofA.id);
    expect(resultB?.id).toBe(proofB.id);

    expect(crossTenantA).toBeNull();
    expect(crossTenantB).toBeNull();
  });
});
