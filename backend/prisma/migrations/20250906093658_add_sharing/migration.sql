-- CreateTable
CREATE TABLE "ScheduleShare" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "sharedWithUserId" INTEGER NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleShare_scheduleId_sharedWithUserId_key" ON "ScheduleShare"("scheduleId", "sharedWithUserId");

-- AddForeignKey
ALTER TABLE "ScheduleShare" ADD CONSTRAINT "ScheduleShare_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "DaySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleShare" ADD CONSTRAINT "ScheduleShare_sharedWithUserId_fkey" FOREIGN KEY ("sharedWithUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
