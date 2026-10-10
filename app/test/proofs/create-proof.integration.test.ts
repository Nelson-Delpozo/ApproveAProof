
// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ProofActivityType, ProofStatus } from "../../../generated/prisma/client";
import { db } from "../../lib/db.server";
import { createProofForOrganization } from "../../services/proofs/create-proof.server";
import { cleanupTestOrganizations } from "../helpers/cleanup-test-organizations";

const ORG_A_SLUG = "create-proof-org-a";
const ORG_B_SLUG = "create-proof-org-b";

async function createOrganization(slug: string) {
  return db.organization.create({
    data: { name: `Create Proof ${slug}`, slug },
  });
}

const validInput = {
  title: "  Johnson Dental Brochure  ",
  recipientName: "  Alex Johnson  ",
  recipientEmail: "  alex@example.test  ",
};

describe("createProofForOrganization", () => {
  beforeEach(async () => {
    await cleanupTestOrganizations(db, [ORG_A_SLUG, ORG_B_SLUG]);
  });

  afterAll(async () => {
    await cleanupTestOrganizations(db, [ORG_A_SLUG, ORG_B_SLUG]);
    await db.$disconnect();
  });

  it("creates a Draft Proof with trimmed recipient snapshots and one creation activity", async () => {
    const organization = await createOrganization(ORG_A_SLUG);

    const proof = await createProofForOrganization(organization.id, validInput);

    expect(proof.organizationId).toBe(organization.id);
    expect(proof.title).toBe("Johnson Dental Brochure");
    expect(proof.recipientName).toBe("Alex Johnson");
    expect(proof.recipientEmail).toBe("alex@example.test");
    expect(proof.customerId).toBeNull();
    expect(proof.currentRevisionId).toBeNull();
    expect(proof.status).toBe(ProofStatus.DRAFT);

    const activities = await db.proofActivity.findMany({
      where: { organizationId: organization.id, proofId: proof.id },
    });
    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe(ProofActivityType.PROOF_CREATED);
  });

  it("allows a Draft Proof without an email address", async () => {
    const organization = await createOrganization(ORG_A_SLUG);

    const proof = await createProofForOrganization(organization.id, {
      title: "Poster",
      recipientName: "Morgan Lee",
    });

    expect(proof.recipientEmail).toBeNull();
    expect(proof.status).toBe(ProofStatus.DRAFT);
  });

  it("associates an owned Customer without replacing the supplied recipient snapshot", async () => {
    const organization = await createOrganization(ORG_A_SLUG);
    const customer = await db.customer.create({
      data: {
        organizationId: organization.id,
        name: "Old Customer Name",
        email: "old@example.test",
      },
    });

    const proof = await createProofForOrganization(organization.id, {
      ...validInput,
      customerId: customer.id,
    });

    expect(proof.customerId).toBe(customer.id);
    expect(proof.recipientName).toBe("Alex Johnson");
    expect(proof.recipientEmail).toBe("alex@example.test");

    await db.customer.update({
      where: { id: customer.id },
      data: { name: "Updated Customer", email: "new@example.test" },
    });

    const persisted = await db.proof.findUniqueOrThrow({ where: { id: proof.id } });
    expect(persisted.recipientName).toBe("Alex Johnson");
    expect(persisted.recipientEmail).toBe("alex@example.test");
  });

  it("rejects a Customer belonging to another Organization without creating a Proof or activity", async () => {
    const organizationA = await createOrganization(ORG_A_SLUG);
    const organizationB = await createOrganization(ORG_B_SLUG);
    const customerB = await db.customer.create({
      data: { organizationId: organizationB.id, name: "Other Shop Customer" },
    });

    await expect(
      createProofForOrganization(organizationA.id, {
        ...validInput,
        customerId: customerB.id,
      }),
    ).rejects.toThrow();

    expect(await db.proof.count({ where: { organizationId: organizationA.id } })).toBe(0);
    expect(await db.proofActivity.count({ where: { organizationId: organizationA.id } })).toBe(0);
  });

  it("rejects a nonexistent Customer without creating records", async () => {
    const organization = await createOrganization(ORG_A_SLUG);

    await expect(
      createProofForOrganization(organization.id, {
        ...validInput,
        customerId: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow();

    expect(await db.proof.count({ where: { organizationId: organization.id } })).toBe(0);
    expect(await db.proofActivity.count({ where: { organizationId: organization.id } })).toBe(0);
  });

  it.each([
    { title: "", recipientName: "Alex" },
    { title: "   ", recipientName: "Alex" },
    { title: "Poster", recipientName: "" },
    { title: "Poster", recipientName: "   " },
    { title: "Poster", recipientName: "Alex", recipientEmail: "invalid-email" },
  ])("rejects invalid creation input: %j", async (input) => {
    const organization = await createOrganization(ORG_A_SLUG);

    await expect(createProofForOrganization(organization.id, input)).rejects.toThrow();

    expect(await db.proof.count({ where: { organizationId: organization.id } })).toBe(0);
    expect(await db.proofActivity.count({ where: { organizationId: organization.id } })).toBe(0);
  });

  it("rejects a nonexistent Organization without creating an orphan Proof or activity", async () => {
    const missingOrganizationId = "00000000-0000-4000-8000-000000000002";

    await expect(
      createProofForOrganization(missingOrganizationId, validInput),
    ).rejects.toThrow();

    expect(await db.proof.count({ where: { organizationId: missingOrganizationId } })).toBe(0);
    expect(await db.proofActivity.count({ where: { organizationId: missingOrganizationId } })).toBe(0);
  });
});
