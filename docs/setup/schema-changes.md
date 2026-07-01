# Schema-change safety

Editing a content type's schema after entries exist is one of the highest-
risk moves an admin can make in a CMS. Narah runs a layered defense so
the common cases are self-serving and the risky ones surface a warning
before anything ships. This page catalogs what's safe, what needs care,
and what the system does automatically.

---

## Change categories

### ✅ Always safe

- **Add a new scalar field** — existing entries just lack the new key; the
  validator fills it with `null` (or `[]` for list fields) on next save.
- **Rename a field's label / description** — cosmetic only.
- **Reorder fields** — no data touched.
- **Toggle `localized`** — no data touched (localization stub, no shape
  change yet).

### 🟡 Safe with auto-migration

The API rewrites entry JSON in-place inside the same transaction as the
schema change. A pre-flight snapshot lands first so you can rewind from
the revisions panel if anything looks off.

- **Rename `apiId`** — the value at `data.oldApiId` moves to
  `data.newApiId` for every entry in the content type.
- **Toggle `isList`** — scalar ↔ single-element array. Wrapping and
  unwrapping preserves the value.
- **Rename a GROUP child's `apiId`** (label + type unchanged) — nested
  keys inside `data.<group>` (or each item of a list-group) rename the
  same way.

### 🟠 Safe but surfaces an impact preview

The API accepts these but the admin shows a confirm modal with a count
of affected entries + a per-entry preview before it lets you commit.

- **Delete a field** — the JSON keeps the value (recoverable from
  snapshot) but the UI stops rendering it.
- **Tighten `required` from false to true** — existing entries with a
  null value can no longer publish until edited.
- **Coercible type change** — see the matrix below.

### 🔴 Hard-blocked

The API returns `400 SCHEMA_CHANGE_NOT_COERCIBLE` and refuses. The admin
sees this as a blocking reason in the impact preview.

- **Uncoercible type change** — e.g. `TEXT → MEDIA`, `BOOLEAN → DATE`.
  Fix: delete the field and create a new one (or export data, adjust
  offline, re-import).
- **Turning a GROUP into a scalar / other type** — GROUP only coerces
  into GROUP.

---

## Type coercion matrix

Source → set of allowed targets. Everything not in the set is blocked.

| Source | Allowed targets |
|---|---|
| `TEXT` | `TEXT`, `RICH_TEXT`, `NUMBER`, `SELECT` |
| `RICH_TEXT` | `RICH_TEXT`, `TEXT` |
| `NUMBER` | `NUMBER`, `TEXT` |
| `BOOLEAN` | `BOOLEAN`, `TEXT` |
| `DATE` | `DATE`, `DATETIME` |
| `DATETIME` | `DATETIME`, `DATE` |
| `MEDIA` | `MEDIA` |
| `JSON` | `JSON` |
| `SELECT` | `SELECT`, `MULTI_SELECT`, `TEXT` |
| `MULTI_SELECT` | `MULTI_SELECT`, `SELECT` |
| `RELATION` | `RELATION` |
| `GROUP` | `GROUP` |

The matrix is intentionally conservative. If you need a coercion we
don't allow, do it offline (export → transform → re-import) rather than
letting the runtime guess.

---

## Snapshot lifecycle

Every risky change writes a `ContentEntryRevision` row per entry, tagged
with `reason = 'pre-schema-change:<what>'` (e.g.
`pre-schema-change:field:title` or `pre-schema-change:field-delete:body`).

- Snapshots survive the retention window that normal revisions use — a
  user editing an entry 10× after the schema change won't push these
  out. They stay accessible from the revisions panel.
- To restore, open the entry → Revisions → find the row tagged with
  `pre-schema-change:*` → restore. Post-restore behavior follows the
  usual "rewind" semantics (forward revisions after the target are
  dropped).
- Snapshots are per-entry, not per-content-type. Every entry of the
  content type gets one, so a partial restore is possible.

---

## Practical workflows

### Rename a field

Just do it. The API migrates data + snapshots. Zero prep needed.

### Change a field's type (coercible)

1. Save the change from the field form.
2. Impact preview surfaces: total entries + a warning if the type change
   might lose some values (e.g. non-numeric strings when going
   `TEXT → NUMBER`).
3. Confirm to apply. Snapshot lands.
4. Existing entries display via the new type on next open; values that
   don't fit fall back to `null` and the entry becomes invalid to
   publish until edited.

### Change a field's type (uncoercible)

Not allowed as a single edit. Recipe:

1. Export the affected entries (public delivery API works).
2. Delete the field.
3. Add the new field with the new type.
4. Re-import data after transforming it offline.

### Delete a field

1. Click Delete on the field row.
2. Impact preview loads. If any entry has a value, it's shown as "at
   risk" (data will not be visible in the UI after delete, but it's in
   the snapshot).
3. Confirm. All entries get a snapshot revision. The field is removed.
4. To restore data later: revert the field creation and restore each
   entry from the `pre-schema-change:field-delete:*` snapshot.

### Rework a GROUP's children

- Renaming a child's `apiId` (keeping type + label) auto-migrates
  nested data.
- Adding a new child is safe — existing items get null for it.
- Deleting a child is a data-loss change. Do the same "export → drop
  → recreate" dance you would for a scalar delete when the data is
  important.
- Reordering children is safe.

---

## What's NOT built (yet)

- **Soft-deleted fields** — the `ContentField.deprecated_at` column
  exists as scaffolding but isn't wired into queries yet. When it is,
  field deletion becomes reversible without a snapshot restore.
- **Impact preview for GROUP child changes** — the endpoint only
  analyzes top-level field changes. GROUP child renames still get an
  automatic snapshot, but you won't see a preview modal for them.
- **Bulk revert of pre-schema-change snapshots** — restoring today is
  one-entry-at-a-time via the revisions panel. A "restore all entries
  from snapshot X" tool is a follow-up.

---

## Testing

Automated coverage in `apps/api/test/content.test.ts` under
`Schema-change safety — …`:

- `rename of a field apiId migrates all entry data + leaves a
  recoverable snapshot`
- `coercible type change (TEXT → NUMBER) is allowed`
- `uncoercible type change (TEXT → MEDIA) is rejected with 400
  SCHEMA_CHANGE_NOT_COERCIBLE`
- `impact analysis — rename is non-destructive`
- `impact analysis — delete flags entries with values as at-risk`
- `impact analysis — uncoercible type swap surfaces blockingReason`
- `impact analysis — tightening required flags null-value entries`

Run with `bun test test/content.test.ts` in `apps/api`.
