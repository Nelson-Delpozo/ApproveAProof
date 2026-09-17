// @vitest-environment node

import { describe, expect, it } from "vitest";

import { authConfig } from "../../services/auth/auth-config.server";

describe("Auth0 OIDC configuration", () => {
  it("builds the configured Auth0 issuer", () => {
    const issuer = new URL(`https://${authConfig.domain}`);

    expect(issuer.protocol).toBe("https:");
    expect(issuer.hostname).toBe(authConfig.domain);
    expect(issuer.pathname).toBe("/");
  });
});
