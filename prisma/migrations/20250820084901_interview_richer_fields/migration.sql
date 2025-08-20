-- CreateEnum
CREATE TYPE "public"."AnswerSource" AS ENUM ('TEXT', 'AUDIO');

-- AlterTable
ALTER TABLE "public"."interview_answers" ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "source" "public"."AnswerSource" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "transcriptionMeta" JSONB;

-- AlterTable
ALTER TABLE "public"."interview_sessions" ADD COLUMN     "questionCount" INTEGER,
ADD COLUMN     "resumeMime" TEXT,
ADD COLUMN     "resumeName" TEXT;
