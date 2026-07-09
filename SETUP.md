# PRISM-AI — Fresh Machine Setup

This guide takes a brand-new machine from `git clone` to a working system:
web dashboard, Express bridge, Supabase database, and the Python
face-recognition service streaming live from a webcam.

> **Security note — this repo is public.** Every key/URL below is a
> placeholder. Never paste real Supabase keys (especially the **secret**
> key) into any committed file. The real env files (`.env`, `.env.local`)
> are gitignored; only the `.example` files are committed.

## Architecture (what you are about to run)

```
Browser ── React + Vite dev server (:5173)
              │  /api proxied ──────────► Express bridge (:3001) ──► hosted Supabase
              │                              │                       (PostgreSQL + Auth + RLS)
              │  /stream proxied ─────────► Python edge AI (127.0.0.1:5174)
              │                              (InsightFace SCRFD + ArcFace, GPU)
              └── Camera page Start/Stop ──► bridge spawns/kills the Python process
```

- The **Python edge AI** owns the webcam exclusively, serves an annotated
  MJPEG stream on `127.0.0.1:5174/stream`, and POSTs recognized students to
  the bridge (`/api/attendance`) every 10 seconds.
- The **Express bridge** (`server/server.js`, port 3001) receives detections,
  persists them to Supabase, and is the only place the Supabase **secret**
  key lives.
- The webcam, the Python service, and the Express bridge must all run on the
  **same machine**. You do not start Python by hand — an admin or teacher
  starts/stops it from the web app's Camera page.
- `ai-service/edge/enrolled_students.json` (face embeddings — biometric data)
  is **gitignored**. A fresh clone has **no enrolled faces**; you enroll them
  later via Admin Panel → Face Registration.

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js + npm | **20 LTS or newer** | Vite 8 requires a recent Node (no `engines` field is declared, but older Node will fail). Also runs the bridge and the seeder. |
| Python | **3.11** (project venv was built with 3.11.9) | InsightFace + OpenCV edge service. |
| Git | any recent | clone the repo. |
| A webcam | any | only needed for the AI/camera features. |
| A GPU | DirectX 12-capable (Windows: NVIDIA/AMD/Intel, incl. integrated) or NVIDIA CUDA (Linux) | **required for the AI camera service only** — it refuses to start without one ("Incompatible hardware — GPU required"; no CPU fallback). The web app itself runs on anything. |
| A Supabase account | free tier is fine | hosted PostgreSQL + Auth. Create a new project at <https://supabase.com> before step 5. |
| Internet | once, at first AI start | auto-downloads the InsightFace `buffalo_l` model pack (~280 MB). |

Check your versions:

```powershell
node --version    # want v20.x or newer
py -3.11 --version    # Windows launcher; on macOS/Linux: python3.11 --version
git --version
```

## Clone

```powershell
git clone https://github.com/UMAR-ZHARIEF/PRISM-AI-FYP2.git
cd PRISM-AI-FYP2
```

Repo layout you will touch during setup:

```
PRISM-ai--web/    React frontend (note the double hyphen in the folder name)
server/           Express bridge
scripts/          one-shot Supabase demo-data seeder
ai-service/edge/  Python face recognition + enrollment
supabase/         SQL migrations + seed
```

## 1) Frontend install

React 19 + Vite 8, with supabase-js, recharts, jspdf, papaparse.

```powershell
cd PRISM-ai--web
npm install
cd ..
```

(Lockfiles are committed, so `npm ci` also works if you want exact versions.)

Available scripts: `npm run dev` (dev server), `npm run build`,
`npm run lint`, `npm run preview`.

## 2) Server install

Express 5 bridge with @supabase/supabase-js, cors, dotenv.

```powershell
cd server
npm install
cd ..
```

Started later with `npm start` (which runs `node server.js`). The port is
fixed at **3001**.

## 3) Seeder install

Small ESM Node project used once to load demo data into Supabase.

```powershell
cd scripts
npm install
cd ..
```

## 4) Python venv + requirements

The bridge expects the venv at exactly `ai-service/edge/venv` — it launches
`venv\Scripts\python.exe` (Windows) or `venv/bin/python` (macOS/Linux)
itself, so do not rename or relocate it.

**Windows (PowerShell):**

```powershell
cd ai-service\edge
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..\..
```

If `Activate.ps1` is blocked by execution policy, either run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or skip
activation and call the venv directly:
`.\venv\Scripts\python.exe -m pip install -r requirements.txt`.

**macOS / Linux:**

```sh
cd ai-service/edge
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ../..
```

