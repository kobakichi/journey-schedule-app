-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('GENERAL', 'MOVE');

-- AlterTable
ALTER TABLE "ScheduleItem" ADD COLUMN     "arrivalPlace" TEXT,
ADD COLUMN     "departurePlace" TEXT,
ADD COLUMN     "kind" "ItemKind" NOT NULL DEFAULT 'GENERAL';
