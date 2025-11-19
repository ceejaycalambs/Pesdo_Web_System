# 📧📱 Email & SMS Flow Architecture

## System Overview

The PESDO system uses a **dual-channel notification system** (Email + SMS) for business notifications, ensuring users receive important updates through multiple channels. Authentication emails are handled by Supabase Auth.

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  User Actions (Jobseeker/Employer/Admin)                 │  │
│  │  - Apply to job                                           │  │
│  │  - Update application status                              │  │
│  │  - Approve job                                            │  │
│  │  - Verify employer                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Service Layer                                            │  │
│  │  📧 src/services/emailService.js                          │  │
│  │  📱 src/services/smsService.js                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Serverless)                │
│  ┌──────────────────────────┐  ┌──────────────────────────┐   │
│  │  send-email/index.ts     │  │  send-sms/index.ts        │   │
│  │  (Brevo API Integration) │  │  (TextBee API Integration)│   │
│  └──────────────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
│  ┌──────────────────────────┐  ┌──────────────────────────┐   │
│  │  Brevo (Email Provider)  │  │  TextBee.dev (SMS)       │   │
│  │  api.brevo.com           │  │  api.textbee.dev         │   │
│  └──────────────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    📧 Email Delivered
                    📱 SMS Delivered
```

---

## 🔄 Complete Flow: Jobseeker Applies to Job

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: User Action                                            │
│  Jobseeker clicks "Apply" button                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Database Operation                                     │
│  Application record created in 'applications' table             │
│  Location: JobseekerDashboard.jsx → handleApplyToJob()          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Fetch Recipient Data                                   │
│  Query employer_profiles table for:                             │
│  - mobile_number (for SMS)                                      │
│  - contact_email or email (for Email)                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Parallel Notification Execution                        │
│                                                                 │
│  ┌────────────────────────────┐  ┌──────────────────────────┐ │
│  │  SMS Channel               │  │  Email Channel           │ │
│  │                            │  │                          │ │
│  │  sendNewApplicationSMS()   │  │  sendNewApplicationEmail()│ │
│  │  ↓                         │  │  ↓                       │ │
│  │  sendSMS({to, message})    │  │  sendEmail({to, subject, │ │
│  │  ↓                         │  │         html, text})     │ │
│  │  supabase.functions.invoke│  │  supabase.functions.invoke│ │
│  │  ('send-sms', {...})       │  │  ('send-email', {...})   │ │
│  │  ↓                         │  │  ↓                       │ │
│  │  Edge Function:            │  │  Edge Function:           │ │
│  │  send-sms/index.ts         │  │  send-email/index.ts      │ │
│  │  ↓                         │  │  ↓                       │ │
│  │  TextBee API Call         │  │  Brevo API Call          │ │
│  │  ↓                         │  │  ↓                       │ │
│  │  📱 SMS Sent               │  │  📧 Email Sent            │ │
│  └────────────────────────────┘  └──────────────────────────┘ │
│                                                                 │
│  ⚠️ Both execute in parallel (non-blocking)                    │
│  ⚠️ Failures are independent (one can fail, other succeeds)     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Activity Logging                                       │
│  Log action to 'activity_logs' table                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: UI Update                                              │
│  Show success message to jobseeker                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 All Notification Flows Matrix

| # | Trigger | Actor | Recipient | SMS Function | Email Function | File Location |
|---|---------|-------|-----------|--------------|---------------|---------------|
| 1 | Apply to job | Jobseeker | Employer | `sendNewApplicationSMS()` | `sendNewApplicationEmail()` | `JobseekerDashboard.jsx` |
| 2 | Update application status | Employer | Jobseeker | `sendApplicationStatusSMS()` | `sendApplicationStatusEmail()` | `EmployerDashboard.jsx` |
| 3 | Approve job | Admin | Employer | `sendJobApprovalSMS()` | `sendJobApprovalEmail()` | `JobManagementSimplified.jsx` |
| 4 | Refer jobseeker | Admin | Jobseeker | `sendApplicationStatusSMS()` | `sendApplicationStatusEmail()` | `JobManagementSimplified.jsx` |
| 5 | Verify employer | Admin | Employer | `sendSMS()` | `sendEmployerVerificationEmail()` | `EmployerVerificationSimple.jsx` |
| 6 | Submit job vacancy | Employer | Admin (only) | ❌ None | `sendNewJobSubmissionEmail()` | `EmployerDashboard.jsx` |
| 7 | Signup | User | User | ❌ None | ✅ Supabase Auth | `AuthContext.jsx` |
| 8 | Password reset | User | User | ❌ None | ✅ Supabase Auth | `ForgotPassword.jsx` |

---

## 🔧 Service Layer Details

### Email Service (`src/services/emailService.js`)

**Base Function:**
```javascript
sendEmail({ to, subject, html, text, senderName })
  ↓
supabase.functions.invoke('send-email', { body: {...} })
  ↓
Edge Function: send-email/index.ts
  ↓
