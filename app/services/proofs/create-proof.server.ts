import { z } from "zod";

import { ProofActivityType, ProofStatus, type Proof } from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";

const createProofInputSchema = z.object({
  title: z.string().trim().min(1),
  recipientName: z.string().trim().min(1),
  recipientEmail: z.string().trim().pipe(z.email()).optional().nullable(),
  customerId: z.uuid().optional().nullable(),
});

type CreateProofInput = z.input<typeof createProofInputSchema>;

export async function createProofForOrganization(
  organizationId: string,
  input: CreateProofInput,
): Promise<Proof> {
  const validatedInput = createProofInputSchema.parse(input);

  return db.$transaction(async (tx) => {
    if (validatedInput.customerId) {
      const customer = await tx.customer.findFirst({
        where: {
          id: validatedInput.customerId,
          organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!customer) {
        throw new Error("Customer not found.");
      }
    }

    const proof = await tx.proof.create({
      data: {
        organizationId,
        customerId: validatedInput.customerId ?? null,
        title: validatedInput.title,
        recipientName: validatedInput.recipientName,
        recipientEmail: validatedInput.recipientEmail ?? null,
        status: ProofStatus.DRAFT,
        currentRevisionId: null,
      },
    });

    await tx.proofActivity.create({
      data: {
        organizationId,
        proofId: proof.id,
        type: ProofActivityType.PROOF_CREATED,
      },
    });

    return proof;
  });
}
