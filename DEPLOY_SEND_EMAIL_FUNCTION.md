# Deploy send-email Edge Function - Step by Step

## Step 1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh/edge-functions
2. Or navigate: Dashboard → Your Project → Edge Functions (left sidebar)

## Step 2: Create New Function

1. Click the **"New Function"** button (usually top right)
2. Name it: `send-email` (exactly this name, lowercase with hyphen)
3. Click **"Create Function"**

## Step 3: Copy and Paste the Code

1. Open `supabase/functions/send-email/index.ts` in your code editor
2. **Copy ALL the code** from that file
3. **Paste it** into the Supabase Dashboard code editor
4. Click **"Deploy"** or **"Save"**

## Step 4: Set the Secret (BREVO_API_KEY)

1. In the function page, go to **Settings** tab (or look for "Secrets" section)
2. Click **"Add Secret"** or **"Manage Secrets"**
3. Add:
   - **Name**: `BREVO_API_KEY`
   - **Value**: Your Brevo API key (get it from https://app.brevo.com/settings/keys/api)
4. Click **"Save"** or **"Add"**

## Step 5: Test the Function

1. Go to the **"Invoke"** tab in the function page
2. Use this test payload:
   ```json
   {
     "to": "your-email@gmail.com",
     "subject": "Test Email",
     "html": "<h1>Test Email</h1><p>This is a test email from PESDO.</p>"
   }
   ```
3. Click **"Invoke Function"**
4. You should see a success response

## Step 6: Verify It Works

1. Go back to your local app
2. Refresh the browser
3. Try submitting a job as an employer
4. Check the browser console - should see:
   - ✅ `📧 Email Service: Attempting to send email`
   - ✅ `✅ Email Service: Email sent successfully`
   - ❌ No more CORS errors!

## Complete Code (for reference)

The complete code is in: `supabase/functions/send-email/index.ts`

Make sure you copy the **entire file** including:
- All imports and type declarations
- The helper functions (badRequest, ok)
- The main Deno.serve handler
- All CORS headers

## Troubleshooting

### If you get "Function not found" error:
- Make sure the function name is exactly `send-email` (lowercase, with hyphen)
- Wait a few seconds after deploying for it to propagate

### If you get "BREVO_API_KEY is not configured":
- Go to Settings → Secrets
- Make sure `BREVO_API_KEY` is set correctly
- The name must be exactly `BREVO_API_KEY` (case-sensitive)

### If you still get CORS errors:
- Make sure you deployed the latest version with the CORS fix
- Clear browser cache and refresh
- Check that the OPTIONS handler returns status 200

---

**Once deployed, your admin email notifications will work!** 🎉

