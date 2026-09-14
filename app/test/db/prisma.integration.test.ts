import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "../../lib/db.server";

async function resetDatabase() {
  await db.proofDispatch.deleteMany();
  await db.proofActivity.deleteMany();
  await db.proofResponse.deleteMany();

  await db.proof.updateMany({
    data: {
      currentRevisionId: null,
    },
  });

  await db.revision.deleteMany();
  await db.proof.deleteMany();
  await db.customer.deleteMany();
  await db.membership.deleteMany();
  await db.user.deleteMany();
  await db.organization.deleteMany();
}

async function createOrganization(name: string, slug: string) {
  return db.organization.create({
    data: {
      name,
      slug,
    },
  });
}

async function createCustomer(organizationId: string, name: string, email: string) {
  return db.customer.create({
    data: {
      organizationId,
      name,
      email,
    },
  });
}

async function createProof(
  organizationId: string,
  customerId: string,
  recipientName: string,
  recipientEmail: string,
  title: string,
) {
  return db.proof.create({
    data: {
      organizationId,
      customerId,
      recipientName,
      recipientEmail,
      title,
    },
  });
}

async function createRevision(organizationId: string, proofId: string, number: number) {
  return db.revision.create({
    data: {
      organizationId,
      proofId,
      number,
      fileKey: `test/${proofId}/${number}.pdf`,
      fileName: `proof-${number}.pdf`,
      fileType: "application/pdf",
      fileSize: 123,
      fileHash: `hash-${proofId}-${number}`,
    },
  });
}

