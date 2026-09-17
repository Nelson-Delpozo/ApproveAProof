import { z } from "zod";

import { env } from "../env.server";

const authConfigSchema = z.object({
  domain: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  callbackUrl: z.string().url(),
  logoutUrl: z.string().url(),
  sessionSecret: z.string().min(32),
});

const result = authConfigSchema.safeParse({
  domain: env.AUTH0_DOMAIN,
  clientId: env.AUTH0_CLIENT_ID,
  clientSecret: env.AUTH0_CLIENT_SECRET,
  callbackUrl: env.AUTH0_CALLBACK_URL,
  logoutUrl: env.AUTH0_LOGOUT_URL,
  sessionSecret: env.SESSION_SECRET,
});

if (!result.success) {
  console.error("Invalid authentication configuration:");
  console.error(z.treeifyError(result.error));

  throw new Error("Invalid authentication configuration");
}

export const authConfig = result.data;