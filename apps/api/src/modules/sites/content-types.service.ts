import type { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { HttpError } from '../../utils/http-error'
import type { AuthenticatedRequestUser } from '../auth/auth.types'
import { canAccessSite, canManageSite } from './sites.authorization'
import type {
  CreateContentFieldInput,
  CreateContentTypeInput,
  ListContentTypesQuery,
  ReorderContentFieldsInput,
  ReplaceContentTypeInput,
  UpdateContentFieldInput,
  UpdateContentTypeInput
} from './content-types.schemas'
import {
  getContentFieldConfigIssues,
  normalizeContentApiId
} from './content-types.schemas'
import {
  analyzeFieldChange,
  isTypeChangeCoercible,
  renameGroupChildKeyInEntries,
  snapshotEntriesForContentType,
  type ImpactAnalysis,
  type ProposedFieldChange
} from './schema-change-safety'

const contentFieldSelect = {
  id: true,
  label: true,
  apiId: true,
  type: true,
  description: true,
  required: true,
  localized: true,
  isList: true,
  sortOrder: true,
  config: true,
  validation: true,
  defaultValue: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ContentFieldSelect

const contentTypeListSelect = {
  id: true,
  name: true,
  apiId: true,
  description: true,
  isSingleton: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      fields: true,
      entries: true
    }
  }
} satisfies Prisma.ContentTypeSelect

const contentTypeDetailSelect = {
  id: true,
  name: true,
  apiId: true,
  description: true,
  isSingleton: true,
  createdAt: true,
  updatedAt: true,
  fields: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: contentFieldSelect
  }
} satisfies Prisma.ContentTypeSelect

type ContentTypeListRecord = Prisma.ContentTypeGetPayload<{
  select: typeof contentTypeListSelect
}>

type ContentFieldRecord = Prisma.ContentFieldGetPayload<{
  select: typeof contentFieldSelect
}>

type ContentTypeDetailRecord = Prisma.ContentTypeGetPayload<{
  select: typeof contentTypeDetailSelect
}>

const isPrismaUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'P2002'

const ensureSiteExists = async (siteId: string) => {
  const site = await prisma.site.findUnique({
    where: {
      id: siteId
    },
    select: {
      id: true
    }
  })

  if (!site) {
    throw new HttpError({
      message: 'Site not found',
      statusCode: 404,
      code: 'SITE_NOT_FOUND'
    })
  }
}

const ensureSiteAccess = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  await ensureSiteExists(siteId)

  const hasAccess = await canAccessSite(user, siteId)

  if (!hasAccess) {
    throw new HttpError({
      message: 'You do not have access to this site',
      statusCode: 403,
      code: 'FORBIDDEN'
    })
  }
}

const ensureSchemaManageAccess = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  await ensureSiteExists(siteId)

  if (user.isSuperAdmin) return
  if (await canManageSite(user, siteId)) return

  throw new HttpError({
    message: 'Only site owners, admins, and super admins can manage content types',
    statusCode: 403,
    code: 'FORBIDDEN'
  })
}

const getContentTypeApiIdTakenError = () =>
  new HttpError({
    message: 'This content type apiId is already in use for this site',
    statusCode: 409,
    code: 'CONTENT_TYPE_API_ID_TAKEN'
  })

const getContentFieldApiIdTakenError = () =>
  new HttpError({
    message: 'This field apiId is already in use for this content type',
    statusCode: 409,
    code: 'CONTENT_FIELD_API_ID_TAKEN'
  })

const serializeContentField = (field: ContentFieldRecord) => ({
  id: field.id,
  label: field.label,
  apiId: field.apiId,
  type: field.type,
  description: field.description,
  required: field.required,
  localized: field.localized,
  isList: field.isList,
  sortOrder: field.sortOrder,
  config: field.config,
  validation: field.validation,
  defaultValue: field.defaultValue,
  createdAt: field.createdAt,
  updatedAt: field.updatedAt
})

const serializeContentTypeListItem = (contentType: ContentTypeListRecord) => ({
  id: contentType.id,
  name: contentType.name,
  apiId: contentType.apiId,
  description: contentType.description,
  isSingleton: contentType.isSingleton,
  fieldCount: contentType._count.fields,
  entryCount: contentType._count.entries,
  createdAt: contentType.createdAt,
  updatedAt: contentType.updatedAt
})

