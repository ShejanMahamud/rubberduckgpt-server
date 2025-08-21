-- CreateTable
CREATE TABLE "public"."plan_limits" (
    "id" TEXT NOT NULL,
    "plan" "public"."Plan" NOT NULL,
    "maxInterviews" INTEGER NOT NULL DEFAULT 10,
    "maxChatMessages" INTEGER NOT NULL DEFAULT 100,
    "maxResumeUploads" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_limits_plan_key" ON "public"."plan_limits"("plan");

-- CreateIndex
CREATE INDEX "plan_limits_plan_idx" ON "public"."plan_limits"("plan");
