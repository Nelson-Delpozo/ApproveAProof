// @vitest-environment node

import { describe, expect, it } from "vitest";

import { processAuthorizationCallback } from "../../services/auth/callback.server";

describe("authentication callback processing", () => {
  it("rejects a callback whose state does not match the authorization transaction", async () => {
    const callbackUrl = new URL(
      "http://localhost:5173/auth/callback?code=invalid-code&state=wrong-state",
    );

    const transaction = {
      codeVerifier: "test-code-verifier",
      state: "expected-state",
      nonce: "expected-nonce",
    };

    await expect(processAuthorizationCallback(callbackUrl, transaction)).rejects.toThrow();
  });
});
