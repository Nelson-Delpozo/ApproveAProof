import * as oidc from "openid-client";

import { authConfig } from "./auth-config.server";

const issuer = new URL(`https://${authConfig.domain}`);

let configurationPromise: Promise<oidc.Configuration> | undefined;

export function getOidcConfiguration() {
  configurationPromise ??= oidc.discovery(issuer, authConfig.clientId, authConfig.clientSecret);

  return configurationPromise;
}

export function setOidcConfigurationForTesting(configuration: oidc.Configuration) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("OIDC configuration may only be overridden during tests");
  }

  configurationPromise = Promise.resolve(configuration);
}

export function resetOidcConfigurationForTesting() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("OIDC configuration may only be reset during tests");
  }

  configurationPromise = undefined;
}
