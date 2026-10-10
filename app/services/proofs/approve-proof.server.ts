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

const approvalStatement = "I have reviewed this proof and approve this revision for production.";

const approvalInputSchema = z.object({
  revisionId: z.uuid(),
  responderName: z.string().trim().min(1),
  responderEmail: z.email().optional(),
});

type ApproveProofInput = z.input<typeof approvalInputSchema>;

type LockedProof = {
  id: string;
  organizationId: string;
  status: ProofStatus;
  currentRevisionId: string | null;
  recipientName: string;
  recipientEmail: string | null;
};

export async function approveProofForOrganization(
  organizationId: string,
  proofId: string,
  input: ApproveProofInput,
): Promise<ProofResponse> {
  const validatedInput = approvalInputSchema.parse(input);

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

    if (!canTransitionProofStatus(proof.status, ProofStatus.APPROVED)) {
      throw new Error(`Proof cannot be approved from status ${proof.status}.`);
    }

    if (!proof.currentRevisionId) {
      throw new Error("Proof has no current Revision.");
    }

    if (validatedInput.revisionId !== proof.currentRevisionId) {
      throw new Error("Approval Revision does not match the current Revision.");
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
      throw new Error("Approval Revision not found.");
    }

    const sentDispatch = await tx.proofDispatch.findFirst({
      where: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        revisionId: revision.id,
        type: {
          in: [ProofDispatchType.INITIAL_PROOF, ProofDispatchType.REVISION],
        },
        status: ProofDispatchStatus.SENT,
        sentAt: {
          not: null,
        },
      },
      select: {
        id: true,
        recipientName: true,
        recipientEmail: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!sentDispatch) {
      throw new Error("Approval Revision has no completed submission dispatch.");
    }

    const confirmationRecipientEmail = sentDispatch.recipientEmail.trim();

    if (!z.email().safeParse(confirmationRecipientEmail).success) {
      throw new Error("Approval confirmation recipient email is invalid.");
    }

    const response = await tx.proofResponse.create({
      data: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        revisionId: revision.id,
        type: ProofResponseType.APPROVED,
        responderName: validatedInput.responderName,
        responderEmail: validatedInput.responderEmail,
        approvalStatementSnapshot: approvalStatement,
      },
    });

    await tx.proof.update({
      where: {
        id: proof.id,
        organizationId: proof.organizationId,
      },
      data: {
        status: ProofStatus.APPROVED,
      },
    });

    await tx.proofActivity.create({
      data: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        type: ProofActivityType.PROOF_APPROVED,
      },
    });

    await tx.proofDispatch.create({
      data: {
        organizationId: proof.organizationId,
        proofId: proof.id,
        revisionId: revision.id,
        type: ProofDispatchType.APPROVAL_CONFIRMATION,
        status: ProofDispatchStatus.PENDING,
        recipientName: sentDispatch.recipientName,
        recipientEmail: confirmationRecipientEmail,
      },
    });

    return response;
  });
}
