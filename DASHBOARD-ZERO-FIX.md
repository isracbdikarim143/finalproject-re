# 🔧 DASHBOARD SHOWING 0 - DIAGNOSTIC & FIX

## 🎯 Problem
Dashboard statistics (Calories, Water, Workouts) stay at **0** even after logging data.

---

## 🔍 ROOT CAUSE ANALYSIS

Your Dashboard.jsx is **correctly** configured to query from `activity_logs` table:

```javascript
// ✅ Correct query (line 85-90)
const { data: activities } = await supabase
  .from('activity_logs')  // ✅ Querying correct table
  .select('*')
  .eq('user_id', userId)  // ✅ Filtering by user ID
  .gte('created_at', startOfToday.toISOString())  // ✅ Today's data
  .lte('created_at', endOfToday.toISOString())
```

**The issue**: The `activity_logs` table likely doesn't exist in your Supabase database yet!

---

## 🧪 STEP 1: Open Browser Console & Test

### Open Developer Console:
1. Press **F12** in your browser
2. Go to **Console** tab
3. Look for these messages when you open the Dashboard:

### Expected Console Output:

#### ❌ If `activity_logs` doesn't exist:
```
⚠️ activity_logs table not found. Please run SUPABASE-SCHEMA.sql
```

#### ✅ If `activity_logs` exists but is empty:
```
📊 Dashboard Query (activity_logs ONLY): { userId: '...', startOfToday: '...', endOfToday: '...' }
📊 Dashboard Results (activity_logs): { totalActivities: 0, activities: [] }
📊 Dashboard Stats Updated: { calories: 0, water: 0, workouts: 0 }
```

#### ✅ If `activity_logs` has data:
```
📊 Dashboard Results (activity_logs): { totalActivities: 3, activities: [...] }
📊 Dashboard Stats Updated: { calories: 450, water: 500, workouts: 2 }
```

---

## 🗄️ STEP 2: Verify Supabase Table Exists

### Check if `activity_logs` table exists:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to Table Editor** (left sidebar)
4. **Look for `activity_logs` table**

### If `activity_logs` table is MISSING:
**You need to run the SQL schema!**

---

## 🛠️ STEP 3: Create `activity_logs` Table

### Run This SQL in Supabase:

1. **Go to Supabase Dashboard** → **SQL Editor**
2. **Copy the SQL below** (or use `SUPABASE-SCHEMA.sql` from your project)
3. **Paste and click "Run"**

```sql
-- Create activity_logs table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own activity logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity logs"
  ON activity_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity logs"
  ON activity_logs FOR DELETE
  USING (auth.uid() = user_id);
```

### Verify Table Created:
```sql
-- Run this to verify
SELECT * FROM activity_logs LIMIT 1;
```

If you see "Success. No rows returned", the table exists! ✅

---

## 🧪 STEP 4: Test Data Insertion

### Manually Insert Test Data:

Run this in **Supabase SQL Editor** (replace `YOUR_USER_ID` with your actual user ID):

```sql
-- Get your user ID first
SELECT id, email FROM auth.users LIMIT 1;

-- Insert a test workout (replace 'your-user-id-here')
INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount, duration)
VALUES ('your-user-id-here', 'workout', 'Test Workout', 100, 30, 30);

-- Insert a test nutrition entry
INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount)
VALUES ('your-user-id-here', 'nutrition', 'Test Food', 250, 250);

-- Insert a test water entry
INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount)
VALUES ('your-user-id-here', 'water', 'Water Intake', 0, 250);
```

### Check Data Was Inserted:
```sql
SELECT * FROM activity_logs WHERE user_id = 'your-user-id-here';
```

---

## 🔄 STEP 5: Verify Real-Time Updates

### After creating the table:

1. **Refresh your Dashboard** in the browser
2. **Complete a workout** (go to Workouts page)
3. **Watch the Dashboard** - it should update immediately

### What to Look For:

#### In Browser Console:
```
🔔 Activity change detected: { eventType: 'INSERT', new: {...} }
📊 Dashboard Query (activity_logs ONLY): ...
📊 Dashboard Results (activity_logs): { totalActivities: 1, ... }
📊 Dashboard Stats Updated: { calories: 100, water: 0, workouts: 1 }
```

