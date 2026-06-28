import { env } from '../config/env'

const jsonSchema = (schemaName: string) => ({
  'application/json': {
    schema: {
      $ref: `#/components/schemas/${schemaName}`
    }
  }
})

const errorJsonContent = (example?: Record<string, unknown>) => ({
  'application/json': {
    schema: {
      $ref: '#/components/schemas/ErrorResponse'
    },
    ...(example ? { example } : {})
  }
})

const bearerSecurity = [{ bearerAuth: [] }]

const contentFieldTypeEnum = [
  'TEXT',
  'RICH_TEXT',
  'NUMBER',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'MEDIA',
  'JSON',
  'SELECT',
  'MULTI_SELECT',
  'RELATION'
] as const

const siteIdPathParameter = {
  in: 'path',
  name: 'siteId',
  required: true,
  schema: {
    type: 'string',
    format: 'uuid'
  }
} as const

const contentTypeIdPathParameter = {
  in: 'path',
  name: 'contentTypeId',
  required: true,
  schema: {
    type: 'string',
    format: 'uuid'
  }
} as const

const fieldIdPathParameter = {
  in: 'path',
  name: 'fieldId',
  required: true,
  schema: {
    type: 'string',
    format: 'uuid'
  }
} as const

const contentTypePaths = {
  '/sites/{siteId}/content-types': {
    get: {
      tags: ['Content Types'],
      summary: 'List site content types',
      description:
        "Returns content types for a site the current user can access. Editors and viewers can read schema definitions, while owners, admins, and super admins can manage them.",
      security: bearerSecurity,
      parameters: [
        siteIdPathParameter,
        {
          in: 'query',
          name: 'search',
          required: false,
          schema: {
            type: 'string'
          },
          description: 'Filters content types by name, apiId, or description.'
        }
      ],
      responses: {
        '200': {
          description: 'Content types returned successfully.',
          content: jsonSchema('ContentTypeListResponse')
        },
        '401': {
          description: 'Authentication is required or the token is invalid.',
          content: errorJsonContent({
            message: 'Authentication required'
          })
        },
        '403': {
          description:
            'The current user cannot access this site or must accept active policies first.',
          content: errorJsonContent({
            message: 'You do not have access to this site',
            code: 'FORBIDDEN'
          })
        },
        '404': {
          description: 'Site was not found.',
          content: errorJsonContent({
            message: 'Site not found',
            code: 'SITE_NOT_FOUND'
          })
        }
      }
    },
    post: {
      tags: ['Content Types'],
      summary: 'Create a content type',
      description:
        'Creates a reusable schema definition for a site. Only super admins and site owners/admins can manage content types.',
      security: bearerSecurity,
      parameters: [siteIdPathParameter],
      requestBody: {
        required: true,
        content: jsonSchema('CreateContentTypeRequest')
      },
      responses: {
        '201': {
          description: 'Content type created successfully.',
          content: jsonSchema('ContentTypeDetailResponse')
        },
        '400': {
          description: 'Request body validation failed.',
          content: errorJsonContent({
            message: 'Invalid request body'
          })
        },
        '401': {
          description: 'Authentication is required or the token is invalid.',
          content: errorJsonContent({
            message: 'Authentication required'
          })
        },
        '403': {
          description:
            'The current user does not have permission to manage content types for this site.',
          content: errorJsonContent({
            message: 'You do not have permission to manage content types for this site',
            code: 'FORBIDDEN'
          })
        },
        '404': {
          description: 'Site was not found.',
          content: errorJsonContent({
            message: 'Site not found',
            code: 'SITE_NOT_FOUND'
          })
        },
        '409': {
          description: 'The content type apiId is already in use for this site.',
          content: errorJsonContent({
            message: 'This content type apiId is already in use for this site',
            code: 'CONTENT_TYPE_API_ID_TAKEN'
          })
        }
      }
    }
  },
  '/sites/{siteId}/content-types/{contentTypeId}': {
    get: {
      tags: ['Content Types'],
      summary: 'Get content type detail',
      description:
        'Returns a content type and its ordered fields for a site the current user can access.',
      security: bearerSecurity,
      parameters: [siteIdPathParameter, contentTypeIdPathParameter],
      responses: {
        '200': {
          description: 'Content type returned successfully.',
          content: jsonSchema('ContentTypeDetailResponse')
        },
        '401': {
          description: 'Authentication is required or the token is invalid.',
          content: errorJsonContent({
            message: 'Authentication required'
          })
        },
        '403': {
          description:
            'The current user cannot access this site or must accept active policies first.',
          content: errorJsonContent({
            message: 'You do not have access to this site',
            code: 'FORBIDDEN'
          })
        },
        '404': {
          description: 'The site or content type was not found.',
          content: errorJsonContent({
            message: 'Content type not found',
            code: 'CONTENT_TYPE_NOT_FOUND'
          })
        }
      }
    },
    patch: {
      tags: ['Content Types'],
      summary: 'Update a content type',
      description:
        'Updates content type metadata such as name, apiId, description, and singleton mode.',
      security: bearerSecurity,
      parameters: [siteIdPathParameter, contentTypeIdPathParameter],
      requestBody: {
        required: true,
        content: jsonSchema('UpdateContentTypeRequest')
      },
      responses: {
        '200': {
          description: 'Content type updated successfully.',
          content: jsonSchema('ContentTypeDetailResponse')
        },
        '400': {
          description: 'Request body validation failed.',
          content: errorJsonContent({
            message: 'Invalid request body'
          })
        },
        '401': {
          description: 'Authentication is required or the token is invalid.',
          content: errorJsonContent({
            message: 'Authentication required'
          })
        },
        '403': {
          description:
            'The current user does not have permission to manage content types for this site.',
          content: errorJsonContent({
            message: 'You do not have permission to manage content types for this site',
            code: 'FORBIDDEN'
          })
        },
        '404': {
          description: 'The site or content type was not found.',
          content: errorJsonContent({
            message: 'Content type not found',
            code: 'CONTENT_TYPE_NOT_FOUND'
          })
        },
        '409': {
          description: 'The content type apiId is already in use for this site.',
          content: errorJsonContent({
            message: 'This content type apiId is already in use for this site',
            code: 'CONTENT_TYPE_API_ID_TAKEN'
          })
        }
      }
    },
    delete: {
      tags: ['Content Types'],
      summary: 'Delete a content type',
      description:
        'Deletes a content type when it does not have content entries yet.',
      security: bearerSecurity,
      parameters: [siteIdPathParameter, contentTypeIdPathParameter],
      responses: {
        '200': {
          description: 'Content type deleted successfully.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ok'],
                properties: {
                  ok: {
                    type: 'boolean',
                    example: true
                  }
                }
              }
            }
          }
        },
        '401': {
          description: 'Authentication is required or the token is invalid.',
          content: errorJsonContent({
            message: 'Authentication required'
          })
        },
        '403': {
          description:
            'The current user does not have permission to manage content types for this site.',
          content: errorJsonContent({
            message: 'You do not have permission to manage content types for this site',
            code: 'FORBIDDEN'
          })
        },
        '404': {
          description: 'The site or content type was not found.',
          content: errorJsonContent({
            message: 'Content type not found',
            code: 'CONTENT_TYPE_NOT_FOUND'
          })
        },
        '409': {
          description:
            'The content type already has entries and cannot be deleted.',
          content: errorJsonContent({
            message: 'Content type has entries and cannot be deleted',
            code: 'CONTENT_TYPE_HAS_ENTRIES'
          })
        }
      }
    }
  },
  '/sites/{siteId}/content-types/{contentTypeId}/fields': {
    post: {
      tags: ['Content Types'],
      summary: 'Create a content field',
      description:
        'Adds a new field to a content type and appends it to the field order unless a specific sortOrder is provided.',
      security: bearerSecurity,
      parameters: [siteIdPathParameter, contentTypeIdPathParameter],
      requestBody: {
        required: true,
        content: jsonSchema('CreateContentFieldRequest')
      },
      responses: {
        '201': {
          description: 'Content field created successfully.',
          content: jsonSchema('ContentFieldMutationResponse')
        },
        '400': {
          description: 'Request body validation failed.',
          content: errorJsonContent({
            message: 'Invalid request body'
          })
        },
        '401': {
          description: 'Authentication is required or the token is invalid.',
          content: errorJsonContent({
            message: 'Authentication required'
          })
        },
        '403': {
          description:
            'The current user does not have permission to manage content types for this site.',
          content: errorJsonContent({
            message: 'You do not have permission to manage content types for this site',
            code: 'FORBIDDEN'
          })
        },
        '404': {
          description: 'The site or content type was not found.',
          content: errorJsonContent({
            message: 'Content type not found',
            code: 'CONTENT_TYPE_NOT_FOUND'
          })
        },
        '409': {
          description:
            'The field apiId is already in use for this content type.',
          content: errorJsonContent({
            message: 'This field apiId is already in use for this content type',
            code: 'CONTENT_FIELD_API_ID_TAKEN'
          })
        }
      }
    }
  },
  '/sites/{siteId}/content-types/{contentTypeId}/fields/{fieldId}': {
    patch: {
      tags: ['Content Types'],
      summary: 'Update a content field',
      description:
        'Updates a content field definition and optionally repositions it in the field order.',
      security: bearerSecurity,
      parameters: [
        siteIdPathParameter,
        contentTypeIdPathParameter,
        fieldIdPathParameter
      ],
      requestBody: {
        required: true,
        content: jsonSchema('UpdateContentFieldRequest')
      },
      responses: {
        '200': {
          description: 'Content field updated successfully.',
          content: jsonSchema('ContentFieldMutationResponse')
        },
        '400': {
          description: 'Request body validation failed.',
          content: errorJsonContent({
            message: 'Invalid request body'
          })
        },
        '401': {
          description: 'Authentication is required or the token is invalid.',
          content: errorJsonContent({
            message: 'Authentication required'
          })
        },
        '403': {
          description:
            'The current user does not have permission to manage content types for this site.',
          content: errorJsonContent({
            message: 'You do not have permission to manage content types for this site',
            code: 'FORBIDDEN'
          })
        },
        '404': {
          description: 'The site, content type, or field was not found.',
          content: errorJsonContent({
            message: 'Content field not found',
            code: 'CONTENT_FIELD_NOT_FOUND'
          })
        },
        '409': {
          description:
            'The field apiId is already in use for this content type.',
          content: errorJsonContent({
            message: 'This field apiId is already in use for this content type',
            code: 'CONTENT_FIELD_API_ID_TAKEN'
          })
        }
      }
    },
    delete: {
      tags: ['Content Types'],
      summary: 'Delete a content field',
      description:
        'Deletes a field from a content type and re-normalizes the remaining field order.',
      security: bearerSecurity,
      parameters: [
        siteIdPathParameter,
        contentTypeIdPathParameter,
        fieldIdPathParameter
      ],
      responses: {
        '200': {
          description: 'Content field deleted successfully.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ok'],
                properties: {
                  ok: {
                    type: 'boolean',
                    example: true
                  }
                }
              }
            }
          }
        },
        '401': {
          description: 'Authentication is required or the token is invalid.',
          content: errorJsonContent({
            message: 'Authentication required'
          })
        },
        '403': {
          description:
            'The current user does not have permission to manage content types for this site.',
          content: errorJsonContent({
            message: 'You do not have permission to manage content types for this site',
            code: 'FORBIDDEN'
          })
        },
        '404': {
          description: 'The site, content type, or field was not found.',
          content: errorJsonContent({
            message: 'Content field not found',
            code: 'CONTENT_FIELD_NOT_FOUND'
          })
        }
      }
    }
  },
  '/sites/{siteId}/content-types/{contentTypeId}/fields/reorder': {
    patch: {
      tags: ['Content Types'],
      summary: 'Reorder content fields',
      description:
        'Replaces the field sort order for a content type using the provided ordered array of field IDs.',
      security: bearerSecurity,
      parameters: [siteIdPathParameter, contentTypeIdPathParameter],
      requestBody: {
        required: true,
        content: jsonSchema('ReorderContentFieldsRequest')
      },
      responses: {
        '200': {
          description: 'Field order updated successfully.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ok'],
                properties: {
                  ok: {
                    type: 'boolean',
                    example: true
                  }
                }
              }
            }
          }
        },
        '400': {
          description:
            'Request validation failed or the payload did not include the full field set exactly once.',
          content: errorJsonContent({
            message: 'Invalid field order payload'
          })
        },
        '401': {
          description: 'Authentication is required or the token is invalid.',
          content: errorJsonContent({
            message: 'Authentication required'
          })
        },
        '403': {
          description:
            'The current user does not have permission to manage content types for this site.',
          content: errorJsonContent({
            message: 'You do not have permission to manage content types for this site',
            code: 'FORBIDDEN'
          })
        },
        '404': {
          description: 'The site or content type was not found.',
          content: errorJsonContent({
            message: 'Content type not found',
            code: 'CONTENT_TYPE_NOT_FOUND'
          })
        }
      }
    }
  }
} as const

