-- Core authoring metadata; existing event rows remain unchanged.
ALTER TABLE "Event"
  ADD COLUMN "shortDescription" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "locationName" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "onlineUrl" TEXT;
