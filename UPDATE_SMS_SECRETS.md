# Update SMS Gateway Secrets

## Current Issue
The credentials in your SMS Gateway app **don't match** what's in Supabase, causing the 401 error.

## Your Actual Credentials (from SMS Gateway app):
- **Username:** `00PKL3`
- **Password:** `aslp2vayrpzsrq`
- **Device ID:** `nmJJWgn3v2QsOhUg12b-n`
- **Server:** `api.sms-gate.app:443` ✅ (correct)

## Current Supabase Secrets (WRONG):
- **Username:** `7ONAGO` ❌
- **Password:** `25mmhgtotnjptk` ❌
- **Device ID:** `JOfKfT_s1aT-kOYRNVFjy` ❌

## How to Update Supabase Secrets

### Option 1: Via Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh
   - Click **Edge Functions** → `send-sms` → **Settings** → **Secrets**

2. **Update each secret:**
   - Click on `SMS_GATEWAY_USERNAME` → Change value to: `00PKL3`
   - Click on `SMS_GATEWAY_PASSWORD` → Change value to: `aslp2vayrpzsrq`
   - Click on `SMS_GATEWAY_DEVICE_ID` → Change value to: `nmJJWgn3v2QsOhUg12b-n`

3. **Save changes**

### Option 2: Via Supabase CLI

If you have Supabase CLI installed:

```bash
supabase secrets set SMS_GATEWAY_USERNAME=00PKL3
supabase secrets set SMS_GATEWAY_PASSWORD=aslp2vayrpzsrq
supabase secrets set SMS_GATEWAY_DEVICE_ID=nmJJWgn3v2QsOhUg12b-n
```

## After Updating

1. **Test the function again:**
   - Go to Edge Functions → `send-sms` → **Invoke**
   - Use test payload:
     ```json
     {
       "to": "+639159324811",
       "message": "Test message from PESDO"
     }
     ```

2. **Expected result:**
   - Should return `200 OK` instead of `401 Unauthorized`
   - Response should show `"success": true`
   - You should receive SMS on your phone!

3. **Check logs:**
   - Go to **Logs** tab
   - Should see: `✅ SMS sent successfully` instead of `401 Unauthorized`

## Quick Copy-Paste Values

**Username:**
```
00PKL3
```

**Password:**
```
aslp2vayrpzsrq
```

**Device ID:**
```
nmJJWgn3v2QsOhUg12b-n
```

## Verify After Update

After updating secrets, the logs should show:
- `🔐 Credentials check: { hasUsername: true, hasPassword: true, hasDeviceId: true, ... }`
- `📥 Response status: 200 OK` ✅ (instead of 401)
- `✅ SMS sent successfully`

---

**Once you update the secrets, test again and it should work!** 🎉

