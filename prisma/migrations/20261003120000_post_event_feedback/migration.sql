CREATE TABLE "EventFeedback" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "EventFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventFeedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "EventFeedback_comment_check" CHECK ("comment" IS NULL OR (char_length("comment") BETWEEN 1 AND 1000 AND btrim("comment") <> ''))
);
CREATE UNIQUE INDEX "EventFeedback_eventId_userId_key" ON "EventFeedback"("eventId", "userId");
CREATE INDEX "EventFeedback_userId_idx" ON "EventFeedback"("userId");
CREATE INDEX "EventFeedback_eventId_createdAt_id_idx" ON "EventFeedback"("eventId", "createdAt", "id");
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
