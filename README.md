# WMS Tracking – Master PTW Tracking Register

Full-stack **Next.js 14 (App Router) + TypeScript + MongoDB** monorepo.
Add PTW records through a form, **import / export Excel**, and keep dated import snapshots and activity history in MongoDB. Includes authentication and user deletion / replacement.

## Monorepo layout

```
wms-tracking/
├── apps/
│   └── web/                     # Next.js app (UI + REST API)
│       ├── scripts/seed-admin.ts
│       └── src/
│           ├── app/             # routes: pages + /api route handlers (thin)
│           ├── components/      # ui/ · layout/ · auth/ · permits/ · files/ · users/
│           ├── hooks/           # SWR data hooks
│           ├── lib/             # env, db, auth(jwt/session), http(errors/response), excel, mappers
│           ├── models/          # Mongoose: User, Permit, FileRecord, Counter
│           ├── services/        # business logic: permit, file, user, auth
│           └── middleware.ts    # signed-session gate for pages + API
└── packages/
    └── shared/                  # @wms/shared – used by client AND server
        └── src/
            ├── constants/       # dropdown options + PERMIT_FIELDS (single source of truth)
            ├── schemas/         # Zod validation (forms, API, Excel import)
            ├── types/           # DTOs
            └── utils/           # date helpers
```

**Design idea:** `PERMIT_FIELDS` (in `packages/shared`) describes every Excel column once – header, type,
dropdown options, section. The form, table, Mongoose schema, Zod validation, Excel export (with dropdown
lists) and Excel import all derive from it. To add or change a column or dropdown value, edit that one file.

Request flow: `route handler` → `service` → `model`. Route handlers only authenticate, validate (Zod) and
delegate; errors are thrown as `AppError` and converted to a uniform `{ success, data | error }` response.

## Getting started

Requirements: Node 18.18+ (20 recommended) and a MongoDB instance (local or Atlas).

```bash
npm install
cp apps/web/.env.example apps/web/.env.local     # then fill in the values
npm run seed:admin                                # creates the first admin user
npm run dev                                       # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run typecheck`, `npm run lint`.

## Features

| Area     | Behaviour                                                                                                                                                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register | Create / edit / delete permits. Dropdown fields (Department, Discipline, PTW types, Certificate, Plant, Yes/No, Status) and date pickers; Sr No is auto-numbered. Search + filters + pagination.                                                                                                    |
| Import   | Upload `.xlsx` (same layout as the original: title row, header on row 3). Each row is validated; invalid rows are skipped and reported with the exact problem. Imports update the current register and save an immutable snapshot grouped by upload date; same-day uploads remain separate batches. |
| Export   | Downloads the (filtered) register as `.xlsx` with styled headers and working dropdown lists in every select column. A blank **template** is also available.                                                                                                                                         |
| History  | Import snapshots and export activity metadata are listed **grouped by date/time** with type, rows, result, and user; filter by type and date range. Imported snapshot data is stored in MongoDB and can be reopened by date.                                                                        |
| Users    | Admin-only management (create, edit, deactivate, role).                                                                                                                                                                                                                                             |

### User deletion / replacement

Deleting a user is a **soft delete** (`isDeleted`), so history never breaks. In the delete dialog you can pick a
**replacement user**: all permits and import/export history owned by the deleted user are re-assigned to
the replacement. Without a replacement, records stay and display the name as "(deleted)".

Guards: you cannot delete yourself, delete / demote the last active admin, or pick an inactive replacement.
Deleted or deactivated users lose access immediately (the session is re-checked against the database on every request).
The deleted user's email can be re-used.

## API overview

| Method             | Path                                      | Notes                                                                                                                   |
| ------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| POST               | `/api/auth/login` · `/logout` · GET `/me` | httpOnly JWT cookie                                                                                                     |
| GET / POST         | `/api/permits`                            | list (`search,status,department,discipline,plantDivision,dateFrom,dateTo,batchId,page,limit,sortBy,sortOrder`) / create |
| GET                | `/api/permits/batches`                    | dated import snapshots and permit / closed counts                                                                       |
| GET / PUT / DELETE | `/api/permits/:id`                        | PUT replaces the record (empty fields are cleared)                                                                      |
| POST               | `/api/permits/import`                     | multipart `file`                                                                                                        |
| GET                | `/api/permits/export`                     | same filters; returns xlsx and records history                                                                          |
| GET                | `/api/permits/template`                   | blank xlsx                                                                                                              |
| GET                | `/api/files`                              | `kind,dateFrom,dateTo,page,limit`                                                                                       |
| GET / DELETE       | `/api/files/:id`                          | Read file-history metadata / delete history; deleting an import also deletes its snapshot                               |
| GET / POST         | `/api/users`                              | create = admin only                                                                                                     |
| PUT / DELETE       | `/api/users/:id`                          | `DELETE ?replacementUserId=<id>`                                                                                        |

## Notes

- If an Atlas `mongodb+srv://` DNS lookup fails, the app and admin seeder retry once using Google and Cloudflare DNS. If your network blocks those resolvers, use a network that permits DNS lookups or the standard (non-SRV) connection string from Atlas.
- Plans last 14 calendar days: the end date is calculated as 13 days after the start date during Excel import or when selecting a start date in the form. The countdown shows when a future plan starts, then counts remaining days inclusively (for example, **1 day left** on the end date) and labels expired plans without changing their Status.
- Dates in the register, import history, and exported workbooks use `DD-MM-YYYY`. Imported snapshots can be edited independently and exported without changing the current register.
- The form and Excel register use **Work Description**; imports still accept the legacy **Work Activity** header. Multiple certificate types can be selected in the form or entered in Excel separated by semicolons. Remarks are included in the register.
- Imported snapshots created before snapshot history was introduced cannot be opened; the original workbook remains available in file history.
- `Commisioing` (typo in the original sheet) is stored as **Commissioning**; the importer accepts the old spelling.
- Certificate Types support multiple selections in the form and semicolon-separated values in Excel. Yes/No fields and Status use radio controls in the form; Status values are **Not Start Yet**, **Not Closed**, and **Closed**.
- User reassignment runs as idempotent updates (no multi-document transaction) so it works on a standalone
  MongoDB; if interrupted, simply repeat the delete.
- Set `APP_TIMEZONE` (e.g. `Asia/Dubai`) so exported file names carry local time.
