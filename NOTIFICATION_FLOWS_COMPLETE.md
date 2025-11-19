# Complete SMS & Email Notification Flows

## Overview
This document maps all SMS and email notification flows in the PESDO system from Jobseeker, Employer, and Admin perspectives.

---

## 📱 JOBSEEKER FLOWS

### Flow 1: Jobseeker Applies to a Job
**Trigger**: Jobseeker clicks "Apply" button on a job vacancy  
**Location**: `src/pages/Jobseeker/JobseekerDashboard.jsx` → `handleApplyToJob()`

**Recipient**: Employer  
**Notifications Sent**:
1. ✅ **SMS**: `sendNewApplicationSMS()`
   - To: Employer's mobile number
   - Message: "Hi [EmployerName]! New application received for [JobTitle] from [JobseekerName]. Check your dashboard. - PESDO"

2. ✅ **Email**: `sendNewApplicationEmail()`
   - To: Employer's email (contact_email or email)
   - Subject: "New Application: [JobTitle] - [JobseekerName]"
   - Content: HTML email with job details and link to dashboard

**Flow Diagram**:
```
Jobseeker clicks "Apply"
    ↓
Application created in database
    ↓
Fetch employer profile (phone + email)
    ↓
┌─────────────────────────────────┐
│  Send SMS (if phone available)  │
│  Send Email (if email available) │
│  Both sent in parallel           │
└─────────────────────────────────┘
    ↓
Success message shown to jobseeker
```

**Code Location**: Lines ~1463-1504 in `JobseekerDashboard.jsx`

---

### Flow 2: Jobseeker Receives Application Status Update
**Trigger**: Employer updates application status (accepted/rejected/referred)  
**Location**: `src/pages/Employer/EmployerDashboard.jsx` → `handleApplicationDecision()`

**Recipient**: Jobseeker  
**Notifications Sent**:
1. ✅ **SMS**: `sendApplicationStatusSMS()`
   - To: Jobseeker's phone number
   - Status-specific messages:
     - **Accepted**: "Hi [Name]! Great news! Your application for [JobTitle] at [Company] has been ACCEPTED. Check your dashboard for details. - PESDO"
     - **Rejected**: "Hi [Name]! Thank you for applying. Your application for [JobTitle] at [Company] was not selected. Keep applying! - PESDO"
     - **Referred**: "Hi [Name]! You've been REFERRED for [JobTitle] at [Company]. The employer will review your profile. - PESDO"

2. ✅ **Email**: `sendApplicationStatusEmail()`
   - To: Jobseeker's email
   - Status-specific HTML emails with:
     - **Accepted**: Green success theme, congratulations message
     - **Rejected**: Neutral theme, encouragement message
     - **Referred**: Green theme, referral details

**Flow Diagram**:
```
Employer updates application status
    ↓
Status saved to database
    ↓
Fetch jobseeker profile (phone + email)
    ↓
Fetch job details and company name
    ↓
┌─────────────────────────────────┐
│  Send SMS (if phone available)  │
│  Send Email (if email available) │
│  Both sent in parallel           │
└─────────────────────────────────┘
    ↓
Status updated in UI
```

**Code Location**: Lines ~1055-1133 in `EmployerDashboard.jsx`

---

### Flow 3: Jobseeker Gets Referred by Admin
**Trigger**: Admin refers jobseeker to a job  
**Location**: `src/pages/Admin/JobManagementSimplified.jsx` → `handleReferJobseeker()`

**Recipient**: Jobseeker  
**Notifications Sent**:
1. ✅ **SMS**: `sendApplicationStatusSMS()` (status='referred')
   - To: Jobseeker's phone number
   - Message: "Hi [Name]! You've been REFERRED for [JobTitle] at [Company]. The employer will review your profile. - PESDO"

2. ✅ **Email**: `sendApplicationStatusEmail()` (status='referred')
   - To: Jobseeker's email
   - Subject: "📋 You've Been Referred - [JobTitle] at [Company]"
   - Content: Referral notification with job details

