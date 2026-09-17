import { describe, expect, it } from "vitest";

import { getOidcConfiguration } from "../../services/auth/oidc.server";

describe("Auth0 OIDC configuration", () => {
  it("discovers the configured Auth0 issuer", async () => {
    const configuration = await getOidcConfiguration();

    expect(configuration).toBeDefined();
  });
});