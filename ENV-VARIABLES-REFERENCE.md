# Environment Variables Reference

## 📝 Copy-Paste Ready for Vercel

When adding environment variables in Vercel Dashboard (Settings → Environment Variables), use these **exact names**:

### Production Environment Variables:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjEyMzQ1Njc4LCJleHAiOjE5Mjc5MjE2Nzh9.your-anon-key-here
```

### ⚠️ Important Notes:

1. **Variable Names MUST start with `VITE_`** - This is required for Vite to expose them to the client
2. **No spaces** around the `=` sign
3. **No quotes** needed around values in Vercel Dashboard
4. **Copy the FULL anon key** (it's very long, ~200+ characters)

---

## 🔍 How to Verify Environment Variables Are Working:

### Method 1: Browser Console (On Deployed Site)

Open your deployed site and press F12, then type in console:

```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set (hidden for security)' : 'Missing!')
```

### Method 2: Check Network Tab

1. Open DevTools (F12) → Network tab
2. Reload page
3. Look for requests to `supabase.co` domain
4. If you see `401` or `403` errors, environment variables might be wrong
5. If you see `Failed to fetch` or `Network error`, check the URL format

---

## 🛠️ Troubleshooting:

### Problem: "Supabase is not configured!" in console

**Solution:**
- Go to Vercel Dashboard → Settings → Environment Variables
- Verify both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are added
- Make sure they're enabled for **Production** environment
- **Redeploy** the application after adding variables

### Problem: Variables show as "undefined" in production

**Solution:**
- Check variable names match exactly (case-sensitive): `VITE_SUPABASE_URL` not `VITE_SUPABASE_URL_`
- Ensure variables are added to **Production** environment (not just Preview/Development)
- After adding variables, trigger a new deployment

### Problem: Build succeeds but app shows blank screen

**Solution:**
- Check browser console (F12) for specific errors
- Verify environment variables are set correctly (see Method 1 above)
- Check Vercel Function Logs for runtime errors

---

## ✅ Quick Checklist:

- [ ] `VITE_SUPABASE_URL` added (full URL: `https://xxxxx.supabase.co`)
- [ ] `VITE_SUPABASE_ANON_KEY` added (full anon key, very long string)
- [ ] Both variables enabled for **Production** environment
- [ ] Variables have no extra spaces or quotes
- [ ] Redeployed application after adding variables
- [ ] Verified in browser console that variables are accessible
