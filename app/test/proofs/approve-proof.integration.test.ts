
 // @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  ProofActivityType,
  ProofDispatchStatus,
  ProofDispatchType,
  ProofResponseType,
  ProofStatus,
} from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";
import { approveProofForOrganization } from "../../services/proofs/approve-proof.server";
import { cancelProofForOrganization } from "../../services/proofs/proof.server";
import { createRevisionForProof } from "../../services/proofs/revision.server";
import { submitProofForApproval } from "../../services/proofs/submit-proof.server";

const ORG_SLUG = "approve-proof-org-a";
const ORG_B_SLUG = "approve-proof-org-b";

function revisionInput(suffix: string) {
  return {
    fileKey: `proofs/${suffix}.pdf`,
    fileName: `${suffix}.pdf`,
    fileType: "application/pdf",
    fileSize: 1024,
    fileHash: `sha256-${suffix}`,
  };
}

async function createOrganization(slug = ORG_SLUG) {
  return db.organization.create({
    data: {
      name: `Approve Proof ${slug}`,
      slug,
    },
  });
}

async function createSubmittedProof(options?: {
  dispatchStatus?: ProofDispatchStatus;
  recipientEmail?: string;
}) {
  const organization = await createOrganization();

  const proof = await db.proof.create({
    data: {
      organizationId: organization.id,
      recipientName: "Customer A",
      recipientEmail:
        options?.recipientEmail ?? "customer-a@approveaproof.test",
      title: "Approval Integration Test",
    },
  });

  const revision = await createRevisionForProof(
    organization.id,
    proof.id,
    revisionInput("approval-test"),
  );

  await submitProofForApproval(organization.id, proof.id);

  const dispatch = await db.proofDispatch.findFirstOrThrow({
    where: {
      organizationId: organization.id,
      proofId: proof.id,
      revisionId: revision.id,
      type: ProofDispatchType.INITIAL_PROOF,
    },
  });

  if (options?.dispatchStatus) {
    await db.proofDispatch.update({
      where: {
        id: dispatch.id,
      },
      data: {
        status: options.dispatchStatus,
        sentAt:
          options.dispatchStatus === ProofDispatchStatus.SENT
            ? new Date()
            : null,
      },
    });
  }

  return {
    organization,
    proof,
    revision,
    dispatch,
  };
}

function approvalInput(revisionId: string) {
  return {
    revisionId,
    responderName: "  Customer A  ",
    responderEmail: "customer-a@approveaproof.test",
  };
}

async function approvalRecords(proofId: string) {
  const [proof, responses, activities, confirmations] =
    await Promise.all([
      db.proof.findUniqueOrThrow({
        where: {
          id: proofId,
        },
      }),
      db.proofResponse.findMany({
        where: {
          proofId,
        },
      }),
      db.proofActivity.findMany({
        where: {
          proofId,
          type: ProofActivityType.PROOF_APPROVED,
        },
      }),
      db.proofDispatch.findMany({
        where: {
          proofId,
          type: ProofDispatchType.APPROVAL_CONFIRMATION,
        },
      }),
    ]);

  return {
    proof,
    responses,
    activities,
    confirmations,
  };
}

