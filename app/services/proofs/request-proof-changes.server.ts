
import { z } from "zod";

import {
  ProofActivityType,
  ProofDispatchStatus,
  ProofDispatchType,
  ProofResponseType,
  ProofStatus,
  type ProofResponse,
} from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";
import { canTransitionProofStatus } from "./proof-lifecycle";

const changeRequestInputSchema = z.object({
  revisionId: z.uuid(),
  responderName: z.string().trim().min(1),
  responderEmail: z.email().optional(),
  comments: z.string().trim().min(1),
});

type RequestProofChangesInput = z.input<
  typeof changeRequestInputSchema
>;

type LockedProof = {
  id: string;
  organizationId: string;
  status: ProofStatus;
  currentRevisionId: string | null;
};

export async function requestProofChangesForOrganization(
  organizationId: string,
  proofId: string,
  input: RequestProofChangesInput,
): Promise<ProofResponse> {
  const validatedInput = changeRequestInputSchema.parse(input);

  return db.$transaction(async (tx) => {
    const proofs = await tx.$queryRaw<LockedProof[]>`
      SELECT
        "id",
        "organizationId",
        "status",
        "currentRevisionId"
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
      !canTransitionProofStatus(
        proof.status,
        ProofStatus.CHANGES_REQUESTED,
      )
    ) {
      throw new Error(
        `Proof cannot request changes from status ${proof.status}.`,
      );
    }

    if (!proof.currentRevisionId) {
      throw new Error("Proof has no current Revision.");
    }

    if (validatedInput.revisionId !== proof.currentRevisionId) {
      throw new Error(
        "Change request Revision does not match the current Revision.",
      );
    }

    const revision = await tx.revision.findFirst({
      where: {
        id: validatedInput.revisionId,
        proofId: proof.id,
        organizationId: proof.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!revision) {
      throw new Error("Change request Revision not found.");
    }

    const sentDispatch = await tx.proofDispatch.findFirst({
      where: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        revisionId: revision.id,
        type: {
          in: [
            ProofDispatchType.INITIAL_PROOF,
            ProofDispatchType.REVISION,
          ],
        },
        status: ProofDispatchStatus.SENT,
        sentAt: {
          not: null,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!sentDispatch) {
      throw new Error(
        "Change request Revision has no completed submission dispatch.",
      );
    }

    const response = await tx.proofResponse.create({
      data: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        revisionId: revision.id,
        type: ProofResponseType.CHANGES_REQUESTED,
        responderName: validatedInput.responderName,
        responderEmail: validatedInput.responderEmail,
        comments: validatedInput.comments,
      },
    });

    await tx.proof.update({
      where: {
        id: proof.id,
        organizationId: proof.organizationId,
      },
      data: {
        status: ProofStatus.CHANGES_REQUESTED,
      },
    });

    await tx.proofActivity.create({
      data: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        type: ProofActivityType.CHANGES_REQUESTED,
      },
    });

    return response;
  });
}
