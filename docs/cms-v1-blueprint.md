# Narah CMS v1 Blueprint

## Product Concept

Narah CMS is a schema-driven, multi-site headless CMS designed for teams that need to manage structured content across multiple properties from a shared platform. The system should let administrators define content models, generate the corresponding authoring experience dynamically, and expose content through a consistent API for downstream web and app clients.

## Goals

- Provide a flexible headless CMS foundation for multiple sites within one platform.
- Let authorized users define content structures without hardcoding forms for every content type.
- Support clear role boundaries for governance, publishing safety, and operational scale.
- Keep the platform modular so features can be phased in without reworking the core architecture.

## Non-Goals

- Building the full production CMS in the foundation phase.
- Adding database infrastructure such as Prisma or PostgreSQL before the domain model is settled.
- Implementing authentication, invitation flows, or media upload in this iteration.
- Delivering complete content type CRUD or public publishing workflows yet.

## MVP Scope

- Monorepo foundation with separate admin and API apps.
- Basic API structure, versioned routing, environment validation, and shared middleware.
- Admin placeholder application with working UI foundation.
- Blueprint documentation for product direction, scope, roles, and phased delivery.

## Tech Stack

- Monorepo: Bun workspaces
- Task orchestration: Turborepo
- Admin app: Vite, React, TypeScript, shadcn/ui, Tailwind CSS
- API app: Bun, Express, TypeScript, Zod

## Monorepo Structure

```text
apps/
  admin/   # React admin dashboard
  api/     # Express API
packages/  # Shared packages to be introduced as the platform grows
docs/      # Product and architecture documentation
```

## Role Model

- `super_admin`: Platform-wide administrator with access to all sites, configuration, and user management.
- `site_admin`: Site-level administrator responsible for settings, users, and content governance within assigned sites.
- `editor`: Content author and maintainer for permitted schemas and entries.
- `viewer`: Read-only access for approved operational or auditing use cases.

## First-Login Legal Consent Requirement

On a user's first successful login, access to the application should be gated until both of the following are explicitly accepted:

- Privacy Policy acceptance
- User Agreement acceptance

The system should store consent status and timestamp for auditability once authentication is implemented.

## High-Level Modules

- Auth & invitation
- Site management
- Content type builder
- Field builder
- Dynamic form renderer
- Content entry manager
- Media library
- Public API

## Suggested Phased Roadmap

### Phase 1: Foundation

- Finalize monorepo conventions, app boundaries, and developer workflows.
- Establish API structure, middleware, environment validation, and versioned routes.
- Prepare admin shell and project blueprint documentation.

### Phase 2: Site Management + Users

- Implement authentication and invitation flow.
- Add role-aware access control scaffolding.
- Introduce site creation, assignment, and user membership management.
- Enforce first-login legal consent flow.

### Phase 3: Schema Builder

- Define the schema model for content types and fields.
- Build admin tooling for content type and field configuration.
- Introduce validation rules and schema versioning considerations.

### Phase 4: Content Entries

- Build dynamic form rendering from saved schemas.
- Add content entry CRUD, draft states, and editorial workflows.
- Support per-site content isolation and role-based permissions.

### Phase 5: Media + Public API

- Add media library workflows and asset attachment to content entries.
- Expand public API capabilities for content querying and delivery.
- Improve performance, access policies, and client integration patterns.

## Not Included Yet

- Prisma
- PostgreSQL setup
- Authentication implementation
- Content type CRUD
- Media upload
