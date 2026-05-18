-- =====================================================================
-- PRISM-AI seed data: reference rows only.
-- Run this after 0001_initial_schema.sql.
-- Idempotent: re-running will not produce duplicates.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Years (Year 1 .. Year 6)
-- ---------------------------------------------------------------------
insert into public.years (year_num, label) values
  (1, 'Year 1'),
  (2, 'Year 2'),
  (3, 'Year 3'),
  (4, 'Year 4'),
  (5, 'Year 5'),
  (6, 'Year 6')
on conflict (year_num) do update set label = excluded.label;

-- ---------------------------------------------------------------------
-- Subjects (6 KSSR subjects)
-- ---------------------------------------------------------------------
insert into public.subjects (name) values
  ('English'),
  ('Bahasa Melayu'),
  ('Mathematics'),
  ('Science'),
  ('Pendidikan Islam'),
  ('Pendidikan Moral')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Class sections (5 classes x 6 years = 30 rows)
-- Colours must match the frontend palette exactly.
-- ---------------------------------------------------------------------
insert into public.class_sections (year_num, name, color) values
  -- Year 1
  (1, 'Bestari', '#2F75C9'),
  (1, 'Bijak',   '#E04A3F'),
  (1, 'Cerdik',  '#4FA764'),
  (1, 'Cerdas',  '#EA8534'),
  (1, 'Pandai',  '#F2C744'),
  -- Year 2
  (2, 'Bestari', '#2F75C9'),
  (2, 'Bijak',   '#E04A3F'),
  (2, 'Cerdik',  '#4FA764'),
  (2, 'Cerdas',  '#EA8534'),
  (2, 'Pandai',  '#F2C744'),
  -- Year 3
  (3, 'Bestari', '#2F75C9'),
  (3, 'Bijak',   '#E04A3F'),
  (3, 'Cerdik',  '#4FA764'),
  (3, 'Cerdas',  '#EA8534'),
  (3, 'Pandai',  '#F2C744'),
  -- Year 4
  (4, 'Bestari', '#2F75C9'),
  (4, 'Bijak',   '#E04A3F'),
  (4, 'Cerdik',  '#4FA764'),
  (4, 'Cerdas',  '#EA8534'),
  (4, 'Pandai',  '#F2C744'),
  -- Year 5
  (5, 'Bestari', '#2F75C9'),
  (5, 'Bijak',   '#E04A3F'),
  (5, 'Cerdik',  '#4FA764'),
  (5, 'Cerdas',  '#EA8534'),
  (5, 'Pandai',  '#F2C744'),
  -- Year 6
  (6, 'Bestari', '#2F75C9'),
  (6, 'Bijak',   '#E04A3F'),
  (6, 'Cerdik',  '#4FA764'),
  (6, 'Cerdas',  '#EA8534'),
  (6, 'Pandai',  '#F2C744')
on conflict (year_num, name) do update set color = excluded.color;
