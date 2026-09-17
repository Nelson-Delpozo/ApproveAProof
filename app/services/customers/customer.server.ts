import type { Customer } from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";

export async function getCustomerForOrganization(
  organizationId: string,
  customerId: string,
): Promise<Customer | null> {
  return db.customer.findFirst({
    where: {
      id: customerId,
      organizationId,
    },
  });
}
