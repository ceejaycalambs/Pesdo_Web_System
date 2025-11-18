# Verify SMS Gateway Credentials

## What the Logs Tell Us

✅ **Good News:**
- Secrets are loaded correctly in Supabase
- Function code is working
- Request is being sent correctly

❌ **Problem:**
- SMS Gateway API is rejecting the credentials (401 Unauthorized)
- This means the credentials don't match what the API expects

## Step-by-Step Verification

### Step 1: Check SMS Gateway App Settings

1. **Open SMS Gateway app on your Android device**

2. **Go to Cloud Server settings:**
   - Look for "Cloud Server" or "Server Settings"
   - Check these exact values:

   **Current values in Supabase:**
   - Username: `7ONAGO`
   - Password: `25mmhgtotnjptk`
   - Device ID: `JOfKfT_s1aT-kOYRNVFjy`
   - Server: `api.sms-gate.app:443`

3. **Compare with app:**
   - Do they match **exactly**? (case-sensitive!)
   - Is the cloud server toggle **ON** (green)?
   - Is the device **connected** to the server?

### Step 2: Common Issues

#### Issue A: Credentials Changed
**If credentials in app are different:**
- Update Supabase secrets to match the app
- OR update the app to match Supabase

#### Issue B: Device Not Connected
**If device shows "Disconnected" or "Offline":**
- Check internet connection on Android device
- Restart SMS Gateway app
- Toggle cloud server OFF and ON again
- Wait for "Connected" status

#### Issue C: Device ID Changed
**If Device ID is different:**
- Device IDs can change if you reinstall the app
- Update the secret in Supabase with the new Device ID

#### Issue D: Wrong Server Address
**If server address is different:**
- Should be: `api.sms-gate.app:443`
- OR: `https://api.sms-gate.app`
- Check what's in your app

### Step 3: Get Correct Credentials

**From SMS Gateway App:**
1. Open the app
2. Go to Cloud Server settings
3. Note down:
   - **Username** (exact, case-sensitive)
   - **Password** (exact, case-sensitive)
   - **Device ID** (exact, case-sensitive)
   - **Server Address** (exact)

### Step 4: Update Supabase Secrets

**If credentials are different, update them:**

1. Go to Supabase Dashboard → Edge Functions → `send-sms` → Settings → Secrets

2. Update each secret:
   - Click on the secret
   - Enter the correct value from your app
   - Save

3. **OR use CLI:**
   ```bash
   supabase secrets set SMS_GATEWAY_USERNAME=<correct_username>
   supabase secrets set SMS_GATEWAY_PASSWORD=<correct_password>
   supabase secrets set SMS_GATEWAY_DEVICE_ID=<correct_device_id>
   ```

### Step 5: Test Again

After updating credentials:
1. Go to Edge Functions → `send-sms` → Invoke
2. Use test payload:
   ```json
   {
     "to": "+639159324811",
     "message": "Test message from PESDO"
   }
   ```
3. Check response - should be success now!

---

## Alternative: Test API Directly

If you want to verify the credentials work, you can test the API directly:

### Using curl (if you have it):
```bash
curl -X POST https://api.sms-gate.app/mobile/v1/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n '7ONAGO:25mmhgtotnjptk' | base64)" \
  -d '{
    "device_id": "JOfKfT_s1aT-kOYRNVFjy",
    "phone_number": "+639159324811",
    "message": "Test message"
  }'
```

### Using Postman or similar:
- URL: `https://api.sms-gate.app/mobile/v1/send`
- Method: POST
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Basic <base64(username:password)>`
- Body:
  ```json
  {
    "device_id": "JOfKfT_s1aT-kOYRNVFjy",
    "phone_number": "+639159324811",
    "message": "Test message"
  }
  ```

**If this also returns 401:**
- Credentials are definitely wrong
- Check SMS Gateway app for correct values

**If this returns 200:**
- Credentials are correct
- Issue might be with how Supabase is encoding them
- Check Edge Function code

---

## Quick Checklist

Before testing again, verify:
- [ ] Credentials in SMS Gateway app match Supabase secrets exactly
- [ ] Cloud server is enabled (green toggle)
- [ ] Android device is online and connected
- [ ] Device shows "Connected" status in app
- [ ] Server address is correct: `api.sms-gate.app:443`

---

## What to Do Next

1. **Check your SMS Gateway app** - Get the exact credentials
2. **Compare with Supabase secrets** - Do they match?
3. **Update if different** - Update Supabase secrets to match app
4. **Test again** - Should work now!

**Share what you find:**
- What are the credentials in your SMS Gateway app?
- Do they match what's in Supabase?
- Is the device connected in the app?