const serializeContentTypeDetail = (contentType: ContentTypeDetailRecord) => ({
  id: contentType.id,
  name: contentType.name,
  apiId: contentType.apiId,
  description: contentType.description,
  isSingleton: contentType.isSingleton,
  fields: contentType.fields.map(serializeContentField),
  createdAt: contentType.createdAt,
  updatedAt: contentType.updatedAt
})

const resolveContentTypeApiId = ({
  name,
  apiId
}: {
  name: string
  apiId?: string
}) => {
  const normalizedApiId = normalizeContentApiId({
    value: apiId ?? name,
    fallbackPrefix: 'content_type'
  })

  if (!normalizedApiId) {
    throw new HttpError({
      message: 'apiId is invalid after normalization',
      statusCode: 400,
      code: 'INVALID_CONTENT_TYPE_API_ID'
    })
  }

  return normalizedApiId
}

const resolveContentFieldApiId = ({
  label,
  apiId
}: {
  label: string
  apiId?: string
}) => {
  const normalizedApiId = normalizeContentApiId({
    value: apiId ?? label,
    fallbackPrefix: 'field'
  })

  if (!normalizedApiId) {
    throw new HttpError({
      message: 'apiId is invalid after normalization',
      statusCode: 400,
      code: 'INVALID_CONTENT_FIELD_API_ID'
    })
  }

  return normalizedApiId
}

const ensureContentTypeApiIdIsAvailable = async ({
  siteId,
  apiId,
  excludeContentTypeId
}: {
  siteId: string
  apiId: string
  excludeContentTypeId?: string
}) => {
  const existingContentType = await prisma.contentType.findFirst({
    where: {
      siteId,
      apiId,
      ...(excludeContentTypeId
        ? {
            id: {
              not: excludeContentTypeId
            }
          }
        : {})
    },
    select: {
      id: true
    }
  })

  if (existingContentType) {
    throw getContentTypeApiIdTakenError()
  }
}

const ensureContentFieldApiIdIsAvailable = async ({
  contentTypeId,
  apiId,
  excludeFieldId
}: {
  contentTypeId: string
  apiId: string
  excludeFieldId?: string
}) => {
  const existingField = await prisma.contentField.findFirst({
    where: {
      contentTypeId,
      apiId,
      ...(excludeFieldId
        ? {
            id: {
              not: excludeFieldId
            }
          }
        : {})
    },
    select: {
      id: true
    }
  })

  if (existingField) {
    throw getContentFieldApiIdTakenError()
  }
}

const getContentTypeDetailRecord = async ({
  siteId,
  contentTypeId
}: {
  siteId: string
  contentTypeId: string
}) => {
  const contentType = await prisma.contentType.findFirst({
    where: {
      id: contentTypeId,
      siteId
    },
    select: contentTypeDetailSelect
  })

  if (!contentType) {
    throw new HttpError({
      message: 'Content type not found',
      statusCode: 404,
      code: 'CONTENT_TYPE_NOT_FOUND'
    })
  }

  return contentType
}

const getContentTypeMinimalRecord = async ({
  siteId,
  contentTypeId
}: {
  siteId: string
  contentTypeId: string
}) => {
  const contentType = await prisma.contentType.findFirst({
    where: {
      id: contentTypeId,
      siteId
    },
    select: {
      id: true,
      name: true,
      apiId: true,
      description: true,
      isSingleton: true,
      createdAt: true,
      updatedAt: true
    }
  })

  if (!contentType) {
    throw new HttpError({
      message: 'Content type not found',
      statusCode: 404,
      code: 'CONTENT_TYPE_NOT_FOUND'
    })
  }

  return contentType
}

const getContentFieldRecord = async ({
  siteId,
  contentTypeId,
  fieldId
}: {
  siteId: string
  contentTypeId: string
  fieldId: string
}) => {
  const field = await prisma.contentField.findFirst({
    where: {
      id: fieldId,
      contentTypeId,
      contentType: {
        siteId
      }
    },
    select: contentFieldSelect
  })

  if (!field) {
    throw new HttpError({
      message: 'Content field not found',
      statusCode: 404,
      code: 'CONTENT_FIELD_NOT_FOUND'
    })
  }

  return field
}

const getOrderedFieldIds = async ({
  contentTypeId,
  tx = prisma
}: {
  contentTypeId: string
  tx?: Prisma.TransactionClient | typeof prisma
}) => {
  const fields = await tx.contentField.findMany({
    where: {
      contentTypeId
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true
    }
  })

  return fields.map((field) => field.id)
}

