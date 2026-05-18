# PRISM-AI seed scripts

One-shot Node.js script that seeds a Supabase project from the mock data
in `PRISM-ai--web/src/data/mockData.js`. It creates real `auth.users`
rows for all 44 staff and ~90 parents, then populates every domain table
(profiles, class_sections, subject_teachers, students, parent_students,
attendance_records, school_events, ai_models, notifications, audit_logs).

The script is **idempotent** — running it a second time is safe. Existing
users are detected via `admin.listUsers()` lookup; every other table is
upserted on its natural key (or deleted-then-inserted for tables with no
unique constraint).

## Prerequisites

1. The schema is already applied (`supabase/migrations/0001_initial_schema.sql`
   and `0002_notifications_scope.sql`).
2. `supabase/seed.sql` has been run, so `years`, `subjects`, and the 30
   `class_sections` rows exist.
3. Node 18+ installed locally.

## Environment variables

| Var                    | Required | Notes                                                                                                                                                                                                                          |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`         | yes      | Your project URL, e.g. `https://abc123.supabase.co`.                                                                                                                                                                           |
| `SUPABASE_SECRET_KEY`  | yes\*    | The new dashboard name for what used to be the `service_role` key. Find it under **Project Settings → API → "Secret key"**. Format starts with `sb_secret_…`. If the dashboard still uses the older naming, look for the `service_role` key marked **secret**. |
| `SUPABASE_SERVICE_KEY` | yes\*    | Fallback name if your tooling still uses the old variable. The script reads this if `SUPABASE_SECRET_KEY` is unset.                                                                                                                                            |
| `STAFF_PASSWORD`       | no       | Shared temporary password for admin / teacher / assistant accounts. Defaults to `Welcome123!`. Staff change it on first login.                                                                                                                                |

\* Exactly one of `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_KEY` must be set.

**WARNING — keep the secret key private.** It bypasses Row Level
Security entirely and grants full read/write across every table.
Never commit it. Never share it in chat, screenshots, or logs.
Treat it the same as a root database password.

## Running

```sh
cd scripts
npm install
node migrate-mock-data.mjs
```

### Setting env vars

**PowerShell (Windows):**

```powershell
$env:SUPABASE_URL = "https://YOUR_REF.supabase.co"
$env:SUPABASE_SECRET_KEY = "sb_secret_..."
$env:STAFF_PASSWORD = "Welcome123!"   # optional
node migrate-mock-data.mjs
```

**bash / zsh (macOS, Linux):**

```sh
export SUPABASE_URL="https://YOUR_REF.supabase.co"
export SUPABASE_SECRET_KEY="sb_secret_..."
export STAFF_PASSWORD="Welcome123!"   # optional
node migrate-mock-data.mjs
```

**Or use a local `.env`** (not committed — see `.gitignore`). Source it
manually before running, e.g.:

```sh
# scripts/.env
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
STAFF_PASSWORD=Welcome123!
```

```sh
set -a; source .env; set +a
node migrate-mock-data.mjs
```

## What the staff get vs what parents get

- **Staff** (admin, teachers, assistant): all use the same `STAFF_PASSWORD`.
  Tell them to change it on first login.
- **Parents**: each gets an unguessable random password. They log in via
  the password-reset flow (we do not blast invitation emails — that
  would hit the free-tier email rate limit).

## Re-running

Safe. Existing `auth.users` rows are detected and reused; every other
table upserts on its natural key. Running twice in a row will produce
the same end state.

## Troubleshooting

- **`cannot read public.years` on startup** — the schema migrations or
  `seed.sql` have not been applied. Apply them via the Supabase
  dashboard's SQL editor (or the CLI) and re-run.
- **`no class_section for year+class lookup`** — `seed.sql` did not
  create the 30 class_sections rows. Re-run it.
- **`createUser` 429 rate limit** — Supabase's auth admin API enforces a
  modest rate limit on free tier. The script processes users serially
  to stay under it, but if you hit it, wait a minute and re-run.
