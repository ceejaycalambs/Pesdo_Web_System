# Quick Fix for CORS Error

## The Problem
You're getting this error:
```
Access to fetch at 'https://qslbiuijmwhirnbyghrh.supabase.co/functions/v1/send-sms' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

## The Solution
The Edge Function needs to be **redeployed** with the CORS fix.

## Easiest Way: Supabase Dashboard

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh/edge-functions
   - Or: Dashboard → Edge Functions (left sidebar)

2. **Find or Create `send-sms` function:**
   - If it exists: Click on it
   - If it doesn't exist: Click **"New Function"** → Name it `send-sms`

3. **Copy the code:**
   - Open `supabase/functions/send-sms/index.ts` in your editor
   - Copy ALL the code

4. **Paste and Deploy:**
   - Paste the code into the Supabase Dashboard editor
   - Click **"Deploy"** or **"Save"**

5. **Set Secrets (if not already set):**
   - In the function page, go to **Settings** → **Secrets**
   - Add these 3 secrets:
     ```
     SMS_GATEWAY_USERNAME = 7ONAGO
     SMS_GATEWAY_PASSWORD = 25mmhgtotnjptk
     SMS_GATEWAY_DEVICE_ID = JOfKfT_s1aT-kOYRNVFjy
     ```

6. **Test:**
   - Click **"Invoke"** button
   - Use test payload: `{"to": "+639123456789", "message": "Test"}`
   - Should return success

## After Deployment

1. **Refresh your browser** (to clear any cached errors)
2. **Try referring a jobseeker again**
3. **Check browser console** - CORS error should be gone
4. **Check Edge Function logs** - Should show SMS requests

## Verify It's Working

After deployment, when you refer a jobseeker, you should see in browser console:
- ✅ `📱 SMS Service: Attempting to send SMS`
- ✅ `🔗 SMS Service: Invoking Edge Function "send-sms"`
- ✅ `📥 SMS Service: Edge Function response received`
- ✅ `✅ SMS Service: SMS sent successfully`

**No more CORS errors!**

