---
title: 'Building a Multi-Tenant SaaS with Next.js and NestJS'
description: 'Technical deep-dive into architecting a multi-tenant SaaS platform using Next.js 15, NestJS 11, Prisma, and PostgreSQL with tenant isolation at every layer.'
date: '2026-02-10'
category: 'Technical'
author: 'Booking OS Team'
readTime: '8 min read'
---

Building a multi-tenant SaaS platform requires careful architectural decisions at every layer of the stack. This post shares practical patterns we have found effective when building with Next.js, NestJS, Prisma, and PostgreSQL.

## Tenant Isolation Strategy

The most critical decision in multi-tenant architecture is how to isolate tenant data. The three common approaches are: separate databases per tenant, separate schemas per tenant, or shared tables with a tenant ID column. For most SaaS applications, the shared-table approach with a `businessId` column offers the best balance of simplicity, cost, and scalability.

## Enforcing Isolation at the API Layer

Every database query must filter by the current tenant's ID. In NestJS, this can be enforced using a combination of guards and parameter decorators. A `TenantGuard` extracts the business ID from the authenticated user's JWT token, and a `@BusinessId()` decorator injects it into controller methods. This ensures that even if a developer forgets to add the filter, the framework catches it.

## Authentication with httpOnly Cookies

For web-first SaaS applications, httpOnly cookies provide better security than localStorage-based JWT tokens. The API sets cookies with appropriate `Domain`, `SameSite`, and `Secure` attributes. The frontend reads the cookie automatically on every request — no token management code needed on the client side.

## Database Design with Prisma

Prisma provides type-safe database access and migration management. For multi-tenant applications, define your models with explicit `businessId` relations and create database indexes on frequently queried tenant-scoped columns. Use JSON columns for flexible, tenant-specific configuration that does not warrant its own table.

## Frontend with Next.js App Router

Next.js App Router provides server components for SEO-critical pages and client components for interactive dashboards. Middleware handles route protection by checking for authentication cookies before rendering protected pages.

## Real-Time Updates

For collaborative features like shared inboxes, Socket.io provides real-time updates. Namespace rooms by business ID to ensure tenants only receive their own events. This maintains isolation even in the real-time layer.

## Key Lessons

Start with strong tenant isolation patterns from day one — retrofitting them later is painful. Invest in automated testing that verifies isolation across all endpoints. And design your schema to be flexible with JSON fields where requirements are still evolving.
