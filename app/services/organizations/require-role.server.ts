import type { MembershipRole } from "../../../generated/prisma/client";

import {
  requireOrganization,
  type OrganizationContext,
} from "./require-organization.server";

const ROLE_LEVEL: Record<MembershipRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export async function requireRole(
  request: Request,
  minimumRole: MembershipRole,
): Promise<OrganizationContext> {
  const context = await requireOrganization(request);

  if (
    ROLE_LEVEL[context.membership.role] <
    ROLE_LEVEL[minimumRole]
  ) {
    throw new Response("Forbidden", {
      status: 403,
    });
  }

  return context;
}