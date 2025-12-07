# Update TextBee API Credentials

Since you've changed your TextBee registered device and have a new API, you need to update the credentials in Supabase.

## Method 1: Using Supabase CLI (Recommended)

### Prerequisites
- Supabase CLI installed: `npm install -g supabase`
- Your new TextBee API Key and Device ID from https://textbee.dev/dashboard

### Steps:

1. **Login to Supabase CLI:**
   ```bash
   supabase login
   ```

2. **Link your project** (if not already linked):
   ```bash
   supabase link --project-ref qslbiuijmwhirnbyghrh
   ```

3. **Update the secrets with your new credentials:**
   ```bash
   supabase secrets set TEXTBEE_API_KEY=your_new_api_key_here
   supabase secrets set TEXTBEE_DEVICE_ID=your_new_device_id_here
   ```

   Replace:
   - `your_new_api_key_here` with your actual new API key
   - `your_new_device_id_here` with your actual new device ID

4. **Verify the secrets were set:**
   ```bash
   supabase secrets list
   ```

## Method 2: Using Supabase Dashboard (Web Interface)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `qslbiuijmwhirnbyghrh`
3. Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
4. Update the following secrets:
   - `TEXTBEE_API_KEY` - Enter your new API key
   - `TEXTBEE_DEVICE_ID` - Enter your new device ID
5. Click **Save** or **Update**

## Get Your New Credentials

1. Go to https://textbee.dev/dashboard
2. Log in to your account
3. Find your new device
4. Copy the **API Key** and **Device ID**

## Verify It's Working

After updating the credentials, test by sending an SMS through your application. The Edge Function will automatically use the new credentials.

## Troubleshooting

If SMS still doesn't work after updating:

1. **Check the Edge Function logs:**
   - Go to Supabase Dashboard → Edge Functions → `send-sms` → Logs
   - Look for any error messages

2. **Verify credentials format:**
   - API Key should be a string (no spaces)
   - Device ID should be a string (no spaces)

3. **Test the Edge Function directly:**
   ```bash
   supabase functions invoke send-sms --body '{"to":"+639123456789","message":"Test message"}'
   ```

## Notes

- The credentials are stored securely as environment variables in Supabase
- No code changes are needed - the Edge Function reads from environment variables
- Changes take effect immediately after updating the secrets
- The old device credentials will stop working once you update them


