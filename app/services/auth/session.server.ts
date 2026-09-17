import { createCookieSessionStorage } from "react-router";

import type { AuthorizationTransaction } from "./auth-types";
import { authConfig } from "./auth-config.server";

const AUTH_TRANSACTION_KEY = "authTransaction";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__approveaproof_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [authConfig.sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

export function setAuthorizationTransaction(
  session: Awaited<ReturnType<typeof getSession>>,
  transaction: AuthorizationTransaction,
) {
  session.set(AUTH_TRANSACTION_KEY, transaction);
}

export function getAuthorizationTransaction(
  session: Awaited<ReturnType<typeof getSession>>,
): AuthorizationTransaction | undefined {
  return session.get(AUTH_TRANSACTION_KEY) as
    | AuthorizationTransaction
    | undefined;
}

export function clearAuthorizationTransaction(
  session: Awaited<ReturnType<typeof getSession>>,
) {
  session.unset(AUTH_TRANSACTION_KEY);
}