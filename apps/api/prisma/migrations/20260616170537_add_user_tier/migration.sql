-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tier" "UserTier" NOT NULL DEFAULT 'FREE';