describe("approveProofForOrganization", () => {
  async function cleanTestOrganizations() {
    const organizations = await db.organization.findMany({
      where: {
        slug: {
          in: [ORG_SLUG, ORG_B_SLUG],
        },
      },
      select: {
        id: true,
      },
    });

    const organizationIds = organizations.map(
      (organization) => organization.id,
    );

    if (organizationIds.length === 0) {
      return;
    }

    await db.proofResponse.deleteMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
    });

    await db.organization.deleteMany({
      where: {
        id: {
          in: organizationIds,
        },
      },
    });
  }

  beforeEach(async () => {
    await cleanTestOrganizations();
  });

  afterAll(async () => {
    await cleanTestOrganizations();
    await db.$disconnect();
  });

  it("atomically approves the current Revision and creates authoritative evidence", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const response = await approveProofForOrganization(
      organization.id,
      proof.id,
      approvalInput(revision.id),
    );

    expect(response).toMatchObject({
      organizationId: organization.id,
      proofId: proof.id,
      revisionId: revision.id,
      type: ProofResponseType.APPROVED,
      responderName: "Customer A",
      responderEmail: "customer-a@approveaproof.test",
    });

    expect(response.approvalStatementSnapshot).toBeTruthy();
    expect(response.approvalStatementSnapshot?.trim()).not.toBe("");
    expect(response.occurredAt).toBeInstanceOf(Date);

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(ProofStatus.APPROVED);
    expect(records.proof.currentRevisionId).toBe(revision.id);

    expect(records.responses).toHaveLength(1);
    expect(records.responses[0].id).toBe(response.id);

    expect(records.activities).toHaveLength(1);
    expect(records.activities[0]).toMatchObject({
      organizationId: organization.id,
      proofId: proof.id,
      type: ProofActivityType.PROOF_APPROVED,
    });

    expect(records.confirmations).toHaveLength(1);
    expect(records.confirmations[0]).toMatchObject({
      organizationId: organization.id,
      proofId: proof.id,
      revisionId: revision.id,
      type: ProofDispatchType.APPROVAL_CONFIRMATION,
      status: ProofDispatchStatus.PENDING,
      recipientName: "Customer A",
      recipientEmail: "customer-a@approveaproof.test",
      attemptCount: 0,
      sentAt: null,
    });
  });

  it("uses the sent dispatch recipient snapshot rather than mutable Proof recipient fields", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    await db.proof.update({
      where: {
        id: proof.id,
      },
      data: {
        recipientName: "Changed Recipient",
        recipientEmail: "changed@approveaproof.test",
      },
    });

    await approveProofForOrganization(
      organization.id,
      proof.id,
      approvalInput(revision.id),
    );

    const records = await approvalRecords(proof.id);

    expect(records.confirmations).toHaveLength(1);
    expect(records.confirmations[0].recipientName).toBe("Customer A");
    expect(records.confirmations[0].recipientEmail).toBe(
      "customer-a@approveaproof.test",
    );
  });

  it("rejects approval from another Organization without changing the Proof", async () => {
    const { proof, revision } = await createSubmittedProof({
      dispatchStatus: ProofDispatchStatus.SENT,
    });

    const otherOrganization = await createOrganization(ORG_B_SLUG);

    await expect(
      approveProofForOrganization(
        otherOrganization.id,
        proof.id,
        approvalInput(revision.id),
      ),
    ).rejects.toThrow("Proof not found.");

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.responses).toHaveLength(0);
    expect(records.activities).toHaveLength(0);
    expect(records.confirmations).toHaveLength(0);
  });

  it.each([
    ProofStatus.DRAFT,
    ProofStatus.CHANGES_REQUESTED,
    ProofStatus.APPROVED,
    ProofStatus.CANCELED,
  ])(
    "rejects approval from %s without creating approval records",
    async (status) => {
      const { organization, proof, revision } =
        await createSubmittedProof({
          dispatchStatus: ProofDispatchStatus.SENT,
        });

      await db.proof.update({
        where: {
          id: proof.id,
        },
        data: {
          status,
        },
      });

      await expect(
        approveProofForOrganization(
          organization.id,
          proof.id,
          approvalInput(revision.id),
        ),
      ).rejects.toThrow(
        `Proof cannot be approved from status ${status}.`,
      );

      const records = await approvalRecords(proof.id);

      expect(records.proof.status).toBe(status);
      expect(records.responses).toHaveLength(0);
      expect(records.activities).toHaveLength(0);
      expect(records.confirmations).toHaveLength(0);
    },
  );

  it("rejects a stale Revision rather than silently approving the current Revision", async () => {
    const organization = await createOrganization();

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Stale Revision Test",
      },
    });

    const oldRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("old-revision"),
    );

    const currentRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("current-revision"),
    );

    await submitProofForApproval(organization.id, proof.id);

    await db.proofDispatch.updateMany({
      where: {
        proofId: proof.id,
        revisionId: currentRevision.id,
      },
      data: {
        status: ProofDispatchStatus.SENT,
        sentAt: new Date(),
      },
    });

    await expect(
      approveProofForOrganization(
        organization.id,
        proof.id,
        approvalInput(oldRevision.id),
      ),
    ).rejects.toThrow(
      "Approval Revision does not match the current Revision.",
    );

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.proof.currentRevisionId).toBe(
      currentRevision.id,
    );
    expect(records.responses).toHaveLength(0);
    expect(records.activities).toHaveLength(0);
    expect(records.confirmations).toHaveLength(0);
  });

  it("rejects a Revision belonging to another Proof", async () => {
    const { organization, proof } = await createSubmittedProof({
      dispatchStatus: ProofDispatchStatus.SENT,
    });

    const otherProof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Other Customer",
        recipientEmail: "other@approveaproof.test",
        title: "Other Proof",
      },
    });

    const otherRevision = await createRevisionForProof(
      organization.id,
      otherProof.id,
      revisionInput("other-proof"),
    );

    await expect(
      approveProofForOrganization(
        organization.id,
        proof.id,
        approvalInput(otherRevision.id),
      ),
    ).rejects.toThrow(
      "Approval Revision does not match the current Revision.",
    );

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.responses).toHaveLength(0);
  });

  it.each([
    {
      label: "pending",
      status: ProofDispatchStatus.PENDING,
    },
    {
      label: "failed",
      status: ProofDispatchStatus.FAILED,
    },
  ])(
    "rejects approval when the submission dispatch is $label",
    async ({ status }) => {
      const { organization, proof, revision } =
        await createSubmittedProof({
          dispatchStatus: status,
        });

      await expect(
        approveProofForOrganization(
          organization.id,
          proof.id,
          approvalInput(revision.id),
        ),
      ).rejects.toThrow(
        "Approval Revision has no completed submission dispatch.",
      );

      const records = await approvalRecords(proof.id);

      expect(records.proof.status).toBe(
        ProofStatus.AWAITING_APPROVAL,
      );
      expect(records.responses).toHaveLength(0);
      expect(records.activities).toHaveLength(0);
      expect(records.confirmations).toHaveLength(0);
    },
  );

  it("rejects a SENT dispatch without a sentAt timestamp", async () => {
    const { organization, proof, revision, dispatch } =
      await createSubmittedProof();

    await db.proofDispatch.update({
      where: {
        id: dispatch.id,
      },
      data: {
        status: ProofDispatchStatus.SENT,
        sentAt: null,
      },
    });

    await expect(
      approveProofForOrganization(
        organization.id,
        proof.id,
        approvalInput(revision.id),
      ),
    ).rejects.toThrow(
      "Approval Revision has no completed submission dispatch.",
    );

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.responses).toHaveLength(0);
    expect(records.activities).toHaveLength(0);
    expect(records.confirmations).toHaveLength(0);
  });

  it("rejects a SENT dispatch of the wrong type", async () => {
    const { organization, proof, revision, dispatch } =
      await createSubmittedProof();

    await db.proofDispatch.update({
      where: {
        id: dispatch.id,
      },
      data: {
        type: ProofDispatchType.REMINDER,
        status: ProofDispatchStatus.SENT,
        sentAt: new Date(),
      },
    });

    await expect(
      approveProofForOrganization(
        organization.id,
        proof.id,
        approvalInput(revision.id),
      ),
    ).rejects.toThrow(
      "Approval Revision has no completed submission dispatch.",
    );

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.responses).toHaveLength(0);
    expect(records.activities).toHaveLength(0);
    expect(records.confirmations).toHaveLength(0);
  });

  it("rejects an invalid confirmation recipient before creating approval evidence", async () => {
    const { organization, proof, revision, dispatch } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    await db.proofDispatch.update({
      where: {
        id: dispatch.id,
      },
      data: {
        recipientEmail: "invalid-email",
      },
    });

    await expect(
      approveProofForOrganization(
        organization.id,
        proof.id,
        approvalInput(revision.id),
      ),
    ).rejects.toThrow(
      "Approval confirmation recipient email is invalid.",
    );

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.responses).toHaveLength(0);
    expect(records.activities).toHaveLength(0);
    expect(records.confirmations).toHaveLength(0);
  });

  it.each([
    {
      label: "blank responder name",
      input: {
        responderName: "   ",
      },
    },
    {
      label: "malformed responder email",
      input: {
        responderEmail: "not-an-email",
      },
    },
  ])("rejects a $label", async ({ input }) => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    await expect(
      approveProofForOrganization(
        organization.id,
        proof.id,
        {
          ...approvalInput(revision.id),
          ...input,
        },
      ),
    ).rejects.toThrow();

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.responses).toHaveLength(0);
    expect(records.activities).toHaveLength(0);
    expect(records.confirmations).toHaveLength(0);
  });

  it("rejects a duplicate approval without creating duplicate records", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const firstResponse = await approveProofForOrganization(
      organization.id,
      proof.id,
      approvalInput(revision.id),
    );

    await expect(
      approveProofForOrganization(
        organization.id,
        proof.id,
        approvalInput(revision.id),
      ),
    ).rejects.toThrow(
      "Proof cannot be approved from status APPROVED.",
    );

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(ProofStatus.APPROVED);
    expect(records.responses).toHaveLength(1);
    expect(records.responses[0].id).toBe(firstResponse.id);
    expect(records.activities).toHaveLength(1);
    expect(records.confirmations).toHaveLength(1);
  });

  it("allows only one of two concurrent approvals to succeed", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const results = await Promise.allSettled([
      approveProofForOrganization(
        organization.id,
        proof.id,
        approvalInput(revision.id),
      ),
      approveProofForOrganization(
        organization.id,
        proof.id,
        approvalInput(revision.id),
      ),
    ]);

    const successes = results.filter(
      (result) => result.status === "fulfilled",
    );

    const failures = results.filter(
      (result) => result.status === "rejected",
    );

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const records = await approvalRecords(proof.id);

    expect(records.proof.status).toBe(ProofStatus.APPROVED);
    expect(records.responses).toHaveLength(1);
    expect(records.activities).toHaveLength(1);
    expect(records.confirmations).toHaveLength(1);
  });

  it("serializes approval and cancellation so only one terminal state wins", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const results = await Promise.allSettled([
      approveProofForOrganization(
        organization.id,
        proof.id,
        approvalInput(revision.id),
      ),
      cancelProofForOrganization(
        organization.id,
        proof.id,
      ),
    ]);

    const successes = results.filter(
      (result) => result.status === "fulfilled",
    );

    const failures = results.filter(
      (result) => result.status === "rejected",
    );

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const records = await approvalRecords(proof.id);

    expect([
      ProofStatus.APPROVED,
      ProofStatus.CANCELED,
    ]).toContain(records.proof.status);

    if (records.proof.status === ProofStatus.APPROVED) {
      expect(records.responses).toHaveLength(1);
      expect(records.activities).toHaveLength(1);
      expect(records.confirmations).toHaveLength(1);
    } else {
      expect(records.responses).toHaveLength(0);
      expect(records.activities).toHaveLength(0);
      expect(records.confirmations).toHaveLength(0);
    }
  });

  it("preserves existing Revision metadata after approval", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    await approveProofForOrganization(
      organization.id,
      proof.id,
      approvalInput(revision.id),
    );

    const persistedRevision = await db.revision.findUniqueOrThrow({
      where: {
        id: revision.id,
      },
    });

    expect(persistedRevision).toEqual(revision);
  });

  it("rolls back all approval writes when confirmation dispatch insertion fails", async () => {
    const { organization, proof, revision, dispatch } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const rollbackRecipient = "rollback-fixture@approveaproof.test";

    await db.proofDispatch.update({
      where: { id: dispatch.id },
      data: { recipientEmail: rollbackRecipient },
    });

    // This trigger only rejects confirmation dispatches addressed to our
    // unique rollback fixture. It is test-only and removed in finally.
    // The application service itself has no testing bypass.
    await db.$executeRaw`
      CREATE FUNCTION approve_proof_rollback_fixture()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."type" = 'APPROVAL_CONFIRMATION'
           AND NEW."recipientEmail" = 'rollback-fixture@approveaproof.test'
        THEN
          RAISE EXCEPTION 'Injected approval confirmation failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    try {
      await db.$executeRaw`
        CREATE TRIGGER approve_proof_rollback_fixture_trigger
        BEFORE INSERT ON "ProofDispatch"
        FOR EACH ROW
        EXECUTE FUNCTION approve_proof_rollback_fixture()
      `;

      await expect(
        approveProofForOrganization(
          organization.id,
          proof.id,
          approvalInput(revision.id),
        ),
      ).rejects.toThrow();

      const records = await approvalRecords(proof.id);

      expect(records.proof.status).toBe(ProofStatus.AWAITING_APPROVAL);
      expect(records.proof.currentRevisionId).toBe(revision.id);
      expect(records.responses).toHaveLength(0);
      expect(records.activities).toHaveLength(0);
      expect(records.confirmations).toHaveLength(0);

      const originalDispatch = await db.proofDispatch.findUniqueOrThrow({
        where: { id: dispatch.id },
      });

      expect(originalDispatch.status).toBe(ProofDispatchStatus.SENT);
      expect(originalDispatch.sentAt).not.toBeNull();
    } finally {
      await db.$executeRaw`
        DROP TRIGGER IF EXISTS approve_proof_rollback_fixture_trigger
        ON "ProofDispatch"
      `;
      await db.$executeRaw`
        DROP FUNCTION IF EXISTS approve_proof_rollback_fixture()
      `;
    }
  });
});