const contentTypeSchemas = {
  ContentFieldType: {
    type: 'string',
    enum: [...contentFieldTypeEnum]
  },
  ContentFieldResponse: {
    type: 'object',
    required: [
      'id',
      'label',
      'apiId',
      'type',
      'description',
      'required',
      'localized',
      'isList',
      'sortOrder',
      'config',
      'validation',
      'defaultValue',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      label: {
        type: 'string',
        example: 'Title'
      },
      apiId: {
        type: 'string',
        example: 'title'
      },
      type: {
        $ref: '#/components/schemas/ContentFieldType'
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'Primary page heading'
      },
      required: {
        type: 'boolean',
        example: true
      },
      localized: {
        type: 'boolean',
        example: false
      },
      isList: {
        type: 'boolean',
        example: false
      },
      sortOrder: {
        type: 'integer',
        minimum: 0,
        example: 0
      },
      config: {
        type: 'object',
        nullable: true,
        additionalProperties: true
      },
      validation: {
        type: 'object',
        nullable: true,
        additionalProperties: true
      },
      defaultValue: {
        nullable: true
      },
      createdAt: {
        type: 'string',
        format: 'date-time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time'
      }
    }
  },
  ContentTypeListItem: {
    type: 'object',
    required: [
      'id',
      'name',
      'apiId',
      'description',
      'isSingleton',
      'fieldCount',
      'entryCount',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      name: {
        type: 'string',
        example: 'Page'
      },
      apiId: {
        type: 'string',
        example: 'page'
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'Website pages'
      },
      isSingleton: {
        type: 'boolean',
        example: false
      },
      fieldCount: {
        type: 'integer',
        minimum: 0,
        example: 4
      },
      entryCount: {
        type: 'integer',
        minimum: 0,
        example: 0
      },
      createdAt: {
        type: 'string',
        format: 'date-time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time'
      }
    }
  },
  ContentTypeDetail: {
    type: 'object',
    required: [
      'id',
      'name',
      'apiId',
      'description',
      'isSingleton',
      'fields',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      name: {
        type: 'string',
        example: 'Page'
      },
      apiId: {
        type: 'string',
        example: 'page'
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'Website pages'
      },
      isSingleton: {
        type: 'boolean',
        example: false
      },
      fields: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ContentFieldResponse'
        }
      },
      createdAt: {
        type: 'string',
        format: 'date-time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time'
      }
    }
  },
  ContentTypeListResponse: {
    type: 'object',
    required: ['contentTypes'],
    properties: {
      contentTypes: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ContentTypeListItem'
        }
      }
    }
  },
  ContentTypeDetailResponse: {
    type: 'object',
    required: ['contentType'],
    properties: {
      contentType: {
        $ref: '#/components/schemas/ContentTypeDetail'
      }
    }
  },
  ContentFieldMutationResponse: {
    type: 'object',
    required: ['field'],
    properties: {
      field: {
        $ref: '#/components/schemas/ContentFieldResponse'
      }
    }
  },
  CreateContentTypeRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        example: 'Page'
      },
      apiId: {
        type: 'string',
        nullable: true,
        example: 'page'
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'Website pages'
      },
      isSingleton: {
        type: 'boolean',
        example: false
      }
    }
  },
  UpdateContentTypeRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        example: 'Page'
      },
      apiId: {
        type: 'string',
        nullable: true,
        example: 'page'
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'Website pages'
      },
      isSingleton: {
        type: 'boolean',
        example: false
      }
    }
  },
  CreateContentFieldRequest: {
    type: 'object',
    required: ['label', 'type'],
    properties: {
      label: {
        type: 'string',
        minLength: 2,
        example: 'Title'
      },
      apiId: {
        type: 'string',
        nullable: true,
        example: 'title'
      },
      type: {
        $ref: '#/components/schemas/ContentFieldType'
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'Primary page heading'
      },
      required: {
        type: 'boolean',
        example: true
      },
      localized: {
        type: 'boolean',
        example: false
      },
      isList: {
        type: 'boolean',
        example: false
      },
      sortOrder: {
        type: 'integer',
        minimum: 0,
        example: 0
      },
      config: {
        type: 'object',
        nullable: true,
        additionalProperties: true
      },
      validation: {
        type: 'object',
        nullable: true,
        additionalProperties: true
      },
      defaultValue: {
        nullable: true
      }
    }
  },
  UpdateContentFieldRequest: {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        minLength: 2,
        example: 'Title'
      },
      apiId: {
        type: 'string',
        nullable: true,
        example: 'title'
      },
      type: {
        $ref: '#/components/schemas/ContentFieldType'
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'Primary page heading'
      },
      required: {
        type: 'boolean',
        example: true
      },
      localized: {
        type: 'boolean',
        example: false
      },
      isList: {
        type: 'boolean',
        example: false
      },
      sortOrder: {
        type: 'integer',
        minimum: 0,
        example: 1
      },
      config: {
        type: 'object',
        nullable: true,
        additionalProperties: true
      },
      validation: {
        type: 'object',
        nullable: true,
        additionalProperties: true
      },
      defaultValue: {
        nullable: true
      }
    }
  },
  ReorderContentFieldsRequest: {
    type: 'object',
    required: ['fieldIds'],
    properties: {
      fieldIds: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
          format: 'uuid'
        }
      }
    }
  }
} as const

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Narah CMS API',
    version: '0.1.0',
    description:
      'API documentation for Narah CMS, a schema-driven headless CMS.'
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: 'Local Narah CMS API server'
    },
    {
      url: 'http://localhost:3000',
      description: 'Example local API URL'
    }
  ],
  tags: [
    {
      name: 'System',
      description: 'System-level API metadata endpoints.'
    },
    {
      name: 'Auth',
      description: 'Authentication and policy acceptance endpoints.'
    },
    {
      name: 'Health',
      description: 'Service and database health endpoints.'
    },
    {
      name: 'Sites',
      description: 'Site management endpoints for Narah CMS.'
    },
    {
      name: 'Content Types',
      description: 'Site-specific schema and field builder endpoints.'
    },
    {
      name: 'Invitations',
      description: 'Public invitation acceptance endpoints.'
    }
  ],
  paths: {
    '/': {
      get: {
        tags: ['System'],
        summary: 'Get API information',
        description:
          'Returns basic metadata about the Narah CMS API and its foundational routes.',
        responses: {
          '200': {
            description: 'API information returned successfully.',
            content: jsonSchema('ApiInfoResponse')
          }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API health',
        description: 'Returns a simple health response for the API root alias.',
        responses: {
          '200': {
            description: 'API health returned successfully.',
            content: jsonSchema('HealthResponse')
          }
        }
      }
    },
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Check versioned API health',
        description:
          'Returns a simple health response from the versioned v1 namespace.',
        responses: {
          '200': {
            description: 'API health returned successfully.',
            content: jsonSchema('HealthResponse')
          }
        }
      }
    },
    '/health/db': {
      get: {
        tags: ['Health'],
        summary: 'Check database connection',
        description:
          'Verifies that the API can connect to the configured PostgreSQL database.',
        responses: {
          '200': {
            description: 'Database connection is healthy.',
            content: jsonSchema('HealthDbResponse')
          },
          '500': {
            description: 'Database health check failed.',
            content: errorJsonContent({
              message: 'Internal server error'
            })
          }
        }
      }
    },
    '/health/protected': {
      get: {
        tags: ['Health'],
        summary: 'Check authenticated and policy-accepted access',
        description:
          'Verifies that the current user is authenticated and has accepted all active policy documents.',
        security: bearerSecurity,
        responses: {
          '200': {
            description: 'Protected health check succeeded.',
            content: jsonSchema('ProtectedHealthResponse')
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Invalid or expired access token'
            })
          },
          '403': {
            description:
              'The authenticated user must accept active policy documents before access is allowed.',
            content: errorJsonContent({
              message: 'Policy acceptance required',
              code: 'POLICY_ACCEPTANCE_REQUIRED'
            })
          }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login user',
        description:
          'Authenticates a user with email and password, then returns a JWT access token and policy-acceptance status.',
        requestBody: {
          required: true,
          content: jsonSchema('LoginRequest')
        },
        responses: {
          '200': {
            description: 'Login succeeded.',
            content: jsonSchema('LoginResponse')
          },
          '400': {
            description: 'Request body validation failed.',
            content: errorJsonContent({
              message: 'Invalid request body'
            })
          },
          '401': {
            description: 'Credentials were invalid.',
            content: errorJsonContent({
              message: 'Invalid credentials'
            })
          },
          '403': {
            description: 'User account is not active.',
            content: errorJsonContent({
              message: 'User account is not active'
            })
          }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current authenticated user',
        description:
          'Returns the currently authenticated user and whether policy acceptance is still required.',
        security: bearerSecurity,
        responses: {
          '200': {
            description: 'Current authenticated user returned successfully.',
            content: jsonSchema('CurrentUserResponse')
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description: 'User account is not active.',
            content: errorJsonContent({
              message: 'User account is not active'
            })
          }
        }
      }
    },
    '/auth/required-policies': {
      get: {
        tags: ['Auth'],
        summary: 'Get active policies and acceptance status',
        description:
          'Returns all active policy documents along with whether the current user has already accepted each one.',
        security: bearerSecurity,
        responses: {
          '200': {
            description: 'Required policies returned successfully.',
            content: jsonSchema('RequiredPoliciesResponse')
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description: 'User account is not active.',
            content: errorJsonContent({
              message: 'User account is not active'
            })
          }
        }
      }
    },
    '/auth/accept-policies': {
      post: {
        tags: ['Auth'],
        summary: 'Accept active policy documents',
        description:
          'Creates policy acceptance records for the current user against the provided active policy document IDs.',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonSchema('AcceptPoliciesRequest')
        },
        responses: {
          '200': {
            description: 'Policies were accepted successfully.',
            content: jsonSchema('AcceptPoliciesResponse')
          },
          '400': {
            description:
              'The request body was invalid or included non-active policy document IDs.',
            content: errorJsonContent({
              message: 'Only active policy documents can be accepted'
            })
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description: 'User account is not active.',
            content: errorJsonContent({
              message: 'User account is not active'
            })
          }
        }
      }
    },
    '/sites': {
      get: {
        tags: ['Sites'],
        summary: 'List sites',
        description:
          'Returns sites visible to the current user. Super admins can list all sites, while non-super admins only see sites they belong to.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'query',
            name: 'includeArchived',
            required: false,
            schema: {
              type: 'boolean',
              default: false
            },
            description: 'When true, archived sites are included in the results.'
          },
          {
            in: 'query',
            name: 'search',
            required: false,
            schema: {
              type: 'string'
            },
            description: 'Filters sites by name, slug, or description.'
          }
        ],
        responses: {
          '200': {
            description: 'Site list returned successfully.',
            content: jsonSchema('SiteListResponse')
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user must accept active policy documents before accessing sites.',
            content: errorJsonContent({
              message: 'Policy acceptance required',
              code: 'POLICY_ACCEPTANCE_REQUIRED'
            })
          }
        }
      },
      post: {
        tags: ['Sites'],
        summary: 'Create a site',
        description:
          'Creates a new site. Only super admins can create sites at this stage.',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonSchema('CreateSiteRequest')
        },
        responses: {
          '201': {
            description: 'Site created successfully.',
            content: jsonSchema('SiteDetailResponse')
          },
          '400': {
            description: 'Request body validation failed.',
            content: errorJsonContent({
              message: 'Invalid request body'
            })
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user does not have permission to create a site or must accept active policies first.',
            content: errorJsonContent({
              message: 'Super admin access required'
            })
          },
          '409': {
            description: 'The normalized site slug already exists.',
            content: errorJsonContent({
              message: 'A site with this slug already exists',
              code: 'SITE_SLUG_CONFLICT'
            })
          }
        }
      }
    },
    ...contentTypePaths,
    '/sites/{siteId}/members': {
      get: {
        tags: ['Sites'],
        summary: 'List site members',
        description:
          'Returns all site members for a site the current user can access.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'siteId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Site members returned successfully.',
            content: jsonSchema('SiteMemberListResponse')
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user does not have access to this site or must accept active policies first.',
            content: errorJsonContent({
              message: 'You do not have access to this site',
              code: 'SITE_ACCESS_DENIED'
            })
          },
          '404': {
            description: 'Site was not found.',
            content: errorJsonContent({
              message: 'Site not found',
              code: 'SITE_NOT_FOUND'
            })
          }
        }
      }
    },
    '/sites/{siteId}/members/{memberId}': {
      patch: {
        tags: ['Sites'],
        summary: 'Update a site member role',
        description:
          'Updates a site member role while enforcing role assignment rules and last-owner protection.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'siteId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          },
          {
            in: 'path',
            name: 'memberId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        requestBody: {
          required: true,
          content: jsonSchema('UpdateSiteMemberRequest')
        },
        responses: {
          '200': {
            description: 'Site member updated successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['member'],
                  properties: {
                    member: {
                      $ref: '#/components/schemas/SiteMemberResponse'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Request validation failed.',
            content: errorJsonContent({
              message: 'Invalid request body'
            })
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user does not have permission to manage this member or assign the requested role.',
            content: errorJsonContent({
              message: 'You do not have permission to assign this role',
              code: 'SITE_MEMBER_ROLE_ASSIGNMENT_DENIED'
            })
          },
          '404': {
            description: 'The site or site member was not found.',
            content: errorJsonContent({
              message: 'Site member not found',
              code: 'SITE_MEMBER_NOT_FOUND'
            })
          },
          '409': {
            description: 'Changing this role would remove the last remaining owner.',
            content: errorJsonContent({
              message: 'At least one OWNER must remain in this site',
              code: 'LAST_OWNER_REQUIRED'
            })
          }
        }
      },
      delete: {
        tags: ['Sites'],
        summary: 'Remove a site member',
        description:
          'Deletes a site member while enforcing access rules and last-owner protection.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'siteId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          },
          {
            in: 'path',
            name: 'memberId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Site member removed successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ok'],
                  properties: {
                    ok: {
                      type: 'boolean',
                      example: true
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user does not have permission to remove this member.',
            content: errorJsonContent({
              message: 'You do not have permission to remove this member',
              code: 'SITE_MEMBER_REMOVE_DENIED'
            })
          },
          '404': {
            description: 'The site or site member was not found.',
            content: errorJsonContent({
              message: 'Site member not found',
              code: 'SITE_MEMBER_NOT_FOUND'
            })
          },
          '409': {
            description: 'Removing this member would remove the last remaining owner.',
            content: errorJsonContent({
              message: 'At least one OWNER must remain in this site',
              code: 'LAST_OWNER_REQUIRED'
            })
          }
        }
      }
    },
    '/sites/{siteId}/invitations': {
      get: {
        tags: ['Sites'],
        summary: 'List site invitations',
        description:
          'Returns pending site invitations for a site the current user can manage.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'siteId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Site invitations returned successfully.',
            content: jsonSchema('SiteInvitationListResponse')
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user does not have permission to manage invitations for this site.',
            content: errorJsonContent({
              message: 'You do not have permission to manage invitations for this site',
              code: 'SITE_INVITATION_MANAGE_DENIED'
            })
          },
          '404': {
            description: 'Site was not found.',
            content: errorJsonContent({
              message: 'Site not found',
              code: 'SITE_NOT_FOUND'
            })
          }
        }
      },
      post: {
        tags: ['Sites'],
        summary: 'Create a site invitation',
        description:
          'Creates or refreshes a pending site invitation and returns a copyable invitation URL.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'siteId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        requestBody: {
          required: true,
          content: jsonSchema('CreateSiteInvitationRequest')
        },
        responses: {
          '201': {
            description: 'Site invitation created successfully.',
            content: jsonSchema('CreateSiteInvitationResponse')
          },
          '400': {
            description: 'Request body validation failed.',
            content: errorJsonContent({
              message: 'Invalid request body'
            })
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user does not have permission to invite this role or manage site invitations.',
            content: errorJsonContent({
              message: 'You do not have permission to invite a user with this role',
              code: 'SITE_INVITATION_ROLE_DENIED'
            })
          },
          '404': {
            description: 'Site was not found.',
            content: errorJsonContent({
              message: 'Site not found',
              code: 'SITE_NOT_FOUND'
            })
          },
          '409': {
            description: 'The invited email already belongs to a site member.',
            content: errorJsonContent({
              message: 'This user is already a site member',
              code: 'SITE_MEMBER_ALREADY_EXISTS'
            })
          }
        }
      }
    },
    '/sites/{siteId}/invitations/{invitationId}': {
      delete: {
        tags: ['Sites'],
        summary: 'Revoke a site invitation',
        description:
          'Revokes a pending site invitation by setting its status to REVOKED.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'siteId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          },
          {
            in: 'path',
            name: 'invitationId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Invitation revoked successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ok'],
                  properties: {
                    ok: {
                      type: 'boolean',
                      example: true
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user does not have permission to manage invitations for this site.',
            content: errorJsonContent({
              message: 'You do not have permission to manage invitations for this site',
              code: 'SITE_INVITATION_MANAGE_DENIED'
            })
          },
          '404': {
            description: 'The site or invitation was not found.',
            content: errorJsonContent({
              message: 'Site invitation not found',
              code: 'SITE_INVITATION_NOT_FOUND'
            })
          },
          '409': {
            description: 'The invitation is no longer pending.',
            content: errorJsonContent({
              message: 'Only pending invitations can be revoked',
              code: 'SITE_INVITATION_NOT_PENDING'
            })
          }
        }
      }
    },
    '/sites/{siteId}': {
      get: {
        tags: ['Sites'],
        summary: 'Get site details',
        description:
          'Returns detailed information and counts for a single site visible to the current user.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'siteId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Site details returned successfully.',
            content: jsonSchema('SiteDetailResponse')
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user does not have access to this site or must accept active policies first.',
            content: errorJsonContent({
              message: 'You do not have access to this site',
              code: 'SITE_ACCESS_DENIED'
            })
          },
          '404': {
            description: 'Site was not found.',
            content: errorJsonContent({
              message: 'Site not found',
              code: 'SITE_NOT_FOUND'
            })
          }
        }
      },
      patch: {
        tags: ['Sites'],
        summary: 'Update a site',
        description:
          'Updates site metadata. Super admins can update any site, while site members require OWNER or ADMIN role.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'siteId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        requestBody: {
          required: true,
          content: jsonSchema('UpdateSiteRequest')
        },
        responses: {
          '200': {
            description: 'Site updated successfully.',
            content: jsonSchema('SiteDetailResponse')
          },
          '400': {
            description: 'Request validation failed.',
            content: errorJsonContent({
              message: 'Invalid request body'
            })
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user does not have permission to update this site or must accept active policies first.',
            content: errorJsonContent({
              message: 'You do not have permission to update this site',
              code: 'SITE_MANAGE_DENIED'
            })
          },
          '404': {
            description: 'Site was not found.',
            content: errorJsonContent({
              message: 'Site not found',
              code: 'SITE_NOT_FOUND'
            })
          },
          '409': {
            description: 'The normalized site slug already exists.',
            content: errorJsonContent({
              message: 'A site with this slug already exists',
              code: 'SITE_SLUG_CONFLICT'
            })
          }
        }
      },
      delete: {
        tags: ['Sites'],
        summary: 'Archive a site',
        description:
          'Archives a site by setting its status to ARCHIVED. Hard deletion is not performed.',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'siteId',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Site archived successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ok'],
                  properties: {
                    ok: {
                      type: 'boolean',
                      example: true
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Authentication is required or the token is invalid.',
            content: errorJsonContent({
              message: 'Authentication required'
            })
          },
          '403': {
            description:
              'The current user is not allowed to archive this site or must accept active policies first.',
            content: errorJsonContent({
              message: 'Super admin access required'
            })
          },
          '404': {
            description: 'Site was not found.',
            content: errorJsonContent({
              message: 'Site not found',
              code: 'SITE_NOT_FOUND'
            })
          }
        }
      }
    },
    '/invitations/accept': {
      post: {
        tags: ['Invitations'],
        summary: 'Accept a site invitation',
        description:
          'Accepts a site invitation using a secure token. Existing users are added to the site, while new users can create an account at the same time.',
        requestBody: {
          required: true,
          content: jsonSchema('AcceptInvitationRequest')
        },
        responses: {
          '200': {
            description: 'Invitation accepted successfully.',
            content: jsonSchema('AcceptInvitationResponse')
          },
          '400': {
            description:
              'The request body was invalid or required account fields were missing for a new user.',
            content: errorJsonContent({
              message: 'Name and password are required to create a new account',
              code: 'INVITATION_ACCOUNT_DETAILS_REQUIRED'
            })
          },
          '404': {
            description: 'The invitation token was not found.',
            content: errorJsonContent({
              message: 'Invitation not found',
              code: 'INVITATION_NOT_FOUND'
            })
          },
          '409': {
            description: 'The invitation has already been accepted or revoked.',
            content: errorJsonContent({
              message: 'This invitation has already been accepted',
              code: 'INVITATION_ALREADY_ACCEPTED'
            })
          },
          '410': {
            description: 'The invitation has expired.',
            content: errorJsonContent({
              message: 'This invitation has expired',
              code: 'INVITATION_EXPIRED'
            })
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      ...contentTypeSchemas,
      ApiInfoResponse: {
        type: 'object',
        required: ['name', 'service', 'environment', 'version', 'routes'],
        properties: {
          name: {
            type: 'string',
            example: 'Narah CMS API'
          },
          service: {
            type: 'string',
            example: '@narah-cms/api'
          },
          environment: {
            type: 'string',
            enum: ['development', 'test', 'production'],
            example: 'development'
          },
          version: {
            type: 'string',
            example: 'v1'
          },
          routes: {
            type: 'object',
            required: ['root', 'health', 'v1Health'],
            properties: {
              root: {
                type: 'string',
                example: '/'
              },
              health: {
                type: 'string',
                example: '/health'
              },
              v1Health: {
                type: 'string',
                example: '/api/v1/health'
              }
            }
          }
        }
      },
      HealthResponse: {
        type: 'object',
        required: ['status', 'service', 'timestamp'],
        properties: {
          status: {
            type: 'string',
            example: 'ok'
          },
          service: {
            type: 'string',
            example: '@narah-cms/api'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2026-05-06T04:00:00.000Z'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            example: 'Authentication required'
          },
          code: {
            type: 'string',
            example: 'POLICY_ACCEPTANCE_REQUIRED'
          },
          issues: {
            type: 'array',
            items: {
              type: 'string'
            }
          }
        }
      },
      UserResponse: {
        type: 'object',
        required: ['id', 'email', 'name', 'status', 'isSuperAdmin'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          email: {
            type: 'string',
            format: 'email'
          },
          name: {
            type: 'string',
            nullable: true,
            example: 'Super Admin'
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'ACTIVE', 'DISABLED']
          },
          isSuperAdmin: {
            type: 'boolean',
            example: true
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'admin@narah.local'
          },
          password: {
            type: 'string',
            example: 'Admin12345!'
          }
        }
      },
      LoginResponse: {
        type: 'object',
        required: ['accessToken', 'user', 'requiresPolicyAcceptance'],
        properties: {
          accessToken: {
            type: 'string',
            example: '<jwt-access-token>'
          },
          user: {
            $ref: '#/components/schemas/UserResponse'
          },
          requiresPolicyAcceptance: {
            type: 'boolean',
            example: true
          }
        }
      },
      CurrentUserResponse: {
        type: 'object',
        required: ['user', 'requiresPolicyAcceptance'],
        properties: {
          user: {
            $ref: '#/components/schemas/UserResponse'
          },
          requiresPolicyAcceptance: {
            type: 'boolean',
            example: true
          }
        }
      },
      PolicyDocumentResponse: {
        type: 'object',
        required: ['id', 'type', 'version', 'title', 'content', 'accepted'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          type: {
            type: 'string',
            enum: ['PRIVACY_POLICY', 'USER_AGREEMENT']
          },
          version: {
            type: 'string',
            example: '1.0.0'
          },
          title: {
            type: 'string',
            example: 'Privacy Policy'
          },
          content: {
            type: 'string'
          },
          accepted: {
            type: 'boolean',
            example: false
          }
        }
      },
      RequiredPoliciesResponse: {
        type: 'object',
        required: ['policies'],
        properties: {
          policies: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PolicyDocumentResponse'
            }
          }
        }
      },
      AcceptPoliciesRequest: {
        type: 'object',
        required: ['policyDocumentIds'],
        properties: {
          policyDocumentIds: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'string',
              format: 'uuid'
            }
          }
        }
      },
      AcceptPoliciesResponse: {
        type: 'object',
        required: ['ok', 'requiresPolicyAcceptance'],
        properties: {
          ok: {
            type: 'boolean',
            example: true
          },
          requiresPolicyAcceptance: {
            type: 'boolean',
            example: false
          }
        }
      },
      HealthDbResponse: {
        type: 'object',
        required: ['ok', 'database'],
        properties: {
          ok: {
            type: 'boolean',
            example: true
          },
          database: {
            type: 'string',
            example: 'connected'
          }
        }
      },
      ProtectedHealthResponse: {
        type: 'object',
        required: ['ok', 'userId'],
        properties: {
          ok: {
            type: 'boolean',
            example: true
          },
          userId: {
            type: 'string',
            format: 'uuid'
          }
        }
      },
      SiteResponse: {
        type: 'object',
        required: [
          'id',
          'name',
          'slug',
          'description',
          'status',
          'createdAt',
          'updatedAt',
          'memberCount'
        ],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          name: {
            type: 'string',
            example: 'Kaleka Website'
          },
          slug: {
            type: 'string',
            example: 'kaleka-website'
          },
          description: {
            type: 'string',
            nullable: true,
            example: 'Main website content'
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'DISABLED', 'ARCHIVED']
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          },
          memberCount: {
            type: 'integer',
            minimum: 0,
            example: 1
          }
        }
      },
      SiteListResponse: {
        type: 'object',
        required: ['sites'],
        properties: {
          sites: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/SiteResponse'
            }
          }
        }
      },
      CreateSiteRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            minLength: 2,
            example: 'Kaleka Website'
          },
          slug: {
            type: 'string',
            nullable: true,
            example: 'kaleka-website'
          },
          description: {
            type: 'string',
            nullable: true,
            example: 'Main website content'
          }
        }
      },
      UpdateSiteRequest: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 2,
            example: 'Kaleka Website'
          },
          slug: {
            type: 'string',
            nullable: true,
            example: 'kaleka-website'
          },
          description: {
            type: 'string',
            nullable: true,
            example: 'Updated site description'
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'DISABLED', 'ARCHIVED']
          }
        }
      },
      SiteDetail: {
        type: 'object',
        required: [
          'id',
          'name',
          'slug',
          'description',
          'status',
          'createdAt',
          'updatedAt',
          'currentUserRole',
          'memberCount',
          'contentTypeCount',
          'entryCount',
          'mediaAssetCount'
        ],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          name: {
            type: 'string',
            example: 'Kaleka Website'
          },
          slug: {
            type: 'string',
            example: 'kaleka-website'
          },
          description: {
            type: 'string',
            nullable: true,
            example: 'Main website content'
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'DISABLED', 'ARCHIVED']
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          },
          currentUserRole: {
            type: 'string',
            nullable: true,
            enum: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
          },
          memberCount: {
            type: 'integer',
            minimum: 0,
            example: 1
          },
          contentTypeCount: {
            type: 'integer',
            minimum: 0,
            example: 0
          },
          entryCount: {
            type: 'integer',
            minimum: 0,
            example: 0
          },
          mediaAssetCount: {
            type: 'integer',
            minimum: 0,
            example: 0
          }
        }
      },
      SiteDetailResponse: {
        type: 'object',
        required: ['site'],
        properties: {
          site: {
            $ref: '#/components/schemas/SiteDetail'
          }
        }
      },
      SiteMemberResponse: {
        type: 'object',
        required: ['id', 'role', 'createdAt', 'updatedAt', 'user'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          role: {
            type: 'string',
            enum: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          },
          user: {
            $ref: '#/components/schemas/UserResponse'
          }
        }
      },
      SiteMemberListResponse: {
        type: 'object',
        required: ['members'],
        properties: {
          members: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/SiteMemberResponse'
            }
          }
        }
      },
      UpdateSiteMemberRequest: {
        type: 'object',
        required: ['role'],
        properties: {
          role: {
            type: 'string',
            enum: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
          }
        }
      },
      SiteInvitationInvitedByResponse: {
        type: 'object',
        required: ['id', 'email', 'name'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          email: {
            type: 'string',
            format: 'email'
          },
          name: {
            type: 'string',
            nullable: true,
            example: 'Super Admin'
          }
        }
      },
      SiteInvitationResponse: {
        type: 'object',
        required: [
          'id',
          'email',
          'role',
          'status',
          'expiresAt',
          'createdAt',
          'invitedBy',
          'inviteUrl'
        ],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          email: {
            type: 'string',
            format: 'email'
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'EDITOR', 'VIEWER']
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']
          },
          expiresAt: {
            type: 'string',
            format: 'date-time'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          invitedBy: {
            $ref: '#/components/schemas/SiteInvitationInvitedByResponse'
          },
          inviteUrl: {
            type: 'string',
            nullable: true,
            example: 'http://localhost:5173/invitations/accept?token=<token>'
          }
        }
      },
      SiteInvitationListResponse: {
        type: 'object',
        required: ['invitations'],
        properties: {
          invitations: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/SiteInvitationResponse'
            }
          }
        }
      },
      CreateSiteInvitationRequest: {
        type: 'object',
        required: ['email', 'role'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'editor@example.com'
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'EDITOR', 'VIEWER']
          }
        }
      },
      CreateSiteInvitationResponse: {
        type: 'object',
        required: ['invitation', 'inviteUrl'],
        properties: {
          invitation: {
            $ref: '#/components/schemas/SiteInvitationResponse'
          },
          inviteUrl: {
            type: 'string',
            example: 'http://localhost:5173/invitations/accept?token=<token>'
          }
        }
      },
      AcceptInvitationRequest: {
        type: 'object',
        required: ['token'],
        properties: {
          token: {
            type: 'string'
          },
          name: {
            type: 'string',
            nullable: true,
            example: 'Editor User'
          },
          password: {
            type: 'string',
            nullable: true,
            minLength: 8,
            example: 'OptionalPassword123'
          }
        }
      },
      AcceptInvitationResponse: {
        type: 'object',
        required: ['ok', 'mode', 'message'],
        properties: {
          ok: {
            type: 'boolean',
            example: true
          },
          mode: {
            type: 'string',
            enum: ['EXISTING_USER', 'NEW_USER']
          },
          message: {
            type: 'string',
            example: 'Invitation accepted. Please log in.'
          }
        }
      }
    }
  }
} as const
