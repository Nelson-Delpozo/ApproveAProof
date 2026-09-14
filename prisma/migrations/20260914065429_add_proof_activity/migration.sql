-- CreateEnum
CREATE TYPE "ProofActivityType" AS ENUM ('PROOF_CREATED', 'REVISION_CREATED', 'REVISION_READY', 'PROOF_SENT', 'PROOF_VIEWED', 'CHANGES_REQUESTED', 'PROOF_APPROVED', 'REMINDER_SENT', 'PROOF_CANCELED', 'REVIEW_LINK_REGENERATED');

-- CreateTable
CREATE TABLE "ProofActivity" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "proofId" UUID NOT NULL,
    "type" "ProofActivityType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProofActivity_organizationId_idx" ON "ProofActivity"("organizationId");

-- CreateIndex
CREATE INDEX "ProofActivity_proofId_idx" ON "ProofActivity"("proofId");

-- CreateIndex
CREATE INDEX "ProofActivity_proofId_createdAt_idx" ON "ProofActivity"("proofId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProofActivity" ADD CONSTRAINT "ProofActivity_proofId_organizationId_fkey" FOREIGN KEY ("proofId", "organizationId") REFERENCES "Proof"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
