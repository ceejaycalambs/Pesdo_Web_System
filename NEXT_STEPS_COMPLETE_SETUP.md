# Next Steps: Complete Admin Email Notification Setup

## ✅ What's Done
- [x] Email service code updated (fixed `process.env` issue)
- [x] Admin notification code added to job submission
- [x] `send-email` Edge Function created and deployed
- [x] CORS issue fixed

## 🔧 What's Left

### Step 1: Create Database Function (Required)

You need to run the SQL script to create the function that allows employers to get admin emails (bypasses RLS).

**Option A: Via Supabase Dashboard (Easiest)**

1. Go to: https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh/sql/new
2. Or: Dashboard → SQL Editor → New Query
3. Open `database/get_admin_emails_for_notifications.sql` in your editor
4. **Copy ALL the SQL code** from that file
5. **Paste it** into the SQL Editor
6. Click **"Run"** or press `Ctrl+Enter`
7. You should see: "Success. No rows returned"

**Option B: Via Supabase CLI**

```bash
# If you have Supabase CLI
supabase db execute -f database/get_admin_emails_for_notifications.sql
```

### Step 2: Verify the Function Works

Test the database function:

1. Go to SQL Editor in Supabase Dashboard
2. Run this query:
   ```sql
   SELECT * FROM public.get_admin_emails_for_notifications();
   ```
3. You should see a list of admin emails (only regular admins, not super_admin)

### Step 3: Test the Complete Flow

1. **As an Employer:**
   - Log in as an employer account
   - Submit a new job vacancy
   - Check browser console for:
     - ✅ `📧 Email Service: Attempting to send email`
     - ✅ `✅ Email notification sent to admin: [email]`

2. **As an Admin:**
   - Check your email inbox
   - You should receive an email with subject: `📋 New Job Vacancy Pending Review: [Job Title]`
   - The email should contain job details and a link to review

3. **Check Edge Function Logs:**
   - Go to: Dashboard → Edge Functions → `send-email` → Logs
   - You should see successful email sends

## 🎯 Expected Behavior

When an employer submits a job:

1. ✅ Job is saved to database
2. ✅ System fetches all admin emails (via RPC function)
3. ✅ Email notifications sent to all regular admins (not super_admin)
4. ✅ Admins receive email with job details
5. ✅ Admins also see web notification (real-time)

## 🐛 Troubleshooting

### If admins don't receive emails:

1. **Check Edge Function Logs:**
   - Dashboard → Edge Functions → `send-email` → Logs
   - Look for errors

2. **Check Browser Console:**
   - Look for error messages
   - Should see: `✅ Email notification sent to admin: [email]`

3. **Verify Database Function:**
   ```sql
   SELECT * FROM public.get_admin_emails_for_notifications();
   ```
   - Should return admin emails
   - If empty, check that you have admin profiles with `role = 'admin'`

4. **Check BREVO_API_KEY:**
   - Dashboard → Edge Functions → `send-email` → Settings → Secrets
   - Make sure `BREVO_API_KEY` is set correctly

### If you get "function does not exist" error:

- Make sure you ran the SQL script from `database/get_admin_emails_for_notifications.sql`
- The function name must be exactly: `get_admin_emails_for_notifications`

### If you get RLS policy errors:

- The database function should bypass RLS (it uses SECURITY DEFINER)
- If still having issues, check that the function was created correctly

## 📋 Checklist

- [ ] Run SQL script: `database/get_admin_emails_for_notifications.sql`
- [ ] Verify function works: `SELECT * FROM public.get_admin_emails_for_notifications();`
- [ ] Test job submission as employer
- [ ] Verify admin receives email
- [ ] Check Edge Function logs for success
- [ ] Verify no errors in browser console

## 🎉 Once Complete

Your admin email notification system will be fully functional:
- ✅ Employers submit jobs → Admins get notified via email
- ✅ Admins also get web notifications (real-time)
- ✅ Only regular admins receive emails (super_admin excluded)
- ✅ All notifications are non-blocking (don't affect job submission)

---

**Ready to test!** Submit a job and check your admin email inbox! 📧

