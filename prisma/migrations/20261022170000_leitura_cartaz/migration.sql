-- Leitura do cartaz do evento (o que já está escrito nele) e qual imagem foi lida.
ALTER TABLE "Event" ADD COLUMN "cartazLeitura" JSONB;
ALTER TABLE "Event" ADD COLUMN "cartazLidoUrl" TEXT;
