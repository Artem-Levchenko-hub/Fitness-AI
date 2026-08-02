import { z } from "zod";

import { normalizePushEndpoint } from "./endpoint-policy";

const pushKey = z
  .string()
  .min(16)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid Web Push key encoding");

export const pushEndpointSchema = z
  .string()
  .max(2_048)
  .transform((value, context) => {
    try {
      return normalizePushEndpoint(value);
    } catch {
      context.addIssue({
        code: "custom",
        message: "Unsupported push endpoint",
      });
      return z.NEVER;
    }
  });

export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({
    p256dh: pushKey,
    auth: pushKey,
  }),
});
