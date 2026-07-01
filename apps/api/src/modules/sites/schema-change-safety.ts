import {
  ContentFieldType,
  type ContentEntryStatus,
  type Prisma
} from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'

/* ────────────────────────────────────────────────────────────────────────── */
/*  Schema-change safety helpers                                              */
/*                                                                            */
/*  Anything that mutates a field's shape (apiId / type / isList / required   */
/*  / GROUP children) goes through here first so we can:                      */
/*  - snapshot every affected entry into a recoverable revision               */
/*  - auto-migrate entry data where it's safe (apiId rename, isList toggle)   */
/*  - reject changes we can't make safely (uncoercible type swaps)            */
/*  - compute a preview of impact so the admin can show a confirm modal       */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Per-entry-type coercion matrix. Maps SOURCE → set of TARGETS that we
 * believe we can coerce existing data into without losing meaning.
 *
 * Anything NOT in the source's allow-set is hard-rejected with an error
 * that tells the editor to delete the field and create a new one (or
 * export/import data manually) — same pattern Postgres uses for non-
 * castable column type changes.
 */
const TYPE_COERCION: Record<ContentFieldType, ReadonlySet<ContentFieldType>> = {
  TEXT: new Set([
    ContentFieldType.TEXT,
    ContentFieldType.RICH_TEXT,
    ContentFieldType.NUMBER,
    ContentFieldType.SELECT
  ]),
  RICH_TEXT: new Set([ContentFieldType.RICH_TEXT, ContentFieldType.TEXT]),
  NUMBER: new Set([ContentFieldType.NUMBER, ContentFieldType.TEXT]),
  BOOLEAN: new Set([ContentFieldType.BOOLEAN, ContentFieldType.TEXT]),
  DATE: new Set([ContentFieldType.DATE, ContentFieldType.DATETIME]),
  DATETIME: new Set([ContentFieldType.DATETIME, ContentFieldType.DATE]),
  MEDIA: new Set([ContentFieldType.MEDIA]),
  JSON: new Set([ContentFieldType.JSON]),
  SELECT: new Set([
    ContentFieldType.SELECT,
    ContentFieldType.MULTI_SELECT,
    ContentFieldType.TEXT
  ]),
  MULTI_SELECT: new Set([
    ContentFieldType.MULTI_SELECT,
    ContentFieldType.SELECT
  ]),
  RELATION: new Set([ContentFieldType.RELATION]),
  GROUP: new Set([ContentFieldType.GROUP])
}

export const isTypeChangeCoercible = (
  from: ContentFieldType,
  to: ContentFieldType
): boolean => TYPE_COERCION[from].has(to)

/* ────────────────────────────────────────────────────────────────────────── */
/*  Snapshotting                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Snapshot every entry of a content type into a recoverable revision row
 * tagged with `reason`. Caller passes the same transaction client the
 * schema mutation runs in so snapshot + mutation are atomic — either both
 * land or neither does, no orphaned snapshots.
 *
 * Pruning is suspended on purpose for these system snapshots — they exist
 * so admins can rewind if a schema change goes wrong; we don't want them
 * silently disappearing because the entry had 10 recent edits.
 */