const toPrismaJsonValue = (value: unknown) =>
  value as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined

const applyFieldOrder = async ({
  tx,
  orderedFieldIds
}: {
  tx: Prisma.TransactionClient
  orderedFieldIds: string[]
}) => {
  await Promise.all(
    orderedFieldIds.map((fieldId, index) =>
      tx.contentField.update({
        where: {
          id: fieldId
        },
        data: {
          sortOrder: index
        }
      })
    )
  )
}

const validateFieldConfigOrThrow = ({
  type,
  config
}: {
  type: ContentFieldRecord['type']
  config?: Record<string, unknown> | null
}) => {
  const issues = getContentFieldConfigIssues({
    type,
    config: config as Record<string, never> | null | undefined
  })

  if (issues.length > 0) {
    throw new HttpError({
      message: 'Invalid request body',
      statusCode: 400,
      issues
    })
  }
}

export const listContentTypesForUser = async ({
  user,
  siteId,
  query
}: {
  user: AuthenticatedRequestUser
  siteId: string
  query: ListContentTypesQuery
}) => {
  await ensureSiteAccess(user, siteId)

  const contentTypes = await prisma.contentType.findMany({
    where: {
      siteId,
      ...(query.search
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                apiId: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              }
            ]
          }
        : {})
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: contentTypeListSelect
  })

  return {
    contentTypes: contentTypes.map(serializeContentTypeListItem)
  }
}

export const createContentTypeForUser = async ({
  user,
  siteId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  input: CreateContentTypeInput
}) => {
  await ensureSchemaManageAccess(user, siteId)

  const name = input.name.trim()
  const apiId = resolveContentTypeApiId({
    name,
    apiId: input.apiId
  })

  await ensureContentTypeApiIdIsAvailable({
    siteId,
    apiId
  })

  try {
    const contentType = await prisma.contentType.create({
      data: {
        siteId,
        name,
        apiId,
        description: input.description ?? null,
        isSingleton: input.isSingleton ?? false,
        createdById: user.id
      },
      select: contentTypeDetailSelect
    })

    return {
      contentType: serializeContentTypeDetail(contentType)
    }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw getContentTypeApiIdTakenError()
    }

    throw error
  }
}

export const getContentTypeByIdForUser = async ({
  user,
  siteId,
  contentTypeId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
}) => {
  await ensureSiteAccess(user, siteId)

  const contentType = await getContentTypeDetailRecord({
    siteId,
    contentTypeId
  })

  return {
    contentType: serializeContentTypeDetail(contentType)
  }
}

export const updateContentTypeForUser = async ({
  user,
  siteId,
  contentTypeId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  input: UpdateContentTypeInput
}) => {
  await ensureSchemaManageAccess(user, siteId)

  const currentContentType = await getContentTypeMinimalRecord({
    siteId,
    contentTypeId
  })

  const data: Prisma.ContentTypeUpdateInput = {}

  if (input.name !== undefined) {
    data.name = input.name.trim()
  }

  if (input.apiId !== undefined) {
    const apiId = resolveContentTypeApiId({
      name: input.name?.trim() ?? currentContentType.name,
      apiId: input.apiId
    })

    if (apiId !== currentContentType.apiId) {
      await ensureContentTypeApiIdIsAvailable({
        siteId,
        apiId,
        excludeContentTypeId: contentTypeId
      })
    }

    data.apiId = apiId
  }

  if (input.description !== undefined) {
    data.description = input.description
  }

  if (input.isSingleton !== undefined) {
    data.isSingleton = input.isSingleton
  }

  try {
    const contentType =
      Object.keys(data).length === 0
        ? await getContentTypeDetailRecord({
            siteId,
            contentTypeId
          })
        : await prisma.contentType.update({
            where: {
              id: contentTypeId
            },
            data,
            select: contentTypeDetailSelect
          })

    return {
      contentType: serializeContentTypeDetail(contentType)
    }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw getContentTypeApiIdTakenError()
    }

    throw error
  }
}

