-- =====================================================================
-- PRISM-AI - 0009_emotion_check_alignment.sql
-- Align the engagement_records.emotion CHECK constraint with the
-- emotion labels the deployed model actually emits.
--
-- WHY: migration 0008 constrained emotion to six labels
-- (Happy/Sad/Angry/Fear/Disgust/Neutral), but the deployed YOLOv8
-- emotion detector emits TEN classes - see
-- ai-service/edge/face_recognition.py, FALLBACK_EMOTION_CLASSES
-- (lines 152-155): Angry, Disgust, Excited, Fear, Happy, Sad,
-- Serious, Thinking, Worried, neutral. The server persists the raw
-- label verbatim (server/server.js, persistEngagementBatch), so any
-- of the five labels missing from the 0008 CHECK rejects the insert.
--
-- DIVERGENCE HISTORY: the hosted Supabase project
-- (noyafradgbejnufoxdoy) was patched out-of-band through the Supabase
-- Management API to accept all ten model labels plus both casings of
-- neutral ('Neutral' and 'neutral'). That patch fixed the live
-- project but left the migration files behind: a fresh install from
-- migrations alone (0001..0008) would still reject 5 of the 10
-- labels. This migration codifies the patched constraint, so the
-- files and the live database agree again and fresh installs are
-- correct.
--
-- CONSTRAINT NAME: 0008 declared the CHECK inline on the emotion
-- column, which PostgreSQL auto-named engagement_records_emotion_check
-- (first and only CHECK on that column). Drop it if it exists, then
-- re-add under the same name with the full label list.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS before ADD CONSTRAINT, so
-- re-running this file is safe (and every label allowed by 0008 is
-- still allowed below, so re-validating existing rows cannot fail).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Replace the six-label CHECK from 0008 with the ten model labels plus
-- both neutral casings. The IN list is case-sensitive on purpose: the
-- checkpoint's class names carry a lowercase 'neutral', while the 0008
-- schema text used the capitalised spelling, so historical rows and
-- fresh model output are both accepted.
-- ---------------------------------------------------------------------
alter table public.engagement_records
  drop constraint if exists engagement_records_emotion_check;

alter table public.engagement_records
  add constraint engagement_records_emotion_check
  check (emotion in (
    'Angry', 'Disgust', 'Excited', 'Fear', 'Happy',
    'Sad', 'Serious', 'Thinking', 'Worried',
    'neutral', 'Neutral'
  ));
