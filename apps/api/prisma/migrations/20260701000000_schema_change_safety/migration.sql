-- Soft-delete scaffolding for content fields. Populated by the future
-- soft-delete flow; column added now so we don't need another migration
-- when that lands.
ALTER TABLE "content_fields" ADD COLUMN "deprecated_at" TIMESTAMP(3);

-- Free-form tag for non-user snapshots (e.g. 'pre-schema-change:apiId').
-- Null for regular user edits.
ALTER TABLE "content_entry_revisions" ADD COLUMN "reason" TEXT;
