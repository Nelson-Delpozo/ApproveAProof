
// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  ProofActivityType,
  ProofStatus,
} from "../../../generated/prisma/client";
import { db } from "../../lib/db.server";
import { cancelProofForOrganization } from "../../services/proofs/proof.server";
import { createRevisionForProof } from "../../services/proofs/revision.server";

const ORG_A_SLUG = "cancel-proof-org-a";
const ORG_B_SLUG = "cancel-proof-org-b";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

function revisionInput(suffix: string) {
  return {
    fileKey: `proofs/test-${suffix}.pdf`,
    fileName: `test-${suffix}.pdf`,
    fileType: "application/pdf",
    fileSize: 1024,
    fileHash: `sha256-test-${suffix}`,
  };
}

async function getCancellationActivities(
  organizationId: string,
  proofId: string,
) {
  return db.proofActivity.findMany({
    where: {
      organizationId,
      proofId,
      type: ProofActivityType.PROOF_CANCELED,
    },
  });
}

describe("cancelProofForOrganization", () => {
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

  it.each([
    ProofStatus.DRAFT,
    ProofStatus.AWAITING_APPROVAL,
    ProofStatus.CHANGES_REQUESTED,
  ])("cancels an owned Proof from %s and records one cancellation activity", async (status) => {
    const organization = await db.organization.create({
      data: {
        name: "Cancel Proof Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        title: "Cancelable Proof",
        status,
      },
    });

    const result = await cancelProofForOrganization(organization.id, proof.id);

    expect(result.status).toBe(ProofStatus.CANCELED);

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    expect(persistedProof.status).toBe(ProofStatus.CANCELED);

    const activities = await getCancellationActivities(
      organization.id,
      proof.id,
    );

    expect(activities).toHaveLength(1);
  });

  it("does not allow another organization to cancel the Proof or create an activity", async () => {
    const organizationA = await db.organization.create({
      data: {
        name: "Cancel Proof Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const organizationB = await db.organization.create({
      data: {
        name: "Cancel Proof Organization B",
        slug: ORG_B_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organizationA.id,
        recipientName: "Customer A",
        title: "Organization A Proof",
      },
    });

    await expect(
      cancelProofForOrganization(organizationB.id, proof.id),
    ).rejects.toThrow();

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    expect(persistedProof.status).toBe(ProofStatus.DRAFT);

    expect(
      await getCancellationActivities(organizationA.id, proof.id),
    ).toHaveLength(0);
    expect(
      await getCancellationActivities(organizationB.id, proof.id),
    ).toHaveLength(0);
  });

  it.each([ProofStatus.APPROVED, ProofStatus.CANCELED])(
    "rejects cancellation from %s without recording an activity",
    async (status) => {
      const organization = await db.organization.create({
        data: {
          name: "Cancel Proof Organization A",
          slug: ORG_A_SLUG,
        },
      });

      const proof = await db.proof.create({
        data: {
          organizationId: organization.id,
          recipientName: "Customer A",
          title: "Non-cancelable Proof",
          status,
        },
      });

      await expect(
        cancelProofForOrganization(organization.id, proof.id),
      ).rejects.toThrow();

      const persistedProof = await db.proof.findUniqueOrThrow({
        where: { id: proof.id },
      });

      expect(persistedProof.status).toBe(status);

      expect(
        await getCancellationActivities(organization.id, proof.id),
      ).toHaveLength(0);
    },
  );

  it("rejects cancellation without an activity when a competing transaction commits APPROVED first", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Cancel Proof Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        title: "Concurrent Approval Proof",
        status: ProofStatus.DRAFT,
      },
    });

    const lockAcquired = deferred<void>();
    const releaseLock = deferred<void>();

    const competingTransaction = db.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Proof"
          WHERE "id" = ${proof.id}::uuid
            AND "organizationId" = ${organization.id}::uuid
          FOR UPDATE
        `;

        lockAcquired.resolve();

        await releaseLock.promise;

        await tx.proof.update({
          where: {
            id: proof.id,
            organizationId: organization.id,
          },
          data: {
            status: ProofStatus.APPROVED,
          },
        });
      },
      {
        timeout: 15000,
      },
    );

    await lockAcquired.promise;

    const cancellationResult = cancelProofForOrganization(
      organization.id,
      proof.id,
    ).then(
      (value) => ({ succeeded: true as const, value }),
      (error: unknown) => ({ succeeded: false as const, error }),
    );

    releaseLock.resolve();

    await competingTransaction;

    const result = await cancellationResult;

    expect(result.succeeded).toBe(false);

    if (!result.succeeded) {
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe(
        "Proof cannot be canceled from status APPROVED.",
      );
    }

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    expect(persistedProof.status).toBe(ProofStatus.APPROVED);

    expect(
      await getCancellationActivities(organization.id, proof.id),
    ).toHaveLength(0);
  }, 20000);

  it("rejects Revision creation after cancellation and preserves the audit trail", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Cancel Proof Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        title: "Canceled Revision Proof",
        status: ProofStatus.DRAFT,
      },
    });

    const originalRevision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("before-cancellation"),
    );

    const canceledProof = await cancelProofForOrganization(
      organization.id,
      proof.id,
    );

    expect(canceledProof.status).toBe(ProofStatus.CANCELED);
    expect(canceledProof.currentRevisionId).toBe(originalRevision.id);

    await expect(
      createRevisionForProof(
        organization.id,
        proof.id,
        revisionInput("after-cancellation"),
      ),
    ).rejects.toThrow(
      "Cannot create a Revision when Proof status is CANCELED.",
    );

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    const persistedRevisions = await db.revision.findMany({
      where: {
        proofId: proof.id,
        organizationId: organization.id,
      },
      orderBy: { number: "asc" },
    });

    expect(persistedProof.status).toBe(ProofStatus.CANCELED);
    expect(persistedProof.currentRevisionId).toBe(originalRevision.id);
    expect(persistedRevisions).toHaveLength(1);
    expect(persistedRevisions[0].id).toBe(originalRevision.id);
    expect(persistedRevisions[0].number).toBe(1);

    const cancellationActivities = await getCancellationActivities(
      organization.id,
      proof.id,
    );

    expect(cancellationActivities).toHaveLength(1);

    const revisionActivities = await db.proofActivity.findMany({
      where: {
        organizationId: organization.id,
        proofId: proof.id,
        type: ProofActivityType.REVISION_CREATED,
      },
    });

    expect(revisionActivities).toHaveLength(1);
  }, 20000);
});
