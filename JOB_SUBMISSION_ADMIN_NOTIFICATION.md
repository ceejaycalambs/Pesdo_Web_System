# Job Submission Admin Email Notification

## Overview
When an employer submits a new job vacancy, all regular admins (excluding super_admin) now receive email notifications. This ensures admins are promptly notified about pending job reviews both in the web dashboard and via email.

---

## Implementation Details

### Email Template
**Location**: `src/services/emailService.js`
**Function**: `sendNewJobSubmissionEmail(email, adminName, jobTitle, employerName, companyName)`

**Email Content:**
- Subject: `📋 New Job Vacancy Pending Review: [Job Title]`
- Includes:
  - Job title
  - Employer name
  - Company name (if available)
  - Status: Pending Approval
  - Link to admin job management page

### Trigger Location
**File**: `src/pages/Employer/EmployerDashboard.jsx`
**Function**: `handleSubmitJob()`

### Flow

```
Employer submits job vacancy
    ↓
Job inserted into 'jobvacancypending' table
    ↓
Fetch all admin profiles (role = 'admin' only)
    ↓
┌─────────────────────────────────────────┐
│  Send email to each admin in parallel   │
│  (Non-blocking, independent failures)   │
└─────────────────────────────────────────┘
    ↓
Job submission success message shown
```

---

## Key Features

### ✅ Admin Filtering
- **Only regular admins** receive notifications (`role = 'admin'`)
- **Super admins are excluded** (`role = 'super_admin'` is filtered out)
- Query: `.eq('role', 'admin')`

### ✅ Parallel Execution
- All admin emails sent in parallel using `Promise.all()`
- Non-blocking - doesn't delay job submission
- Independent error handling per admin

### ✅ Error Handling
- If fetching admin profiles fails → Logged but doesn't block submission
- If sending to one admin fails → Other admins still receive email
- Job submission succeeds even if all email notifications fail

### ✅ Email Details
- Personalized with admin's name
- Includes job title, employer name, and company name
- Contains direct link to review page
- Professional HTML template with PESDO branding

---

## Code Changes

### 1. New Email Template Function
**File**: `src/services/emailService.js`
```javascript
export const sendNewJobSubmissionEmail = async (email, adminName, jobTitle, employerName, companyName)
```

### 2. Updated Job Submission Handler
**File**: `src/pages/Employer/EmployerDashboard.jsx`
- Added import: `sendNewJobSubmissionEmail`
- Added admin notification logic after successful job insertion
- Fetches admin profiles (excluding super_admin)
- Sends emails in parallel

---

## Notification Recipients

### ✅ Receives Email
- All users with `admin_profiles.role = 'admin'`

### ❌ Does NOT Receive Email
- Super admins (`role = 'super_admin'`)
- Users without admin profiles
- Admins without email addresses

---

## Web Dashboard Notifications

Admins also receive real-time web notifications through:
- **Location**: `src/hooks/useRealtimeNotifications.js`
- **Source**: Real-time subscription to `jobvacancypending` table
- **Display**: Notification bell in admin dashboard

**Result**: Admins get notified via:
1. ✅ **Web Dashboard** - Real-time notification bell
2. ✅ **Email** - Email notification to their registered email address

---

## Testing Checklist

- [ ] Submit a job vacancy as employer
- [ ] Verify job is inserted into database
- [ ] Check that all regular admins receive email
- [ ] Verify super_admin does NOT receive email
- [ ] Confirm email contains correct job details
- [ ] Verify email link works correctly
- [ ] Test with multiple admins (parallel sending)
- [ ] Verify job submission succeeds even if email fails

---

## Future Enhancements

Potential improvements:
- Add SMS notifications for admins (optional)
- Allow admins to configure notification preferences
- Add notification history/log
- Support for admin groups/teams
- Batch notifications for multiple job submissions

---

*Last Updated: After implementing admin email notifications for job submissions*

