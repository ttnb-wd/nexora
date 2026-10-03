CREATE TYPE "InvitationRole" AS ENUM ('ADMIN', 'EDITOR', 'MEMBER');
CREATE TABLE "OrganizationInvitation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "InvitationRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invitedById" TEXT,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "acceptedAt" TIMESTAMPTZ(3),
  "declinedAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OrganizationInvitation_normalized_email" CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "OrganizationInvitation_one_terminal_state" CHECK (num_nonnulls("acceptedAt", "declinedAt", "revokedAt") <= 1)
);
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");
CREATE INDEX "OrganizationInvitation_organizationId_email_idx" ON "OrganizationInvitation"("organizationId", "email");
-- Expired open invitations are revoked transactionally before replacement.
CREATE UNIQUE INDEX "OrganizationInvitation_open_email_key" ON "OrganizationInvitation"("organizationId", "email") WHERE "acceptedAt" IS NULL AND "declinedAt" IS NULL AND "revokedAt" IS NULL;
