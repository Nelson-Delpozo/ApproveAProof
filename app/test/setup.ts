import "@testing-library/jest-dom/vitest";

process.env.APP_URL ??= "http://localhost:5173";

process.env.AUTH0_DOMAIN ??= "approveaproof-test.auth0.com";
process.env.AUTH0_CLIENT_ID ??= "approveaproof-test-client";
process.env.AUTH0_CLIENT_SECRET ??= "approveaproof-test-secret";
process.env.AUTH0_CALLBACK_URL ??= "http://localhost:5173/auth/callback";
process.env.AUTH0_LOGOUT_URL ??= "http://localhost:5173/";
process.env.SESSION_SECRET ??= "approveaproof-test-session-secret-at-least-32-characters";
