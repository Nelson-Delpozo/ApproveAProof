
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
import { requestProofChangesForOrganization } from "../../services/proofs/request-proof-changes.server";
import { createRevisionForProof } from "../../services/proofs/revision.server";
import { submitProofForApproval } from "../../services/proofs/submit-proof.server";

const ORG_SLUG = "request-changes-org-a";
const ORG_B_SLUG = "request-changes-org-b";

function revisionInput(suffix: string) {
  return {
    fileKey: `proofs/${suffix}.pdf`,
    fileName: `${suffix}.pdf`,
    fileType: "application/pdf",
    fileSize: 1024,
    fileHash: `sha256-${suffix}`,
  };
}

function changeRequestInput(revisionId: string) {
  return {
    revisionId,
    responderName: "  Customer A  ",
    responderEmail: "customer-a@approveaproof.test",
    comments: "  Please increase the headline size.  ",
  };
}

async function createOrganization(slug = ORG_SLUG) {
  return db.organization.create({
    data: {
      name: `Request Changes ${slug}`,
      slug,
    },
  });
}

async function createSubmittedProof(options?: {
  dispatchStatus?: ProofDispatchStatus;
}) {
  const organization = await createOrganization();

  const proof = await db.proof.create({
    data: {
      organizationId: organization.id,
      recipientName: "Customer A",
      recipientEmail: "customer-a@approveaproof.test",
      title: "Change Request Integration Test",
    },
  });

  const revision = await createRevisionForProof(
    organization.id,
    proof.id,
    revisionInput("changes-test"),
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
      where: { id: dispatch.id },
      data: {
        status: options.dispatchStatus,
        sentAt:
          options.dispatchStatus === ProofDispatchStatus.SENT
            ? new Date()
            : null,
      },
    });
  }

  return { organization, proof, revision, dispatch };
}

async function changeRequestRecords(proofId: string) {
  const [proof, responses, activities, notifications] =
    await Promise.all([
      db.proof.findUniqueOrThrow({
        where: { id: proofId },
      }),
      db.proofResponse.findMany({
        where: { proofId },
        orderBy: { occurredAt: "asc" },
      }),
      db.proofActivity.findMany({
        where: {
          proofId,
          type: ProofActivityType.CHANGES_REQUESTED,
        },
      }),
      db.proofDispatch.findMany({
        where: {
          proofId,
          type: ProofDispatchType.CHANGE_REQUEST_NOTIFICATION,
        },
      }),
    ]);

  return { proof, responses, activities, notifications };
}

