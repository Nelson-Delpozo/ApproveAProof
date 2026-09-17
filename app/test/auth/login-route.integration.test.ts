// @vitest-environment node

import { describe, expect, it } from "vitest";

import { loader } from "../../routes/auth.login";
import {
  getAuthorizationTransaction,
  getSession,
} from "../../services/auth/session.server";

describe("authentication login route", () => {
  it("stores the authorization transaction and redirects to Auth0", async () => {
    const request = new Request("http://localhost:5173/auth/login");

    const response = await loader({ request });

    expect(response.status).toBe(302);

    const location = response.headers.get("Location");
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location!);

    expect(redirectUrl.protocol).toBe("https:");
    expect(redirectUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(redirectUrl.searchParams.get("state")).toBeTruthy();
    expect(redirectUrl.searchParams.get("nonce")).toBeTruthy();

    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();

    const session = await getSession(setCookie);
    const transaction = getAuthorizationTransaction(session);

    expect(transaction).toBeDefined();
    expect(transaction?.state).toBe(
      redirectUrl.searchParams.get("state"),
    );
    expect(transaction?.nonce).toBe(
      redirectUrl.searchParams.get("nonce"),
    );
    expect(transaction?.codeVerifier).toBeTruthy();
  });
});