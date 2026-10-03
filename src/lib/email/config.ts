import "server-only";
import { z } from "zod";

export function emailConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  const replyTo = env.EMAIL_REPLY_TO?.trim();
  if (!key || !from || /[\r\n]/.test(from) || (replyTo && !z.email().safeParse(replyTo).success)) return null;
  const address = from.match(/^[^<>]+<([^<>]+)>$/)?.[1] ?? from;
  if (!z.email().safeParse(address).success) return null;
  const domain = address.split("@")[1].toLowerCase();
  // Provider validates DNS verification. Never use its shared sandbox sender in production.
  if (env.NODE_ENV === "production" && (domain === "resend.dev" || domain === "localhost" || domain.endsWith(".test") || domain.endsWith(".example") || domain === "example.com" || domain.endsWith(".example.com"))) return null;
  return { key, from, ...(replyTo ? { replyTo } : {}) };
}
