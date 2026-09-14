ALTER TABLE "ProofResponse"
ADD CONSTRAINT "ProofResponse_approved_requires_statement_check"
CHECK (
  "type" <> 'APPROVED'
  OR "approvalStatementSnapshot" IS NOT NULL
);