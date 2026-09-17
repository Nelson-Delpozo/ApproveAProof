import type { User } from "../../../generated/prisma/client";

import { db } from "../../lib/db.server";
import type { AuthenticatedIdentity } from "./callback.server";

export async function resolveAuthenticatedUser(
  identity: AuthenticatedIdentity,
): Promise<User> {
  return db.user.upsert({
    where: {
      auth0Subject: identity.subject,
    },
    update: {
      ...(identity.email ? { email: identity.email } : {}),
      ...(identity.name ? { name: identity.name } : {}),
    },
    create: {
      auth0Subject: identity.subject,
      email: identity.email,
      name: identity.name,
    },
  });
}