# Twilio SMS Setup Guide

## ✅ Code Updated!

I've updated the `send-sms` Edge Function to use **Twilio** instead of the Android SMS Gateway. Twilio is a legitimate, trusted service used by millions of companies.

## Step 1: Sign Up for Twilio (Free)

1. **Go to:** https://www.twilio.com/try-twilio
2. **Sign up** with your email
3. **Verify your email**
4. **Complete setup** (they'll ask a few questions)

## Step 2: Get Your Credentials

After signing up:

1. **Go to Twilio Console:** https://console.twilio.com
2. **Dashboard shows:**
   - **Account SID** (starts with "AC...")
   - **Auth Token** (click "Show" to reveal)

3. **Get a Phone Number:**
   - Go to **"Phone Numbers"** → **"Manage"** → **"Buy a number"**
   - OR use the **trial number** (free, but limited)
   - Copy the phone number (format: +1234567890)

## Step 3: Update Supabase Secrets

1. **Go to:** Supabase Dashboard → Edge Functions → `send-sms` → **Settings** → **Secrets**

2. **Remove old secrets** (if they exist):
   - `SMS_GATEWAY_USERNAME`
   - `SMS_GATEWAY_PASSWORD`
   - `SMS_GATEWAY_DEVICE_ID`

3. **Add new secrets:**
   - **Key:** `TWILIO_ACCOUNT_SID`
     **Value:** Your Account SID (from Twilio Console)
   
   - **Key:** `TWILIO_AUTH_TOKEN`
     **Value:** Your Auth Token (from Twilio Console)
   
   - **Key:** `TWILIO_PHONE_NUMBER`
     **Value:** Your Twilio phone number (e.g., +1234567890)

## Step 4: Deploy Updated Function

1. **Copy the updated code** from `supabase/functions/send-sms/index.ts`
2. **Go to:** Supabase Dashboard → Edge Functions → `send-sms` → **Code**
3. **Paste the new code**
4. **Click "Deploy"** or "Save"

## Step 5: Test

1. **Go to:** Edge Functions → `send-sms` → **Invoke**
2. **Use test payload:**
   ```json
   {
     "to": "+639159324811",
     "message": "Test message from PESDO via Twilio"
   }
   ```
3. **Click "Invoke"**
4. **Expected:** `200 OK` with `"success": true`
5. **Check your phone** - should receive SMS!

## Pricing

- **Free Trial:** $15.50 credits (~1,000 SMS messages)
- **After Trial:** ~$0.015 per SMS to Philippines
- **Cost for 100 SMS/month:** ~$1.50/month

Very affordable for a legitimate, reliable service!

## Benefits of Twilio

- ✅ **Legitimate & Trusted** - Used by millions
- ✅ **Reliable** - 99.99% uptime
- ✅ **Simple** - Clean REST API
- ✅ **Good Documentation** - Easy to use
- ✅ **Philippines Support** - Works with +63 numbers
- ✅ **Delivery Reports** - Track message status

## Troubleshooting

### Error: "Twilio credentials not configured"
- Make sure all 3 secrets are set in Supabase
- Check secret names are exact: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

### Error: "401 Unauthorized"
- Double-check Account SID and Auth Token are correct
- Make sure you copied them exactly (no extra spaces)

### Error: "Invalid phone number"
- Make sure Twilio phone number includes country code (e.g., +1234567890)
- Verify the number is active in Twilio Console

### Trial Number Limitations
- Trial numbers can only send to verified numbers
- Go to Twilio Console → Phone Numbers → Verified Caller IDs
- Add your test phone number there

## Next Steps

Once it's working:
1. ✅ SMS notifications will work in your app
2. ✅ Jobseeker referrals will send SMS
3. ✅ Application status changes will send SMS
4. ✅ Job approvals will send SMS

**You're all set!** 🎉