`requirements.txt` pulls `insightface>=0.7.3`, `opencv-python`, `numpy`,
`requests`, `Pillow`, and a **GPU** onnxruntime build — `onnxruntime-directml`
on Windows (works on any DirectX 12 GPU: NVIDIA, AMD, or Intel integrated) or
`onnxruntime-gpu` on Linux (needs NVIDIA CUDA 12 + cuDNN 9). The AI service
**requires a GPU** and refuses to start with
`Incompatible hardware — GPU required` if no CUDA/DirectML provider is
available; there is deliberately no CPU fallback. macOS has neither CUDA nor
DirectML, so a Mac cannot be the camera machine (the web app still runs).
Under DirectML the face detector runs at its native 640x640 input (other
sizes crash the DirectML provider) — the service adjusts this automatically
and logs the override.
If pip tries to compile InsightFace's C++ extension on Windows and fails,
install the "Microsoft C++ Build Tools" (Visual Studio Build Tools) and
re-run the `pip install`.

## 5) Environment files

Two files must be created; both are gitignored. Copy the committed examples:

```powershell
Copy-Item PRISM-ai--web\.env.local.example PRISM-ai--web\.env.local
Copy-Item server\.env.example server\.env
```

(macOS/Linux: `cp PRISM-ai--web/.env.local.example PRISM-ai--web/.env.local`
and `cp server/.env.example server/.env`.)

Then fill in the values from your Supabase dashboard:
**Project Settings → API**.

**`PRISM-ai--web/.env.local`** — frontend. Uses the *publishable* (anon) key,
which is safe to expose to browsers because Row Level Security enforces
access:

```ini
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLISHABLE-KEY
```

**`server/.env`** — bridge. Uses the **secret** key (`sb_secret_...`, the new
name for the old `service_role` key). It **bypasses RLS entirely**:

```ini
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_YOUR-SECRET-KEY
```

> **WARNING:** never commit these files, never paste the secret key into
> chat, screenshots, logs, or frontend code. Treat it like a root database
> password. `.gitignore` already excludes `.env`, `.env.local`,
> `server/.env`, and `scripts/.env`.

The server reads `server/.env` via `dotenv` from its working directory, so
always start it from inside `server/`.

## 6) Database setup (migrations + seed)

Run the SQL by hand in the Supabase dashboard (**SQL Editor → New query**,
paste the whole file, **Run**). Apply in this exact order — all files are
idempotent, so re-running is safe:

1. `supabase/migrations/0001_initial_schema.sql` — enums, all tables,
   indexes, triggers (auto-profile on signup), helper functions, RLS
   policies.
2. `supabase/migrations/0002_notifications_scope.sql` — notification
   scoping (user / role / global).
3. `supabase/migrations/0003_consent_and_policies.sql` — PDPA consent and
   policy-document tables.
4. `supabase/migrations/0003_notifications_staff_insert.sql` — broadens the
   notifications INSERT policy to all authenticated users.

   *(Yes, there are two `0003_` files — an accepted numbering collision.
   Run **both**; they touch different objects and their relative order does
   not matter.)*
5. `supabase/seed.sql` — reference data: 6 years, 6 KSSR subjects, 30 class
   sections.

Verify in **Table Editor**: `years` has 6 rows, `subjects` 6, and
`class_sections` 30.

### Demo data (optional but recommended)

`scripts/migrate-mock-data.mjs` creates real `auth.users` for all 44 mock
staff and ~90 parents and populates every domain table (students,
attendance, events, notifications, ...). It is idempotent — safe to re-run.
Full details, including the `STAFF_PASSWORD` variable and its default, are
in [`scripts/README.md`](scripts/README.md).

```powershell
cd scripts
$env:SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co"
$env:SUPABASE_SECRET_KEY = "sb_secret_YOUR-SECRET-KEY"
# optional: $env:STAFF_PASSWORD = "a-temporary-staff-password"
node migrate-mock-data.mjs
cd ..
```

(macOS/Linux: `export SUPABASE_URL=...` etc., then `node migrate-mock-data.mjs`.)

### No demo data? Create one admin by hand

The app requires signing in, and starting the AI requires an **admin or
teacher**. If you skipped the seeder:

1. Supabase dashboard → **Authentication → Users → Add user** (email +
   password, auto-confirm).
2. The `on_auth_user_created` trigger creates a `profiles` row with the
   default role `parent`. Promote it in the SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

## 7) Run it

**Terminal 1 — Express bridge:**

```powershell
cd server
npm start
```

**Terminal 2 — Vite dev server:**

```powershell
cd PRISM-ai--web
npm run dev
```

**Then start the AI from the browser** (the bridge spawns the Python process
for you — it is not a third terminal):

1. Open <http://localhost:5173> and sign in as an admin or teacher.
2. Go to **Dashboard → Camera** (`/dashboard/camera`).
3. Click **Start AI**. On the very first start, InsightFace downloads the
   `buffalo_l` model pack (~280 MB) into `%USERPROFILE%\.insightface`
   (`~/.insightface` on macOS/Linux) — needs internet once; the download is
   shared across all projects on the machine, so later starts are fast.
