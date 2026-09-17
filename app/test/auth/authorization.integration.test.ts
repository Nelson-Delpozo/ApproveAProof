// @vitest-environment node

import { describe, expect, it } from "vitest";

import { authConfig } from "../../services/auth/auth-config.server";
import { createAuthorizationRequest } from "../../services/auth/authorization.server";

describe("Auth0 authorization request", () => {
  it("creates an authorization request with PKCE, state, and nonce", async () => {
    const { url, transaction } = await createAuthorizationRequest();

    expect(url.protocol).toBe("https:");
    expect(url.searchParams.get("client_id")).toBe(authConfig.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(
      authConfig.callbackUrl,
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid profile email");

    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    expect(url.searchParams.get("state")).toBe(transaction.state);
    expect(url.searchParams.get("nonce")).toBe(transaction.nonce);

    expect(transaction.codeVerifier).toBeTruthy();
    expect(transaction.state).toBeTruthy();
    expect(transaction.nonce).toBeTruthy();
  });

  it("generates fresh security values for each authorization request", async () => {
    const first = await createAuthorizationRequest();
    const second = await createAuthorizationRequest();

    expect(first.transaction.codeVerifier).not.toBe(
      second.transaction.codeVerifier,
    );
    expect(first.transaction.state).not.toBe(second.transaction.state);
    expect(first.transaction.nonce).not.toBe(second.transaction.nonce);
  });
});