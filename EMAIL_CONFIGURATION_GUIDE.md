# Email Configuration Guide - Brevo API Setup

This guide will walk you through setting up email notifications using Brevo (formerly Sendinblue) API.

## Step 1: Create a Brevo Account

1. Go to [https://www.brevo.com/](https://www.brevo.com/)
2. Click **"Sign Up Free"** or **"Get Started"**
3. Create your account (free tier includes 300 emails/day)
4. Verify your email address

## Step 2: Get Your API Key

1. Log in to your Brevo account
2. Go to **Settings** → **SMTP & API** (or click [here](https://app.brevo.com/settings/keys/api))
3. Under **"API Keys"** section, click **"Generate a new API key"**
4. Give it a name (e.g., "PESDO Email Notifications")
5. Select permissions: **"Send emails"** (or "Full access" if available)
6. Click **"Generate"**
7. **IMPORTANT**: Copy the API key immediately - you won't be able to see it again!
   - It will look like: `xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 3: Set Up Sender Email (Domain Verification)

### Option A: Use Brevo's Default Sender (Quick Setup)
1. Go to **Settings** → **Senders & IP**
2. Click **"Add a sender"**
3. Enter your email address (e.g., `no-reply@pesdosurigao.online`)
4. Verify the email address (Brevo will send a verification email)
5. Click the verification link in your email

### Option B: Use Your Own Domain (Recommended for Production)
1. Go to **Settings** → **Senders & IP**
2. Click **"Add a domain"**
3. Enter your domain (e.g., `pesdosurigao.online`)
4. Add the DNS records Brevo provides to your domain's DNS settings
5. Wait for verification (usually takes a few minutes to 24 hours)

## Step 4: Set the API Key in Supabase

You have two options to set the API key:

### Option A: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   npx supabase login
   ```
   - This will open your browser to authenticate

3. **Link your project** (if not already linked):
   ```bash
   npx supabase link --project-ref qslbiuijmwhirnbyghrh
   ```
   - Replace `qslbiuijmwhirnbyghrh` with your actual project reference if different

4. **Set the API key as a secret**:
   ```bash
   npx supabase secrets set BREVO_API_KEY=your_api_key_here
   ```
   - Replace `your_api_key_here` with the actual API key you copied from Brevo
   - Example: `npx supabase secrets set BREVO_API_KEY=xkeysib-abc123...`

5. **Verify the secret was set**:
   ```bash
   npx supabase secrets list
   ```
   - You should see `BREVO_API_KEY` in the list (the value will be hidden for security)

### Option B: Using Supabase Dashboard (Alternative)

1. Go to your Supabase project dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (`qslbiuijmwhirnbyghrh`)
3. Go to **Project Settings** (gear icon in sidebar)
4. Click on **"Edge Functions"** in the left menu
5. Scroll down to **"Secrets"** section
6. Click **"Add secret"**
7. Enter:
   - **Name**: `BREVO_API_KEY`
   - **Value**: Your Brevo API key (paste it here)
8. Click **"Save"**

## Step 5: Deploy the Email Edge Function

Make sure the `send-email` Edge Function is deployed:

```bash
npx supabase functions deploy send-email
```

If you haven't deployed it yet, the function is located at:
- `supabase/functions/send-email/index.ts`

## Step 6: Test the Configuration

### Test via Browser Console

1. Open your application in the browser
2. Open Developer Tools (F12)
3. Go to the Console tab
4. Trigger a notification (e.g., apply to a job, approve a job, etc.)
5. Look for these messages:
   - ✅ `Email Service: Email sent successfully`
   - ✅ `Email notification sent to [user type]`

### Test via Supabase Dashboard

1. Go to **Edge Functions** → **send-email**
2. Click **"Invoke"** tab
3. Use this test payload:
   ```json
   {
     "to": "your-test-email@example.com",
     "subject": "Test Email from PESDO",
     "html": "<h1>Test Email</h1><p>This is a test email from PESDO.</p>"
   }
   ```
4. Click **"Invoke"**
5. Check your email inbox for the test email

## Troubleshooting

### Issue: "BREVO_API_KEY is not configured"
**Solution**: Make sure you've set the secret correctly:
```bash
npx supabase secrets set BREVO_API_KEY=your_key_here
```

### Issue: "Failed to send email"
**Possible causes**:
1. **Invalid API key**: Double-check the API key in Brevo dashboard
2. **Unverified sender**: Make sure your sender email is verified in Brevo
3. **Rate limit**: Free tier has 300 emails/day limit
4. **Invalid email format**: Check that recipient emails are valid

**Check logs**:
```bash
npx supabase functions logs send-email
```

### Issue: Emails going to spam
**Solutions**:
1. Verify your sender domain in Brevo
2. Set up SPF and DKIM records (Brevo provides these)
3. Use a verified domain instead of a single email address
4. Warm up your domain by sending gradually increasing volumes

### Issue: "Edge Function not found"
**Solution**: Deploy the function:
```bash
npx supabase functions deploy send-email
```

## Security Best Practices

1. **Never commit API keys to Git**: The `.env` file should be in `.gitignore`
2. **Use Supabase Secrets**: Always use Supabase secrets for sensitive data
3. **Rotate keys regularly**: Change your API keys periodically
4. **Limit permissions**: Only grant necessary permissions to API keys
5. **Monitor usage**: Check Brevo dashboard regularly for unusual activity

## Brevo Free Tier Limits

- **300 emails per day**
- **Unlimited contacts**
- **Email support**
- **Basic analytics**

If you need more:
- **Lite Plan**: $25/month - 10,000 emails/month
- **Premium Plan**: $65/month - 20,000 emails/month

## Next Steps

Once configured:
1. ✅ Test email notifications are working
2. ✅ Monitor email delivery in Brevo dashboard
3. ✅ Check Supabase Edge Function logs for any errors
4. ✅ Verify emails are being received (not in spam)

## Support

- **Brevo Support**: [https://help.brevo.com/](https://help.brevo.com/)
- **Supabase Docs**: [https://supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)
- **Edge Functions Logs**: `npx supabase functions logs send-email`

