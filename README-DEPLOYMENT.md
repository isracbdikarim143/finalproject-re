# HealthHub Deployment Guide - Complete Frontend Rebuild

## 🚀 Overview
This guide explains how to deploy the **REBUILT** HealthHub fitness tracking application. The frontend has been **completely rewritten** to sync with the new Supabase table structure using **activity_logs** as the single source of truth.

---

## 📋 What Changed?

### ✅ Database Schema (NEW)
- **`activity_logs`** table: Unified table for all activities (workout, nutrition, water)
- **`profiles`** table: Updated with proper columns (height_cm, weight_kg, username, avatar_url)
- **RLS Policies**: Row-level security enabled for both tables

### ✅ Frontend Logic (REBUILT)
1. **Dashboard.jsx**: Now queries **ONLY** from `activity_logs` table
2. **Progress.jsx**: Now queries **ONLY** from `activity_logs` table
3. **Nutrition.jsx**: Inserts into `activity_logs` with `toast.success()` feedback
4. **Workouts.jsx**: Inserts into `activity_logs` with `toast.success()` feedback
5. **Profile.jsx**: Fixed BMI calculation and removed infinite loading
6. **Topbar.jsx**: Fixed logout button with `window.location.replace('/login')`

---

## 🗄️ STEP 1: Setup Supabase Database

### 1.1 Create Tables
1. Go to your **Supabase Dashboard** → **SQL Editor**
2. Copy the contents of `SUPABASE-SCHEMA.sql`
3. Paste and **Run** the SQL
4. Verify tables are created in **Table Editor**

### 1.2 Verify RLS Policies
1. Go to **Authentication** → **Policies**
2. Verify policies exist for `profiles` and `activity_logs`

### 1.3 Create Storage Bucket (for Avatars)
1. Go to **Storage** → **Create Bucket**
2. Name it `avatars`
3. Set to **Public**
4. Add RLS policies for avatars (see `SUPABASE-SCHEMA.sql`)

---

## 📦 STEP 2: Deploy to Vercel

### 2.1 Environment Variables
Add these to **Vercel** → **Settings** → **Environment Variables**:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2.2 Deploy
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

---

## 🧪 STEP 3: Testing

### Test Checklist
- [ ] **Signup**: Create new account
- [ ] **Login**: Sign in with credentials
- [ ] **Profile**: Update height, weight, avatar → BMI calculates instantly
- [ ] **Dashboard**: Shows 0 for all stats initially
- [ ] **Workouts**: Complete a workout → Dashboard updates immediately
- [ ] **Nutrition**: Log food → Dashboard calories update immediately
- [ ] **Water**: Add water → Dashboard water updates immediately
- [ ] **Progress**: Shows charts with activity details on hover
- [ ] **Logout**: Logout button redirects to `/login`
- [ ] **Session Timer**: Shows session duration in header

---

## 🐛 Common Issues

### Issue 1: "activity_logs table not found"
**Solution**: Run `SUPABASE-SCHEMA.sql` in Supabase SQL Editor

### Issue 2: Dashboard shows 0 even after logging activities
**Solution**: Check browser console for errors. Ensure `activity_logs` has proper RLS policies.

### Issue 3: "Failed to fetch" errors
**Solution**: 
1. Check Vercel environment variables
2. Verify Supabase URL and Anon Key are correct
3. Check Supabase CORS settings

### Issue 4: Profile save leads to blank page
**Solution**: This has been fixed. Profile save now exits immediately with toast notification.

### Issue 5: Logout button doesn't work
**Solution**: This has been fixed. Logout now uses `window.location.replace('/login')`

---

## 🎯 Key Features

### 1. **Unified Activity Tracking**
All activities (workout, nutrition, water) are stored in `activity_logs` table:
```sql
INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount)
VALUES ('user-id', 'workout', 'Push-ups', 50, 30);
```

### 2. **Instant UI Updates**
- Dashboard updates **immediately** after logging activities
- Real-time subscriptions for `activity_logs` table
- Optimistic UI updates for instant feedback

### 3. **Success Notifications**
Every action triggers a success toast:
- ✅ Workout completed
- ✅ Nutrition logged
- ✅ Water added
- ✅ Profile saved

### 4. **BMI Calculation**
Formula: **BMI = weight(kg) / (height(m))²**
- Calculated instantly when height/weight are updated
- Displays category: Underweight, Normal, Overweight, Obese

### 5. **Session Tracking**
- Shows session duration in header
- Displays last login time in profile dropdown
- Tracks logout time in database

---

## 📊 Database Schema

### activity_logs Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users |
| activity_type | TEXT | 'workout', 'nutrition', or 'water' |
| activity_name | TEXT | Name of activity |
| calories | NUMERIC | Calories burned/consumed |
| amount | NUMERIC | Duration (mins) or quantity (ml) |
| duration | NUMERIC | Duration in minutes |
| metadata | JSONB | Additional data (protein, carbs, etc.) |
| created_at | TIMESTAMPTZ | Timestamp |

### profiles Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (references auth.users) |
| full_name | TEXT | User's full name |
| username | TEXT | Unique username |
| height_cm | NUMERIC | Height in centimeters |
| weight_kg | NUMERIC | Weight in kilograms |
| goal | TEXT | Fitness goal |
| avatar_url | TEXT | Path to avatar in storage |
| last_sign_in_at | TIMESTAMPTZ | Last login time |
| logout_time | TIMESTAMPTZ | Last logout time |

---

## 🔄 Migration from Old Tables (Optional)

If you have data in old tables (`workout_logs`, `nutrition`, `water_logs`), run these SQL commands to migrate:

```sql
-- Migrate workout_logs
INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount, duration, created_at)
SELECT user_id, 'workout', workout_type, calories_burned, duration_mins, duration_mins, created_at
FROM workout_logs;

-- Migrate nutrition
INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount, metadata, created_at)
SELECT user_id, 'nutrition', food_name, calories, calories, 
       jsonb_build_object('protein', protein, 'carbs', carbs, 'fat', fat), created_at
FROM nutrition;

-- Migrate water_logs
INSERT INTO activity_logs (user_id, activity_type, activity_name, calories, amount, created_at)
SELECT user_id, 'water', 'Water Intake', 0, amount_ml, created_at
FROM water_logs;
```

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify Supabase connection in Network tab
3. Check `activity_logs` table in Supabase Table Editor
4. Verify RLS policies are enabled

---

## 🎉 Success!

Your HealthHub app is now fully deployed with:
- ✅ Unified activity tracking
- ✅ Real-time dashboard updates
- ✅ Instant BMI calculation
- ✅ Success notifications
- ✅ Fixed logout functionality
- ✅ Session tracking

**Happy Tracking! 💪**
