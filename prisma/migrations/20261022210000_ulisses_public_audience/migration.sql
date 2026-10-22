-- Repair upcoming public Ulisses events imported before `publicos` was stored.
-- Restrict by source, published status, legacy audience, and empty audience list
-- so internal or manually restricted events are left unchanged.
UPDATE "Event"
SET "publicos" = ARRAY['todos_ativos']::TEXT[]
WHERE "source" = 'ulisses'
  AND "status" = 'publicado'
  AND "audience" = 'todos_ativos'
  AND "publicos" = ARRAY[]::TEXT[]
  AND "startsAt" >= CURRENT_TIMESTAMP - INTERVAL '1 day';
