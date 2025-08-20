/*
  Warnings:

  - A unique constraint covering the columns `[sessionId,questionId,userId]` on the table `interview_answers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sessionId,order]` on the table `interview_questions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."interview_sessions" ADD COLUMN     "gradedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "interview_answers_createdAt_idx" ON "public"."interview_answers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "interview_answers_sessionId_questionId_userId_key" ON "public"."interview_answers"("sessionId", "questionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_questions_sessionId_order_key" ON "public"."interview_questions"("sessionId", "order");
