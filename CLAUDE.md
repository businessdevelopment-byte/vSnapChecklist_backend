# vsnapChecklist Backend — Claude Guidance

## Stack

- **Node.js + Express 5**, TypeScript (strict, CommonJS output)
- **Prisma v7** ORM with **PostgreSQL** (via `@prisma/adapter-pg`)
- **Zod** — request body and query param validation
- **jsonwebtoken** — JWT auth (HS256)
- **bcryptjs** — password hashing
- **pg** — PostgreSQL driver for adapter

## Architecture: Controller → Service → Prisma

```
Request
  → Router (defines HTTP verb + URL, attaches middleware)
    → authMiddleware (verifies JWT, attaches req.user)
      → Controller (Zod.parse(req.body/query), calls service)
        → Service (all business logic + Prisma queries)
          → Prisma Client → PostgreSQL
```

**Rules:**
- **NEVER** put Prisma queries in controllers — services only
- **NEVER** put business logic in routes
- Controllers must call `sendSuccess()` / `sendError()` from `src/utils/apiResponse.ts`
- All async controllers are wrapped in try/catch

## Database Schema (10 tables)

| Table | Maps To | Purpose |
|---|---|---|
| `users` | — | Auth, roles (ADMIN/USER) |
| `departments` | — | Firm names |
| `task_templates` | "Unique" sheet | Master recurring task definitions |
| `checklist_entries` | "Checklist" sheet | Generated daily instances |
| `delegation_tasks` | "DELEGATION" sheet | One-time/Critical/Urgent tasks |
| `delegation_history` | "DELEGATION DONE" sheet | Submission records |
| `task_transfer_logs` | — | Audit trail for task transfers |
| `attendance_logs` | "Attendance Login" sheet | Login tracking |
| `holidays` | — | Holiday dates for working calendar (excludes task generation) |
| `system_settings` | — | Global settings (e.g., `skipSundays: boolean`) |

## Task Generation (lazy, on-demand)

`GET /api/checklist` calls `checklistService.materializeTasks(userId, date)` before returning:
1. Load active templates for user where `startDate <= today <= lastDate`
2. Bulk INSERT missing entries for today using `skipDuplicates: true`
3. Return all entries — newly created ones are included

The frequency logic is in `src/services/checklist.service.ts:shouldGenerateForDate()`.

## Key Files

| File | Purpose |
|---|---|
| `src/index.ts` | HTTP server bootstrap |
| `src/app.ts` | Express instance, global middleware |
| `src/config/env.ts` | Zod-validated env vars — import `env`, never `process.env` |
| `src/config/database.ts` | Prisma Client singleton — import `prisma` |
| `src/utils/apiResponse.ts` | `sendSuccess(res, data, msg?, status?)` and `sendError(res, msg, status?, errors?)` |
| `src/utils/jwt.ts` | `signToken(payload)` and `verifyToken(token)` |
| `src/middleware/authMiddleware.ts` | Verifies Bearer token, attaches `req.user` (userId, username, role) |
| `src/middleware/errorHandler.ts` | Global Express error handler |

## Services

| Service | Key Methods |
|---|---|
| `template.service.ts` | CRUD for task templates |
| `checklist.service.ts` | `materializeTasks()`, `getEntries()`, `submitEntry()`, `markLeave()` |
| `delegation.service.ts` | CRUD + `submit()` (creates history) + `markHistoryAdminDone()` |
| `transfer.service.ts` | `transferTasks()` — updates entries + logs audit trail |
| `auth.service.ts` | `login()` — validates credentials, logs attendance, returns JWT |
| `user.service.ts` | `getAll()`, `getMe()`, `getDepartments()` |

## API Routes

```
POST   /api/auth/login               public
POST   /api/auth/logout              authenticated

GET    /api/checklist                triggers task generation, returns today's entries
GET    /api/checklist/history        completed entries
GET    /api/checklist/stats          dashboard counts
GET    /api/checklist/staff-stats    per-user stats (admin)
POST   /api/checklist/:id/submit     user marks task done
POST   /api/checklist/admin-done     admin marks entries processed
POST   /api/checklist/leave          admin marks date range as leave

GET    /api/templates                list templates
POST   /api/templates                create (admin)
PATCH  /api/templates/:id            update (admin)
DELETE /api/templates/:id            deactivate

GET    /api/delegation               list active delegation tasks
POST   /api/delegation               create
PATCH  /api/delegation/:id/status    update status
DELETE /api/delegation/:id           soft delete (admin)
POST   /api/delegation/:id/submit    user submits completion
GET    /api/delegation/history       completed submissions
POST   /api/delegation/admin-done    admin marks history done
GET    /api/delegation/status-counts counts by status

POST   /api/transfer                 admin transfers tasks to another user
GET    /api/transfer/logs            audit log

GET    /api/users
GET    /api/users/me
GET    /api/departments
POST   /api/departments              admin only
```

## Environment Variables

Copy `.env.example` to `.env`. Never commit `.env`.

Required:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — minimum 32 characters
- `PORT` — defaults to 4000
- `CORS_ORIGIN` — must match frontend URL exactly

## Database Commands

```bash
npm run db:migrate      # create + apply migration
npm run db:generate     # regenerate Prisma Client after schema change
npm run db:studio       # Prisma Studio at localhost:5555
npm run db:seed         # seed departments, users, templates, sample delegation
npm run db:reset        # drop all + re-migrate (dev only!)
```

## Seed Data (prisma/seed.ts)

| User | Password | Role |
|---|---|---|
| admin | admin@123 | ADMIN |
| john.doe | user@123 | USER |
| jane.smith | user@123 | USER |
