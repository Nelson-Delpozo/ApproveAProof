CREATE OR REPLACE FUNCTION "enforce_proof_customer_tenant_integrity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."customerId" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM "Customer"
       WHERE "id" = NEW."customerId"
         AND "organizationId" = NEW."organizationId"
     )
  THEN
    RAISE EXCEPTION
      'Proof customer must belong to the same organization as the proof'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Proof_customer_tenant_integrity_insert"
BEFORE INSERT ON "Proof"
FOR EACH ROW
EXECUTE FUNCTION "enforce_proof_customer_tenant_integrity"();

CREATE TRIGGER "Proof_customer_tenant_integrity_update"
BEFORE UPDATE OF "organizationId", "customerId" ON "Proof"
FOR EACH ROW
EXECUTE FUNCTION "enforce_proof_customer_tenant_integrity"();