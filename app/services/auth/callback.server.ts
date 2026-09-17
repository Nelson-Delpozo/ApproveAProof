import * as oidc from "openid-client";

import type { AuthorizationTransaction } from "./auth-types";
import { getOidcConfiguration } from "./oidc.server";

export type AuthenticatedIdentity = {
  subject: string;
  email: string;
  name?: string;
};

export async function processAuthorizationCallback(
  callbackUrl: URL,
  transaction: AuthorizationTransaction,
): Promise<AuthenticatedIdentity> {
  const configuration = await getOidcConfiguration();

  const tokens = await oidc.authorizationCodeGrant(
    configuration,
    callbackUrl,
    {
      pkceCodeVerifier: transaction.codeVerifier,
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      idTokenExpected: true,
    },
  );

  const claims = tokens.claims();

  if (!claims?.sub) {
    throw new Error("Authenticated identity is missing a subject");
  }

  if (typeof claims.email !== "string" || claims.email.length === 0) {
    throw new Error("Authenticated identity is missing an email");
  }

  return {
    subject: claims.sub,
    email: claims.email,
    name: typeof claims.name === "string" ? claims.name : undefined,
  };
}