export const deleteContentTypeForUser = async ({
  user,
  siteId,
  contentTypeId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
}) => {
  await ensureSchemaManageAccess(user, siteId)

  const contentType = await prisma.contentType.findFirst({
    where: {
      id: contentTypeId,
      siteId
    },
    select: {
      id: true,
      _count: {
        select: {
          entries: true
        }
      }
    }
  })

  if (!contentType) {
    throw new HttpError({
      message: 'Content type not found',
      statusCode: 404,
      code: 'CONTENT_TYPE_NOT_FOUND'
    })
  }

  if (contentType._count.entries > 0) {
    throw new HttpError({
      message: 'Content type has entries and cannot be deleted',
      statusCode: 409,
      code: 'CONTENT_TYPE_HAS_ENTRIES'
    })
  }

  await prisma.contentType.delete({
    where: {
      id: contentType.id
    }
  })

  return {
    ok: true
  }
}

export const createContentFieldForUser = async ({
  user,
  siteId,
  contentTypeId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  input: CreateContentFieldInput
}) => {
  await ensureSchemaManageAccess(user, siteId)
  await getContentTypeMinimalRecord({
    siteId,
    contentTypeId
  })

  validateFieldConfigOrThrow({
    type: input.type,
    config: input.config as Record<string, unknown> | null | undefined
  })

  const label = input.label.trim()
  const apiId = resolveContentFieldApiId({
    label,
    apiId: input.apiId
  })

  await ensureContentFieldApiIdIsAvailable({
    contentTypeId,
    apiId
  })

  try {
    const currentFieldIds = await getOrderedFieldIds({
      contentTypeId
    })
    const requestedIndex =
      input.sortOrder === undefined
        ? currentFieldIds.length
        : Math.max(0, Math.min(input.sortOrder, currentFieldIds.length))

    const field = await prisma.$transaction(async (tx) => {
      const createdField = await tx.contentField.create({
        data: {
          contentTypeId,
          label,
          apiId,
          type: input.type,
          description: input.description ?? null,
          required: input.required ?? false,
          localized: input.localized ?? false,
          isList: input.isList ?? false,
          sortOrder: currentFieldIds.length,
          config:
            input.config === undefined
              ? undefined
              : toPrismaJsonValue(input.config),
          validation:
            input.validation === undefined
              ? undefined
              : toPrismaJsonValue(input.validation),
          defaultValue:
            input.defaultValue === undefined
              ? undefined
              : toPrismaJsonValue(input.defaultValue)
        },
        select: contentFieldSelect
      })

      const orderedFieldIds = [...currentFieldIds]
      orderedFieldIds.splice(requestedIndex, 0, createdField.id)

      await applyFieldOrder({
        tx,
        orderedFieldIds
      })

      return tx.contentField.findUniqueOrThrow({
        where: {
          id: createdField.id
        },
        select: contentFieldSelect
      })
    })

    return {
      field: serializeContentField(field)
    }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw getContentFieldApiIdTakenError()
    }

    throw error
  }
}

/**
 * Pull a flat list of children defs out of a GROUP field's config.children.
 * Tolerant of missing keys — anything malformed is just skipped.
 */
const extractGroupChildrenFromConfig = (
  config: unknown
): Array<{ apiId: string; label: string; type: string }> => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return []
  const raw = (config as { children?: unknown }).children
  if (!Array.isArray(raw)) return []
  const out: Array<{ apiId: string; label: string; type: string }> = []
  for (const child of raw) {
    if (!child || typeof child !== 'object' || Array.isArray(child)) continue
    const c = child as Record<string, unknown>
    if (typeof c.apiId !== 'string' || typeof c.type !== 'string') continue
    out.push({
      apiId: c.apiId,
      label: typeof c.label === 'string' ? c.label : c.apiId,
      type: c.type
    })
  }
  return out
}

