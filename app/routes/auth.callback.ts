import { redirect } from "react-router";

import { processAuthorizationCallback } from "../services/auth/callback.server";
import {
  clearAuthorizationTransaction,
  commitSession,
  getAuthorizationTransaction,
  getSession,
  setAuthenticatedUserId,
} from "../services/auth/session.server";
import { resolveAuthenticatedUser } from "../services/auth/user.server";

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request.headers.get("Cookie"));
  const transaction = getAuthorizationTransaction(session);

  if (!transaction) {
    throw new Response("Missing authentication transaction", {
      status: 400,
    });
  }

  const callbackUrl = new URL(request.url);

  const identity = await processAuthorizationCallback(callbackUrl, transaction);

  const user = await resolveAuthenticatedUser(identity);

  setAuthenticatedUserId(session, user.id);
  clearAuthorizationTransaction(session);

  return redirect("/app", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
