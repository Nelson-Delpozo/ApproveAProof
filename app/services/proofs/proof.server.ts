import type { Proof } from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";

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
