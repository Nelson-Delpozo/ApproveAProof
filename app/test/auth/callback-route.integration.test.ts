// @vitest-environment node

import { describe, expect, it } from "vitest";

import { loader } from "../../routes/auth.callback";

describe("authentication callback route", () => {
  it("rejects a callback without an authorization transaction", async () => {
    const request = new Request(
      "http://localhost:5173/auth/callback?code=test-code&state=test-state",
    );

    try {
      await loader({ request });

      throw new Error("Expected callback route to reject the request");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(400);
      expect(await response.text()).toBe(
        "Missing authentication transaction",
      );
    }
  });
});