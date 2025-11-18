# SMS Gateway Debugging Guide

## 🔍 Step-by-Step Debugging

### Step 1: Check Browser Console

1. Open your app in browser
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Try an action that should send SMS (e.g., approve job, accept application)
5. Look for these logs:
   - `✅ SMS notification sent to [recipient]` - Success!
   - `❌ SMS sending error:` - Error occurred
   - `⚠️ Failed to send SMS notification (non-critical):` - SMS failed but action continued

**What to check:**
- Are there any error messages?
- Is the SMS function being called at all?
- What's the exact error message?

---

### Step 2: Verify Edge Function is Deployed

**Check in Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh
2. Click **Edge Functions** in left sidebar
3. Look for `send-sms` function
4. If it's **NOT there**, deploy it:

```bash
cd c:\Users\User\Desktop\pesdo-web-app
supabase functions deploy send-sms
```

**Expected output:**
```
Deploying function send-sms...
Function send-sms deployed successfully
```

---

### Step 3: Verify Secrets are Set

**In Supabase Dashboard:**
1. Go to **Edge Functions** → `send-sms`
2. Click **Settings** tab
3. Look for **Secrets** section
4. Verify these 3 secrets exist:
   - `SMS_GATEWAY_USERNAME`
   - `SMS_GATEWAY_PASSWORD`
   - `SMS_GATEWAY_DEVICE_ID`

**If secrets are missing, set them via CLI:**
```bash
supabase secrets set SMS_GATEWAY_USERNAME=7ONAGO
supabase secrets set SMS_GATEWAY_PASSWORD=25mmhgtotnjptk
supabase secrets set SMS_GATEWAY_DEVICE_ID=JOfKfT_s1aT-kOYRNVFjy
```

**Verify secrets are set:**
```bash
supabase secrets list
```

You should see all 3 secrets listed.

---

### Step 4: Check Edge Function Logs

**In Supabase Dashboard:**
1. Go to **Edge Functions** → `send-sms`
2. Click **Logs** tab
3. Try sending an SMS
4. Check the logs for:
   - `🔐 Credentials check:` - Shows if credentials are loaded
   - `📤 SMS Request:` - Shows the request being sent
   - `📥 Response status:` - Shows API response
   - `✅ SMS sent successfully` - Success!
   - `❌ SMS Gateway error` - Error occurred

**What to look for:**
- If you see `hasUsername: false` → Secrets not set
- If you see `status: 401` → Wrong credentials
- If you see `status: 404` → Wrong API endpoint
- If you see `Failed to connect` → Network/device issue

---

### Step 5: Test Edge Function Directly

**Option A: Via Supabase Dashboard**
1. Go to **Edge Functions** → `send-sms`
2. Click **Invoke** button
3. Use this test payload:
```json
{
  "to": "+639123456789",
  "message": "Test message from PESDO"
}
```
4. Click **Invoke**
5. Check the response

**Option B: Via Browser Console**
Open browser console (F12) and run:
```javascript
const { data, error } = await supabase.functions.invoke('send-sms', {
  body: { 
    to: '+639123456789', 
    message: 'Test message from PESDO' 
  }
});
console.log('Response:', { data, error });
```

---

### Step 6: Verify Android Device

**Check SMS Gateway App:**
1. ✅ Device is powered on
2. ✅ SMS Gateway app is running (not closed)
3. ✅ Cloud server toggle is **ON** (green)
4. ✅ Device has active SIM card
5. ✅ Device is connected to internet (WiFi or mobile data)
6. ✅ Server address: `api.sms-gate.app:443`
7. ✅ Username: `7ONAGO`
8. ✅ Password: `25mmhgtotnjptk`
9. ✅ Device ID: `JOfKfT_s1aT-kOYRNVFjy`

**Test device connection:**
- Open SMS Gateway app
- Check if it shows "Connected" or "Online"
- Look for any error messages in the app

---

### Step 7: Verify Phone Numbers in Database

**Check jobseeker profiles:**
1. Go to Supabase Dashboard → **Table Editor**
2. Open `jobseeker_profiles` table
3. Check `phone` column
4. Verify format: `+639123456789` (not `09123456789`)