describe("database invariants", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("rejects a revision whose organization does not own the proof", async () => {
    const organizationA = await createOrganization("Organization A", "organization-a");

    const organizationB = await createOrganization("Organization B", "organization-b");

    const customer = await createCustomer(organizationA.id, "Customer A", "customer-a@example.com");

    const proof = await createProof(
      organizationA.id,
      customer.id,
      customer.name,
      "customer-a@example.com",
      "Proof A",
    );

    await expect(createRevision(organizationB.id, proof.id, 1)).rejects.toThrow();
  });

  it("rejects a current revision belonging to another proof", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proofA = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof A",
    );

    const proofB = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof B",
    );

    const revisionB = await createRevision(organization.id, proofB.id, 1);

    await expect(
      db.proof.update({
        where: {
          id: proofA.id,
        },
        data: {
          currentRevisionId: revisionB.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("preserves proof recipient history when a customer is deleted", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Jane Customer", "jane@example.com");

    const proof = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "jane@example.com",
      "Historical Proof",
    );

    await db.customer.delete({
      where: {
        id: customer.id,
      },
    });

    const preservedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(preservedProof.customerId).toBeNull();
    expect(preservedProof.recipientName).toBe("Jane Customer");
    expect(preservedProof.recipientEmail).toBe("jane@example.com");
  });

  it("rejects a proof response tied to a revision from another proof or organization", async () => {
    const organizationA = await createOrganization("Organization A", "organization-a");

    const organizationB = await createOrganization("Organization B", "organization-b");

    const customerA = await createCustomer(
      organizationA.id,
      "Customer A",
      "customer-a@example.com",
    );

    const customerB = await createCustomer(
      organizationB.id,
      "Customer B",
      "customer-b@example.com",
    );

    const proofA = await createProof(
      organizationA.id,
      customerA.id,
      customerA.name,
      "customer-a@example.com",
      "Proof A",
    );

    const proofB = await createProof(
      organizationB.id,
      customerB.id,
      customerB.name,
      "customer-b@example.com",
      "Proof B",
    );

    const revisionB = await createRevision(organizationB.id, proofB.id, 1);

    await expect(
      db.proofResponse.create({
        data: {
          organizationId: organizationA.id,
          proofId: proofA.id,
          revisionId: revisionB.id,
          type: "CHANGES_REQUESTED",
          responderName: "Customer A",
          responderEmail: "customer-a@example.com",
          comments: "Please revise this.",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects an approved response without an approval statement snapshot", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proof = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof",
    );

    const revision = await createRevision(organization.id, proof.id, 1);

    await expect(
      db.proofResponse.create({
        data: {
          organizationId: organization.id,
          proofId: proof.id,
          revisionId: revision.id,
          type: "APPROVED",
          responderName: "Customer",
          responderEmail: "customer@example.com",
        },
      }),
    ).rejects.toThrow();
  });

  it("prevents deletion of a revision referenced by proof response evidence", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proof = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof",
    );

    const revision = await createRevision(organization.id, proof.id, 1);

    await db.proofResponse.create({
      data: {
        organizationId: organization.id,
        proofId: proof.id,
        revisionId: revision.id,
        type: "APPROVED",
        responderName: "Customer",
        responderEmail: "customer@example.com",
        approvalStatementSnapshot: "I approve this revision for production.",
      },
    });

    await expect(
      db.revision.delete({
        where: {
          id: revision.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects proof activity assigned to the wrong organization", async () => {
    const organizationA = await createOrganization("Organization A", "organization-a");

    const organizationB = await createOrganization("Organization B", "organization-b");

    const customer = await createCustomer(organizationA.id, "Customer", "customer@example.com");

    const proof = await createProof(
      organizationA.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof",
    );

    await expect(
      db.proofActivity.create({
        data: {
          organizationId: organizationB.id,
          proofId: proof.id,
          type: "PROOF_CREATED",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a proof dispatch revision belonging to another proof", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proofA = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof A",
    );

    const proofB = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof B",
    );

    const revisionB = await createRevision(organization.id, proofB.id, 1);

    await expect(
      db.proofDispatch.create({
        data: {
          organizationId: organization.id,
          proofId: proofA.id,
          revisionId: revisionB.id,
          type: "REVISION",
          recipientName: "Customer",
          recipientEmail: "customer@example.com",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate membership for the same organization and user", async () => {
    const organization = await createOrganization("Organization", "organization");

    const user = await db.user.create({
      data: {
        auth0Subject: "auth0|test-user",
        email: "user@example.com",
        name: "Test User",
      },
    });

    await db.membership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
      },
    });

    await expect(
      db.membership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate revision numbers within the same proof", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proof = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof",
    );

    await createRevision(organization.id, proof.id, 1);

    await expect(createRevision(organization.id, proof.id, 1)).rejects.toThrow();
  });

  it("allows a proof to have no current revision", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proof = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof",
    );

    expect(proof.currentRevisionId).toBeNull();
  });

  it("allows a proof to reference one of its own revisions as current", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proof = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof",
    );

    const revision = await createRevision(organization.id, proof.id, 1);

    const updatedProof = await db.proof.update({
      where: {
        id: proof.id,
      },
      data: {
        currentRevisionId: revision.id,
      },
    });

    expect(updatedProof.currentRevisionId).toBe(revision.id);
  });

  it("prevents deletion of a revision while it is the proof's current revision", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proof = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof",
    );

    const revision = await createRevision(organization.id, proof.id, 1);

    await db.proof.update({
      where: {
        id: proof.id,
      },
      data: {
        currentRevisionId: revision.id,
      },
    });

    await expect(
      db.revision.delete({
        where: {
          id: revision.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("allows deleting a proof with a current revision when no evidence references that revision", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proof = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof",
    );

    const revision = await createRevision(organization.id, proof.id, 1);

    await db.proof.update({
      where: {
        id: proof.id,
      },
      data: {
        currentRevisionId: revision.id,
      },
    });

    await db.proof.delete({
      where: {
        id: proof.id,
      },
    });

    const deletedProof = await db.proof.findUnique({
      where: {
        id: proof.id,
      },
    });

    const deletedRevision = await db.revision.findUnique({
      where: {
        id: revision.id,
      },
    });

    expect(deletedProof).toBeNull();
    expect(deletedRevision).toBeNull();
  });

  it("prevents deletion of a proof when approval evidence references one of its revisions", async () => {
    const organization = await createOrganization("Organization", "organization");

    const customer = await createCustomer(organization.id, "Customer", "customer@example.com");

    const proof = await createProof(
      organization.id,
      customer.id,
      customer.name,
      "customer@example.com",
      "Proof",
    );

    const revision = await createRevision(organization.id, proof.id, 1);

    await db.proofResponse.create({
      data: {
        organizationId: organization.id,
        proofId: proof.id,
        revisionId: revision.id,
        type: "APPROVED",
        responderName: "Customer",
        responderEmail: "customer@example.com",
        approvalStatementSnapshot: "I approve this revision for production.",
      },
    });

    await expect(
      db.proof.delete({
        where: {
          id: proof.id,
        },
      }),
    ).rejects.toThrow();
  });
});
