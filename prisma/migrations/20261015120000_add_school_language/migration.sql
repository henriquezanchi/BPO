-- Pedido do usuário 2026-10-15: idioma do Portal do Membro decidido pela
-- escola (sem seletor manual) — "pt" (padrão) ou "en", pras filiais
-- americanas vistas na Mercury API.
ALTER TABLE "School" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'pt';
