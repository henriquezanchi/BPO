-- Pedido de participação ligado ao GAF escolhido pelo aluno (pedido do usuário 2026-10-25).
ALTER TABLE "GafRequest" ADD COLUMN "classGroupId" TEXT;
CREATE INDEX "GafRequest_classGroupId_idx" ON "GafRequest"("classGroupId");
ALTER TABLE "GafRequest" ADD CONSTRAINT "GafRequest_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
