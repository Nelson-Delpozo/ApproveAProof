import type {
  Membership,
  Organization,
  User,
} from "../../../generated/prisma/client";
import { redirect } from "react-router";

import { requireUser } from "../auth/require-user.server";
import { getUserMemberships } from "./user-membership.server";

export type OrganizationContext = {
  user: User;
  organization: Organization;
  membership: Membership;
};

export async function requireOrganization(
  request: Request,
): Promise<OrganizationContext> {
  const user = await requireUser(request);
  const memberships = await getUserMemberships(user.id);

  if (memberships.length === 0) {
    throw redirect("/app/onboarding");
  }

  const membership = memberships[0];

  return {
    user,
    organization: membership.organization,
    membership,
  };
}