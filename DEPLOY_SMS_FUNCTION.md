# How to Deploy SMS Edge Function

## Quick Deploy Steps

### Option 1: Using Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh
   - Login if needed

2. **Navigate to Edge Functions:**
   - Click **Edge Functions** in the left sidebar
   - You should see a list of functions

3. **Deploy the function:**
   - If `send-sms` exists, click on it → **Deploy** or **Redeploy**
   - If it doesn't exist, click **Create Function** → Name it `send-sms`
   - Copy the contents of `supabase/functions/send-sms/index.ts`
   - Paste into the code editor
   - Click **Deploy**

4. **Set Secrets:**
   - Go to **Settings** tab in the function
   - Click **Secrets** section
   - Add these 3 secrets:
     - `SMS_GATEWAY_USERNAME` = `7ONAGO`
     - `SMS_GATEWAY_PASSWORD` = `25mmhgtotnjptk`
     - `SMS_GATEWAY_DEVICE_ID` = `JOfKfT_s1aT-kOYRNVFjy`

---

### Option 2: Using Supabase CLI

**Install Supabase CLI (if not installed):**
```bash
npm install -g supabase
```

**Login:**
```bash
supabase login
```

**Link your project:**
```bash
supabase link --project-ref qslbiuijmwhirnbyghrh
```

**Deploy the function:**
```bash
supabase functions deploy send-sms
```

**Set secrets:**
```bash
supabase secrets set SMS_GATEWAY_USERNAME=7ONAGO
supabase secrets set SMS_GATEWAY_PASSWORD=25mmhgtotnjptk
supabase secrets set SMS_GATEWAY_DEVICE_ID=JOfKfT_s1aT-kOYRNVFjy
```

---

## Verify Deployment

1. **Check function exists:**
   - Go to Supabase Dashboard → Edge Functions
   - You should see `send-sms` in the list

2. **Test the function:**
   - Click on `send-sms` function
   - Click **Invoke** button
   - Use this test payload:
   ```json
   {
     "to": "+639123456789",
     "message": "Test message"
   }
   ```
   - Check the response

3. **Check logs:**
   - Go to **Logs** tab
   - You should see function invocations

---

## After Deployment

Once deployed, the CORS error should be fixed. Try referring a jobseeker again and check:
- Browser console should show `✅ SMS sent successfully`
- No more CORS errors
- SMS should be received on the phone

