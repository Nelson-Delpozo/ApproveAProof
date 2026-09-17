// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  clearAuthorizationTransaction,
  commitSession,
  destroySession,
  getAuthorizationTransaction,
  getSession,
  setAuthorizationTransaction,
} from "../../services/auth/session.server";

describe("authentication session", () => {
  it("round-trips session data through the signed cookie", async () => {
    const session = await getSession();

    session.set("userId", "user-123");

    const setCookie = await commitSession(session);
    const cookie = setCookie.split(";")[0];

    const restoredSession = await getSession(cookie);

    expect(restoredSession.get("userId")).toBe("user-123");
  });

  it("creates an HttpOnly SameSite=Lax cookie", async () => {
    const session = await getSession();
    const setCookie = await commitSession(session);

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });

  it("destroys the session cookie", async () => {
    const session = await getSession();

    session.set("userId", "user-123");

    const setCookie = await destroySession(session);

    expect(setCookie).toContain("__approveaproof_session=;");
    expect(setCookie).toContain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("stores and clears an authorization transaction", async () => {
    const session = await getSession();

    const transaction = {
      codeVerifier: "verifier-123",
      state: "state-123",
      nonce: "nonce-123",
    };

    setAuthorizationTransaction(session, transaction);

    expect(getAuthorizationTransaction(session)).toEqual(transaction);

    clearAuthorizationTransaction(session);

    expect(getAuthorizationTransaction(session)).toBeUndefined();
  });
});