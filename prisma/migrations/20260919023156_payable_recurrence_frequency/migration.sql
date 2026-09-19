-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'semestral', 'anual');

-- AlterTable
ALTER TABLE "Payable" ADD COLUMN     "recurrenceFrequency" "RecurrenceFrequency";