4. The annotated live feed appears on the Camera page (Vite proxies
   `/stream` to the Python MJPEG server on `127.0.0.1:5174`).

Stop the AI with the **Stop AI** button on the same page.

### Enrolling faces (needed before anyone can be recognized)

A fresh clone recognizes nobody — `enrolled_students.json` is gitignored.
To enroll:

1. **Stop the AI first** if it is running (both processes grab the same
   webcam; the bridge refuses enrollment with
   `Stop the AI service first before enrolling` while the AI runs).
2. Sign in as an **admin** (enrollment is admin-only, unlike Start/Stop).
3. **Dashboard → Admin Panel → Face Registration**, pick the student, and
   follow the capture window (press `c` to capture).
4. Start the AI again.

## 8) Smoke test checklist

Run through these in order; each proves one layer works.

- [ ] <http://localhost:5173> loads the landing page.
- [ ] Bridge health: returns `"supabaseEnabled": true` (if `false`, fix
      `server/.env` and restart the server):

  ```powershell
  Invoke-RestMethod http://localhost:3001/api/health
  # macOS/Linux: curl http://localhost:3001/api/health
  ```

  (Also reachable through the Vite proxy at
  <http://localhost:5173/api/health>.)
- [ ] You can sign in and reach `/dashboard/camera`.
- [ ] Clicking **Start AI** brings up the annotated camera stream (an FPS/
      faces HUD is drawn on the frames).
- [ ] With at least one face enrolled, stand in front of the camera: within
      ~10 seconds (the Python service POSTs on a 10 s interval) the student
      lands in the **Detected Students** list on the Camera page.
      Unrecognized faces show as red "Unknown" boxes on the stream but are
      never sent to the list — only enrolled students are.

## Troubleshooting

**Zombie `python.exe` holds the camera / port 5174.** If the AI was killed
uncleanly (server crash, closed terminal), a leftover Python process keeps
the webcam and the stream port, so the next Start AI fails or shows a black
feed. Kill it:

```powershell
Get-Process python | Stop-Process -Force
```

(macOS/Linux: `pkill -f face_recognition.py`.)

**Port already in use (3001 / 5173 / 5174).** Find the owner and kill it:

```powershell
Get-NetTCPConnection -LocalPort 3001,5173,5174 -State Listen |
  Select-Object LocalPort, OwningProcess
Get-Process -Id <PID-from-above>
Stop-Process -Id <PID-from-above> -Force
```

**Supabase project paused (free tier).** Free-tier projects pause after
roughly a week of inactivity. Symptoms: DNS errors like "no such host" for
`YOUR-PROJECT-REF.supabase.co`, or the app stuck on a loading spinner.
Fix: open the Supabase dashboard and click **Restore/Resume** on the
project, then reload the app.

**"Incompatible hardware — GPU required" when starting the AI or enrolling.**
The machine has no usable GPU execution provider. The Python service checks
for CUDA/DirectML at startup and refuses to run on CPU by design. Fixes:
on Windows make sure the venv has `onnxruntime-directml` (not plain
`onnxruntime`) and the machine has a DirectX 12 GPU with a working driver;
on Linux install `onnxruntime-gpu` plus NVIDIA CUDA 12 + cuDNN 9. Run the
camera service on a GPU machine — the web app and bridge can stay anywhere.

**First Start AI hangs or fails on the model download.** The `buffalo_l`
download needs outbound internet; corporate firewalls/proxies can block it.
Retry on an open network. If a partial download got corrupted, delete
`%USERPROFILE%\.insightface\models\buffalo_l` and start the AI again.

**"Python venv not found" when clicking Start AI.** The bridge could not
find `ai-service/edge/venv`. Redo step 4 (the venv must be named `venv` and
live inside `ai-service/edge`).

**Camera won't open, or UGREEN / low-resolution webcams.** On Windows the
code deliberately opens the camera with OpenCV's **DirectShow (`CAP_DSHOW`)
backend and does not force a resolution** — it uses the camera's native one,
because forcing 1280x720 breaks low-res cameras such as UGREEN's default
640x480. If the camera still won't open: close every other app using it
(including a leftover enrollment window), check Windows Settings → Privacy →
Camera allows desktop apps, and make sure no zombie `python.exe` is holding
it (see above).

**Enrollment returns "Stop the AI service first before enrolling".** By
design — recognition and enrollment cannot share the webcam. Stop the AI,
enroll, start it again.

**`pip install` fails with `SSL: CERTIFICATE_VERIFY_FAILED` (self-signed
certificate in certificate chain).** Antivirus/web filters that intercept
HTTPS break pip, because pip trusts only its own bundled CA list (not the
Windows certificate store where the filter registered its root). Workaround:

```powershell
pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt
```

**Seeder fails with `cannot read public.years` / missing class_sections.**
The migrations or `seed.sql` were not applied (step 6). Apply them and
re-run; the seeder is idempotent. More cases in `scripts/README.md`.
