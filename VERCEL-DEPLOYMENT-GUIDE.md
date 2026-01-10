# Vercel Deployment Guide - Fitness & Health Tracker

## 🔧 Step 1: Environment Variables Setup

### Required Environment Variables

You need to add these **exact** environment variables in your Vercel Dashboard:

1. Go to your Vercel project: https://vercel.com/dashboard
2. Navigate to: **Settings** → **Environment Variables**
3. Add the following variables:

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `VITE_SUPABASE_URL` | Your Supabase Project URL | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon/Public Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### How to Find Your Supabase Credentials:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **anon public** key → Use as `VITE_SUPABASE_ANON_KEY`

### Important Notes:
- ✅ Make sure variable names start with `VITE_` (required for Vite)
- ✅ Add to **Production**, **Preview**, and **Development** environments
- ✅ After adding, **redeploy** your application (Vercel will auto-redeploy or go to Deployments → Redeploy)

---

## 🏗️ Step 2: Build Settings Verification

Your `package.json` already has the correct build command:

```json
{
  "scripts": {
    "build": "vite build"
  }
}
```

**Vercel will automatically detect Vite**, but verify in Vercel Dashboard:
- Go to **Settings** → **General**
- Ensure:
  - **Framework Preset**: Vite (or auto-detected)
  - **Build Command**: `npm run build` (default)
  - **Output Directory**: `dist` (default for Vite)
  - **Install Command**: `npm install` (default)

---

## 🐛 Step 3: Debugging & Checking Logs

### A. Check Build Logs (During Deployment)

1. Go to **Vercel Dashboard** → Your Project
2. Click on the latest **Deployment**
3. Click on **Build Logs** tab
4. Look for:
   - ❌ Red errors (build failures)
   - ⚠️ Yellow warnings (may not break but should check)
   - ✅ Green success messages

### B. Check Runtime Logs (Function Logs)

1. Go to **Vercel Dashboard** → Your Project
2. Click on **Functions** tab (left sidebar)
3. Look for any errors in function invocations

### C. Check Browser Console (Client-Side Errors)

1. Open your deployed site: `https://final-project-recat.vercel.app`
2. Press `F12` (or right-click → Inspect)
3. Go to **Console** tab
4. Look for:
   - Red errors (especially Supabase connection errors)
   - Environment variable warnings
   - Network errors (404, 500, etc.)

### D. Common Error Messages & Fixes

| Error Message | Cause | Fix |
|--------------|-------|-----|
| `Supabase is not configured!` | Missing env vars | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel |
| `Cannot GET /dashboard` | Routing issue | Ensure `vercel.json` has rewrites (already added) |
| `Blank white screen` | React error | Check browser console for component errors |
| `Network request failed` | CORS/Supabase issue | Check Supabase Site URL (see Step 4) |
| `401 Unauthorized` | Auth issue | Check Supabase Site URL and Redirect URLs |

---

## 🔐 Step 4: Supabase Configuration

### Update Supabase Auth Settings

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to: **Authentication** → **URL Configuration**
3. Update the following:

#### Site URL:
```
https://final-project-recat.vercel.app
```

#### Redirect URLs (Add these):
```
https://final-project-recat.vercel.app/**
https://final-project-recat.vercel.app/dashboard
https://final-project-recat.vercel.app/login
https://final-project-recat.vercel.app/signup
```

**Important:** The `/**` wildcard allows all routes under your domain to handle Supabase auth callbacks.

### Update Supabase RLS Policies (If Needed)

Ensure your Storage bucket `avatars` has proper RLS policies:

```sql
-- Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to update own avatars
CREATE POLICY "Authenticated users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND name LIKE 'avatar_' || auth.uid()::text || '%');

-- Allow authenticated users to view avatars
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
```

---

## 📋 Step 5: Verification Checklist

After deployment, verify:

- [ ] Environment variables added to Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Build completed successfully (check Build Logs)
- [ ] Site URL updated in Supabase Dashboard
- [ ] Redirect URLs added to Supabase
- [ ] Application loads (not blank screen)
- [ ] Login/Signup pages work
- [ ] Authentication redirects correctly
- [ ] No console errors (check browser F12)

---

## 🔄 Step 6: Redeploy After Changes

After updating environment variables or Supabase settings:

1. **Option A (Auto):** Vercel will auto-redeploy on next git push
2. **Option B (Manual):**
   - Go to **Deployments** tab in Vercel
   - Click **⋯** (three dots) on latest deployment
   - Click **Redeploy**

---

## 🆘 Troubleshooting Blank White Screen

If you still see a blank white screen:

### 1. Check Environment Variables
```bash
# Add this to your code temporarily to debug (remove after fixing)
console.log('Env check:', {
  url: import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing',
  key: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
})
```

### 2. Check Browser Console
- Open DevTools (F12)
- Look for React errors
- Look for network failures
- Check if any files are 404 (missing)

### 3. Check Network Tab
- Open DevTools → Network tab
- Reload page
- Check for failed requests (red)
- Verify `index.html` loads (200 status)

### 4. Verify Build Output
- Go to Vercel → Deployments → Latest
- Check Build Logs for errors
- Verify `dist` folder was created

### 5. Test Locally First
```bash
npm run build
npm run preview
```
If local preview works but Vercel doesn't, it's likely an environment variable issue.

---

## 📞 Quick Debugging Commands

Add this to your browser console on the deployed site to check configuration:

```javascript
// Check if Supabase is configured
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing')
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')

// Check build mode
console.log('Production mode:', import.meta.env.PROD)
console.log('Mode:', import.meta.env.MODE)
```

---

## ✅ Success Indicators

Your app is working correctly if:

1. ✅ No blank white screen
2. ✅ Login/Signup pages load
3. ✅ Can sign up and log in
4. ✅ Redirects to `/dashboard` after login
5. ✅ Dashboard shows data (after creating profile)
6. ✅ No console errors (or only harmless warnings)

---

## 🔗 Useful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Your Deployed App**: https://final-project-recat.vercel.app

---

**Need More Help?** Check the browser console (F12) and Vercel build logs for specific error messages.
