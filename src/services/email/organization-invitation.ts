import "server-only";
import { organizationInvitationTemplate, type InvitationEmailContent } from "../../lib/email/invitation-template";
import { sendTransactionalEmail } from "../../lib/email/transport";
export async function sendOrganizationInvitationEmail(content: InvitationEmailContent & { email: string; invitationId: string }) {
  return sendTransactionalEmail({ to: content.email, ...organizationInvitationTemplate(content), idempotencyKey: `organization-invitation/${content.invitationId}` });
}