**Check employer profiles:**
1. Open `employer_profiles` table
2. Check `mobile_number` column
3. Verify format: `+639123456789`

**If phone numbers are missing or wrong format:**
- Edit the profile
- Add phone number in format: `+639XXXXXXXXX`
- Save changes

---

## 🐛 Common Errors & Solutions

### Error 1: "Function not found" or 404
**Cause:** Edge Function not deployed

**Solution:**
```bash
supabase functions deploy send-sms
```

---

### Error 2: "SMS Gateway credentials not configured"
**Cause:** Secrets not set

**Solution:**
```bash
supabase secrets set SMS_GATEWAY_USERNAME=7ONAGO
supabase secrets set SMS_GATEWAY_PASSWORD=25mmhgtotnjptk
supabase secrets set SMS_GATEWAY_DEVICE_ID=JOfKfT_s1aT-kOYRNVFjy
```

**Then redeploy:**
```bash
supabase functions deploy send-sms
```

---

### Error 3: "401 Unauthorized" or "403 Forbidden"
**Cause:** Wrong credentials

**Solution:**
1. Double-check credentials in SMS Gateway app
2. Verify they match the secrets:
   - Username: `7ONAGO`
   - Password: `25mmhgtotnjptk`
   - Device ID: `JOfKfT_s1aT-kOYRNVFjy`
3. Update secrets if different:
```bash
supabase secrets set SMS_GATEWAY_USERNAME=<correct_username>
supabase secrets set SMS_GATEWAY_PASSWORD=<correct_password>
supabase secrets set SMS_GATEWAY_DEVICE_ID=<correct_device_id>
```

---

### Error 4: "Failed to connect to SMS Gateway"
**Cause:** Network issue or device offline

**Solution:**
1. Check Android device is online
2. Check SMS Gateway app is running
3. Verify internet connection on device
4. Restart SMS Gateway app
5. Check if device can access `api.sms-gate.app`

---

### Error 5: "No phone number found"
**Cause:** Phone number missing in database

**Solution:**
1. Add phone number to profile
2. Use format: `+639XXXXXXXXX`
3. For jobseekers: Update `phone` column
4. For employers: Update `mobile_number` column

---

### Error 6: SMS sent but not received
**Cause:** Device or network issue

**Solution:**
1. Check Android device SMS logs
2. Verify SIM card has SMS credits
3. Check recipient phone number is correct
4. Verify device has proper SMS permissions
5. Check SMS Gateway app logs

---

## 📋 Quick Diagnostic Checklist

Run through this checklist:

- [ ] Edge Function `send-sms` exists in Supabase Dashboard
- [ ] All 3 secrets are set (check via `supabase secrets list`)
- [ ] Edge Function logs show function is being called
- [ ] Browser console shows SMS function is being invoked
- [ ] Android device is online and SMS Gateway app is running
- [ ] Cloud server is enabled in SMS Gateway app
- [ ] Phone numbers exist in database with correct format
- [ ] Test via Supabase Dashboard → Edge Functions → Invoke works

---

## 🧪 Test Commands

**1. Check if function exists:**
```bash
supabase functions list
```

**2. Deploy function:**
```bash
supabase functions deploy send-sms
```

**3. List secrets:**
```bash
supabase secrets list
```

**4. Set secrets:**
```bash
supabase secrets set SMS_GATEWAY_USERNAME=7ONAGO
supabase secrets set SMS_GATEWAY_PASSWORD=25mmhgtotnjptk
supabase secrets set SMS_GATEWAY_DEVICE_ID=JOfKfT_s1aT-kOYRNVFjy
```

**5. Test function locally (if Supabase CLI is set up):**
```bash
supabase functions serve send-sms
```

---

## 📞 What to Share for Help

If it's still not working, share:

1. **Browser Console Logs:**
   - Copy all logs related to SMS
   - Look for `📱`, `❌`, `✅` emojis

2. **Edge Function Logs:**
   - From Supabase Dashboard → Edge Functions → send-sms → Logs
   - Copy the latest log entries

3. **Error Message:**
   - Exact error text
   - Status code if any

4. **Test Results:**
   - What happens when you test via Supabase Dashboard?
   - What's the response?

This will help identify the exact issue!

