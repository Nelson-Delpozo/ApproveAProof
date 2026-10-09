import { ProofStatus, type Proof } from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";
import { canTransitionProofStatus } from "./proof-lifecycle";

type LockedProof = {
  id: string;
  organizationId: string;
  status: ProofStatus;
};

export async function getProofForOrganization(
  organizationId: string,
  proofId: string,
): Promise<Proof | null> {
  return db.proof.findFirst({
    where: {
      id: proofId,
      organizationId,
    },
  });
}

export async function cancelProofForOrganization(
  organizationId: string,
  proofId: string,
): Promise<Proof> {
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

    if (!canTransitionProofStatus(proof.status, ProofStatus.CANCELED)) {
      throw new Error(`Proof cannot be canceled from status ${proof.status}.`);
    }

    return tx.proof.update({
      where: {
        id: proof.id,
        organizationId: proof.organizationId,
      },
      data: {
        status: ProofStatus.CANCELED,
      },
    });
  });
}
