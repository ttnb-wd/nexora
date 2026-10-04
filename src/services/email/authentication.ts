import "server-only";
import { createHash } from "node:crypto";
import { getPublicAppUrl } from "@/lib/public-url-server";
import { authEmailTemplate } from "@/lib/email/auth-template";
import { sendTransactionalEmail } from "@/lib/email/transport";

export async function sendAuthenticationEmail(kind: "verification" | "reset", email: string, authUrl: string) {
  const url = new URL(authUrl);
  // Keep Better Auth's route/token intact, but pin both destination and callback.
  const base = new URL(getPublicAppUrl());
  url.protocol = base.protocol; url.host = base.host;
  url.searchParams.set("callbackURL", new URL(kind === "verification" ? "/verify-email?success=1" : "/reset-password", base).href);
  const content = authEmailTemplate(kind, url.href);
  const idempotencyKey = `auth-${kind}-${createHash("sha256").update(url.href).digest("hex")}`;
  const result = await sendTransactionalEmail({ to: email, ...content, idempotencyKey });
  if (!result.ok) throw new Error("Authentication email delivery unavailable.");
}
