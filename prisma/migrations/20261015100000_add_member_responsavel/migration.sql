-- Pedido do usuário 2026-10-15: quando um Member divide e-mail com outro
-- (ex: filho usando e-mail do pai), o responsável tem o login, o
-- dependente só fica vinculado a ele.
ALTER TABLE "Member" ADD COLUMN "responsavelId" TEXT;
ALTER TABLE "Member" ADD CONSTRAINT "Member_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Member_responsavelId_idx" ON "Member"("responsavelId");
