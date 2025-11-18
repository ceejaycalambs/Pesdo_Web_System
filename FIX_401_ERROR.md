# Fix 401 Unauthorized Error

## The Problem
You're getting a **401 Unauthorized** error, which means:
- ✅ Function code is correct (no more "Hello undefined!")
- ✅ Function is running
- ❌ Authentication with SMS Gateway API is failing

## Possible Causes

### 1. Secrets Not Set
The secrets might not be set in Supabase.

**How to check:**
1. Go to Supabase Dashboard → Edge Functions → `send-sms`
2. Click **Settings** tab
3. Look for **Secrets** section
4. Verify these 3 secrets exist:
   - `SMS_GATEWAY_USERNAME`
   - `SMS_GATEWAY_PASSWORD`
   - `SMS_GATEWAY_DEVICE_ID`

**How to fix:**
If secrets are missing, add them:
- `SMS_GATEWAY_USERNAME` = `7ONAGO`
- `SMS_GATEWAY_PASSWORD` = `25mmhgtotnjptk`
- `SMS_GATEWAY_DEVICE_ID` = `JOfKfT_s1aT-kOYRNVFjy`

---

### 2. Wrong Credentials
The credentials might not match what's in your SMS Gateway app.

**How to check:**
1. Open your SMS Gateway app on Android
2. Check these settings:
   - **Username:** Should be `7ONAGO`
   - **Password:** Should be `25mmhgtotnjptk`
   - **Device ID:** Should be `JOfKfT_s1aT-kOYRNVFjy`
   - **Server:** Should be `api.sms-gate.app:443`

**How to fix:**
If they don't match:
- Update the secrets in Supabase to match your app
- OR update your app to match the secrets

---

### 3. Check Edge Function Logs
The logs will show what credentials are being used.

**How to check:**
1. Go to Supabase Dashboard → Edge Functions → `send-sms`
2. Click **Logs** tab
3. Look for the latest log entry
4. Check for:
   - `🔐 Credentials check:` - Shows if credentials are loaded
   - `📤 SMS Request:` - Shows the request being sent
   - `📥 Response status: 401` - Confirms 401 error

**What to look for:**
- If `hasUsername: false` → Secrets not set
- If `hasUsername: true` but still 401 → Wrong credentials

---

## Step-by-Step Fix

### Step 1: Verify Secrets in Supabase
1. Go to: https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh
2. Click **Edge Functions** → `send-sms` → **Settings** → **Secrets**
3. Verify all 3 secrets exist with correct values

### Step 2: Verify Credentials in SMS Gateway App
1. Open SMS Gateway app on Android
2. Check **Cloud Server** settings
3. Verify:
   - Username: `7ONAGO`
   - Password: `25mmhgtotnjptk`
   - Device ID: `JOfKfT_s1aT-kOYRNVFjy`
   - Server: `api.sms-gate.app:443`
   - Cloud server toggle is **ON** (green)

### Step 3: Check Edge Function Logs
1. In Supabase Dashboard → Edge Functions → `send-sms` → **Logs**
2. Run the test again
3. Check the logs for:
   - `🔐 Credentials check:` - Should show `hasUsername: true, hasPassword: true, hasDeviceId: true`
   - `📥 Response status: 401` - This confirms the 401 error

### Step 4: Test Again
1. Click **Invoke** button
2. Use test payload:
   ```json
   {
     "to": "+639159324811",
     "message": "Test message from PESDO"
   }
   ```
3. Check the response

---

## Common Issues & Solutions

### Issue: Secrets show as "not set" in logs
**Solution:**
- Go to Settings → Secrets
- Add all 3 secrets
- Redeploy the function (or it should auto-update)

### Issue: Credentials are set but still 401
**Possible causes:**
1. **Wrong password** - Double-check the password in SMS Gateway app
2. **Device offline** - Check if Android device is online
3. **Cloud server disabled** - Check if toggle is ON in app
4. **Wrong server address** - Should be `api.sms-gate.app:443`

**Solution:**
- Verify credentials match exactly (case-sensitive)
- Check Android device is online
- Restart SMS Gateway app
- Verify cloud server is enabled

### Issue: Device ID mismatch
**Solution:**
- Check Device ID in SMS Gateway app
- Update secret in Supabase if different
- Device ID is case-sensitive

---

## Quick Test Checklist

Before testing, verify:
- [ ] All 3 secrets are set in Supabase
- [ ] Credentials match SMS Gateway app exactly
- [ ] Android device is online
- [ ] SMS Gateway app is running
- [ ] Cloud server is enabled (green toggle)
- [ ] Server address is `api.sms-gate.app:443`

---

## Expected Logs (Success)

When working correctly, logs should show:
```
🔐 Credentials check: { hasUsername: true, hasPassword: true, hasDeviceId: true, ... }
📤 SMS Request: { endpoint: 'https://api.sms-gate.app/mobile/v1/send', phone: '+639159324811', ... }
📥 Response status: 200 OK
✅ SMS sent successfully: { messageId: '...', phone: '+639159324811', ... }
```

---

## Expected Logs (401 Error)

When getting 401, logs will show:
```
🔐 Credentials check: { hasUsername: true, hasPassword: true, hasDeviceId: true, ... }
📤 SMS Request: { endpoint: 'https://api.sms-gate.app/mobile/v1/send', phone: '+639159324811', ... }
📥 Response status: 401 Unauthorized
❌ SMS Gateway error response: { status: 401, statusText: 'Unauthorized', body: '...' }
```

---

## Next Steps

1. **Check the logs** - This will tell you exactly what's wrong
2. **Verify secrets** - Make sure they're set correctly
3. **Verify app credentials** - Make sure they match
4. **Test again** - After fixing, test again

Share what you see in the **Logs** tab, and I can help identify the exact issue!

