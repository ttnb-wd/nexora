CREATE TYPE "EventResourceType" AS ENUM ('SLIDES', 'RECORDING', 'LINK', 'NOTES', 'DOCUMENT', 'OTHER');
CREATE TABLE "EventAgendaItem" (
 "id" TEXT NOT NULL PRIMARY KEY, "eventId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
 "startAt" TIMESTAMPTZ(3) NOT NULL, "endAt" TIMESTAMPTZ(3), "locationLabel" TEXT, "sortOrder" INTEGER NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "EventAgendaItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "EventAgendaItem_time_check" CHECK ("endAt" IS NULL OR "endAt" > "startAt"),
 CONSTRAINT "EventAgendaItem_order_check" CHECK ("sortOrder" >= 0)
);
CREATE TABLE "EventSpeaker" (
 "id" TEXT NOT NULL PRIMARY KEY, "eventId" TEXT NOT NULL, "name" TEXT NOT NULL, "role" TEXT, "company" TEXT, "bio" TEXT, "imageUrl" TEXT, "sortOrder" INTEGER NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "EventSpeaker_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "EventSpeaker_order_check" CHECK ("sortOrder" >= 0)
);
CREATE TABLE "EventResource" (
 "id" TEXT NOT NULL PRIMARY KEY, "eventId" TEXT NOT NULL, "title" TEXT NOT NULL, "type" "EventResourceType" NOT NULL, "url" TEXT NOT NULL, "description" TEXT, "sortOrder" INTEGER NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "EventResource_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "EventResource_order_check" CHECK ("sortOrder" >= 0)
);
CREATE UNIQUE INDEX "EventAgendaItem_eventId_sortOrder_key" ON "EventAgendaItem"("eventId", "sortOrder");
CREATE UNIQUE INDEX "EventSpeaker_eventId_sortOrder_key" ON "EventSpeaker"("eventId", "sortOrder");
CREATE UNIQUE INDEX "EventResource_eventId_sortOrder_key" ON "EventResource"("eventId", "sortOrder");
