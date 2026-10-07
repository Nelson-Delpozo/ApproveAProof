import type { Revision } from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";

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
};

export async function createRevisionForProof(
  organizationId: string,
  proofId: string,
  input: CreateRevisionInput,
): Promise<Revision> {
  return db.$transaction(async (tx) => {
    const proofs = await tx.$queryRaw<LockedProof[]>`
      SELECT "id", "organizationId"
      FROM "Proof"
      WHERE "id" = ${proofId}::uuid
        AND "organizationId" = ${organizationId}::uuid
      FOR UPDATE
    `;

    const proof = proofs[0];

    if (!proof) {
      throw new Error("Proof not found.");
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

    return tx.revision.create({
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
  });
} 