export const snapshotEntriesForContentType = async (
  tx: Prisma.TransactionClient,
  args: {
    contentTypeId: string
    authorId: string
    reason: string
  }
): Promise<number> => {
  const entries = await tx.contentEntry.findMany({
    where: { contentTypeId: args.contentTypeId },
    select: { id: true, version: true, status: true, data: true }
  })
  if (entries.length === 0) return 0
  // For each entry, ensure a revision exists at the current [entryId,
  // version] AND is tagged with our reason. Entry creation already
  // seeds a revision at v=1 with reason=null, so on the first schema
  // change we normally just re-tag it; on subsequent changes, if that
  // revision is already tagged, we leave the earliest tag intact.
  let touched = 0
  for (const entry of entries) {
    const existing = await tx.contentEntryRevision.findFirst({
      where: { entryId: entry.id, version: entry.version }
    })
    if (existing) {
      if (existing.reason === null) {
        await tx.contentEntryRevision.update({
          where: { id: existing.id },
          data: { reason: args.reason }
        })
        touched += 1
      }
      continue
    }
    await tx.contentEntryRevision.create({
      data: {
        entryId: entry.id,
        version: entry.version,
        status: entry.status as ContentEntryStatus,
        data: entry.data as Prisma.InputJsonValue,
        authorId: args.authorId,
        reason: args.reason
      }
    })
    touched += 1
  }
  return touched
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auto-migration: rename a field's apiId across all entries                 */
/* ────────────────────────────────────────────────────────────────────────── */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Rewrite each entry's JSON so the value previously stored under `oldApiId`
 * is now stored under `newApiId`. Idempotent — if `newApiId` already has a
 * value (rare), the old key is dropped and the existing new value wins.
 * Does nothing when the field's apiId hasn't actually changed.
 */
export const renameFieldKeyInEntries = async (
  tx: Prisma.TransactionClient,
  args: {
    contentTypeId: string
    oldApiId: string
    newApiId: string
  }
): Promise<number> => {
  if (args.oldApiId === args.newApiId) return 0
  const entries = await tx.contentEntry.findMany({
    where: { contentTypeId: args.contentTypeId },
    select: { id: true, data: true }
  })
  let migrated = 0
  for (const entry of entries) {
    if (!isPlainObject(entry.data)) continue
    if (!(args.oldApiId in entry.data)) continue
    const next = { ...entry.data }
    if (!(args.newApiId in next)) {
      next[args.newApiId] = next[args.oldApiId]
    }
    delete next[args.oldApiId]
    await tx.contentEntry.update({
      where: { id: entry.id },
      data: { data: next as Prisma.InputJsonValue }
    })
    migrated += 1
  }
  return migrated
}

/**
 * Same idea but for a rename INSIDE a GROUP field's items. Each item is
 * an object that uses the child's apiId as a key. Handles both singleton
 * groups (`data.gallery = {...}`) and list groups (`data.gallery = [{...}]`).
 */
export const renameGroupChildKeyInEntries = async (
  tx: Prisma.TransactionClient,
  args: {
    contentTypeId: string
    groupApiId: string
    oldChildApiId: string
    newChildApiId: string
  }
): Promise<number> => {
  if (args.oldChildApiId === args.newChildApiId) return 0
  const entries = await tx.contentEntry.findMany({
    where: { contentTypeId: args.contentTypeId },
    select: { id: true, data: true }
  })
  let migrated = 0

  const renameItem = (item: unknown): unknown => {
    if (!isPlainObject(item)) return item
    if (!(args.oldChildApiId in item)) return item
    const next = { ...item }
    if (!(args.newChildApiId in next)) {
      next[args.newChildApiId] = next[args.oldChildApiId]
    }
    delete next[args.oldChildApiId]
    return next
  }

  for (const entry of entries) {
    if (!isPlainObject(entry.data)) continue
    const group = entry.data[args.groupApiId]
    if (group === undefined) continue
    let nextGroup: unknown
    if (Array.isArray(group)) {
      const mapped = group.map(renameItem)
      if (mapped.every((v, i) => v === group[i])) continue
      nextGroup = mapped
    } else {
      const renamed = renameItem(group)
      if (renamed === group) continue
      nextGroup = renamed
    }
    const next = { ...entry.data, [args.groupApiId]: nextGroup }
    await tx.contentEntry.update({
      where: { id: entry.id },
      data: { data: next as Prisma.InputJsonValue }
    })
    migrated += 1
  }
  return migrated
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Impact analysis — preview before a schema change is committed             */
/* ────────────────────────────────────────────────────────────────────────── */

export type ProposedFieldChange = {
  apiId?: string
  type?: ContentFieldType
  required?: boolean
  isList?: boolean
  /** When true, the change is a delete (UI mutation, not a real Prisma delete). */
  deleted?: boolean
}

export type ImpactedEntry = {
  id: string
  slug: string | null
  status: ContentEntryStatus
  /** True when this entry currently has a value for the field in question. */
  hasValue: boolean
  /** True when the proposed change would lose this entry's value. */
  willLoseData: boolean
}

export type ImpactAnalysis = {
  totalEntries: number
  /** How many entries actually carry a value for this field today. */
  entriesWithValue: number
  /** Subset of entriesWithValue whose values can't be safely carried over. */
  entriesAtRisk: number
  /** Capped sample of entries for the UI to render. */
  sample: ImpactedEntry[]
  /** Hard error — change is not allowed (e.g. uncoercible type swap). */
  blockingReason: string | null
}

const SAMPLE_LIMIT = 20

/**
 * Given the field's current shape and a proposed change, scan every entry
 * of the content type and report:
 *   - how many entries are affected at all
 *   - how many would lose data if the change went through
 *   - a capped sample for the UI to display
 *   - a hard blocker (with explanation) if we refuse to do the change
 *
 * Does NOT mutate anything. Safe to call from a preview endpoint.
 */
export const analyzeFieldChange = async (args: {
  contentTypeId: string
  field: {
    apiId: string
    type: ContentFieldType
    required: boolean
    isList: boolean
  }
  proposed: ProposedFieldChange
}): Promise<ImpactAnalysis> => {
  const nextType = args.proposed.type ?? args.field.type
  const nextRequired = args.proposed.required ?? args.field.required

  let blockingReason: string | null = null
  if (
    args.proposed.type &&
    args.proposed.type !== args.field.type &&
    !isTypeChangeCoercible(args.field.type, args.proposed.type)
  ) {
    blockingReason =
      `Type change from ${args.field.type} to ${args.proposed.type} is not safely coercible. ` +
      `Delete this field and create a new one (or export-import data manually) to avoid silent data loss.`
  }

  const entries = await prisma.contentEntry.findMany({
    where: { contentTypeId: args.contentTypeId },
    select: {
      id: true,
      slug: true,
      status: true,
      data: true
    },
    orderBy: { updatedAt: 'desc' }
  })

  let entriesWithValue = 0
  let entriesAtRisk = 0
  const sample: ImpactedEntry[] = []

  for (const entry of entries) {
    const data = isPlainObject(entry.data) ? entry.data : {}
    const raw = data[args.field.apiId]
    const hasValue =
      raw !== undefined &&
      raw !== null &&
      !(typeof raw === 'string' && raw.length === 0) &&
      !(Array.isArray(raw) && raw.length === 0)

    let willLoseData = false
    if (args.proposed.deleted) {
      willLoseData = hasValue
    } else if (args.proposed.type && args.proposed.type !== args.field.type) {
      willLoseData = hasValue && !isTypeChangeCoercible(args.field.type, nextType)
    } else if (nextRequired && !args.field.required && !hasValue) {
      // Making a field required when it was optional doesn't lose data,
      // but it does block these entries from publishing. Flag at-risk.
      willLoseData = true
    } else if (
      args.proposed.isList !== undefined &&
      args.proposed.isList !== args.field.isList
    ) {
      // isList toggle has a migration path (wrap/unwrap), so data isn't
      // lost — just reshaped. Not at-risk.
      willLoseData = false
    }

    if (hasValue) entriesWithValue += 1
    if (willLoseData) entriesAtRisk += 1
    if (sample.length < SAMPLE_LIMIT && (hasValue || willLoseData)) {
      sample.push({
        id: entry.id,
        slug: entry.slug,
        status: entry.status,
        hasValue,
        willLoseData
      })
    }
  }

  return {
    totalEntries: entries.length,
    entriesWithValue,
    entriesAtRisk,
    sample,
    blockingReason
  }
}
