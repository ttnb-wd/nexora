CREATE TYPE "NotificationType" AS ENUM ('EVENT_PUBLISHED', 'EVENT_UPDATED', 'EVENT_CANCELLED', 'REGISTRATION_CONFIRMED', 'REGISTRATION_CANCELLED', 'SYSTEM');

CREATE TABLE "OrganizationFollower" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationFollower_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationFollower_userId_organizationId_key" ON "OrganizationFollower"("userId", "organizationId");
CREATE INDEX "OrganizationFollower_organizationId_idx" ON "OrganizationFollower"("organizationId");
CREATE INDEX "OrganizationFollower_userId_createdAt_idx" ON "OrganizationFollower"("userId", "createdAt");
ALTER TABLE "OrganizationFollower" ADD CONSTRAINT "OrganizationFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationFollower" ADD CONSTRAINT "OrganizationFollower_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT NOT NULL,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
