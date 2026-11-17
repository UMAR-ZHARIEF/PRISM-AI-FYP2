-- =====================================================================
-- PRISM-AI - 0012_classroom_label.sql
-- One new app_settings column: classroom_label, the string the Python
-- edge (ai-service/edge/face_recognition.py) stamps on every detection
-- it sends to POST /api/attendance as the payload's classroom_id. The
-- value flows app_settings -> startAiProcess() CLI arg (--classroom)
-- -> outgoing detections, and every engagement_records row inherits
-- the same label from the attendance payload server-side.
--
-- Default 'CLASS_1A' preserves continuity with existing data: that
-- exact string was hardcoded in the edge payload until now, so the
-- seeded default keeps new rows landing under the same label. Admins
-- edit it in the Admin Panel's System Settings (AI Service block).
--
-- Nullable by design (no NOT NULL), matching the 0010 knob: a row that
-- predates this column reads as null and the server falls back to its
-- in-code default, so no re-seed is needed. No RLS change: the 0005
-- policies already give staff read access and admins alone the update
-- that editing this label needs.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, so re-running this file is safe.
-- =====================================================================

alter table public.app_settings
  add column if not exists classroom_label text default 'CLASS_1A';
