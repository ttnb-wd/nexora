CREATE TABLE "EventCollection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" VARCHAR(60) NOT NULL,
  "normalizedName" VARCHAR(180) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "EventCollection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventCollection_name_check" CHECK (char_length("name") BETWEEN 1 AND 60 AND btrim("name") = "name" AND "normalizedName" = lower("name"))
);
CREATE UNIQUE INDEX "EventCollection_userId_normalizedName_key" ON "EventCollection"("userId", "normalizedName");
CREATE UNIQUE INDEX "EventCollection_id_userId_key" ON "EventCollection"("id", "userId");
ALTER TABLE "EventCollection" ADD CONSTRAINT "EventCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventCollectionMembership" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventCollectionMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventCollectionMembership_collectionId_eventId_key" ON "EventCollectionMembership"("collectionId", "eventId");
CREATE INDEX "EventCollectionMembership_userId_eventId_idx" ON "EventCollectionMembership"("userId", "eventId");
ALTER TABLE "EventCollectionMembership" ADD CONSTRAINT "EventCollectionMembership_collectionId_userId_fkey" FOREIGN KEY ("collectionId", "userId") REFERENCES "EventCollection"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventCollectionMembership" ADD CONSTRAINT "EventCollectionMembership_userId_eventId_fkey" FOREIGN KEY ("userId", "eventId") REFERENCES "EventBookmark"("userId", "eventId") ON DELETE CASCADE ON UPDATE CASCADE;