Brevo API: api.brevo.com/v3/smtp/email
```

**Template Functions:**
- `sendApplicationStatusEmail()` - Status updates (accepted/rejected/referred)
- `sendNewApplicationEmail()` - New application notifications
- `sendJobApprovalEmail()` - Job approval notifications
- `sendEmployerVerificationEmail()` - Verification status
- `sendNewJobSubmissionEmail()` - ⭐ New job vacancy submission (notifies admins)
- `sendConfirmationEmail()` - ⚠️ Not used (Supabase handles)
- `sendPasswordResetEmail()` - ⚠️ Not used (Supabase handles)
- `sendWelcomeEmail()` - ⚠️ Not used

### SMS Service (`src/services/smsService.js`)

**Base Function:**
```javascript
sendSMS({ to, message })
  ↓
formatPhoneNumber() - Converts to E.164 format (+63XXXXXXXXXX)
  ↓
supabase.functions.invoke('send-sms', { body: {...} })
  ↓
Edge Function: send-sms/index.ts
  ↓
TextBee API: api.textbee.dev/api/v1/gateway/devices/{deviceId}/send-sms
```

**Template Functions:**
- `sendApplicationStatusSMS()` - Status updates (accepted/rejected/referred)
- `sendNewApplicationSMS()` - New application notifications
- `sendJobApprovalSMS()` - Job approval notifications
- `sendWelcomeSMS()` - ⚠️ Not used

---

## 🔐 Edge Functions Architecture

### Email Edge Function (`supabase/functions/send-email/index.ts`)

```
Request Received
    ↓
Validate JSON payload (to, subject, html)
    ↓
Get BREVO_API_KEY from environment
    ↓
Format request body:
  - sender: { email: 'no-reply@pesdosurigao.online', name: 'PESDO Surigao' }
  - to: [{ email: recipient }]
  - subject, htmlContent, textContent
    ↓
POST to Brevo API: api.brevo.com/v3/smtp/email
    ↓
Return success/error response
```

**Environment Variables:**
- `BREVO_API_KEY` - Brevo API key (stored as Supabase secret)

### SMS Edge Function (`supabase/functions/send-sms/index.ts`)

```
Request Received
    ↓
Validate JSON payload (to, message)
    ↓
Get TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID from environment
    ↓
Normalize phone number to E.164 format:
  - Handles: 09123456789, +639123456789, 639123456789, 9123456789
  - Converts to: +639123456789
    ↓
Format request body:
  - recipients: [normalizedPhone]
  - message: messageText
    ↓
POST to TextBee API: api.textbee.dev/api/v1/gateway/devices/{deviceId}/send-sms
    ↓
Return success/error response
```

**Environment Variables:**
- `TEXTBEE_API_KEY` - TextBee API key (stored as Supabase secret)
- `TEXTBEE_DEVICE_ID` - TextBee device ID (stored as Supabase secret)

---

## 📱 Email Flow Details

### Email Provider: Brevo (formerly Sendinblue)

**Configuration:**
- Sender Email: `no-reply@pesdosurigao.online`
- Sender Name: `PESDO Surigao`
- API Endpoint: `https://api.brevo.com/v3/smtp/email`
- Authentication: API Key (header: `api-key`)

