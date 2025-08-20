-- CreateEnum
CREATE TYPE "public"."InterviewCategory" AS ENUM ('TECHNICAL', 'PROJECTS', 'BEHAVIORAL');

-- CreateEnum
CREATE TYPE "public"."InterviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."interview_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeText" TEXT,
    "status" "public"."InterviewStatus" NOT NULL DEFAULT 'PENDING',
    "totalScore" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."interview_questions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "category" "public"."InterviewCategory" NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."interview_answers" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "aiFeedback" TEXT,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_sessions_userId_idx" ON "public"."interview_sessions"("userId");

-- CreateIndex
CREATE INDEX "interview_sessions_status_idx" ON "public"."interview_sessions"("status");

-- CreateIndex
CREATE INDEX "interview_sessions_createdAt_idx" ON "public"."interview_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "interview_questions_sessionId_idx" ON "public"."interview_questions"("sessionId");

-- CreateIndex
CREATE INDEX "interview_answers_sessionId_idx" ON "public"."interview_answers"("sessionId");

-- CreateIndex
CREATE INDEX "interview_answers_questionId_idx" ON "public"."interview_answers"("questionId");

-- CreateIndex
CREATE INDEX "interview_answers_userId_idx" ON "public"."interview_answers"("userId");

-- AddForeignKey
ALTER TABLE "public"."interview_sessions" ADD CONSTRAINT "interview_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."interview_questions" ADD CONSTRAINT "interview_questions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."interview_answers" ADD CONSTRAINT "interview_answers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."interview_answers" ADD CONSTRAINT "interview_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."interview_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."interview_answers" ADD CONSTRAINT "interview_answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
