import { redirect } from "react-router";

import { processAuthorizationCallback } from "../services/auth/callback.server";
import {
  clearAuthorizationTransaction,
  commitSession,
  getAuthorizationTransaction,
  getSession,
} from "../services/auth/session.server";

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request.headers.get("Cookie"));
  const transaction = getAuthorizationTransaction(session);

  if (!transaction) {
    throw new Response("Missing authentication transaction", {
      status: 400,
    });
  }

  const callbackUrl = new URL(request.url);

  const identity = await processAuthorizationCallback(
    callbackUrl,
    transaction,
  );

  clearAuthorizationTransaction(session);

  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
      "X-Authenticated-Subject": identity.subject,
    },
  });
}