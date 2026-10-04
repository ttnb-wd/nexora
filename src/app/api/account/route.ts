import { getIP } from "better-auth/api";
import { getAuth } from "@/features/auth/server/auth";
import { getAuthEnvironment, isAuthConfigured } from "@/lib/env";
import { accountMutationSchema } from "@/features/account/schemas";
import { AccountError, getAccountSettings, mutateAccount } from "@/features/account/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }); }
function safeError(error: unknown) { return error instanceof AccountError ? json({ message: error.message }, error.status) : json({ message: "Unable to complete this account request. Please try again." }, 503); }
export async function GET(request: Request) {
  if (!isAuthConfigured()) return json({ message: "Account settings are temporarily unavailable." }, 503);
  try { return json(await getAccountSettings(request.headers)); } catch (error) { return safeError(error); }
}
export async function POST(request: Request) {
  if (!isAuthConfigured()) return json({ message: "Account settings are temporarily unavailable." }, 503);
  if (request.headers.get("origin") !== new URL(getAuthEnvironment().APP_URL).origin || request.headers.get("sec-fetch-site") === "cross-site") return json({ message: "This request could not be accepted." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ message: "Check the form and try again." }, 400);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ message: "Check the form and try again." }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 16384) { await reader.cancel(); return json({ message: "This request is too large." }, 413); } chunks.push(value); }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return json({ message: "Check the form and try again." }, 400); }
    const parsed = accountMutationSchema.safeParse(value);
    if (!parsed.success) return json({ message: "Check the form and try again." }, 400);
    const native = await mutateAccount(request.headers, parsed.data, getIP(request, getAuth().options) || "unknown");
    if (native && !native.ok) return json({ message: parsed.data.action === "password" ? "Unable to change your password. Check your current password and try again." : "Unable to update your account. Please sign in again and retry." }, native.status === 401 ? 401 : 400);
    const response = json({ ok: true });
    // Native password change rotates the current session. Only its HttpOnly
    // cookies reach the browser; the native JSON token/user payload is discarded.
    for (const cookie of native?.headers.getSetCookie() ?? []) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) { return safeError(error); }
}
