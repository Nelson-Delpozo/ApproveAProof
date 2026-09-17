import * as oidc from "openid-client";

import { authConfig } from "./auth-config.server";

const issuer = new URL(`https://${authConfig.domain}`);

let configurationPromise: Promise<oidc.Configuration> | undefined;

export function getOidcConfiguration() {
  configurationPromise ??= oidc.discovery(
    issuer,
    authConfig.clientId,
    authConfig.clientSecret,
  );

  return configurationPromise;
}