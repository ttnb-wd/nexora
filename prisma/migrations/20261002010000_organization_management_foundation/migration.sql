-- Optional organization metadata is collected gradually; preserve all existing values.
ALTER TABLE "Organization"
  ALTER COLUMN "shortName" DROP NOT NULL,
  ALTER COLUMN "description" DROP NOT NULL,
  ALTER COLUMN "industry" DROP NOT NULL,
  ALTER COLUMN "city" DROP NOT NULL,
  ALTER COLUMN "region" DROP NOT NULL,
  ALTER COLUMN "visualTheme" DROP NOT NULL,
  ALTER COLUMN "logoVariant" DROP NOT NULL;
