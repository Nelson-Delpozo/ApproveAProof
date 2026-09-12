-- Add recipient snapshot fields as nullable first so existing Proof rows
-- can be populated safely.
ALTER TABLE "Proof"
ADD COLUMN "recipientEmail" TEXT,
ADD COLUMN "recipientName" TEXT;

-- Snapshot the current Customer identity onto each existing Proof.
-- These values become historical Proof data and will survive future
-- Customer edits or deletion.
UPDATE "Proof" AS p
SET
  "recipientName" = c."name",
  "recipientEmail" = c."email"
FROM "Customer" AS c
WHERE p."customerId" = c."id";

-- Every existing Proof should now have a recipient name.
-- Making this NOT NULL also acts as a safety check: the migration
-- will fail here if any Proof could not be backfilled.
ALTER TABLE "Proof"
ALTER COLUMN "recipientName" SET NOT NULL;

-- Replace the required Customer relationship with an optional one.
ALTER TABLE "Proof"
DROP CONSTRAINT "Proof_customerId_fkey";

ALTER TABLE "Proof"
ALTER COLUMN "customerId" DROP NOT NULL;

-- Deleting a Customer now removes only the live relationship.
-- Historical recipient snapshots remain on the Proof.
ALTER TABLE "Proof"
ADD CONSTRAINT "Proof_customerId_fkey"
FOREIGN KEY ("customerId")
REFERENCES "Customer"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;