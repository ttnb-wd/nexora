import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/features/auth/server/auth";
import { isAuthConfigured } from "@/lib/env";
import { signInSchema, signUpSchema } from "@/features/auth/schemas";
import { authErrorMessage } from "@/features/auth/errors";

export const runtime = "nodejs";
function failure(code: string, status: number, retryAfter?: string | null) {
  return Response.json({ code, message: authErrorMessage({ code, status }) }, {
    status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "X-Retry-After": retryAfter } : {}) },
  });
}
async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  // Only the Step 07 surface is exposed; reset/OAuth/account management remain disabled.
  const allowed = request.method === "GET" ? path === "/get-session" : ["/sign-in/email", "/sign-up/email", "/sign-out"].includes(path);
  if (!allowed) return failure("NOT_FOUND", 404);
  let forwarded = request;
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
      const result = (path === "/sign-up/email" ? signUpSchema : signInSchema).safeParse(parsed);
      if (!result.success) return failure("VALIDATION_ERROR", 400);
      // Strip user IDs, roles, redirect URLs, and extra profile fields at the server boundary.
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      forwarded = new Request(request.url, { method: "POST", headers, body: JSON.stringify(result.data) });
    } catch { return failure("VALIDATION_ERROR", 400); }
  }
  if (!isAuthConfigured()) {
    // Public mock pages remain usable without a provisioned auth environment.
    return path === "/get-session" ? Response.json(null, { headers: { "Cache-Control": "no-store" } }) : failure("SERVICE_UNAVAILABLE", 503);
  }
  try {
    const handlers = toNextJsHandler(getAuth());
    const response = await (request.method === "GET" ? handlers.GET(forwarded) : handlers.POST(forwarded));
    if (!response.ok) {
      const payload: unknown = await response.clone().json().catch(() => null);
      const rawCode = payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string" ? payload.code : "SERVICE_UNAVAILABLE";
      const safeCodes = ["INVALID_EMAIL_OR_PASSWORD", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "USER_ALREADY_EXISTS"];
      const code = response.status === 429 ? "TOO_MANY_REQUESTS" : response.status === 403 ? "FORBIDDEN" : safeCodes.includes(rawCode) ? rawCode : "SERVICE_UNAVAILABLE";
      return failure(code, response.status, response.headers.get("X-Retry-After"));
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    // Avoid logging request bodies, database queries, credentials, or raw auth errors.
    console.error("Authentication request failed", { type: error instanceof Error ? error.name : "UnknownError" });
    return failure("SERVICE_UNAVAILABLE", 503);
  }
}
export const GET = handle;
export const POST = handle;
