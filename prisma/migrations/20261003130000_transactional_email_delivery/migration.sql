ALTER TABLE "OrganizationInvitation"
  ADD COLUMN "emailSentAt" TIMESTAMPTZ(3),
  ADD COLUMN "emailProviderMessageId" TEXT,
  ADD COLUMN "emailLastAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "emailSendAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "emailFailureCategory" TEXT;
