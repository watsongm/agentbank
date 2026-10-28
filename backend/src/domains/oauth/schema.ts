import { z } from "zod";

export const OAuthTokenInput = z
  .object({
    grant_type: z.string().default("client_credentials"),
    client_id: z.string().default("agentbank-sdk"),
    client_secret: z.string().optional(),
    scope: z.string().optional(),
    customer_id: z.string().optional(),
    sub: z.string().optional(),
  })
  .default({});

export type OAuthTokenInputT = z.infer<typeof OAuthTokenInput>;
