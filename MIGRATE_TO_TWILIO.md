# Migrate to Twilio SMS API

## Why Switch to Twilio?

- ✅ **Legitimate & Trusted** - Used by millions of companies
- ✅ **Free Trial** - $15.50 free credits (~1,000 SMS)
- ✅ **Simple Integration** - Clean REST API
- ✅ **Reliable** - 99.99% uptime
- ✅ **Good Documentation** - Easy to implement
- ✅ **Philippines Support** - Works with +63 numbers

## Step 1: Sign Up for Twilio

1. Go to: https://www.twilio.com/try-twilio
2. Sign up for free account
3. Verify your email
4. Complete setup

## Step 2: Get Your Credentials

After signing up:

1. **Go to Twilio Console:** https://console.twilio.com
2. **Get Account SID:**
   - Dashboard shows your "Account SID"
   - Copy it (starts with "AC...")

3. **Get Auth Token:**
   - Click "Show" next to Auth Token
   - Copy it

4. **Get Phone Number:**
   - Go to "Phone Numbers" → "Manage" → "Buy a number"
   - OR use the trial number (limited, but free)
   - Copy the phone number (format: +1234567890)

## Step 3: Update Edge Function

I'll update the `send-sms` function to use Twilio instead.

## Step 4: Set Secrets in Supabase

Update Supabase secrets:
- `TWILIO_ACCOUNT_SID` = (your Account SID)
- `TWILIO_AUTH_TOKEN` = (your Auth Token)
- `TWILIO_PHONE_NUMBER` = (your Twilio number)

## Step 5: Test

Test the function - should work immediately!

## Pricing

- **Free Trial:** $15.50 credits (~1,000 SMS)
- **After Trial:** ~$0.015 per SMS to Philippines
- **Cost for 100 SMS/month:** ~$1.50/month

Very affordable for a legitimate service!

