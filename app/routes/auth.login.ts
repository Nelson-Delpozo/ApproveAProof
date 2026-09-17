import { redirect } from "react-router";

import { createAuthorizationRequest } from "../services/auth/authorization.server";
import {
  commitSession,
  getSession,
  setAuthorizationTransaction,
} from "../services/auth/session.server";

export async function loader({ request }: { request: Request }) {
  const { url, transaction } = await createAuthorizationRequest();

  const session = await getSession(request.headers.get("Cookie"));

  setAuthorizationTransaction(session, transaction);

  return redirect(url.toString(), {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}