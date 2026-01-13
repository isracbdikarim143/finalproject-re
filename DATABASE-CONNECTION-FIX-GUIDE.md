# 🚨 CRITICAL: DATABASE CONNECTION FIX GUIDE

## Problem Diagnosis
Your Dashboard shows '0' because **Row Level Security (RLS) policies** are either:
1. Not configured properly in Supabase
2. Blocking authenticated users from reading their own data

## IMMEDIATE FIX STEPS

### Step 1: Open Supabase Dashboard
Go to: https://supabase.com/dashboard

### Step 2: Select Your Project
Click on your HealthHub project

### Step 3: Run Database Audit SQL

1. Go to **SQL Editor** in left sidebar
2. Click **New Query**
3. Copy and paste the entire content from `SUPABASE-DATABASE-AUDIT.sql`
4. Click **Run** (or press F5)

This will:
- ✅ Check if tables exist
- ✅ Create missing tables
- ✅ Enable RLS with proper policies
- ✅ Create performance indexes
- ✅ Verify setup

### Step 4: Create Avatars Storage Bucket

1. Go to **Storage** in left sidebar
2. Click **New bucket**
3. Name: `avatars`
4. Set to **Public bucket** ✅
5. Click **Create bucket**

Then set the storage policy:
1. Click on `avatars` bucket
2. Go to **Policies** tab
3. Click **New Policy**
4. Template: **Allow authenticated users to upload**
5. Policy name: `Authenticated users can upload avatars`
6. Policy definition:
```sql
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

### Step 5: Verify Database Connection

In Supabase SQL Editor, run:
```sql
-- Check if RLS policies are active
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Should show rowsecurity = true for all tables
```

### Step 6: Test Data Access

1. Login to your app
2. Open browser console (F12)
3. Look for console logs showing:
   - `📊 Dashboard Query:` - Shows query is running
   - `📊 Dashboard Results:` - Shows data returned
4. If you see `0` results but no errors, **RLS is blocking you**

### Step 7: Quick RLS Test (Temporary)

If still not working, temporarily disable RLS to confirm it's the issue:

```sql
-- TEMPORARY: Disable RLS to test
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs DISABLE ROW LEVEL SECURITY;
```

If data shows up after this, **RLS was the problem**. Then re-enable with policies:

```sql
-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
```

## Common RLS Policy Issues

### Issue 1: No SELECT Policy
**Symptom:** Dashboard shows '0', no data visible
**Fix:** Create SELECT policy:
```sql
CREATE POLICY "Users can view own data"
ON public.workout_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

### Issue 2: No INSERT Policy
**Symptom:** "Permission denied" when logging workout/nutrition
**Fix:** Create INSERT policy:
```sql
CREATE POLICY "Users can insert own data"
ON public.workout_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### Issue 3: Wrong user_id Column
**Symptom:** Policies exist but data still not showing
**Fix:** Verify column name is `user_id` not `userId` or `user`:
```sql
-- Check column names
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workout_logs';
```

## Verification Checklist

After running the SQL script, verify:

- [ ] All 5 tables exist (profiles, activity_logs, workout_logs, nutrition, water_logs)
- [ ] RLS is ENABLED on all tables
- [ ] SELECT policies exist for all tables
- [ ] INSERT policies exist for all tables
- [ ] `avatars` storage bucket exists and is public
- [ ] Storage policies allow authenticated uploads
- [ ] Dashboard shows console logs with query results
- [ ] Login works without errors
- [ ] Complete a workout → Dashboard updates

## Testing the Fix

### Test 1: Login
1. Login to app
2. Check console for: `✅ Logout Success` or similar
3. Should redirect to dashboard

### Test 2: Dashboard Data
1. Open Dashboard
2. Check console for: `📊 Dashboard Results: { workouts: X, nutrition: Y, water: Z }`
3. Dashboard should show numbers > 0 if you have data

### Test 3: Complete Workout
1. Go to Workouts page
2. Click "Complete Workout"
3. Check console for: `🔔 Workout change detected:`
4. Dashboard should update immediately

### Test 4: Profile Save
1. Go to Profile
2. Edit height/weight
3. Click Save
4. Should save without blank page
5. BMI should calculate

### Test 5: Logout
1. Click avatar → Logout
2. Should redirect to /login
3. Console shows: `🔄 Redirecting to login...`

## If Still Not Working

### Check Supabase Connection
1. Go to Vercel Dashboard
2. Open your project
3. Go to **Settings** → **Environment Variables**
4. Verify these exist:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Check Vercel Logs
1. Go to Vercel Dashboard
2. Click on your deployment
3. Go to **Logs**
4. Look for errors related to Supabase

### Check Browser Network Tab
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Complete a workout
4. Look for requests to Supabase
5. Check response status:
   - **200 OK** = Success
   - **403 Forbidden** = RLS policy issue
   - **401 Unauthorized** = Authentication issue

## Emergency Fallback

If nothing works, use this SQL to completely disable RLS (NOT RECOMMENDED FOR PRODUCTION):

```sql
-- EMERGENCY ONLY: Disable RLS on all tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs DISABLE ROW LEVEL SECURITY;
```

This will make your app work but is **NOT SECURE**. Once confirmed working, re-enable RLS with proper policies.

## Contact for Help

If you're still stuck after following this guide:
1. Check the console logs and copy any errors
2. Go to Supabase Dashboard → SQL Editor
3. Run: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
4. Send the results

---

**Expected Result After Fix:**
- ✅ Dashboard shows today's workouts/calories/water
- ✅ Real-time updates work
- ✅ Profile saves without blank page
- ✅ Avatar uploads work
- ✅ Logout redirects properly
- ✅ All success messages show ✅

**If you see data in Supabase Table Editor but not in the app, it's 100% an RLS policy issue.**
