# Fix CORS Error for send-email Edge Function

## Problem
When calling the `send-email` Edge Function from localhost, you get this CORS error:
```
Access to fetch at 'https://qslbiuijmwhirnbyghrh.supabase.co/functions/v1/send-email' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

## Root Cause
The OPTIONS preflight response was missing:
1. Explicit `status: 200` 
2. `Access-Control-Max-Age` header

## Solution
The Edge Function has been fixed. You need to **redeploy** it.

## Quick Fix: Deploy via Supabase Dashboard

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh/edge-functions
2. Or: Dashboard → Edge Functions (left sidebar)

### Step 2: Find `send-email` Function
- Click on the `send-email` function
- If it doesn't exist, click **"New Function"** → Name it `send-email`

### Step 3: Copy Updated Code
- Open `supabase/functions/send-email/index.ts` in your editor
- Copy **ALL** the code

### Step 4: Paste and Deploy
- Paste the code into the Supabase Dashboard editor
- Click **"Deploy"** or **"Save"**

### Step 5: Set Secrets (if not already set)
- In the function page, go to **Settings** → **Secrets**
- Add this secret:
  ```
  BREVO_API_KEY = your_brevo_api_key_here
  ```

### Step 6: Test
- Click **"Invoke"** button
- Use test payload:
  ```json
  {
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Test</h1>"
  }
  ```
- Should return success

## Alternative: Deploy via CLI

If you have Supabase CLI set up:

```bash
# Navigate to project directory
cd c:\Users\User\Desktop\pesdo-web-app

# Deploy the function
supabase functions deploy send-email

# Set secret (if not already set)
supabase secrets set BREVO_API_KEY=your_brevo_api_key_here
```

## After Deployment

1. **Refresh your browser** (to clear any cached errors)
2. **Try submitting a job again** as an employer
3. **Check browser console** - CORS error should be gone
4. **Check Edge Function logs** - Should show email requests

## Verify It's Working

After deployment, when you submit a job, you should see in browser console:
- ✅ `📧 Email Service: Attempting to send email`
- ✅ `🔗 Email Service: Invoking Edge Function "send-email"`
- ✅ `📥 Email Service: Edge Function response received`
- ✅ `✅ Email Service: Email sent successfully`

**No more CORS errors!**

## What Was Fixed

**Before:**
```typescript
if (req.method === 'OPTIONS') {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}
```

**After:**
```typescript
if (req.method === 'OPTIONS') {
  return new Response('', {
    status: 200,  // ✅ Added explicit status
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Max-Age': '86400',  // ✅ Added cache header
    },
  });
}
```

---

*Fixed during development mode investigation*

