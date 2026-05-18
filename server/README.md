# PRISM-AI Bridge Server

Express server that sits between the Python edge AI (`face_recognition.py`)
and the React Dashboard. Receives face-recognition detections, keeps a
live in-memory feed the dashboard polls, and (when configured) persists
each fresh detection to Supabase's `attendance_records` table.

## Required env vars

| Var                  | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `SUPABASE_URL`       | Project URL from Supabase dashboard (Settings → API).         |
| `SUPABASE_SECRET_KEY`| Secret key — **not** the publishable one. Bypasses RLS.       |

If either is missing the bridge still runs — detections just stay in memory
(the dashboard's live feed keeps working, but nothing is written to the DB).

## Setting env vars

Either drop a `server/.env` (copy `.env.example`) — `dotenv` will pick it
up automatically — or export them in your shell before starting:

```powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co"
$env:SUPABASE_SECRET_KEY = "sb_secret_..."
```

```bash
export SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
export SUPABASE_SECRET_KEY="sb_secret_..."
```

`.env` is gitignored; **never** commit real keys.

## Run

```bash
cd server
npm install
npm start          # or: node server.js
```

Server listens on `http://localhost:3001`.

## Endpoints

| Method | Path                       | Used by                                            |
| ------ | -------------------------- | -------------------------------------------------- |
| GET    | `/api/health`              | Health probe (also reports `supabaseEnabled`).     |
| GET    | `/api/attendance`          | Dashboard polls this for live data.                |
| GET    | `/api/attendance/summary`  | Dashboard count cards.                             |
| POST   | `/api/attendance`          | Python `face_recognition.py` posts detections.     |
| POST   | `/api/attendance/reset`    | Clears today's in-memory attendance for a new day. |
| POST   | `/api/students`            | Optional: enrollment script registers a student.   |

## How persistence works

The POST handler:

1. Updates the in-memory store + responds to Python immediately.
2. **Then** (fire-and-forget) for each *new* detection this request:
   - Strips any `" (Class)"` suffix from `student_name`.
   - Looks up `students` by `full_name` (case-insensitive `ilike`).
   - Upserts `attendance_records` keyed on `(student_id, date)` so re-posts
     for the same student/day are idempotent.

A DB failure logs but never blocks the response or breaks the in-memory feed.
