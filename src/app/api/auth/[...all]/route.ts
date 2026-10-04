import { toNextJsHandler } from "better-auth/next-js";
import { getIP } from "better-auth/api";
import { getAuth } from "@/features/auth/server/auth";
import { getAuthEnvironment, isAuthConfigured } from "@/lib/env";
import { emailRequestSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/features/auth/schemas";
import { authErrorMessage } from "@/features/auth/errors";
import { allowLifecycleRequest, allowResetCallback } from "@/features/auth/server/lifecycle-rate-limit";

export const runtime = "nodejs";
const genericMessage = "If an account exists for that email, we sent instructions.";
function generic() { return Response.json({ status: true, message: genericMessage }, { headers: { "Cache-Control": "no-store" } }); }
function failure(code: string, status: number, retryAfter?: string | null) {
  return Response.json({ code, message: authErrorMessage({ code, status }) }, {
    status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "X-Retry-After": retryAfter } : {}) },
  });
}
async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  const emailRequest = ["/request-password-reset", "/send-verification-email"].includes(path);
  const allowed = request.method === "GET" ? ["/get-session", "/verify-email"].includes(path) || /^\/reset-password\/[A-Za-z0-9_-]{1,128}$/.test(path)
    : ["/sign-in/email", "/sign-up/email", "/sign-out", "/request-password-reset", "/send-verification-email", "/reset-password"].includes(path);
  if (!allowed) return failure("NOT_FOUND", 404);
  let forwarded = request;
  let email = "";
  if (request.method === "POST" && path !== "/sign-out") {
    if (!request.headers.get("content-type")?.includes("application/json")) return failure("VALIDATION_ERROR", 400);
    try {
      const reader = request.body?.getReader();
      if (!reader) return failure("VALIDATION_ERROR", 400);
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 16384) { await reader.cancel(); return failure("VALIDATION_ERROR", 413); }
        chunks.push(value);
      }
      const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const schema = emailRequest ? emailRequestSchema : path === "/reset-password" ? resetPasswordSchema : path === "/sign-up/email" ? signUpSchema : signInSchema;
      const result = schema.safeParse(parsed);
      if (!result.success) return failure("VALIDATION_ERROR", 400);
      const body = { ...result.data } as Record<string, unknown>;
      email = typeof body.email === "string" ? body.email : "";
      delete body.confirmPassword;
      if (emailRequest) {
        // Public recovery never inherits an unrelated signed-in identity.
        body[path === "/request-password-reset" ? "redirectTo" : "callbackURL"] = path === "/request-password-reset" ? "/reset-password" : "/verify-email?success=1";
      }
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      if (emailRequest) headers.delete("cookie");
      forwarded = new Request(request.url, { method: "POST", headers, body: JSON.stringify(body) });
    } catch { return failure("VALIDATION_ERROR", 400); }
  }
  if (!isAuthConfigured()) return emailRequest ? generic() : path === "/get-session" ? Response.json(null) : failure("SERVICE_UNAVAILABLE", 503);
  const origin = new URL(getAuthEnvironment().APP_URL).origin;
  // Extra same-origin check happens BEFORE email/rate-limit work. Better Auth's own
  // Origin, Fetch Metadata and callback protections are also left enabled.
  if (request.method === "POST" && (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site")) return failure("FORBIDDEN", 403);
  const started = Date.now();
  try {
    if (request.method === "GET" && path.startsWith("/reset-password/")) {
      const ip = getIP(request, getAuth().options) || "unknown";
      if (!await allowResetCallback(ip)) return failure("TOO_MANY_REQUESTS", 429);
    }
    if (emailRequest || path === "/sign-up/email") {
      const ip = getIP(request, getAuth().options) || "unknown";
      const kind = path === "/sign-up/email" ? "signup" : path === "/request-password-reset" ? "forgot" : "verification";
      if (!await allowLifecycleRequest(email, ip, kind)) return emailRequest ? generic() : failure("TOO_MANY_REQUESTS", 429);
    }
    const handlers = toNextJsHandler(getAuth());
    const response = await (request.method === "GET" ? handlers.GET(forwarded) : handlers.POST(forwarded));
    if (emailRequest) return generic();
    if (response.status >= 400) {
      const payload: unknown = await response.clone().json().catch(() => null);
      const rawCode = payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string" ? payload.code : "SERVICE_UNAVAILABLE";
      const safeCodes = ["INVALID_EMAIL_OR_PASSWORD", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "USER_ALREADY_EXISTS", "EMAIL_NOT_VERIFIED"];
      const code = response.status === 429 ? "TOO_MANY_REQUESTS" : safeCodes.includes(rawCode) ? rawCode : response.status === 403 ? "FORBIDDEN" : path === "/reset-password" ? "INVALID_RESET" : "SERVICE_UNAVAILABLE";
      return failure(code, response.status, response.headers.get("X-Retry-After"));
    }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    // Never log credentials, token-bearing URLs or provider/database exceptions.
    return emailRequest ? generic() : failure("SERVICE_UNAVAILABLE", 503);
  } finally {
    // Uniform floor covers the centralized transport's 8s timeout, including
    // missing config, absent users and throttling. No public delivery claim internally.
    if (emailRequest) await new Promise(resolve => setTimeout(resolve, Math.max(0, 10000 - (Date.now() - started))));
  }
}
export const GET = handle;
export const POST = handle;
