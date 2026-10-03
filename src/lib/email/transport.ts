import "server-only";
import { Resend, type Response as ResendResponse } from "resend";
import { z } from "zod";
import { emailConfiguration } from "./config";
import type { EmailFailureCategory, EmailResult, TransactionalEmail } from "./types";

export const EMAIL_TIMEOUT_MS = 8000;

// The SDK logs raw provider errors outside production. Override its public
// transport to avoid that privacy leak in EVERY environment. SDK still owns
// email serialization, authorization and idempotency headers. Never patch globals.
class PrivateResend extends Resend {
  override async fetchRequest<T>(path: string, options: RequestInit = {}): Promise<ResendResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, options);
    if (!response.ok) {
      // Status is sufficient; do not parse/retain the recipient-bearing error body.
      await response.body?.cancel();
      return { data: null, error: { name: "application_error", statusCode: response.status, message: "Email request failed." }, headers: null };
    }
    return { data: await response.json() as T, error: null, headers: null };
  }
}
export function providerFailureCategory(status: number | null | undefined): EmailFailureCategory {
  if (status === 401) return "authentication";
  if (status === 403) return "domain";
  if (status === 429) return "rate_limit";
  if (status === 400 || status === 422) return "recipient";
  return "provider";
}
export async function sendTransactionalEmail(message: TransactionalEmail, timeoutMs = EMAIL_TIMEOUT_MS): Promise<EmailResult> {
  const config = emailConfiguration();
  if (!config) return { ok: false, category: "configuration" };
  if (!z.email().safeParse(message.to).success) return { ok: false, category: "recipient" };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<EmailResult>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve({ ok: false, category: "timeout" }); }, timeoutMs);
  });
  const send = async (): Promise<EmailResult> => {
    try {
      // Pin the endpoint: RESEND_BASE_URL must never redirect a production secret.
      const resend = new PrivateResend(config.key, { baseUrl: "https://api.resend.com" });
      const { data, error } = await resend.emails.send({ from: config.from, ...(config.replyTo ? { replyTo: config.replyTo } : {}), to: [message.to], subject: message.subject, html: message.html, text: message.text }, { idempotencyKey: message.idempotencyKey, signal: controller.signal });
      if (error) return { ok: false, category: providerFailureCategory(error.statusCode) };
      if (!data?.id || !/^[A-Za-z0-9_-]{1,128}$/.test(data.id)) return { ok: false, category: "provider" };
      return { ok: true, messageId: data.id };
    } catch { return { ok: false, category: controller.signal.aborted ? "timeout" : "provider" }; }
  };
  try { return await Promise.race([send(), timeout]); }
  finally { clearTimeout(timer); }
}