export const updateContentFieldForUser = async ({
  user,
  siteId,
  contentTypeId,
  fieldId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  fieldId: string
  input: UpdateContentFieldInput
}) => {
  await ensureSchemaManageAccess(user, siteId)
  await getContentTypeMinimalRecord({
    siteId,
    contentTypeId
  })

  const currentField = await getContentFieldRecord({
    siteId,
    contentTypeId,
    fieldId
  })

  const nextType = input.type ?? currentField.type
  const nextConfig =
    input.config !== undefined
      ? input.config
      : (currentField.config as Record<string, unknown> | null | undefined)

  validateFieldConfigOrThrow({
    type: nextType,
    config: nextConfig as Record<string, unknown> | null | undefined
  })

  const data: Prisma.ContentFieldUpdateInput = {}

  if (input.label !== undefined) {
    data.label = input.label.trim()
  }

  if (input.apiId !== undefined) {
    const apiId = resolveContentFieldApiId({
      label: input.label?.trim() ?? currentField.label,
      apiId: input.apiId
    })

    if (apiId !== currentField.apiId) {
      await ensureContentFieldApiIdIsAvailable({
        contentTypeId,
        apiId,
        excludeFieldId: fieldId
      })
    }

    data.apiId = apiId
  }

  if (input.type !== undefined) {
    data.type = input.type
  }

  if (input.description !== undefined) {
    data.description = input.description
  }

  if (input.required !== undefined) {
    data.required = input.required
  }

  if (input.localized !== undefined) {
    data.localized = input.localized
  }

  if (input.isList !== undefined) {
    data.isList = input.isList
  }

  if (input.config !== undefined) {
    data.config = toPrismaJsonValue(input.config)
  }

  if (input.validation !== undefined) {
    data.validation = toPrismaJsonValue(input.validation)
  }

  if (input.defaultValue !== undefined) {
    data.defaultValue = toPrismaJsonValue(input.defaultValue)
  }

  const isListChanging =
    input.isList !== undefined && input.isList !== currentField.isList
  const apiIdChanging =
    data.apiId !== undefined && data.apiId !== currentField.apiId
  const typeChanging =
    input.type !== undefined && input.type !== currentField.type
  const requiredTightening =
    input.required === true && currentField.required === false

  // Type changes that can't be safely coerced are hard-rejected here.
  // The admin sees this as a 400 before any snapshot or DB write.
  if (typeChanging && !isTypeChangeCoercible(currentField.type, input.type!)) {
    throw new HttpError({
      message: `Type change from ${currentField.type} to ${input.type} is not safely coercible. Delete this field and create a new one (or export-import data manually) to avoid silent data loss.`,
      statusCode: 400,
      code: 'SCHEMA_CHANGE_NOT_COERCIBLE'
    })
  }

  // Detect renamed children inside a GROUP. Match old↔new by position
  // (UI emits children in order). A pair where label/type stayed but
  // apiId differs is treated as a rename and triggers per-child data
  // migration plus a snapshot.
  const groupChildRenames: Array<{ oldApiId: string; newApiId: string }> = []
  if (currentField.type === 'GROUP' && input.config) {
    const oldChildren = extractGroupChildrenFromConfig(currentField.config)
    const newChildren = extractGroupChildrenFromConfig(
      input.config as Record<string, unknown> | null | undefined
    )
    const len = Math.min(oldChildren.length, newChildren.length)
    for (let i = 0; i < len; i++) {
      const o = oldChildren[i]
      const n = newChildren[i]
      if (
        o.apiId !== n.apiId &&
        o.type === n.type &&
        o.label === n.label
      ) {
        groupChildRenames.push({ oldApiId: o.apiId, newApiId: n.apiId })
      }
    }
  }

  // Any change that touches the data shape gets a pre-flight snapshot so
  // admins can restore from /revisions if a migration goes sideways.
  const isRiskyChange =
    isListChanging ||
    apiIdChanging ||
    typeChanging ||
    requiredTightening ||
    groupChildRenames.length > 0

  try {
    const updatedField = await prisma.$transaction(async (tx) => {
      if (isRiskyChange) {
        await snapshotEntriesForContentType(tx, {
          contentTypeId,
          authorId: user.id,
          reason: `pre-schema-change:field:${currentField.apiId}`
        })
      }
      for (const { oldApiId, newApiId } of groupChildRenames) {
        await renameGroupChildKeyInEntries(tx, {
          contentTypeId,
          groupApiId: currentField.apiId,
          oldChildApiId: oldApiId,
          newChildApiId: newApiId
        })
      }
      const field =
        Object.keys(data).length === 0
          ? currentField
          : await tx.contentField.update({
              where: {
                id: fieldId
              },
              data,
              select: contentFieldSelect
            })

      // When isList toggles or the apiId is renamed, migrate the JSON shape
      // of every existing entry so previously stored values don't get wiped
      // by the next save's validator.
      if (isListChanging || apiIdChanging) {
        const entries = await tx.contentEntry.findMany({
          where: { contentTypeId },
          select: { id: true, data: true }
        })

        const oldKey = currentField.apiId
        const newKey = (data.apiId as string | undefined) ?? oldKey
        const toList = input.isList === true
        const toScalar = input.isList === false

        for (const entry of entries) {
          const raw =
            entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data)
              ? { ...(entry.data as Record<string, unknown>) }
              : ({} as Record<string, unknown>)

          let current = raw[oldKey]
          if (apiIdChanging) {
            delete raw[oldKey]
          }

          if (toList) {
            const empty = current === undefined || current === null || current === ''
            current = empty
              ? []
              : Array.isArray(current)
                ? current
                : [current]
          } else if (toScalar) {
            if (Array.isArray(current)) {
              current = current.length > 0 ? current[0] : null
            }
          }

          raw[newKey] = current as unknown

          await tx.contentEntry.update({
            where: { id: entry.id },
            data: { data: raw as Prisma.InputJsonValue }
          })
        }
      }

      if (input.sortOrder !== undefined) {
        const currentFieldIds = await getOrderedFieldIds({
          contentTypeId,
          tx
        })
        const filteredFieldIds = currentFieldIds.filter((id) => id !== fieldId)
        const nextIndex = Math.max(
          0,
          Math.min(input.sortOrder, filteredFieldIds.length)
        )

        filteredFieldIds.splice(nextIndex, 0, fieldId)

        await applyFieldOrder({
          tx,
          orderedFieldIds: filteredFieldIds
        })

        return tx.contentField.findUniqueOrThrow({
          where: {
            id: fieldId
          },
          select: contentFieldSelect
        })
      }

      return field
    })

    return {
      field: serializeContentField(updatedField)
    }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw getContentFieldApiIdTakenError()
    }

    throw error
  }
}

