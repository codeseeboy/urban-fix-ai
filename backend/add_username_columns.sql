-- ============================================================================
-- UrbanFix AI — Add Username, City, Ward, Interests columns
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================================

-- Add username column with unique constraint
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

-- Add city column
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;

-- Add ward column
ALTER TABLE users ADD COLUMN IF NOT EXISTS ward TEXT;

-- Add interests column (array of strings)
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username)) WHERE username IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('username', 'city', 'ward', 'interests');
