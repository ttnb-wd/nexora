ALTER TABLE "EventRegistration"
ADD COLUMN "ticketTokenHash" TEXT,
ADD COLUMN "ticketNonce" TEXT,
ADD COLUMN "ticketIssuedAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "EventRegistration_ticketTokenHash_key" ON "EventRegistration"("ticketTokenHash");
