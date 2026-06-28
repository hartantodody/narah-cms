-- CreateTable
CREATE TABLE "content_entry_revisions" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ContentEntryStatus" NOT NULL,
    "data" JSONB NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_entry_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_entry_revisions_entry_id_created_at_idx" ON "content_entry_revisions"("entry_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_entry_revisions_entry_id_version_key" ON "content_entry_revisions"("entry_id", "version");

-- AddForeignKey
ALTER TABLE "content_entry_revisions" ADD CONSTRAINT "content_entry_revisions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entry_revisions" ADD CONSTRAINT "content_entry_revisions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