**Email Templates:**
All emails use HTML templates with:
- Responsive design
- Brand colors (PESDO blue: #005177, #0079a1)
- Call-to-action buttons
- Plain text fallback

**Email Types:**
1. **Application Status** - Status-specific designs (accepted/rejected/referred)
2. **New Application** - Notification to employer
3. **Job Approval** - Confirmation to employer
4. **Employer Verification** - Approval/rejection notification

---

## 📱 SMS Flow Details

### SMS Provider: TextBee.dev

**Configuration:**
- Uses Android device as SMS gateway
- Free service (uses device's SIM card)
- API Endpoint: `https://api.textbee.dev/api/v1/gateway/devices/{deviceId}/send-sms`
- Authentication: API Key (header: `x-api-key`)

**Phone Number Format:**
- Required: E.164 format (`+639123456789`)
- Auto-conversion handles:
  - `09123456789` → `+639123456789`
  - `9123456789` → `+639123456789`
  - `639123456789` → `+639123456789`
  - `+639123456789` → `+639123456789` (already correct)

**SMS Message Format:**
- Concise, informative messages
- Includes recipient name
- Includes relevant details (job title, company, status)
- Ends with "- PESDO" signature

---

## 🔄 Parallel Execution Pattern

All business notifications follow this pattern:

```
Action Completed
    ↓
Fetch Recipient Profile
    ├─ Phone Number (for SMS)
    └─ Email Address (for Email)
    ↓
┌─────────────────────────────────────┐
│  PARALLEL EXECUTION (Non-blocking)  │
│                                      │
│  Promise.all([                      │
│    sendSMS(...).catch(err => {      │
│      console.error('SMS failed', err)│
│    }),                               │
│    sendEmail(...).catch(err => {    │
│      console.error('Email failed', err)│
│    })                                │
│  ])                                  │
│                                      │
│  ⚠️ Both execute simultaneously     │
│  ⚠️ Failures are caught independently│
│  ⚠️ One failure doesn't block the other│
└─────────────────────────────────────┘
    ↓
Continue with activity logging and UI update
```

**Key Benefits:**
- ✅ Faster execution (parallel vs sequential)
- ✅ Better reliability (one channel can fail, other succeeds)
- ✅ Non-blocking (main flow continues even if both fail)

---

## 🔐 Authentication Email Flow (Supabase)

```
User Action (Signup/Password Reset)
    ↓
Supabase Auth API Call
    ↓
Supabase automatically sends email
    ↓
Email contains actual confirmation/reset link
    ↓
User clicks link → Action completed
```

**Note:** Authentication emails are handled entirely by Supabase Auth, not through the Brevo service. This ensures:
- ✅ Actual tokens/links are included
- ✅ Secure token generation
- ✅ Automatic email sending
- ✅ No custom implementation needed

---

## 📍 Code Locations

### Frontend Service Files
- `src/services/emailService.js` - Email service and templates
- `src/services/smsService.js` - SMS service and templates

### Edge Functions
- `supabase/functions/send-email/index.ts` - Email edge function
- `supabase/functions/send-sms/index.ts` - SMS edge function

### Integration Points
- `src/pages/Jobseeker/JobseekerDashboard.jsx` - Job application flow
- `src/pages/Employer/EmployerDashboard.jsx` - Application status updates
- `src/pages/Admin/JobManagementSimplified.jsx` - Job approval & referrals
- `src/pages/Admin/EmployerVerificationSimple.jsx` - Employer verification
- `src/contexts/AuthContext.jsx` - Signup (Supabase Auth)
- `src/pages/ForgotPassword.jsx` - Password reset (Supabase Auth)

---

## 🔍 Error Handling

### Email Errors
```javascript
try {
  const result = await sendEmail({...});
  if (!result.success) {
    console.error('Email failed:', result.error);
    // Continue execution - don't block main flow
  }
} catch (error) {
  console.error('Email exception:', error);
  // Continue execution - don't block main flow
}
```

### SMS Errors
```javascript
try {
  const result = await sendSMS({...});
  if (!result.success) {
    console.error('SMS failed:', result.error);
    // Continue execution - don't block main flow
  }
} catch (error) {
  console.error('SMS exception:', error);
  // Continue execution - don't block main flow
}
```

**Key Points:**
- ✅ All notifications are non-blocking
- ✅ Errors are logged but don't interrupt main flow
- ✅ SMS and Email failures are independent
- ✅ User experience is not affected by notification failures

---

## 🎯 Notification Triggers Summary

### Jobseeker Triggers
1. **Applies to job** → Employer receives SMS + Email
2. **Application status changed** → Jobseeker receives SMS + Email
3. **Referred by admin** → Jobseeker receives SMS + Email

### Employer Triggers
1. **Receives new application** → Employer receives SMS + Email
2. **Updates application status** → Jobseeker receives SMS + Email
3. **Job approved** → Employer receives SMS + Email
4. **Account verified** → Employer receives SMS + Email

### Admin Triggers
1. **Approves job** → Employer receives SMS + Email
2. **Refers jobseeker** → Jobseeker receives SMS + Email
3. **Verifies employer** → Employer receives SMS + Email

### Employer Triggers
1. **Submits job vacancy** → All admins (not super_admin) receive email notification

### Authentication Triggers
1. **User signs up** → User receives confirmation email (Supabase)
2. **User resets password** → User receives reset email (Supabase)

---

## 🚀 Deployment Requirements

### Email Service
1. Deploy edge function: `supabase functions deploy send-email`
2. Set secret: `supabase secrets set BREVO_API_KEY=your_api_key`
3. Verify Brevo account is active

### SMS Service
1. Deploy edge function: `supabase functions deploy send-sms`
2. Set secrets:
   - `supabase secrets set TEXTBEE_API_KEY=your_api_key`
   - `supabase secrets set TEXTBEE_DEVICE_ID=your_device_id`
3. Verify Android device is connected and TextBee app is running

---

## 📝 Notes

1. **Welcome Messages**: Functions exist but are not currently used
2. **Confirmation/Reset**: Using Supabase Auth only (more reliable for tokens)
3. **All notifications**: Sent in parallel, non-blocking, independent error handling
4. **Phone formatting**: Automatic conversion to E.164 format
5. **Email templates**: All use responsive HTML with plain text fallback

---

## 🔄 Flow Verification

### ✅ Complete Flows
- [x] Jobseeker applies → Employer notified (SMS + Email)
- [x] Employer updates status → Jobseeker notified (SMS + Email)
- [x] Admin approves job → Employer notified (SMS + Email)
- [x] Admin refers jobseeker → Jobseeker notified (SMS + Email)
- [x] Admin verifies employer → Employer notified (SMS + Email)
- [x] Employer submits job → All admins (not super_admin) notified (Email only)
- [x] User signs up → User receives confirmation email (Supabase)
- [x] User resets password → User receives reset email (Supabase)

---

*Last Updated: Based on current codebase analysis*