#### On Dashboard:
- Workouts: Should show **1** (not 0)
- Calories: Should show **100** (not 0)
- Water: Should show **0.0 L**

---

## 🐛 STEP 6: If Still Showing 0

### Check These:

#### 1. Are Workouts/Nutrition pages inserting into `activity_logs`?

Open **Workouts.jsx** and look for:
```javascript
// Should be inserting into activity_logs
await supabase.from('activity_logs').insert({
  user_id: user.id,
  activity_type: 'workout',
  activity_name: workout.name,
  calories: workout.calories,
  amount: workout.duration
})
```

If it's inserting into `workout_logs` instead, that's the problem!

#### 2. Check RLS Policies

Run this in Supabase SQL Editor:
```sql
-- Check if RLS policies exist
SELECT * FROM pg_policies WHERE tablename = 'activity_logs';
```

You should see 4 policies (SELECT, INSERT, UPDATE, DELETE).

#### 3. Check User ID Match

Run this to verify the user ID in activities matches your logged-in user:
```sql
-- Check if user IDs match
SELECT user_id FROM activity_logs LIMIT 5;
SELECT id FROM auth.users WHERE email = 'your-email@example.com';
```

Both should return the same UUID.

#### 4. Check Date Filtering

The Dashboard filters by today's date. Run this to see if there's data for today:
```sql
-- Check today's activities
SELECT * FROM activity_logs 
WHERE created_at >= CURRENT_DATE 
AND created_at < CURRENT_DATE + INTERVAL '1 day';
```

---

## ✅ STEP 7: Expected Behavior After Fix

### When Everything Works:

1. **Open Dashboard** → Shows 0 for all stats ✅
2. **Complete a workout** → Dashboard immediately shows:
   - Workouts: 1 ✅
   - Calories: 100 (or workout calories) ✅
3. **Log food** → Dashboard immediately shows:
   - Calories increase ✅
4. **Add water** → Dashboard immediately shows:
   - Water: 0.3 L (or added amount) ✅

### Browser Console Shows:
```
📊 Dashboard Query (activity_logs ONLY): { userId: '...', startOfToday: '...', ... }
🔔 Activity change detected: { eventType: 'INSERT', ... }
📊 Dashboard Results (activity_logs): { totalActivities: 1, ... }
📊 Dashboard Stats Updated: { calories: 100, water: 0, workouts: 1 }
```

---

## 🎯 QUICK CHECKLIST

Use this checklist to fix the issue:

```
□ Open browser console (F12) and check for errors
□ Go to Supabase → Table Editor → Verify activity_logs exists
□ If missing, run SUPABASE-SCHEMA.sql in SQL Editor
□ Verify RLS policies exist (4 policies)
□ Insert test data manually to verify table works
□ Refresh Dashboard and check if test data appears
□ Complete a workout and verify Dashboard updates
□ Check browser console for "Activity change detected" messages
□ Verify Workouts.jsx inserts into activity_logs (not workout_logs)
□ Verify Nutrition.jsx inserts into activity_logs (not nutrition)
```

---

## 🔗 Related Files

- **SQL Schema**: `SUPABASE-SCHEMA.sql` (run this in Supabase)
- **Dashboard Code**: `src/pages/Dashboard.jsx` (already correct)
- **Workouts Code**: `src/pages/Workouts.jsx` (verify inserts to activity_logs)
- **Nutrition Code**: `src/pages/Nutrition.jsx` (verify inserts to activity_logs)

---

## 🆘 Still Not Working?

### Check This in Browser Console:

1. Open Dashboard
2. Look for this log:
   ```
   📊 Dashboard Results (activity_logs): { totalActivities: X, activities: [...] }
   ```

3. If `totalActivities: 0`:
   - The query is working, but no data exists
   - Check if Workouts/Nutrition are inserting data

4. If you see an error:
   - "activity_logs table not found" → Run SUPABASE-SCHEMA.sql
   - "permission denied" → Check RLS policies
   - "user_id constraint violation" → Check user authentication

---

## 🎊 Success!

You'll know it's working when:
- Dashboard shows 0 initially
- After completing a workout, Dashboard shows 1 workout immediately
- After logging food, Dashboard calories increase immediately
- Browser console shows "Activity change detected" messages
- All stats update in real-time

**Your Dashboard should now update instantly! 🚀**
