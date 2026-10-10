-- DropForeignKey
ALTER TABLE "Proof" DROP CONSTRAINT "Proof_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ProofActivity" DROP CONSTRAINT "ProofActivity_proofId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ProofDispatch" DROP CONSTRAINT "ProofDispatch_proofId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Revision" DROP CONSTRAINT "Revision_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Revision" DROP CONSTRAINT "Revision_proofId_organizationId_fkey";

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_proofId_organizationId_fkey" FOREIGN KEY ("proofId", "organizationId") REFERENCES "Proof"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofActivity" ADD CONSTRAINT "ProofActivity_proofId_organizationId_fkey" FOREIGN KEY ("proofId", "organizationId") REFERENCES "Proof"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofDispatch" ADD CONSTRAINT "ProofDispatch_proofId_organizationId_fkey" FOREIGN KEY ("proofId", "organizationId") REFERENCES "Proof"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
