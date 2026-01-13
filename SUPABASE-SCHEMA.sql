-- ============================================
-- SUPABASE DATABASE SCHEMA FOR HEALTHHUB APP
-- ============================================
-- This file contains the complete SQL schema for:
-- 1. profiles table (user information)
-- 2. activity_logs table (unified activity tracking)
-- 3. RLS (Row Level Security) policies
-- ============================================

-- ============================================
-- STEP 1: CREATE PROFILES TABLE
-- ============================================
-- This table stores user profile information
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  height_cm NUMERIC(5,2),
  weight_kg NUMERIC(5,2),
  goal TEXT,
  avatar_url TEXT,
  last_sign_in_at TIMESTAMPTZ,
  logout_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 2: CREATE ACTIVITY_LOGS TABLE
-- ============================================
-- This is the UNIFIED table for all activities (workouts, nutrition, water)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('workout', 'nutrition', 'water')),
  activity_name TEXT NOT NULL,
  calories NUMERIC(10,2) DEFAULT 0,
  amount NUMERIC(10,2) DEFAULT 0,
  duration NUMERIC(10,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(activity_type);

-- ============================================
-- STEP 3: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on activity_logs table
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES TABLE RLS POLICIES
-- ============================================

-- Allow users to read their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to insert their own profile (during signup)
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON profiles
  FOR DELETE
  USING (auth.uid() = id);

-- ============================================
-- ACTIVITY_LOGS TABLE RLS POLICIES
-- ============================================

-- Allow users to read their own activity logs
CREATE POLICY "Users can view their own activity logs"
  ON activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own activity logs
CREATE POLICY "Users can insert their own activity logs"
  ON activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own activity logs
CREATE POLICY "Users can update their own activity logs"
  ON activity_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own activity logs
CREATE POLICY "Users can delete their own activity logs"
  ON activity_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: CREATE STORAGE BUCKET FOR AVATARS
-- ============================================
-- Run this in the Supabase Storage dashboard or via SQL:
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for avatars bucket (run in Supabase dashboard):
-- CREATE POLICY "Avatar images are publicly accessible"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');

-- CREATE POLICY "Users can upload their own avatar"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can update their own avatar"
--   ON storage.objects FOR UPDATE
--   USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete their own avatar"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- STEP 5: CREATE FUNCTION TO AUTO-UPDATE updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 6: SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================
-- Insert sample activity logs (replace YOUR_USER_ID with actual user ID)
-- INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount, duration)
-- VALUES 
--   ('YOUR_USER_ID', 'workout', 'Push-ups', 50, 30, 10),
--   ('YOUR_USER_ID', 'nutrition', 'Baasto (Pasta)', 350, 350, 0),
--   ('YOUR_USER_ID', 'water', 'Water Intake', 0, 250, 0);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify your tables are set up correctly:

-- Check if profiles table exists
-- SELECT * FROM profiles LIMIT 1;

-- Check if activity_logs table exists
-- SELECT * FROM activity_logs LIMIT 1;

-- Check RLS policies
-- SELECT * FROM pg_policies WHERE tablename IN ('profiles', 'activity_logs');

-- ============================================
-- MIGRATION FROM OLD TABLES (OPTIONAL)
-- ============================================
-- If you have data in old tables (workout_logs, nutrition, water_logs), 
-- run this to migrate to activity_logs:

-- Migrate workout_logs to activity_logs
-- INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount, duration, created_at)
-- SELECT 
--   user_id,
--   'workout' AS activity_type,
--   workout_type AS activity_name,
--   calories_burned AS calories,
--   duration_mins AS amount,
--   duration_mins AS duration,
--   created_at
-- FROM workout_logs
-- ON CONFLICT DO NOTHING;

-- Migrate nutrition to activity_logs
-- INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount, metadata, created_at)
-- SELECT 
--   user_id,
--   'nutrition' AS activity_type,
--   food_name AS activity_name,
--   calories,
--   calories AS amount,
--   jsonb_build_object('protein', protein, 'carbs', carbs, 'fat', fat) AS metadata,
--   created_at
-- FROM nutrition
-- ON CONFLICT DO NOTHING;

-- Migrate water_logs to activity_logs
-- INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount, metadata, created_at)
-- SELECT 
--   user_id,
--   'water' AS activity_type,
--   'Water Intake' AS activity_name,
--   0 AS calories,
--   amount_ml AS amount,
--   jsonb_build_object('amount_ml', amount_ml) AS metadata,
--   created_at
-- FROM water_logs
-- ON CONFLICT DO NOTHING;

-- ============================================
-- DEPLOYMENT INSTRUCTIONS
-- ============================================
-- 1. Go to your Supabase project dashboard
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Create a new query
-- 4. Copy and paste this entire file
-- 5. Click "Run" to execute the SQL
-- 6. Verify tables are created in the "Table Editor"
-- 7. Check RLS policies in the "Authentication" > "Policies" section
-- ============================================
