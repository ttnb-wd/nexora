export type EmailFailureCategory = "configuration" | "authentication" | "domain" | "rate_limit" | "recipient" | "timeout" | "provider";
export type EmailResult = { ok: true; messageId: string } | { ok: false; category: EmailFailureCategory };
export type TransactionalEmail = { to: string; subject: string; html: string; text: string; idempotencyKey: string };
