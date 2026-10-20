-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isVirtual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isRealGoods" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_tenantId_isVirtual_idx" ON "orders"("tenantId", "isVirtual");