**Flow Diagram**:
```
Admin clicks "Refer" button
    ↓
Application created/updated (status='referred')
    ↓
Fetch jobseeker profile (phone + email)
    ↓
Fetch employer profile (for company name)
    ↓
┌─────────────────────────────────┐
│  Send SMS (if phone available)  │
│  Send Email (if email available) │
│  Both sent in parallel           │
└─────────────────────────────────┘
    ↓
Activity logged
```

**Code Location**: Lines ~424-572 in `JobManagementSimplified.jsx`

---

## 🏢 EMPLOYER FLOWS

### Flow 1: Employer Receives New Application
**Trigger**: Jobseeker applies to employer's job  
**Location**: `src/pages/Jobseeker/JobseekerDashboard.jsx` → `handleApplyToJob()`

**Recipient**: Employer  
**Notifications Sent**:
1. ✅ **SMS**: `sendNewApplicationSMS()`
   - To: Employer's mobile number
   - Message: "Hi [EmployerName]! New application received for [JobTitle] from [JobseekerName]. Check your dashboard. - PESDO"

2. ✅ **Email**: `sendNewApplicationEmail()`
   - To: Employer's email (contact_email or email)
   - Subject: "New Application: [JobTitle] - [JobseekerName]"
   - Content: HTML email with application details and dashboard link

**Flow Diagram**: Same as Jobseeker Flow 1 (recipient is employer)

---

### Flow 2: Employer Updates Application Status
**Trigger**: Employer accepts/rejects/rejects an application  
**Location**: `src/pages/Employer/EmployerDashboard.jsx` → `handleApplicationDecision()`

**Recipient**: Jobseeker  
**Notifications Sent**: Same as Jobseeker Flow 2

**Flow Diagram**: Same as Jobseeker Flow 2 (triggered by employer)

---

### Flow 3: Employer's Job Gets Approved
**Trigger**: Admin approves employer's job vacancy  
**Location**: `src/pages/Admin/JobManagementSimplified.jsx` → `handleApproveJob()`

**Recipient**: Employer  
**Notifications Sent**:
1. ✅ **SMS**: `sendJobApprovalSMS()`
   - To: Employer's mobile number
   - Message: "Hi [EmployerName]! Your job vacancy "[JobTitle]" has been APPROVED and is now live. - PESDO"

2. ✅ **Email**: `sendJobApprovalEmail()`
   - To: Employer's email (contact_email or email)
   - Subject: "✅ Job Vacancy Approved: [JobTitle]"
   - Content: HTML email with approval confirmation and next steps

**Flow Diagram**:
```
Admin clicks "Approve" button
    ↓
Job moved from pending to approved
    ↓
Notification created in database
    ↓
Fetch employer profile (phone + email)
    ↓
┌─────────────────────────────────┐
│  Send SMS (if phone available)  │
│  Send Email (if email available) │
│  Both sent in parallel           │
└─────────────────────────────────┘
    ↓
Activity logged
```

**Code Location**: Lines ~1173-1218 in `JobManagementSimplified.jsx`

---

### Flow 4: Employer Account Verification
**Trigger**: Admin approves/rejects employer verification  
**Location**: `src/pages/Admin/EmployerVerificationSimple.jsx` → `handleVerifyEmployer()`

**Recipient**: Employer  
**Notifications Sent**:
1. ✅ **SMS**: Generic `sendSMS()`
   - To: Employer's mobile number
   - **Approved**: "Hi [EmployerName]! Your employer account has been APPROVED. You can now post job vacancies. - PESDO"
   - **Rejected**: "Hi [EmployerName]! Your verification was REJECTED. Check dashboard for details. - PESDO"

2. ✅ **Email**: `sendEmployerVerificationEmail()` ⭐ **NEWLY ADDED**
   - To: Employer's email (contact_email or email)
   - **Approved**: Subject: "✅ Account Verification Approved - PESDO Surigao"
   - **Rejected**: Subject: "⚠️ Account Verification Update - PESDO Surigao"
   - Content: HTML email with verification status and details

