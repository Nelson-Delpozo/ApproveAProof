
import {
  ProofActivityType,
  ProofStatus,
  type Revision,
} from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";
import { canTransitionProofStatus } from "./proof-lifecycle";

type CreateRevisionInput = {
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
};

type LockedProof = {
  id: string;
  organizationId: string;
  status: ProofStatus;
};

export async function createRevisionForProof(
  organizationId: string,
  proofId: string,
  input: CreateRevisionInput,
): Promise<Revision> {
  return db.$transaction(async (tx) => {
    const proofs = await tx.$queryRaw<LockedProof[]>`
      SELECT "id", "organizationId", "status"
      FROM "Proof"
      WHERE "id" = ${proofId}::uuid
        AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;

    const proof = proofs[0];

    if (!proof) {
      throw new Error("Proof not found.");
    }

    if (
      proof.status !== ProofStatus.DRAFT &&
      proof.status !== ProofStatus.CHANGES_REQUESTED
    ) {
      throw new Error(
        `Cannot create a Revision when Proof status is ${proof.status}.`,
      );
    }

    if (
      proof.status === ProofStatus.CHANGES_REQUESTED &&
      !canTransitionProofStatus(proof.status, ProofStatus.DRAFT)
    ) {
      throw new Error("Proof cannot transition to DRAFT.");
    }

    const latestRevision = await tx.revision.findFirst({
      where: {
        proofId: proof.id,
        organizationId: proof.organizationId,
      },
      orderBy: {
        number: "desc",
      },
      select: {
        number: true,
      },
    });

    const nextRevisionNumber = (latestRevision?.number ?? 0) + 1;

    const revision = await tx.revision.create({
      data: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        number: nextRevisionNumber,
        fileKey: input.fileKey,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
      },
    });

    await tx.proof.update({
      where: {
        id: proof.id,
        organizationId: proof.organizationId,
      },
      data: {
        currentRevisionId: revision.id,
        status: ProofStatus.DRAFT,
      },
    });

    await tx.proofActivity.create({
      data: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        type: ProofActivityType.REVISION_CREATED,
      },
    });

    return revision;
  });
}
