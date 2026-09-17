import type { Membership, Organization } from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";

export type MembershipWithOrganization = Membership & {
  organization: Organization;
};

export async function getUserMemberships(userId: string): Promise<MembershipWithOrganization[]> {
  return db.membership.findMany({
    where: {
      userId,
    },
    include: {
      organization: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