export const analyzeContentFieldChangeForUser = async ({
  user,
  siteId,
  contentTypeId,
  fieldId,
  proposed
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  fieldId: string
  proposed: ProposedFieldChange
}): Promise<ImpactAnalysis> => {
  await ensureSchemaManageAccess(user, siteId)
  await getContentTypeMinimalRecord({ siteId, contentTypeId })
  const field = await getContentFieldRecord({ siteId, contentTypeId, fieldId })

  return analyzeFieldChange({
    contentTypeId,
    field: {
      apiId: field.apiId,
      type: field.type,
      required: field.required,
      isList: field.isList
    },
    proposed
  })
}

export const deleteContentFieldForUser = async ({
  user,
  siteId,
  contentTypeId,
  fieldId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  fieldId: string
}) => {
  await ensureSchemaManageAccess(user, siteId)
  await getContentTypeMinimalRecord({
    siteId,
    contentTypeId
  })
  const fieldRecord = await getContentFieldRecord({
    siteId,
    contentTypeId,
    fieldId
  })

  await prisma.$transaction(async (tx) => {
    // Pre-flight snapshot — delete is destructive, JSON keeps the data
    // under the old apiId but the field gone means no UI ever sees it.
    // The snapshot lets admins recover full entry state if needed.
    await snapshotEntriesForContentType(tx, {
      contentTypeId,
      authorId: user.id,
      reason: `pre-schema-change:field-delete:${fieldRecord.apiId}`
    })
    await tx.contentField.delete({
      where: {
        id: fieldId
      }
    })

    const remainingFieldIds = await tx.contentField.findMany({
      where: {
        contentTypeId
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true
      }
    })

    await applyFieldOrder({
      tx,
      orderedFieldIds: remainingFieldIds.map((field) => field.id)
    })
  })

  return {
    ok: true
  }
}

export const reorderContentFieldsForUser = async ({
  user,
  siteId,
  contentTypeId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  input: ReorderContentFieldsInput
}) => {
  await ensureSchemaManageAccess(user, siteId)
  await getContentTypeMinimalRecord({
    siteId,
    contentTypeId
  })

  const currentFieldIds = await getOrderedFieldIds({
    contentTypeId
  })
  const nextFieldIds = input.fieldIds
  const uniqueNextFieldIds = new Set(nextFieldIds)

  const hasExactMembership =
    nextFieldIds.length === currentFieldIds.length &&
    uniqueNextFieldIds.size === currentFieldIds.length &&
    currentFieldIds.every((fieldId) => uniqueNextFieldIds.has(fieldId))

  if (!hasExactMembership) {
    throw new HttpError({
      message: 'Invalid field order payload',
      statusCode: 400,
      issues: [
        'fieldIds must include every field for this content type exactly once.'
      ]
    })
  }

  await prisma.$transaction(async (tx) => {
    await applyFieldOrder({
      tx,
      orderedFieldIds: nextFieldIds
    })
  })

  return {
    ok: true
  }
}

