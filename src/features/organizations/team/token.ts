import { createHash, randomBytes } from "node:crypto";
export const normalizeTeamEmail = (email: string) => email.trim().toLowerCase();
export const validInvitationToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
export const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function newInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}
