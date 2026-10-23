CREATE TABLE "AcropolePlayStudent" (
  "sourceStudentId" TEXT PRIMARY KEY,
  "emailHash" TEXT NOT NULL,
  "nameHash" TEXT NOT NULL,
  "loginCiphertext" TEXT NOT NULL,
  "mercurioId" TEXT,
  "mercurioUnit" TEXT,
  "reconciliationStatus" TEXT NOT NULL CHECK ("reconciliationStatus" IN ('matched_active','pending_no_active','pending_ambiguous','pending_name')),
  "mercurioSnapshotAt" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AcropolePlayStudent_emailHash_idx" ON "AcropolePlayStudent"("emailHash");
CREATE INDEX "AcropolePlayStudent_mercurioId_idx" ON "AcropolePlayStudent"("mercurioId");
CREATE TABLE "AcropolePlayAccess" (
  "memberId" TEXT PRIMARY KEY REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sourceStudentId" TEXT NOT NULL UNIQUE REFERENCES "AcropolePlayStudent"("sourceStudentId") ON DELETE CASCADE ON UPDATE CASCADE,
  "emailHash" TEXT NOT NULL,
  "loginCiphertext" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AcropolePlayConfig" (
  "id" BOOLEAN PRIMARY KEY DEFAULT true CHECK ("id"),
  "enabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "AcropolePlayConfig" DEFAULT VALUES;
ALTER TABLE "AcropolePlayStudent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcropolePlayAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcropolePlayConfig" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "AcropolePlayStudent", "AcropolePlayAccess", "AcropolePlayConfig" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "AcropolePlayStudent", "AcropolePlayAccess", "AcropolePlayConfig" TO service_role;

-- Chave gerada e protegida no Vault; nunca vai para o frontend/config pública.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='acropole_play_encryption_key') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'base64'), 'acropole_play_encryption_key', 'Credenciais individuais da Acrópole Play');
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.acropole_play_chave() RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='acropole_play_encryption_key' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.acropole_play_chave() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acropole_play_chave() TO service_role;
