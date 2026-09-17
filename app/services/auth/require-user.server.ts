import type { User } from "../../../generated/prisma/client";
import { redirect } from "react-router";

import { db } from "../../lib/db.server";
import { getAuthenticatedUserId, getSession } from "./session.server";

export async function requireUser(request: Request): Promise<User> {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = getAuthenticatedUserId(session);

  if (!userId) {
    throw redirect("/auth/login");
  }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw redirect("/auth/login");
  }

  return user;
}
