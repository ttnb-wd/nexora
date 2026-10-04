import { escapeEmailHtml } from "./invitation-template";

export function authEmailTemplate(kind: "verification" | "reset", link: string) {
  const url = new URL(link);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid authentication URL.");
  const verify = kind === "verification";
  const subject = verify ? "Verify your Nexora email" : "Reset your Nexora password";
  const cta = verify ? "Verify email" : "Reset password";
  const explanation = verify ? "Confirm your email address to continue using your Nexora account." : "Choose a new password to recover access to your Nexora account.";
  const expiry = verify ? "This link expires in 24 hours." : "This link expires in 1 hour and can only be used once.";
  const security = "Keep this link private. If you did not request this email, you can safely ignore it.";
  const href = escapeEmailHtml(url.href);
  return { subject, text: `Nexora\n\n${subject}\n\n${explanation}\n\n${cta}:\n${url.href}\n\n${expiry}\n${security}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${subject}</title></head><body style="font-family:Arial,sans-serif;background:#f8f9fc;color:#30283e;padding:24px"><main style="max-width:520px;margin:auto;background:white;padding:28px;border-radius:16px"><p style="font-weight:bold;color:#683db3">Nexora</p><h1>${subject}</h1><p>${explanation}</p><p style="margin:28px 0"><a href="${href}" style="background:#683db3;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">${cta}</a></p><p>${expiry}</p><p>If the button does not work, copy this URL:</p><p style="overflow-wrap:anywhere"><a href="${href}">${href}</a></p><p>${security}</p></main></body></html>` };
}
