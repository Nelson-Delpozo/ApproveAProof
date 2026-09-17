import type {
  Membership,
  Organization,
} from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";

type CreateOrganizationInput = {
  userId: string;
  name: string;
  slug: string;
};

type CreatedOrganization = {
  organization: Organization;
  membership: Membership;
};

export async function createOrganizationForUser(
  input: CreateOrganizationInput,
): Promise<CreatedOrganization> {
  return db.$transaction(async (transaction) => {
    const organization = await transaction.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
      },
    });

    const membership = await transaction.membership.create({
      data: {
        organizationId: organization.id,
        userId: input.userId,
        role: "OWNER",
      },
    });

    return {
      organization,
      membership,
    };
  });
}