describe("requestProofChangesForOrganization", () => {
  async function cleanTestOrganizations() {
    const organizations = await db.organization.findMany({
      where: {
        slug: { in: [ORG_SLUG, ORG_B_SLUG] },
      },
      select: { id: true },
    });

    const organizationIds = organizations.map(
      (organization) => organization.id,
    );

    if (organizationIds.length === 0) {
      return;
    }

    await db.proofResponse.deleteMany({
      where: {
        organizationId: { in: organizationIds },
      },
    });

    await db.organization.deleteMany({
      where: {
        id: { in: organizationIds },
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

  it("atomically records a change request for the current Revision", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const response = await requestProofChangesForOrganization(
      organization.id,
      proof.id,
      changeRequestInput(revision.id),
    );

    expect(response).toMatchObject({
      organizationId: organization.id,
      proofId: proof.id,
      revisionId: revision.id,
      type: ProofResponseType.CHANGES_REQUESTED,
      responderName: "Customer A",
      responderEmail: "customer-a@approveaproof.test",
      comments: "Please increase the headline size.",
      approvalStatementSnapshot: null,
    });

    expect(response.occurredAt).toBeInstanceOf(Date);

    const records = await changeRequestRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.CHANGES_REQUESTED,
    );
    expect(records.proof.currentRevisionId).toBe(revision.id);
    expect(records.responses).toHaveLength(1);
    expect(records.responses[0].id).toBe(response.id);

    expect(records.activities).toHaveLength(1);
    expect(records.activities[0]).toMatchObject({
      organizationId: organization.id,
      proofId: proof.id,
      type: ProofActivityType.CHANGES_REQUESTED,
    });

    // Shop-side notification routing is intentionally deferred.
    expect(records.notifications).toHaveLength(0);
  });

  it("allows an omitted optional responder email", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const { responderEmail: _unused, ...input } =
      changeRequestInput(revision.id);

    const response = await requestProofChangesForOrganization(
      organization.id,
      proof.id,
      input,
    );

    expect(response.responderEmail).toBeNull();
    expect(response.responderName).toBe("Customer A");
    expect(response.comments).toBe(
      "Please increase the headline size.",
    );
  });

  it.each(["", " ", "\n\t  "])(
    "rejects blank comments (%j) without changing records",
    async (comments) => {
      const { organization, proof, revision } =
        await createSubmittedProof({
          dispatchStatus: ProofDispatchStatus.SENT,
        });

      await expect(
        requestProofChangesForOrganization(
          organization.id,
          proof.id,
          {
            ...changeRequestInput(revision.id),
            comments,
          },
        ),
      ).rejects.toThrow();

      const records = await changeRequestRecords(proof.id);

      expect(records.proof.status).toBe(
        ProofStatus.AWAITING_APPROVAL,
      );
      expect(records.responses).toHaveLength(0);
      expect(records.activities).toHaveLength(0);
      expect(records.notifications).toHaveLength(0);
    },
  );

  it.each([
    {
      label: "blank responder name",
      changes: { responderName: "   " },
    },
    {
      label: "invalid responder email",
      changes: { responderEmail: "not-an-email" },
    },
    {
      label: "invalid Revision ID",
      changes: { revisionId: "not-a-uuid" },
    },
  ])("rejects a $label", async ({ changes }) => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    await expect(
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        {
          ...changeRequestInput(revision.id),
          ...changes,
        },
      ),
    ).rejects.toThrow();

    const records = await changeRequestRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.responses).toHaveLength(0);
    expect(records.activities).toHaveLength(0);
  });

  it("rejects another Organization without leaking or modifying the Proof", async () => {
    const { proof, revision } = await createSubmittedProof({
      dispatchStatus: ProofDispatchStatus.SENT,
    });

    const otherOrganization = await createOrganization(ORG_B_SLUG);

    await expect(
      requestProofChangesForOrganization(
        otherOrganization.id,
        proof.id,
        changeRequestInput(revision.id),
      ),
    ).rejects.toThrow("Proof not found.");

    const records = await changeRequestRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.responses).toHaveLength(0);
    expect(records.activities).toHaveLength(0);
  });

  it.each([
    ProofStatus.DRAFT,
    ProofStatus.CHANGES_REQUESTED,
    ProofStatus.APPROVED,
    ProofStatus.CANCELED,
  ])(
    "rejects change requests from %s",
    async (status) => {
      const { organization, proof, revision } =
        await createSubmittedProof({
          dispatchStatus: ProofDispatchStatus.SENT,
        });

      await db.proof.update({
        where: { id: proof.id },
        data: { status },
      });

      await expect(
        requestProofChangesForOrganization(
          organization.id,
          proof.id,
          changeRequestInput(revision.id),
        ),
      ).rejects.toThrow(
        `Proof cannot request changes from status ${status}.`,
      );

      const records = await changeRequestRecords(proof.id);

      expect(records.proof.status).toBe(status);
      expect(records.responses).toHaveLength(0);
      expect(records.activities).toHaveLength(0);
    },
  );

  it("rejects a stale Revision", async () => {
    const organization = await createOrganization();

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        recipientEmail: "customer-a@approveaproof.test",
        title: "Stale Change Request",
      },
    });

    const oldRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("changes-old"),
    );

    const currentRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("changes-current"),
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
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        changeRequestInput(oldRevision.id),
      ),
    ).rejects.toThrow(
      "Change request Revision does not match the current Revision.",
    );

    const records = await changeRequestRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.proof.currentRevisionId).toBe(
      currentRevision.id,
    );
    expect(records.responses).toHaveLength(0);
  });

  it("rejects a Revision belonging to another Proof", async () => {
    const { organization, proof } = await createSubmittedProof({
      dispatchStatus: ProofDispatchStatus.SENT,
    });

    const otherProof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Other Customer",
        title: "Other Proof",
      },
    });

    const otherRevision = await createRevisionForProof(
      organization.id,
      otherProof.id,
      revisionInput("changes-other"),
    );

    await expect(
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        changeRequestInput(otherRevision.id),
      ),
    ).rejects.toThrow(
      "Change request Revision does not match the current Revision.",
    );

    const records = await changeRequestRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.AWAITING_APPROVAL,
    );
    expect(records.responses).toHaveLength(0);
  });

  it.each([
    ProofDispatchStatus.PENDING,
    ProofDispatchStatus.FAILED,
  ])(
    "rejects a %s submission dispatch",
    async (status) => {
      const { organization, proof, revision } =
        await createSubmittedProof({
          dispatchStatus: status,
        });

      await expect(
        requestProofChangesForOrganization(
          organization.id,
          proof.id,
          changeRequestInput(revision.id),
        ),
      ).rejects.toThrow(
        "Change request Revision has no completed submission dispatch.",
      );

      const records = await changeRequestRecords(proof.id);

      expect(records.proof.status).toBe(
        ProofStatus.AWAITING_APPROVAL,
      );
      expect(records.responses).toHaveLength(0);
      expect(records.activities).toHaveLength(0);
    },
  );

  it("rejects SENT dispatch without sentAt", async () => {
    const { organization, proof, revision, dispatch } =
      await createSubmittedProof();

    await db.proofDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: ProofDispatchStatus.SENT,
        sentAt: null,
      },
    });

    await expect(
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        changeRequestInput(revision.id),
      ),
    ).rejects.toThrow(
      "Change request Revision has no completed submission dispatch.",
    );
  });

  it("rejects SENT dispatch of an ineligible type", async () => {
    const { organization, proof, revision, dispatch } =
      await createSubmittedProof();

    await db.proofDispatch.update({
      where: { id: dispatch.id },
      data: {
        type: ProofDispatchType.REMINDER,
        status: ProofDispatchStatus.SENT,
        sentAt: new Date(),
      },
    });

    await expect(
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        changeRequestInput(revision.id),
      ),
    ).rejects.toThrow(
      "Change request Revision has no completed submission dispatch.",
    );
  });

  it("rejects duplicate change requests without duplicate evidence", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const first = await requestProofChangesForOrganization(
      organization.id,
      proof.id,
      changeRequestInput(revision.id),
    );

    await expect(
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        changeRequestInput(revision.id),
      ),
    ).rejects.toThrow(
      "Proof cannot request changes from status CHANGES_REQUESTED.",
    );

    const records = await changeRequestRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.CHANGES_REQUESTED,
    );
    expect(records.responses).toHaveLength(1);
    expect(records.responses[0].id).toBe(first.id);
    expect(records.activities).toHaveLength(1);
    expect(records.notifications).toHaveLength(0);
  });

  it("allows only one of two concurrent change requests to succeed", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const results = await Promise.allSettled([
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        changeRequestInput(revision.id),
      ),
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        changeRequestInput(revision.id),
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const records = await changeRequestRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.CHANGES_REQUESTED,
    );
    expect(records.responses).toHaveLength(1);
    expect(records.activities).toHaveLength(1);
  });

  it("serializes approval against a competing change request", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const results = await Promise.allSettled([
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        changeRequestInput(revision.id),
      ),
      approveProofForOrganization(
        organization.id,
        proof.id,
        {
          revisionId: revision.id,
          responderName: "Customer A",
          responderEmail: "customer-a@approveaproof.test",
        },
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const records = await changeRequestRecords(proof.id);

    expect([
      ProofStatus.CHANGES_REQUESTED,
      ProofStatus.APPROVED,
    ]).toContain(records.proof.status);

    expect(records.responses).toHaveLength(1);

    if (records.proof.status === ProofStatus.CHANGES_REQUESTED) {
      expect(records.responses[0].type).toBe(
        ProofResponseType.CHANGES_REQUESTED,
      );
      expect(records.activities).toHaveLength(1);
    } else {
      expect(records.responses[0].type).toBe(
        ProofResponseType.APPROVED,
      );
      expect(records.activities).toHaveLength(0);
    }
  });

  it("serializes cancellation against a competing change request", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const results = await Promise.allSettled([
      requestProofChangesForOrganization(
        organization.id,
        proof.id,
        changeRequestInput(revision.id),
      ),
      cancelProofForOrganization(organization.id, proof.id),
    ]);

    const changeRequestResult = results[0];
    const cancellationResult = results[1];

    // Cancellation is valid from both AWAITING_APPROVAL and
    // CHANGES_REQUESTED. Both operations may therefore succeed.
    expect(cancellationResult.status).toBe("fulfilled");

    const records = await changeRequestRecords(proof.id);

    expect(records.proof.status).toBe(ProofStatus.CANCELED);
    expect(records.proof.currentRevisionId).toBe(revision.id);

    if (changeRequestResult.status === "fulfilled") {
      // The change request completed before cancellation.
      // Its historical evidence must remain intact.
      expect(records.responses).toHaveLength(1);
      expect(records.responses[0]).toMatchObject({
        revisionId: revision.id,
        type: ProofResponseType.CHANGES_REQUESTED,
        comments: "Please increase the headline size.",
      });
      expect(records.activities).toHaveLength(1);
    } else {
      // Cancellation completed first, so the subsequent
      // change request was rejected without evidence.
      expect(records.responses).toHaveLength(0);
      expect(records.activities).toHaveLength(0);
    }

    expect(records.notifications).toHaveLength(0);
  });

  it("preserves historical responses through a revision cycle", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    const originalRevision = await db.revision.findUniqueOrThrow({
      where: { id: revision.id },
    });

    const firstResponse = await requestProofChangesForOrganization(
      organization.id,
      proof.id,
      changeRequestInput(revision.id),
    );

    const nextRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("changes-followup"),
    );

    expect(nextRevision.number).toBe(revision.number + 1);

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    expect(persistedProof.status).toBe(ProofStatus.DRAFT);
    expect(persistedProof.currentRevisionId).toBe(nextRevision.id);

    await submitProofForApproval(organization.id, proof.id);

    await db.proofDispatch.updateMany({
      where: {
        proofId: proof.id,
        revisionId: nextRevision.id,
        type: ProofDispatchType.REVISION,
      },
      data: {
        status: ProofDispatchStatus.SENT,
        sentAt: new Date(),
      },
    });

    const secondResponse = await requestProofChangesForOrganization(
      organization.id,
      proof.id,
      {
        ...changeRequestInput(nextRevision.id),
        comments: "Please adjust the footer.",
      },
    );

    const records = await changeRequestRecords(proof.id);

    expect(records.proof.status).toBe(
      ProofStatus.CHANGES_REQUESTED,
    );
    expect(records.responses).toHaveLength(2);
    expect(
      records.responses.map((response) => response.id),
    ).toEqual(
      expect.arrayContaining([
        firstResponse.id,
        secondResponse.id,
      ]),
    );

    expect(
      records.responses.find(
        (response) => response.id === firstResponse.id,
      ),
    ).toMatchObject({
      revisionId: revision.id,
      comments: "Please increase the headline size.",
    });

    expect(
      records.responses.find(
        (response) => response.id === secondResponse.id,
      ),
    ).toMatchObject({
      revisionId: nextRevision.id,
      comments: "Please adjust the footer.",
    });

    expect(records.activities).toHaveLength(2);

    const persistedOriginalRevision =
      await db.revision.findUniqueOrThrow({
        where: { id: revision.id },
      });

    expect(persistedOriginalRevision).toEqual(originalRevision);
  });

  it("rolls back response and status when activity insertion fails", async () => {
    const { organization, proof, revision } =
      await createSubmittedProof({
        dispatchStatus: ProofDispatchStatus.SENT,
      });

    // This test-only trigger rejects CHANGES_REQUESTED activity
    // inserts. It is removed in finally.
    //
    // No bind parameters are used inside CREATE FUNCTION.
    await db.$executeRaw`
      CREATE FUNCTION request_changes_rollback_fixture()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."type" = 'CHANGES_REQUESTED'
        THEN
          RAISE EXCEPTION 'Injected change request activity failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    try {
      await db.$executeRaw`
        CREATE TRIGGER request_changes_rollback_fixture_trigger
        BEFORE INSERT ON "ProofActivity"
        FOR EACH ROW
        EXECUTE FUNCTION request_changes_rollback_fixture()
      `;

      await expect(
        requestProofChangesForOrganization(
          organization.id,
          proof.id,
          changeRequestInput(revision.id),
        ),
      ).rejects.toThrow();

      const records = await changeRequestRecords(proof.id);

      expect(records.proof.status).toBe(
        ProofStatus.AWAITING_APPROVAL,
      );
      expect(records.proof.currentRevisionId).toBe(revision.id);
      expect(records.responses).toHaveLength(0);
      expect(records.activities).toHaveLength(0);
      expect(records.notifications).toHaveLength(0);
    } finally {
      await db.$executeRaw`
        DROP TRIGGER IF EXISTS request_changes_rollback_fixture_trigger
        ON "ProofActivity"
      `;
      await db.$executeRaw`
        DROP FUNCTION IF EXISTS request_changes_rollback_fixture()
      `;
    }
  });
});
