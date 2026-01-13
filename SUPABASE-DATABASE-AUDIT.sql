-- =====================================================
-- HEALTHHUB SUPABASE DATABASE AUDIT & FIX
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CHECK IF TABLES EXIST
-- =====================================================

-- Check profiles table
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'profiles'
) AS profiles_exists;

-- Check activity_logs table
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'activity_logs'
) AS activity_logs_exists;

-- Check workout_logs table
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'workout_logs'
) AS workout_logs_exists;

-- Check nutrition table
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'nutrition'
) AS nutrition_exists;

-- Check water_logs table
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'water_logs'
) AS water_logs_exists;

-- =====================================================
-- 2. CREATE MISSING TABLES (if needed)
-- =====================================================

-- Create profiles table (if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT,
  avatar_url TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  goal TEXT,
  last_sign_in_at TIMESTAMPTZ,
  logout_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create activity_logs table (if not exists)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL, -- 'workout', 'nutrition', 'water'
  activity_name TEXT,
  calories NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workout_logs table (if not exists)
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workout_id TEXT,
  workout_type TEXT NOT NULL,
  duration_mins NUMERIC DEFAULT 0,
  calories_burned NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nutrition table (if not exists)
CREATE TABLE IF NOT EXISTS public.nutrition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  food_name TEXT NOT NULL,
  calories NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create water_logs table (if not exists)
CREATE TABLE IF NOT EXISTS public.water_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount_ml NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. CHECK RLS STATUS
-- =====================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'activity_logs', 'workout_logs', 'nutrition', 'water_logs');

-- =====================================================
-- 4. DISABLE RLS (TEMPORARY - FOR TESTING ONLY)
-- =====================================================

-- Temporarily disable RLS to test if it's the issue
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.workout_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.nutrition DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.water_logs DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. ENABLE RLS WITH PROPER POLICIES (RECOMMENDED)
-- =====================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity_logs" ON public.activity_logs;

DROP POLICY IF EXISTS "Users can view own workout_logs" ON public.workout_logs;
DROP POLICY IF EXISTS "Users can insert own workout_logs" ON public.workout_logs;

DROP POLICY IF EXISTS "Users can view own nutrition" ON public.nutrition;
DROP POLICY IF EXISTS "Users can insert own nutrition" ON public.nutrition;
DROP POLICY IF EXISTS "Users can delete own nutrition" ON public.nutrition;

DROP POLICY IF EXISTS "Users can view own water_logs" ON public.water_logs;
DROP POLICY IF EXISTS "Users can insert own water_logs" ON public.water_logs;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- =====================================================
-- ACTIVITY_LOGS POLICIES
-- =====================================================

CREATE POLICY "Users can view own activity_logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity_logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- WORKOUT_LOGS POLICIES
-- =====================================================

CREATE POLICY "Users can view own workout_logs"
ON public.workout_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout_logs"
ON public.workout_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- NUTRITION POLICIES
-- =====================================================

CREATE POLICY "Users can view own nutrition"
ON public.nutrition
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition"
ON public.nutrition
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition"
ON public.nutrition
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- WATER_LOGS POLICIES
-- =====================================================

CREATE POLICY "Users can view own water_logs"
ON public.water_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water_logs"
ON public.water_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created 
ON public.activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_created 
ON public.workout_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_user_created 
ON public.nutrition(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_created 
ON public.water_logs(user_id, created_at DESC);

-- =====================================================
-- 7. CREATE STORAGE BUCKET FOR AVATARS
-- =====================================================

-- Run this in the Supabase dashboard or via SQL if you have permissions
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;

-- Set storage policy for avatars bucket
-- This allows authenticated users to upload their own avatars

-- =====================================================
-- 8. VERIFY SETUP
-- =====================================================

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check row counts
SELECT 'profiles' AS table_name, COUNT(*) AS row_count FROM public.profiles
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM public.activity_logs
UNION ALL
SELECT 'workout_logs', COUNT(*) FROM public.workout_logs
UNION ALL
SELECT 'nutrition', COUNT(*) FROM public.nutrition
UNION ALL
SELECT 'water_logs', COUNT(*) FROM public.water_logs;

-- =====================================================
-- 9. TEST QUERIES (Run after authentication)
-- =====================================================

-- Test profiles select
-- SELECT * FROM public.profiles WHERE id = auth.uid();

-- Test activity_logs select for today
-- SELECT * FROM public.activity_logs 
-- WHERE user_id = auth.uid() 
-- AND created_at >= CURRENT_DATE;

-- Test workout_logs select for today
-- SELECT * FROM public.workout_logs 
-- WHERE user_id = auth.uid() 
-- AND created_at >= CURRENT_DATE;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

SELECT '✅ Database setup complete! Please verify:
1. All tables exist
2. RLS is enabled with proper policies
3. Indexes are created
4. Storage bucket for avatars exists' AS status;
