import * as oidc from "openid-client";

import type { AuthorizationTransaction } from "./auth-types";
import { authConfig } from "./auth-config.server";
import { getOidcConfiguration } from "./oidc.server";

export async function createAuthorizationRequest() {
  const configuration = await getOidcConfiguration();

  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();

  const url = oidc.buildAuthorizationUrl(configuration, {
    redirect_uri: authConfig.callbackUrl,
    response_type: "code",
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  const transaction: AuthorizationTransaction = {
    codeVerifier,
    state,
    nonce,
  };

  return {
    url,
    transaction,
  };
}
