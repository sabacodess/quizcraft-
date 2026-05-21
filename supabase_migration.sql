-- ============================================================
-- QuizCraft — Full Schema Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. profiles table — XP tracking, streaks, leveling
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_xp       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login     DATE;

-- 2. pdfs table — category assignment
ALTER TABLE pdfs
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'uncategorized';

-- 3. quizzes table — inherit category from parent PDF
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'uncategorized';

-- 4. summaries table — inherit category from parent PDF
ALTER TABLE summaries
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'uncategorized';

-- 5. Backfill: existing rows get defaults instead of NULL
UPDATE profiles  SET total_xp = 0        WHERE total_xp IS NULL;
UPDATE profiles  SET current_streak = 0  WHERE current_streak IS NULL;
UPDATE pdfs      SET category = 'uncategorized' WHERE category IS NULL;
UPDATE quizzes   SET category = 'uncategorized' WHERE category IS NULL;
UPDATE summaries SET category = 'uncategorized' WHERE category IS NULL;

-- Done! All 4 tables now have consistent category support.