**Flow Diagram**:
```
Admin approves/rejects employer verification
    ↓
Verification status updated in database
    ↓
Notification created in database
    ↓
Fetch employer profile (phone + email)
    ↓
┌─────────────────────────────────┐
│  Send SMS (if phone available)  │
│  Send Email (if email available) │
│  Both sent in parallel           │
└─────────────────────────────────┘
    ↓
Activity logged
```

**Code Location**: Lines ~178-225 in `EmployerVerificationSimple.jsx`

---

## 👨‍💼 ADMIN FLOWS

### Flow 1: Admin Approves Job Vacancy
**Trigger**: Admin clicks "Approve" on pending job  
**Location**: `src/pages/Admin/JobManagementSimplified.jsx` → `handleApproveJob()`

**Recipient**: Employer  
**Notifications Sent**: Same as Employer Flow 3

**Flow Diagram**: Same as Employer Flow 3 (triggered by admin)

---

### Flow 2: Admin Refers Jobseeker to Job
**Trigger**: Admin clicks "Refer" button for a jobseeker  
**Location**: `src/pages/Admin/JobManagementSimplified.jsx` → `handleReferJobseeker()`

**Recipient**: Jobseeker  
**Notifications Sent**: Same as Jobseeker Flow 3

**Flow Diagram**: Same as Jobseeker Flow 3 (triggered by admin)

---

### Flow 3: Admin Verifies Employer Account
**Trigger**: Admin approves/rejects employer verification  
**Location**: `src/pages/Admin/EmployerVerificationSimple.jsx` → `handleVerifyEmployer()`

**Recipient**: Employer  
**Notifications Sent**: Same as Employer Flow 4

**Flow Diagram**: Same as Employer Flow 4 (triggered by admin)

---

## 🔐 AUTHENTICATION FLOWS

### Flow 1: Account Confirmation (Signup)
**Trigger**: User signs up for new account  
**Location**: `src/contexts/AuthContext.jsx` → `signup()`

**Recipient**: New user  
**Notifications Sent**:
1. ✅ **Email**: Supabase Auth (automatic)
   - To: User's email
   - Subject: "Confirm your signup"
   - Content: Supabase's default confirmation email with actual confirmation link
   - **Note**: Brevo confirmation email was removed (using Supabase only)

**Flow Diagram**:
```
User submits registration form
    ↓
Supabase creates auth user
    ↓
Supabase automatically sends confirmation email
    ↓
User receives email with confirmation link
    ↓
User clicks link → Email confirmed
```

**Code Location**: Lines ~417-429 in `AuthContext.jsx`

---

### Flow 2: Password Reset
**Trigger**: User requests password reset  
**Location**: `src/pages/ForgotPassword.jsx` → `handleSubmit()`

**Recipient**: User  
**Notifications Sent**:
1. ✅ **Email**: Supabase Auth (automatic)
   - To: User's email
   - Subject: "Reset your password"
   - Content: Supabase's default reset email with actual reset link
   - **Note**: Brevo reset email was removed (using Supabase only)

**Flow Diagram**:
```
User enters email in forgot password form
    ↓
Supabase sends password reset email
    ↓
User receives email with reset link
    ↓
User clicks link → Password reset page
```

**Code Location**: Lines ~36-39 in `ForgotPassword.jsx`

---

## 📊 Notification Flow Summary Table

| Trigger | Actor | Recipient | SMS | Email | Status |
|---------|-------|-----------|-----|-------|--------|
| Jobseeker applies to job | Jobseeker | Employer | ✅ | ✅ | Complete |
| Employer updates application status | Employer | Jobseeker | ✅ | ✅ | Complete |
| Admin approves job | Admin | Employer | ✅ | ✅ | Complete |
| Admin refers jobseeker | Admin | Jobseeker | ✅ | ✅ | Complete |
| Admin verifies employer | Admin | Employer | ✅ | ✅ | Complete |
| User signs up | User | User | ❌ | ✅ (Supabase) | Complete |
| User resets password | User | User | ❌ | ✅ (Supabase) | Complete |

---

## 🔄 Notification Flow Patterns

