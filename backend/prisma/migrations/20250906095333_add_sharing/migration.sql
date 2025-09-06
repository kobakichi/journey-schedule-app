-- CreateTable
CREATE TABLE "ScheduleShareInvite" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleShareInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleShareInvite_token_key" ON "ScheduleShareInvite"("token");

-- CreateIndex
CREATE INDEX "ScheduleShareInvite_scheduleId_idx" ON "ScheduleShareInvite"("scheduleId");

-- AddForeignKey
ALTER TABLE "ScheduleShareInvite" ADD CONSTRAINT "ScheduleShareInvite_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "DaySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleShareInvite" ADD CONSTRAINT "ScheduleShareInvite_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
