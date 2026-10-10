import { z } from "zod";

import {
  ProofDispatchStatus,
  ProofDispatchType,
  ProofStatus,
  type Proof,
} from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";
import { canTransitionProofStatus } from "./proof-lifecycle";

const recipientEmailSchema = z.email();

type LockedProof = {
  id: string;
  organizationId: string;
  status: ProofStatus;
  currentRevisionId: string | null;
  recipientName: string;
  recipientEmail: string | null;
};

export async function submitProofForApproval(
  organizationId: string,
  proofId: string,
): Promise<Proof> {
  return db.$transaction(async (tx) => {
    const proofs = await tx.$queryRaw<LockedProof[]>`
      SELECT
        "id",
        "organizationId",
        "status",
        "currentRevisionId",
        "recipientName",
        "recipientEmail"
      FROM "Proof"
      WHERE "id" = ${proofId}::uuid
        AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;

    const proof = proofs[0];

    if (!proof) {
      throw new Error("Proof not found.");
    }

    if (!canTransitionProofStatus(proof.status, ProofStatus.AWAITING_APPROVAL)) {
      throw new Error(`Proof cannot be submitted from status ${proof.status}.`);
    }

    if (!proof.currentRevisionId) {
      throw new Error("Proof has no current Revision.");
    }

    const recipientEmail = proof.recipientEmail?.trim();

    if (!recipientEmail) {
      throw new Error("Proof has no recipient email.");
    }

    if (!recipientEmailSchema.safeParse(recipientEmail).success) {
      throw new Error("Proof has an invalid recipient email.");
    }

    const revision = await tx.revision.findFirst({
      where: {
        id: proof.currentRevisionId,
        proofId: proof.id,
        organizationId: proof.organizationId,
      },
    });

    if (!revision) {
      throw new Error("Current Revision not found.");
    }

    const previousSubmission = await tx.proofDispatch.findFirst({
      where: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        type: {
          in: [ProofDispatchType.INITIAL_PROOF, ProofDispatchType.REVISION],
        },
      },
      select: {
        id: true,
      },
    });

    const dispatchType = previousSubmission
      ? ProofDispatchType.REVISION
      : ProofDispatchType.INITIAL_PROOF;

    const updatedProof = await tx.proof.update({
      where: {
        id: proof.id,
        organizationId: proof.organizationId,
      },
      data: {
        status: ProofStatus.AWAITING_APPROVAL,
      },
    });

    await tx.proofDispatch.create({
      data: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        revisionId: revision.id,
        type: dispatchType,
        status: ProofDispatchStatus.PENDING,
        recipientName: proof.recipientName,
        recipientEmail,
      },
    });

    return updatedProof;
  });
}
