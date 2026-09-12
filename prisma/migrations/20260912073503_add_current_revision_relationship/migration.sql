/*
  Warnings:

  - A unique constraint covering the columns `[id,currentRevisionId]` on the table `Proof` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[proofId,id]` on the table `Revision` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Proof" ADD COLUMN     "currentRevisionId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Proof_id_currentRevisionId_key" ON "Proof"("id", "currentRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Revision_proofId_id_key" ON "Revision"("proofId", "id");

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_id_currentRevisionId_fkey" FOREIGN KEY ("id", "currentRevisionId") REFERENCES "Revision"("proofId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
