-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "allowed_origins" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60;
