# Brevo Auth Email Integration Guide

## Overview
This guide explains how Brevo email integration works for account confirmation and password reset emails in the PESDO system.

## Architecture

### Dual Email System
The system uses a **hybrid approach**:
1. **Supabase Auth** sends its own emails (handles tokens and security)
2. **Brevo** sends branded emails (better design and branding)

Both emails are sent to ensure:
- ✅ Reliability (if one fails, the other delivers)
- ✅ Better user experience (branded Brevo emails)
- ✅ Security (Supabase handles the actual auth tokens)

## Email Types

### 1. Account Confirmation Email
**Trigger**: When a user signs up
**Location**: `src/contexts/AuthContext.jsx` → `signup()` function

**Flow**:
1. User submits registration form
2. Supabase creates account and sends confirmation email
3. Brevo sends branded confirmation email (non-blocking)
4. User receives both emails (can use either link)

**Brevo Email Features**:
- Professional PESDO branding
- Clear call-to-action button
- Link fallback (plain text)
- Expiration notice (24 hours)
- User type-specific messaging

### 2. Password Reset Email
**Trigger**: When user requests password reset
**Location**: `src/pages/ForgotPassword.jsx` → `handleSubmit()`

**Flow**:
1. User enters email in forgot password form
2. Supabase sends password reset email
3. Brevo sends branded password reset email (non-blocking)
4. User receives both emails (can use either link)

**Brevo Email Features**:
- Security warnings
- Clear reset button
- Link fallback (plain text)
- Expiration notice (1 hour)
- Security best practices

## Implementation Details

### Email Service Functions
**Location**: `src/services/emailService.js`

- `sendConfirmationEmail(email, userName, confirmationLink, userType)`
- `sendPasswordResetEmail(email, userName, resetLink)`

Both functions:
- Use the existing `sendEmail()` function
- Call the `send-email` Edge Function
- Include HTML templates with PESDO branding
- Include plain text fallback

### Edge Function
**Location**: `supabase/functions/send-auth-email/index.ts`

A dedicated Edge Function for auth emails that:
- Accepts `type` parameter (`confirmation` or `password_reset`)
- Generates appropriate email templates
- Sends via Brevo API
- Handles errors gracefully

**Note**: Currently, the frontend uses `send-email` Edge Function directly. The `send-auth-email` function is available for future use or direct API calls.

## Configuration

### Required Setup
1. **Brevo API Key**: Already configured (same as notification emails)
   ```bash
   npx supabase secrets set BREVO_API_KEY=your_api_key_here
   ```

2. **Deploy Edge Functions**:
   ```bash
   npx supabase functions deploy send-email
   npx supabase functions deploy send-auth-email  # Optional, for future use
   ```

3. **Verify Sender Email**: Ensure `no-reply@pesdosurigao.online` is verified in Brevo

## Email Templates

### Confirmation Email Template
- **Subject**: "Confirm Your Email - PESDO Surigao"
- **Design**: PESDO gradient header, clean content
- **CTA**: "Confirm Email Address" button
- **Features**: Link fallback, expiration notice

### Password Reset Email Template
- **Subject**: "Reset Your Password - PESDO Surigao"
- **Design**: PESDO gradient header, security-focused
- **CTA**: "Reset Password" button (red for urgency)
- **Features**: Security warnings, link fallback, expiration notice

## User Experience

### What Users See
1. **Registration**:
   - User signs up
   - Receives 2 emails:
     - Supabase confirmation email (default styling)
     - Brevo confirmation email (PESDO branded)
   - Can click either link to confirm

2. **Password Reset**:
   - User requests reset
   - Receives 2 emails:
     - Supabase reset email (default styling)
     - Brevo reset email (PESDO branded)
   - Can click either link to reset

### Benefits
- ✅ **Reliability**: Dual delivery ensures emails are received
- ✅ **Branding**: Brevo emails match PESDO design
- ✅ **User Choice**: Users can use whichever email they prefer
- ✅ **Non-Blocking**: Brevo email failures don't affect auth flow

## Error Handling

### Graceful Degradation
- Brevo email failures are logged but don't block auth
- Supabase emails still work if Brevo fails
- Console logs indicate success/failure of Brevo emails

### Logging
- ✅ Success: `✅ Brevo confirmation email sent`
- ⚠️ Failure: `⚠️ Failed to send Brevo confirmation email (non-critical)`

## Future Enhancements

### Option 1: Replace Supabase Emails
- Disable Supabase email sending
- Use only Brevo emails
- Requires custom token handling

### Option 2: Database Triggers
- Use Supabase Database Triggers
- Automatically send Brevo emails on auth events
- More automated, less code in frontend

### Option 3: Supabase Custom SMTP
- Configure Supabase to use Brevo SMTP
- Single email system
- Requires Supabase Pro plan

## Testing

### Test Confirmation Email
1. Register a new account
2. Check email inbox
3. Verify both Supabase and Brevo emails received
4. Test confirmation link from Brevo email

### Test Password Reset Email
1. Go to forgot password page
2. Enter email address
3. Check email inbox
4. Verify both Supabase and Brevo emails received
5. Test reset link from Brevo email

## Troubleshooting

### Issue: Only Supabase emails received
**Possible causes**:
- Brevo API key not set
- Edge Function not deployed
- Brevo email sending failed (check logs)

**Solution**:
```bash
# Check secrets
npx supabase secrets list

# Check Edge Function logs
npx supabase functions logs send-email
```

### Issue: Brevo emails in spam
**Solution**:
- Verify sender domain in Brevo
- Set up SPF/DKIM records
- Warm up domain gradually

### Issue: Confirmation link doesn't work
**Note**: Currently, Brevo emails use a constructed link. The actual confirmation should use Supabase's link. This is a known limitation.

**Future fix**: Extract actual confirmation link from Supabase response or use database triggers.

## Current Limitations

1. **Confirmation Link**: Brevo confirmation email uses a constructed link. The actual Supabase confirmation link should be used for full functionality.

2. **Password Reset Link**: Similar issue - Brevo email uses a constructed link. Supabase's actual reset link should be used.

3. **Duplicate Emails**: Users receive 2 emails (Supabase + Brevo). This is intentional for reliability but can be optimized.

## Recommendations

1. **Short Term**: Keep dual email system for reliability
2. **Medium Term**: Extract actual links from Supabase responses
3. **Long Term**: Consider Supabase Custom SMTP or database triggers

