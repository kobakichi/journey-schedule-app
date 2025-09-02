-- CreateTable
CREATE TABLE "DaySchedule" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DaySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT,
    "color" TEXT DEFAULT '#FFD1DC',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DaySchedule_date_key" ON "DaySchedule"("date");

-- CreateIndex
CREATE INDEX "ScheduleItem_scheduleId_startTime_idx" ON "ScheduleItem"("scheduleId", "startTime");

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "DaySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