### Pattern 1: Parallel SMS + Email (Business Notifications)
**Used For**: Job applications, status updates, approvals, referrals, verifications

```
Action Triggered
    ↓
Fetch recipient profile (phone + email)
    ↓
┌─────────────────────────────┐
│  SMS (if phone available)   │ ← Parallel execution
│  Email (if email available) │ ← Non-blocking
└─────────────────────────────┘
    ↓
Both logged independently
    ↓
Failures don't affect each other
```

### Pattern 2: Supabase Auth Emails (Authentication)
**Used For**: Account confirmation, password reset

```
Auth Action Triggered
    ↓
Supabase handles email sending
    ↓
Email sent with actual token/link
    ↓
User receives email
```

---

## 📱 SMS Service Functions

**Location**: `src/services/smsService.js`

1. `sendSMS({ to, message })` - Base function
2. `sendApplicationStatusSMS(phone, name, jobTitle, status, company)` - Application status
3. `sendNewApplicationSMS(phone, employerName, jobseekerName, jobTitle)` - New application
4. `sendJobApprovalSMS(phone, employerName, jobTitle, status)` - Job approval
5. `sendWelcomeSMS(phone, userName, userType)` - ⚠️ Not used

---

## 📧 Email Service Functions

**Location**: `src/services/emailService.js`

1. `sendEmail({ to, subject, html, text })` - Base function
2. `sendApplicationStatusEmail(email, name, jobTitle, status, company)` - Application status
3. `sendNewApplicationEmail(email, employerName, jobseekerName, jobTitle)` - New application
4. `sendJobApprovalEmail(email, employerName, jobTitle, status)` - Job approval
5. `sendEmployerVerificationEmail(email, employerName, status, reason)` - ⭐ Verification
6. `sendConfirmationEmail(...)` - ⚠️ Not used (Supabase handles)
7. `sendPasswordResetEmail(...)` - ⚠️ Not used (Supabase handles)
8. `sendWelcomeEmail(...)` - ⚠️ Not used

---

## 🎯 Key Implementation Details

### Error Handling
- All notifications are **non-blocking**
- Failures are logged but don't interrupt main flow
- SMS and Email failures are independent

### Email Address Resolution
- **Employers**: `contact_email` (preferred) → `email` (fallback)
- **Jobseekers**: `email` (primary)

### Phone Number Formatting
- All phone numbers formatted to E.164 format (+63XXXXXXXXXX)
- Handles: 09123456789, +639123456789, 639123456789, 9123456789

### Notification Timing
- Notifications sent **after** database operations complete
- Activity logging happens **after** notifications
- UI updates happen **after** notifications

---

## 🔍 Flow Verification Checklist

### Jobseeker Flows
- [x] Apply to job → Employer notified (SMS + Email)
- [x] Application status changed → Jobseeker notified (SMS + Email)
- [x] Referred by admin → Jobseeker notified (SMS + Email)

### Employer Flows
- [x] Receive new application → Employer notified (SMS + Email)
- [x] Update application status → Jobseeker notified (SMS + Email)
- [x] Job approved → Employer notified (SMS + Email)
- [x] Account verified → Employer notified (SMS + Email)

### Admin Flows
- [x] Approve job → Employer notified (SMS + Email)
- [x] Refer jobseeker → Jobseeker notified (SMS + Email)
- [x] Verify employer → Employer notified (SMS + Email)

### Auth Flows
- [x] Signup → User receives confirmation email (Supabase)
- [x] Password reset → User receives reset email (Supabase)

---

## 📝 Notes

1. **Welcome Messages**: Functions exist but are not called anywhere
2. **Confirmation/Reset**: Using Supabase only (more reliable)
3. **Job Rejection**: Employers can reject applications (notified), but job rejection by employers is not a feature
4. **All notifications**: Sent in parallel, non-blocking, independent error handling

---

## 🚀 Future Enhancements

Potential additions:
- Welcome email/SMS after email confirmation
- SMS password reset option
- SMS account confirmation option
- Notification preferences (opt-in/opt-out)
- Notification history/log
- Email templates customization
- Multi-language support

