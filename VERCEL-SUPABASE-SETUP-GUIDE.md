# 🔧 Vercel + Supabase Setup Guide - Fix "Failed to Fetch" Error

## 📋 Step-by-Step Instructions

### Step 1: Add Environment Variables to Vercel Dashboard

**Exact Location:**
1. Go to: **https://vercel.com/dashboard**
2. Click on your project: **finalproject-re** (or your project name)
3. Click **Settings** (top navigation bar)
4. Click **Environment Variables** (left sidebar)
5. You'll see a form with 3 fields:
   - **Key** (variable name)
   - **Value** (your actual value)
   - **Environment** (Production, Preview, Development)

**Add These TWO Variables:**

#### Variable 1: `VITE_SUPABASE_URL`
- **Key:** `VITE_SUPABASE_URL`
- **Value:** Your Supabase project URL (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
- **Environment:** Check ALL THREE: ✅ Production, ✅ Preview, ✅ Development
- Click **"Add"** button

#### Variable 2: `VITE_SUPABASE_ANON_KEY`
- **Key:** `VITE_SUPABASE_ANON_KEY`
- **Value:** Your Supabase anon/public key (very long string starting with `eyJhbGci...`)
- **Environment:** Check ALL THREE: ✅ Production, ✅ Preview, ✅ Development
- Click **"Add"** button

**⚠️ CRITICAL NOTES:**
- Variable names MUST start with `VITE_` (this is required for Vite)
- NO spaces around the `=` sign in the Key field
- NO quotes needed in the Value field
- Copy the ENTIRE anon key (it's ~200+ characters long)
- After adding, you MUST redeploy (see Step 4)

---

### Step 2: Get Your Supabase Credentials

**Where to Find Them:**
1. Go to: **https://supabase.com/dashboard**
2. Select your project
3. Click **Settings** (gear icon, bottom left)
4. Click **API** (in the Settings menu)

**Copy These Values:**
- **Project URL** → Use as `VITE_SUPABASE_URL`
  - Example: `https://abcdefghijklmnop.supabase.co`
- **anon public** key → Use as `VITE_SUPABASE_ANON_KEY`
  - This is a very long string (JWT token)
  - Starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Copy the ENTIRE string

---

### Step 3: Update Supabase Auth Settings (CORS & Redirects)

**Location:** Supabase Dashboard → Authentication → URL Configuration

#### 3.1. Update Site URL:
```
https://final-project-recat.vercel.app
```
(Or your actual Vercel domain)

#### 3.2. Add Redirect URLs:
Click **"Add URL"** and add these (one by one):
```
https://final-project-recat.vercel.app/**
https://final-project-recat.vercel.app/dashboard
https://final-project-recat.vercel.app/login
https://final-project-recat.vercel.app/signup
http://localhost:5173/**
http://localhost:5173
```

**Note:** The `/**` wildcard allows all routes under your domain.

#### 3.3. Check CORS Settings (API Settings):
1. Go to: **Settings** → **API**
2. Scroll down to **CORS Configuration**
3. Make sure your Vercel domain is allowed:
   - `https://final-project-recat.vercel.app`
   - `https://*.vercel.app` (for preview deployments)

**If CORS section doesn't exist:**
- Supabase handles CORS automatically for allowed redirect URLs
- Just make sure your Site URL and Redirect URLs are set correctly

---

### Step 4: Redeploy on Vercel

**After adding environment variables, you MUST redeploy:**

#### Option A: Automatic Redeploy (Recommended)
1. Push a new commit to GitHub:
   ```bash
   git add .
   git commit -m "Update: Enhanced error handling for Supabase connection"
   git push origin main
   ```
2. Vercel will automatically detect the push and redeploy

#### Option B: Manual Redeploy
1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** tab
3. Click the **⋯** (three dots) on the latest deployment
4. Click **Redeploy**
5. Make sure **"Use existing Build Cache"** is UNCHECKED
6. Click **Redeploy**

---

### Step 5: Verify Setup

#### Check Environment Variables (Browser Console):
1. Open your deployed site: `https://final-project-recat.vercel.app`
2. Press **F12** (open DevTools)
3. Go to **Console** tab
4. Look for these logs:

**✅ If variables are set correctly:**
```
🔍 Supabase Environment Check: { urlExists: true, keyExists: true, ... }
✅ Supabase environment variables are configured correctly
📍 Supabase URL: https://xxxxx.supabase.co...
📍 Redirect URL: https://final-project-recat.vercel.app
```

**❌ If variables are missing:**
```
❌ CRITICAL: Supabase environment variables are missing!
❌ MISSING VITE_SUPABASE_URL
❌ MISSING VITE_SUPABASE_ANON_KEY
```

#### Test Login:
1. Try logging in with valid credentials
2. Check console for any errors
3. If you see "Failed to fetch":
   - Check Step 1 (environment variables)
   - Check Step 3 (Supabase redirect URLs)
   - Check Step 4 (redeployed after adding variables)

---

## 🐛 Troubleshooting "Failed to Fetch" Error

### Issue 1: Environment Variables Not Set
**Symptoms:** Console shows "❌ MISSING" for variables

**Solution:**
- Go back to Step 1
- Double-check variable names start with `VITE_`
- Make sure you enabled for **Production** environment
- Redeploy after adding variables

### Issue 2: CORS Error
**Symptoms:** Console shows CORS error in Network tab

**Solution:**
- Go to Step 3
- Add your Vercel domain to Supabase Redirect URLs
- Make sure Site URL matches your Vercel domain

### Issue 3: Invalid Supabase URL
**Symptoms:** Console shows "Invalid Supabase URL format"

**Solution:**
- Check that URL starts with `https://`
- No trailing slash at the end
- Should be: `https://xxxxx.supabase.co` (not `https://xxxxx.supabase.co/`)

### Issue 4: Variables Set But Still Failing
**Symptoms:** Variables show as "Set" but login still fails

**Solution:**
1. Check Network tab (F12 → Network)
2. Look for requests to `supabase.co` domain
3. Check if they return 401, 403, or CORS errors
4. Verify your anon key is correct (copy full key)
5. Verify your project URL is correct

---

## ✅ Checklist

Before reporting the issue is fixed, verify:

- [ ] `VITE_SUPABASE_URL` added to Vercel (Production, Preview, Development)
- [ ] `VITE_SUPABASE_ANON_KEY` added to Vercel (Production, Preview, Development)
- [ ] Supabase Site URL set to your Vercel domain
- [ ] Supabase Redirect URLs include your Vercel domain with `/**`
- [ ] Application redeployed after adding environment variables
- [ ] Browser console shows "✅ Supabase environment variables are configured correctly"
- [ ] Login works without "Failed to fetch" error
- [ ] Network tab shows successful requests to `supabase.co`

---

## 📞 Quick Reference

**Vercel Environment Variables:**
- Dashboard: https://vercel.com/dashboard
- Path: Project → Settings → Environment Variables

**Supabase Settings:**
- Dashboard: https://supabase.com/dashboard
- API Keys: Settings → API
- Auth URLs: Authentication → URL Configuration

**Your Vercel Domain:**
- Check in Vercel Dashboard → Project → Settings → Domains
- Usually: `your-project-name.vercel.app`

---

## 🆘 Still Having Issues?

If "Failed to fetch" persists after following all steps:

1. **Check Browser Console (F12)** - Look for specific error messages
2. **Check Network Tab (F12 → Network)** - See what requests are failing
3. **Check Vercel Function Logs** - Vercel Dashboard → Project → Functions
4. **Verify Supabase Project is Active** - Make sure it's not paused
5. **Check Supabase Status** - https://status.supabase.com

The enhanced error handling in the code will now show you exactly what's wrong in the browser console!
