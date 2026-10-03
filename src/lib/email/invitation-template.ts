export type InvitationEmailContent = { organizationName: string; role: string; inviterName?: string | null; expiresAt: Date; invitationUrl: string };
export const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const singleLine = (value: string) => value.replace(/[\r\n\u0000-\u001f\u007f]/g, " ").trim();

export function organizationInvitationTemplate(content: InvitationEmailContent) {
  const name = singleLine(content.organizationName);
  const inviter = content.inviterName ? singleLine(content.inviterName) : "An organization administrator";
  const role = singleLine(content.role);
  const expiry = content.expiresAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const url = new URL(content.invitationUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !/^\/invitations\/[A-Za-z0-9_-]{43}$/.test(url.pathname) || url.search || url.hash) throw new Error("Invalid invitation URL.");
  const href = escapeEmailHtml(url.href);
  const security = "This private link is intended for the invited email address. Do not forward it. Sign in with that address to accept. If you did not expect this invitation, you can ignore it.";
  return {
    subject: `You’re invited to join ${name} on Nexora`,
    text: `Nexora\n\n${inviter} invited you to join ${name}.\nInvited role: ${role}\nExpires: ${expiry}\n\nAccept invitation:\n${url.href}\n\n${security}\n\nYou received this transactional email because an administrator invited you to their organization on Nexora.`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nexora invitation</title></head><body style="margin:0;background:#f6f7f9;color:#182234;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px"><div style="max-width:560px;margin:auto;background:white;padding:28px;border-radius:12px"><p style="font-size:22px;font-weight:bold;color:#315dd7">Nexora</p><h1 style="font-size:24px;line-height:1.3">Join ${escapeEmailHtml(name)}</h1><p style="line-height:1.6">${escapeEmailHtml(inviter)} invited you to join ${escapeEmailHtml(name)}.</p><p>Invited role: <strong>${escapeEmailHtml(role)}</strong><br>Expires: ${escapeEmailHtml(expiry)}</p><p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:#315dd7;color:white;padding:14px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Accept invitation</a></p><p style="font-size:14px">If the button does not work, copy this URL:</p><p style="font-size:13px;overflow-wrap:anywhere;word-break:break-all"><a href="${href}">${href}</a></p><p style="font-size:13px;line-height:1.6">${escapeEmailHtml(security)}</p><hr style="border:0;border-top:1px solid #e4e7ec"><p style="font-size:12px;line-height:1.6;color:#626c7b">You received this transactional email because an administrator invited you to their organization on Nexora.</p></div></td></tr></table></body></html>`,
  };
}
