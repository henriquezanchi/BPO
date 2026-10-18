-- Grupos além de turmas (Brigada Feminina/Masculina, Corpo de Segurança),
-- canal do Slack vinculado e o tipo "aviso" de atividade.
ALTER TABLE "ClassGroup" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'turma';
ALTER TABLE "ClassGroup" ADD COLUMN "slackChannelId" TEXT;
ALTER TABLE "ClassGroup" ADD COLUMN "slackTeamId" TEXT;
ALTER TYPE "ActivityType" ADD VALUE 'aviso';
