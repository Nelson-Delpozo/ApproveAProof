-- Add organizationId as nullable first so existing Revision rows can be backfilled.
ALTER TABLE "Revision"
ADD COLUMN "organizationId" UUID;

-- Backfill each Revision from the organization that owns its Proof.
UPDATE "Revision" AS r
SET "organizationId" = p."organizationId"
FROM "Proof" AS p
WHERE r."proofId" = p."id";

-- Now that every existing Revision has tenant ownership, make it required.
ALTER TABLE "Revision"
ALTER COLUMN "organizationId" SET NOT NULL;

-- Allow the composite Revision -> Proof foreign key to reference this pair.
CREATE UNIQUE INDEX "Proof_id_organizationId_key"
ON "Proof"("id", "organizationId");

-- Support direct tenant-scoped Revision queries.
CREATE INDEX "Revision_organizationId_idx"
ON "Revision"("organizationId");

-- Add the direct Revision -> Organization relationship.
ALTER TABLE "Revision"
ADD CONSTRAINT "Revision_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Replace the old proofId-only relationship with the tenant-aware composite relationship.
ALTER TABLE "Revision"
DROP CONSTRAINT "Revision_proofId_fkey";

ALTER TABLE "Revision"
ADD CONSTRAINT "Revision_proofId_organizationId_fkey"
FOREIGN KEY ("proofId", "organizationId")
REFERENCES "Proof"("id", "organizationId")
ON DELETE CASCADE
ON UPDATE CASCADE;