// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  clearAuthorizationTransaction,
  commitSession,
  destroySession,
  getAuthenticatedUserId,
  getAuthorizationTransaction,
  getSession,
  setAuthenticatedUserId,
  setAuthorizationTransaction,
} from "../../services/auth/session.server";

describe("authentication session", () => {
  it("round-trips data through a signed cookie", async () => {
    const session = await getSession();

    session.set("example", "value");

    const setCookie = await commitSession(session);
    const cookie = setCookie.split(";")[0];

    const restoredSession = await getSession(cookie);

    expect(restoredSession.get("example")).toBe("value");
  });

  it("uses the expected cookie security flags", async () => {
    const session = await getSession();
    const setCookie = await commitSession(session);

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });

  it("destroys the session cookie", async () => {
    const session = await getSession();

    session.set("example", "value");

    const setCookie = await destroySession(session);

    expect(setCookie).toContain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
  });

  it("stores and clears the authorization transaction", async () => {
    const session = await getSession();

    const transaction = {
      codeVerifier: "test-code-verifier",
      state: "test-state",
      nonce: "test-nonce",
    };

    setAuthorizationTransaction(session, transaction);

    expect(getAuthorizationTransaction(session)).toEqual(transaction);

    clearAuthorizationTransaction(session);

    expect(getAuthorizationTransaction(session)).toBeUndefined();
  });

  it("stores the authenticated local user ID", async () => {
    const session = await getSession();

    setAuthenticatedUserId(session, "test-user-id");

    const setCookie = await commitSession(session);
    const cookie = setCookie.split(";")[0];

    const restoredSession = await getSession(cookie);

    expect(getAuthenticatedUserId(restoredSession)).toBe("test-user-id");
  });
}); 