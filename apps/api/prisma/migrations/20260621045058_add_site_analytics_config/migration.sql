-- CreateTable
CREATE TABLE "site_analytics_configs" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "property_id" TEXT NOT NULL,
    "service_account_ciphertext" TEXT NOT NULL,
    "service_account_iv" TEXT NOT NULL,
    "service_account_auth_tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_analytics_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_analytics_configs_site_id_key" ON "site_analytics_configs"("site_id");

-- AddForeignKey
ALTER TABLE "site_analytics_configs" ADD CONSTRAINT "site_analytics_configs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
