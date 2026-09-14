/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,proofId,id]` on the table `Revision` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProofResponseType" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "ProofResponse" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "proofId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "type" "ProofResponseType" NOT NULL,
    "responderName" TEXT NOT NULL,
    "responderEmail" TEXT,
    "comments" TEXT,
    "approvalStatementSnapshot" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProofResponse_organizationId_idx" ON "ProofResponse"("organizationId");

-- CreateIndex
CREATE INDEX "ProofResponse_proofId_idx" ON "ProofResponse"("proofId");

-- CreateIndex
CREATE INDEX "ProofResponse_revisionId_idx" ON "ProofResponse"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Revision_organizationId_proofId_id_key" ON "Revision"("organizationId", "proofId", "id");

-- AddForeignKey
ALTER TABLE "ProofResponse" ADD CONSTRAINT "ProofResponse_organizationId_proofId_revisionId_fkey" FOREIGN KEY ("organizationId", "proofId", "revisionId") REFERENCES "Revision"("organizationId", "proofId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
