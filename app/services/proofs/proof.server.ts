import { ProofStatus, type Proof } from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";
import { canTransitionProofStatus } from "./proof-lifecycle";

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
  const proof = await getProofForOrganization(organizationId, proofId);

  if (!proof) {
    throw new Error("Proof not found.");
  }

  if (!canTransitionProofStatus(proof.status, ProofStatus.CANCELED)) {
    throw new Error(`Proof cannot be canceled from status ${proof.status}.`);
  }

  return db.proof.update({
    where: {
      id: proof.id,
    },
    data: {
      status: ProofStatus.CANCELED,
    },
  });
}