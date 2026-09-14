-- CreateEnum
CREATE TYPE "ProofDispatchType" AS ENUM ('INITIAL_PROOF', 'REVISION', 'REMINDER', 'APPROVAL_CONFIRMATION', 'CHANGE_REQUEST_NOTIFICATION');

-- CreateEnum
CREATE TYPE "ProofDispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "ProofDispatch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "proofId" UUID NOT NULL,
    "revisionId" UUID,
    "type" "ProofDispatchType" NOT NULL,
    "status" "ProofDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProofDispatch_organizationId_idx" ON "ProofDispatch"("organizationId");

-- CreateIndex
CREATE INDEX "ProofDispatch_proofId_idx" ON "ProofDispatch"("proofId");

-- CreateIndex
CREATE INDEX "ProofDispatch_revisionId_idx" ON "ProofDispatch"("revisionId");

-- CreateIndex
CREATE INDEX "ProofDispatch_status_idx" ON "ProofDispatch"("status");

-- CreateIndex
CREATE INDEX "ProofDispatch_scheduledAt_idx" ON "ProofDispatch"("scheduledAt");

-- AddForeignKey
ALTER TABLE "ProofDispatch" ADD CONSTRAINT "ProofDispatch_proofId_organizationId_fkey" FOREIGN KEY ("proofId", "organizationId") REFERENCES "Proof"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofDispatch" ADD CONSTRAINT "ProofDispatch_organizationId_proofId_revisionId_fkey" FOREIGN KEY ("organizationId", "proofId", "revisionId") REFERENCES "Revision"("organizationId", "proofId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
