-- Notificações push (PWA): inscrições por aparelho e marcas de envio dos encontros.
ALTER TABLE "GroupMeeting" ADD COLUMN "lembreteEnviadoEm" TIMESTAMP(3);
ALTER TABLE "GroupMeeting" ADD COLUMN "presencaPerguntadaEm" TIMESTAMP(3);

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoEnvioEm" TIMESTAMP(3),
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_memberId_idx" ON "PushSubscription"("memberId");
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regra do projeto: toda tabela nova com RLS (o Portal acessa só pelo servidor).
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
