// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cleanupTestOrganizations } from "../helpers/cleanup-test-organizations";

import {
  ProofDispatchStatus,
  ProofDispatchType,
  ProofStatus,
} from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";
import { createRevisionForProof } from "../../services/proofs/revision.server";
import { submitProofForApproval } from "../../services/proofs/submit-proof.server";

const ORG_SLUG = "submit-proof-org-a";
const ORG_B_SLUG = "submit-proof-org-b";

function revisionInput(suffix: string) {
  return {
    fileKey: `proofs/${suffix}.pdf`,
    fileName: `${suffix}.pdf`,
    fileType: "application/pdf",
    fileSize: 1024,
    fileHash: `sha256-${suffix}`,
  };
}

describe("submitProofForApproval", () => {
  beforeEach(async () => {
    await cleanupTestOrganizations(db, [ORG_SLUG, ORG_B_SLUG]);
  });

  afterAll(async () => {
    await cleanupTestOrganizations(db, [ORG_SLUG, ORG_B_SLUG]);
    await db.$disconnect();
  });

  it("submits a Draft Proof and creates a pending dispatch for its current Revision", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Submission Test Proof",
      },
    });

    const revision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("submission-test"),
    );

    const result = await submitProofForApproval(organization.id, proof.id);

    expect(result.status).toBe(ProofStatus.AWAITING_APPROVAL);
    expect(result.currentRevisionId).toBe(revision.id);

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(persistedProof.status).toBe(ProofStatus.AWAITING_APPROVAL);
    expect(persistedProof.currentRevisionId).toBe(revision.id);

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(dispatches).toHaveLength(1);

    expect(dispatches[0]).toMatchObject({
      organizationId: organization.id,
      proofId: proof.id,
      revisionId: revision.id,
      type: ProofDispatchType.INITIAL_PROOF,
      status: ProofDispatchStatus.PENDING,
      recipientName: "Customer A",
      recipientEmail: "customer-a@approveaproof.test",
      attemptCount: 0,
      sentAt: null,
    });
  });

  it("does not allow another organization to submit the Proof", async () => {
    const organizationA = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const organizationB = await db.organization.create({
      data: {
        name: "Submit Proof Organization B",
        slug: ORG_B_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organizationA.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Organization A Protected Proof",
      },
    });

    const revision = await createRevisionForProof(
      organizationA.id,
      proof.id,
      revisionInput("tenant-isolation"),
    );

    await expect(submitProofForApproval(organizationB.id, proof.id)).rejects.toThrow(
      "Proof not found.",
    );

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(persistedProof.organizationId).toBe(organizationA.id);
    expect(persistedProof.status).toBe(ProofStatus.DRAFT);
    expect(persistedProof.currentRevisionId).toBe(revision.id);

    const dispatches = await db.proofDispatch.findMany({
      where: {
        proofId: proof.id,
      },
    });

    expect(dispatches).toHaveLength(0);
  });

  it.each([
    ProofStatus.AWAITING_APPROVAL,
    ProofStatus.CHANGES_REQUESTED,
    ProofStatus.APPROVED,
    ProofStatus.CANCELED,
  ])("rejects submission from %s without modifying existing data", async (status) => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Lifecycle Protected Proof",
      },
    });

    const revision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput(`protected-${status}`),
    );

    await db.proof.update({
      where: {
        id: proof.id,
      },
      data: {
        status,
      },
    });

    const before = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    await expect(submitProofForApproval(organization.id, proof.id)).rejects.toThrow(
      `Proof cannot be submitted from status ${status}.`,
    );

    const after = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(after.status).toBe(status);
    expect(after.currentRevisionId).toBe(revision.id);
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(dispatches).toHaveLength(0);
  });

  it("rejects a Draft Proof without a current Revision", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Proof Without Revision",
      },
    });

    expect(proof.status).toBe(ProofStatus.DRAFT);
    expect(proof.currentRevisionId).toBeNull();

    await expect(submitProofForApproval(organization.id, proof.id)).rejects.toThrow(
      "Proof has no current Revision.",
    );

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(persistedProof.status).toBe(ProofStatus.DRAFT);
    expect(persistedProof.currentRevisionId).toBeNull();
    expect(persistedProof.updatedAt).toEqual(proof.updatedAt);

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(dispatches).toHaveLength(0);
  });

  it.each([
    { label: "null", email: null },
    { label: "whitespace-only", email: "   " },
  ])("rejects a Draft Proof with a $label recipient email", async ({ email }) => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: email,
        title: "Proof Without Valid Recipient Email",
      },
    });

    const revision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("missing-recipient-email"),
    );

    const before = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    await expect(submitProofForApproval(organization.id, proof.id)).rejects.toThrow(
      "Proof has no recipient email.",
    );

    const after = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(after.status).toBe(ProofStatus.DRAFT);
    expect(after.currentRevisionId).toBe(revision.id);
    expect(after.recipientEmail).toBe(email);
    expect(after.updatedAt).toEqual(before.updatedAt);

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(dispatches).toHaveLength(0);
  });

  it.each([
    { label: "missing @ symbol", email: "not-an-email" },
    { label: "missing domain", email: "customer@" },
    { label: "missing local part", email: "@example.com" },
  ])("rejects a Draft Proof with an email $label", async ({ email }) => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: email,
        title: "Proof With Malformed Recipient Email",
      },
    });

    const revision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("malformed-recipient-email"),
    );

    const before = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    await expect(submitProofForApproval(organization.id, proof.id)).rejects.toThrow(
      "Proof has an invalid recipient email.",
    );

    const after = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(after.status).toBe(ProofStatus.DRAFT);
    expect(after.currentRevisionId).toBe(revision.id);
    expect(after.recipientEmail).toBe(email);
    expect(after.updatedAt).toEqual(before.updatedAt);

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(dispatches).toHaveLength(0);
  });

  it("trims a valid recipient email in the dispatch without modifying the Proof", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "  customer@example.com  ",
        title: "Proof With Padded Recipient Email",
      },
    });

    const revision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("trimmed-recipient-email"),
    );

    const result = await submitProofForApproval(organization.id, proof.id);

    expect(result.status).toBe(ProofStatus.AWAITING_APPROVAL);
    expect(result.currentRevisionId).toBe(revision.id);

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(persistedProof.recipientEmail).toBe("  customer@example.com  ");
    expect(persistedProof.status).toBe(ProofStatus.AWAITING_APPROVAL);

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]).toMatchObject({
      revisionId: revision.id,
      status: ProofDispatchStatus.PENDING,
      recipientEmail: "customer@example.com",
    });
  });

  it("rejects a second submission without creating a duplicate dispatch", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Duplicate Submission Test Proof",
      },
    });

    const revision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("duplicate-submission"),
    );

    const firstResult = await submitProofForApproval(organization.id, proof.id);

    expect(firstResult.status).toBe(ProofStatus.AWAITING_APPROVAL);
    expect(firstResult.currentRevisionId).toBe(revision.id);

    const originalDispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(originalDispatches).toHaveLength(1);

    const originalDispatch = originalDispatches[0];

    expect(originalDispatch).toMatchObject({
      revisionId: revision.id,
      type: ProofDispatchType.INITIAL_PROOF,
      status: ProofDispatchStatus.PENDING,
      attemptCount: 0,
      sentAt: null,
    });

    await expect(submitProofForApproval(organization.id, proof.id)).rejects.toThrow(
      "Proof cannot be submitted from status AWAITING_APPROVAL.",
    );

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(persistedProof.status).toBe(ProofStatus.AWAITING_APPROVAL);
    expect(persistedProof.currentRevisionId).toBe(revision.id);
    expect(persistedProof.updatedAt).toEqual(firstResult.updatedAt);

    const finalDispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(finalDispatches).toHaveLength(1);
    expect(finalDispatches[0]).toEqual(originalDispatch);
  });

  it("allows only one of two concurrent submissions to succeed", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Concurrent Submission Test Proof",
      },
    });

    const revision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("concurrent-submission"),
    );

    const results = await Promise.allSettled([
      submitProofForApproval(organization.id, proof.id),
      submitProofForApproval(organization.id, proof.id),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const successfulResult = fulfilled[0];

    if (successfulResult.status !== "fulfilled") {
      throw new Error("Expected one successful submission.");
    }

    expect(successfulResult.value.status).toBe(ProofStatus.AWAITING_APPROVAL);
    expect(successfulResult.value.currentRevisionId).toBe(revision.id);

    const failedResult = rejected[0];

    if (failedResult.status !== "rejected") {
      throw new Error("Expected one rejected submission.");
    }

    expect(failedResult.reason).toBeInstanceOf(Error);
    expect(failedResult.reason.message).toBe(
      "Proof cannot be submitted from status AWAITING_APPROVAL.",
    );

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(persistedProof.status).toBe(ProofStatus.AWAITING_APPROVAL);
    expect(persistedProof.currentRevisionId).toBe(revision.id);

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]).toMatchObject({
      organizationId: organization.id,
      proofId: proof.id,
      revisionId: revision.id,
      type: ProofDispatchType.INITIAL_PROOF,
      status: ProofDispatchStatus.PENDING,
      attemptCount: 0,
      sentAt: null,
    });
  });

  it("rolls back a Proof update when a later database operation fails", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Transaction Rollback Test Proof",
      },
    });

    await expect(
      db.$transaction(async (tx) => {
        await tx.proof.update({
          where: {
            id: proof.id,
            organizationId: organization.id,
          },
          data: {
            status: ProofStatus.AWAITING_APPROVAL,
          },
        });

        // Force a real PostgreSQL error after the update.
        await tx.$executeRaw`
        INSERT INTO "ProofDispatch" ("id")
        VALUES (${proof.id}::uuid)
      `;
      }),
    ).rejects.toThrow();

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(persistedProof.status).toBe(ProofStatus.DRAFT);

    const dispatchCount = await db.proofDispatch.count({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(dispatchCount).toBe(0);
  });

  it("classifies the first submission as INITIAL_PROOF even when the current Revision is number 2", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "First Submission of Revision 2",
      },
    });

    const firstRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("first-submission-revision-1"),
    );

    const secondRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("first-submission-revision-2"),
    );

    expect(firstRevision.number).toBe(1);
    expect(secondRevision.number).toBe(2);

    const submittedProof = await submitProofForApproval(organization.id, proof.id);

    expect(submittedProof.status).toBe(ProofStatus.AWAITING_APPROVAL);
    expect(submittedProof.currentRevisionId).toBe(secondRevision.id);

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]).toMatchObject({
      organizationId: organization.id,
      proofId: proof.id,
      revisionId: secondRevision.id,
      type: ProofDispatchType.INITIAL_PROOF,
      status: ProofDispatchStatus.PENDING,
    });
  });

  it("classifies a subsequent submission as REVISION after changes are requested", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Subsequent Submission Test Proof",
      },
    });

    const firstRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("subsequent-submission-revision-1"),
    );

    await submitProofForApproval(organization.id, proof.id);

    const firstDispatch = await db.proofDispatch.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(firstDispatch.type).toBe(ProofDispatchType.INITIAL_PROOF);
    expect(firstDispatch.revisionId).toBe(firstRevision.id);

    // Simulate the domain state after the customer requests changes.
    // The response-handling service is outside this test's scope.
    await db.proof.update({
      where: {
        id: proof.id,
        organizationId: organization.id,
      },
      data: {
        status: ProofStatus.CHANGES_REQUESTED,
      },
    });

    const secondRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("subsequent-submission-revision-2"),
    );

    expect(secondRevision.number).toBe(2);

    const submittedProof = await submitProofForApproval(organization.id, proof.id);

    expect(submittedProof.status).toBe(ProofStatus.AWAITING_APPROVAL);
    expect(submittedProof.currentRevisionId).toBe(secondRevision.id);

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(dispatches).toHaveLength(2);

    expect(dispatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstDispatch.id,
          revisionId: firstRevision.id,
          type: ProofDispatchType.INITIAL_PROOF,
          status: ProofDispatchStatus.PENDING,
        }),
        expect.objectContaining({
          revisionId: secondRevision.id,
          type: ProofDispatchType.REVISION,
          status: ProofDispatchStatus.PENDING,
        }),
      ]),
    );
  });

  it("keeps submission and Revision creation consistent when run concurrently", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Submit Proof Organization A",
        slug: ORG_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Concurrent Submission and Revision Test",
      },
    });

    const firstRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("concurrent-revision-1"),
    );

    const results = await Promise.allSettled([
      submitProofForApproval(organization.id, proof.id),
      createRevisionForProof(organization.id, proof.id, revisionInput("concurrent-revision-2")),
    ]);

    const successful = results.filter((result) => result.status === "fulfilled");

    const failed = results.filter((result) => result.status === "rejected");

    expect(successful.length).toBeGreaterThanOrEqual(1);

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    const revisions = await db.revision.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
      orderBy: { number: "asc" },
    });

    const dispatches = await db.proofDispatch.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
      },
    });

    expect(persistedProof.status).toBe(ProofStatus.AWAITING_APPROVAL);

    expect(dispatches).toHaveLength(1);
    expect(dispatches[0].status).toBe(ProofDispatchStatus.PENDING);

    if (revisions.length === 1) {
      // Submission acquired the lock first.
      expect(failed).toHaveLength(1);
      expect(revisions[0].id).toBe(firstRevision.id);
      expect(persistedProof.currentRevisionId).toBe(firstRevision.id);
      expect(dispatches[0].revisionId).toBe(firstRevision.id);
    } else {
      // Revision creation acquired the lock first.
      expect(revisions).toHaveLength(2);
      expect(successful).toHaveLength(2);
      expect(revisions[1].number).toBe(2);
      expect(persistedProof.currentRevisionId).toBe(revisions[1].id);
      expect(dispatches[0].revisionId).toBe(revisions[1].id);
    }
  });
});
