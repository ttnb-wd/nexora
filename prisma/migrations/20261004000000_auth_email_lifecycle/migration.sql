-- Preserve existing access without falsely verifying any email address.
ALTER TABLE "User" ADD COLUMN "verificationRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "verificationRequired" SET DEFAULT true;
