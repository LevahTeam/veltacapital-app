-- AlterTable
ALTER TABLE "User" ADD COLUMN     "advancedUnlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasBadge" BOOLEAN NOT NULL DEFAULT false;