/* ────────────────────────────────────────────────────────────── */
/* Schema replace — used by the Code-tab editor                  */
/* ────────────────────────────────────────────────────────────── */

/**
 * Atomically replace the entire schema (metadata + fields) for a content
 * type. The diff key for fields is `apiId`:
 *   - matching apiId  → update field with new values + sortOrder
 *   - new apiId       → create field with given values
 *   - missing apiId   → delete field
 *
 * Runs in a transaction so a failure partway leaves the schema untouched.
 */
export const replaceContentTypeForUser = async ({
  user,
  siteId,
  contentTypeId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  input: ReplaceContentTypeInput
}) => {
  await ensureSchemaManageAccess(user, siteId)
  await getContentTypeMinimalRecord({ siteId, contentTypeId })

  // Resolve and validate the content type apiId. If the caller submits a
  // different apiId, make sure it's still unique within the site.
  const nextContentTypeApiId = resolveContentTypeApiId({
    name: input.name,
    apiId: input.apiId
  })
  await ensureContentTypeApiIdIsAvailable({
    siteId,
    apiId: nextContentTypeApiId,
    excludeContentTypeId: contentTypeId
  })

  // Pre-validate each field's config against its type. Doing this outside the
  // transaction means we short-circuit cleanly on bad input.
  const normalizedFields = input.fields.map((field, index) => {
    const resolvedApiId = resolveContentFieldApiId({
      label: field.label,
      apiId: field.apiId
    })
    validateFieldConfigOrThrow({
      type: field.type,
      config: field.config ?? null
    })
    return {
      sortOrder: index,
      ...field,
      apiId: resolvedApiId
    }
  })

  // Ensure normalized apiIds are still unique after slug normalization.
  const seenApiIds = new Set<string>()
  for (const field of normalizedFields) {
    if (seenApiIds.has(field.apiId)) {
      throw new HttpError({
        message: 'Duplicate field apiId after normalization',
        statusCode: 400,
        code: 'CONTENT_FIELD_API_ID_TAKEN',
        issues: [`Two fields normalize to the same apiId "${field.apiId}".`]
      })
    }
    seenApiIds.add(field.apiId)
  }

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Update content type metadata.
    await tx.contentType.update({
      where: { id: contentTypeId },
      data: {
        name: input.name,
        apiId: nextContentTypeApiId,
        description: input.description ?? null,
        isSingleton: input.isSingleton
      }
    })

    // 2. Snapshot current fields by apiId so we can diff.
    const existingFields = await tx.contentField.findMany({
      where: { contentTypeId },
      select: { id: true, apiId: true }
    })
    const existingByApiId = new Map(
      existingFields.map((f) => [f.apiId, f.id])
    )
    const incomingApiIds = new Set(normalizedFields.map((f) => f.apiId))

    // 3. Delete fields whose apiId is no longer in the payload.
    const toDeleteIds = existingFields
      .filter((f) => !incomingApiIds.has(f.apiId))
      .map((f) => f.id)
    if (toDeleteIds.length > 0) {
      await tx.contentField.deleteMany({
        where: { id: { in: toDeleteIds } }
      })
    }

    // 4. Upsert each incoming field, preserving sort order.
    for (const field of normalizedFields) {
      const existingId = existingByApiId.get(field.apiId)
      const data = {
        label: field.label,
        apiId: field.apiId,
        type: field.type,
        description: field.description ?? null,
        required: field.required,
        localized: field.localized,
        isList: field.isList,
        sortOrder: field.sortOrder,
        config: toPrismaJsonValue(field.config ?? null),
        validation: toPrismaJsonValue(field.validation ?? null),
        defaultValue: toPrismaJsonValue(field.defaultValue ?? null)
      }

      if (existingId) {
        await tx.contentField.update({
          where: { id: existingId },
          data
        })
      } else {
        await tx.contentField.create({
          data: {
            ...data,
            contentTypeId
          }
        })
      }
    }

    return tx.contentType.findUniqueOrThrow({
      where: { id: contentTypeId },
      select: contentTypeDetailSelect
    })
  })

  return { contentType: serializeContentTypeDetail(updated) }
}
