# Fix: Password Reset Email Not Sending

## 🔍 Problem
Password reset request succeeds (`error: null`) but no email is received.

## ✅ Quick Fix Checklist

### Step 1: Add Redirect URL to Supabase (CRITICAL)

The redirect URL must be in Supabase's allowed list:

1. **Go to Supabase Dashboard**
   - Navigate to: **Authentication** → **URL Configuration**
   - Or: **Authentication** → **Settings** → **URL Configuration**

2. **Add These Redirect URLs:**
   ```
   https://pesdosurigao.online/reset-password
   https://www.pesdosurigao.online/reset-password
   https://pesdosurigao.online/reset-password?type=jobseeker
   https://pesdosurigao.online/reset-password?type=employer
   https://www.pesdosurigao.online/reset-password?type=jobseeker
   https://www.pesdosurigao.online/reset-password?type=employer
   http://localhost:5173/reset-password
   http://localhost:5173/reset-password?type=jobseeker
   http://localhost:5173/reset-password?type=employer
   ```

3. **Also Check Site URL:**
   - Set **Site URL** to: `https://pesdosurigao.online` (or `https://www.pesdosurigao.online` if you use www)

### Step 2: Configure SMTP Settings

Supabase needs SMTP configured to send emails:

1. **Go to Supabase Dashboard**
   - Navigate to: **Authentication** → **Settings**
   - Scroll to **SMTP Settings**

2. **Option A: Use Supabase Default SMTP (Easiest)**
   - Supabase provides default SMTP
   - Should work automatically
   - If emails still don't send, use Option B

3. **Option B: Configure Custom SMTP (Recommended)**
   
   **Using Brevo (Free - 300 emails/day):**
   - Sign up at https://www.brevo.com
   - Go to **SMTP & API** → **SMTP**
   - Create an SMTP key
   - In Supabase:
     - **Enable Custom SMTP**: ON
     - **Host**: `smtp-relay.brevo.com`
     - **Port**: `587`
     - **Username**: Your Brevo SMTP login email
     - **Password**: Your Brevo SMTP key
     - **Sender email**: Your verified email (must be verified in Brevo)
     - **Sender name**: PESDO Surigao
   - Click **Save**

   **Using Resend (Free - 3,000 emails/month):**
   - Sign up at https://resend.com
   - Get API key
   - In Supabase:
     - **Enable Custom SMTP**: ON
     - **Host**: `smtp.resend.com`
     - **Port**: `587`
     - **Username**: `resend`
     - **Password**: Your Resend API key
     - **Sender email**: Your verified domain email
     - **Sender name**: PESDO Surigao
   - Click **Save**

### Step 3: Check Email Template

1. **Go to Supabase Dashboard**
   - Navigate to: **Authentication** → **Email Templates**
   - Click on **"Reset Password"** template

2. **Verify Template Has:**
   - `{{ .ConfirmationURL }}` in the template (this is the reset link)
   - Proper subject line
   - HTML and/or plain text body

3. **Test Email:**
   - Use the "Send test email" button to preview
   - Check that the reset link is included

### Step 4: Check Email Rate Limits

Supabase free tier has limits:
- **4 emails per hour per user**
- If you've sent multiple reset requests, wait 1 hour

### Step 5: Check Spam Folder

- Password reset emails often go to spam
- Check spam/junk folder
- Mark as "Not Spam" if found

### Step 6: Verify Email Address Exists

1. **Check if email exists in Supabase:**
   - Go to **Authentication** → **Users**
   - Search for the email address
   - If not found, user needs to sign up first

2. **Check if email is confirmed:**
   - In user details, check "Email Confirmed" status
   - If not confirmed, user needs to verify email first

## 🔧 Debug Steps

### Check Supabase Logs

1. **Go to Supabase Dashboard**
   - Navigate to: **Logs** → **Auth Logs**
   - Look for password reset attempts
   - Check for any errors

### Test with Console

In browser console, check:
```javascript
// The redirect URL should match what's in Supabase
console.log('Redirect URL:', redirectUrl);
```

### Common Issues

1. **URL Mismatch:**
   - Logs show: `https://www.pesdosurigao.online/reset-password?type=jobseeker`
   - But Supabase only has: `https://pesdosurigao.online/reset-password`
   - **Fix**: Add both with and without `www.` prefix

2. **SMTP Not Configured:**
   - Emails won't send without SMTP
   - **Fix**: Configure SMTP (Step 2)

3. **Email Rate Limit:**
   - Too many requests in short time
   - **Fix**: Wait 1 hour, then try again

4. **Email Not Verified in SMTP Service:**
   - Sender email must be verified in Brevo/Resend
   - **Fix**: Verify sender email in your SMTP provider

## ✅ Verification

After fixing, test:

1. **Request password reset**
2. **Check email inbox** (and spam folder)
3. **Click reset link** in email
4. **Verify redirect** to `/reset-password?type=jobseeker` (or `employer`)
5. **Set new password**
6. **Login with new password**

## 📝 Quick Reference

**Supabase Settings to Check:**
- ✅ Authentication → URL Configuration → Redirect URLs
- ✅ Authentication → Settings → SMTP Settings
- ✅ Authentication → Email Templates → Reset Password
- ✅ Authentication → Settings → Site URL

**Redirect URLs to Add:**
- Production: `https://pesdosurigao.online/reset-password*` (with wildcard or specific URLs)
- Development: `http://localhost:5173/reset-password*`

**SMTP Providers (Free):**
- Brevo: 300 emails/day
- Resend: 3,000 emails/month
- Supabase Default: Limited (may not work reliably)

