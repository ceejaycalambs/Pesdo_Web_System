# 🔄 Employer Verification Flow - Complete Documentation

## 📋 Overview

This document describes the complete flow of employer account verification in the PESDO system, from initial account creation through all possible status transitions.

---

## 🎯 Verification Statuses

The system uses the following verification statuses:

| Status | Description | Can Post Jobs? | Auto-Transition? |
|--------|-------------|----------------|------------------|
| **`unverified`** | New account, no documents uploaded | ❌ No | ✅ Yes (when docs uploaded) |
| **`pending`** | Documents uploaded, awaiting admin review | ❌ No | ❌ No (requires admin action) |
| **`approved`** | Verified by admin, account active | ✅ Yes | ❌ No |
| **`rejected`** | Verification rejected by admin | ❌ No | ✅ Yes (can re-verify) |
| **`suspended`** | Account temporarily suspended | ❌ No | ⏱️ Yes (if duration set) |

---

## 🚀 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   1. ACCOUNT CREATION                            │
│                                                                   │
│  Employer signs up → create_employer_profile() RPC function      │
│  → verification_status = 'unverified' (default)                  │
│  → No documents uploaded                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   2. DOCUMENT UPLOAD                             │
│                                                                   │
│  Employer uploads BIR Document OR Business Permit               │
│  → handleDocumentUpload() in EmployerDashboard.jsx               │
│  → Status remains 'unverified' (both docs required)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│             3. AUTOMATIC STATUS UPDATE                            │
│                                                                   │
│  Employer uploads BOTH BIR Document AND Business Permit          │
│  → update_employer_verification_status() RPC function             │
│  → verification_status = 'pending' (automatic)                  │
│  → verification_notes = NULL (cleared for fresh review)         │
│  → Admin receives notification (if configured)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   4. ADMIN REVIEW                                │
│                                                                   │
│  Admin views employer in "Pending Review" tab                    │
│  → Opens verification modal                                     │
│  → Reviews BIR Document and Business Permit                      │
│  → Selects action: Approve / Reject / Suspend                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   5A. APPROVE PATH        │   │   5B. REJECT PATH         │
│                           │   │                           │
│ Admin clicks "Approve"    │   │ Admin clicks "Reject"    │
│ → verification_status =   │   │ → verification_status =   │
│   'approved'              │   │   'rejected'             │
│ → verified_by = admin_id  │   │ → verification_notes =    │
│ → verified_at = timestamp  │   │   rejection reason        │
│ → Can post jobs ✅        │   │ → Cannot post jobs ❌     │
│ → Email + SMS sent        │   │ → Email + SMS sent        │
└───────────────────────────┘   └───────────────────────────┘
                │                           │
                │                           │
                │                           ▼
                │           ┌───────────────────────────┐
                │           │   6. RE-VERIFICATION      │
                │           │                           │
                │           │ Rejected employer uploads │
                │           │ new documents             │
                │           │ → Both BIR + Permit       │
                │           │ → Status auto → 'pending' │
                │           │ → Can be reviewed again   │
                │           └───────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   7. SUSPENSION PATH                             │
│                                                                   │
│  Admin suspends approved employer:                               │
│  → verification_status = 'suspended'                             │
│  → suspension_started_at = timestamp                             │
│  → suspension_duration_days = X (or NULL for indefinite)         │
│  → suspension_notes = reason (required)                           │
│  → Cannot post jobs ❌                                           │
│  → Email + SMS sent with duration and reason                     │
│                                                                   │
│  To Unsuspend:                                                   │
│  → Admin changes status back to 'approved'                        │
│  → Suspension fields cleared                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Detailed Step-by-Step Flow

### **Step 1: Account Creation**

**Location**: `src/contexts/AuthContext.jsx` → `signup()` function

**Process**:
1. Employer signs up with email and password
2. Supabase creates auth user
3. `create_employer_profile()` RPC function is called
4. Profile created with:
   - `verification_status = 'unverified'` (default)
   - `bir_document_url = NULL`
   - `business_permit_url = NULL`

**Code Reference**:
```sql
-- database/update_employer_verification_status.sql
CREATE OR REPLACE FUNCTION public.create_employer_profile(...)
VALUES (..., 'unverified', ...)
```

---

### **Step 2: Document Upload**

**Location**: `src/pages/Employer/EmployerDashboard.jsx` → `handleDocumentUpload()`

**Process**:
1. Employer navigates to "Verification Documents" section
2. Uploads BIR Document OR Business Permit
3. File uploaded to Supabase Storage
4. `bir_document_url` or `business_permit_url` updated in database
5. **Status check happens**:
   - If only ONE document uploaded → status stays `'unverified'`
   - If BOTH documents uploaded → proceed to Step 3

**Key Code**:
```javascript
// src/pages/Employer/EmployerDashboard.jsx (line ~1018)
const originalStatus = profile?.verification_status || 'unverified';
const hasBir = type === 'bir' ? publicUrl : (profile?.bir_document_url || null);
const hasPermit = type === 'permit' ? publicUrl : (profile?.business_permit_url || null);

// If both documents are uploaded and status is 'unverified' or 'rejected', change to 'pending'
if ((originalStatus === 'unverified' || originalStatus === 'rejected') && hasBir && hasPermit) {
  updateData.verification_status = 'pending';
  updateData.verification_notes = null; // Clear notes for fresh review
}
```

---

### **Step 3: Automatic Status Update to 'pending'**

**Location**: `database/update_employer_verification_status.sql` → `update_employer_verification_status()` function

**Process**:
1. After document upload, RPC function is called
2. Function checks:
   - Current status (`unverified`, `pending`, or `rejected`)
   - Presence of BIR document
   - Presence of Business Permit
3. If both documents present → status updated to `'pending'`
4. If documents removed → status reverted to `'unverified'`

**Key Logic**:
```sql
-- database/update_employer_verification_status.sql (line ~97)
IF v_current_status IN ('unverified', 'pending', 'rejected') THEN
    IF v_has_bir AND v_has_permit THEN
        UPDATE public.employer_profiles
        SET verification_status = 'pending',
            verification_notes = NULL,  -- Clear previous rejection notes
            updated_at = now()
        WHERE id = p_employer_id;
    ELSIF NOT (v_has_bir AND v_has_permit) THEN
        UPDATE public.employer_profiles
        SET verification_status = 'unverified',
            updated_at = now()
        WHERE id = p_employer_id;
    END IF;
END IF;
```

---

### **Step 4: Admin Review**

**Location**: `src/pages/Admin/EmployerVerificationSimple.jsx`

**Process**:
1. Admin navigates to "Employer Verification" page
2. Views employers in "Pending Review" tab
3. Clicks "Review" button on an employer
4. Modal opens showing:
   - Business information
   - BIR Document (clickable link)
   - Business Permit (clickable link)
   - Verification Status dropdown
   - Verification Notes (or Suspension fields if suspending)

**Available Actions**:
- **Approve**: Sets status to `'approved'`
- **Reject**: Sets status to `'rejected'` with notes
- **Suspend**: Sets status to `'suspended'` with duration and notes

---

### **Step 5A: Approval Path**

**Location**: `src/pages/Admin/EmployerVerificationSimple.jsx` → `handleVerification()`

**Process**:
1. Admin selects "Approve" from dropdown
2. Clicks "Update Verification"
3. Database updated:
   ```javascript
   {
     verification_status: 'approved',
     verified_by: admin_id,
     verified_at: timestamp,
     verification_notes: notes (optional)
   }
   ```
4. Notifications sent:
   - ✅ In-app notification
   - ✅ Email notification (`sendEmployerVerificationEmail()`)
   - ✅ SMS notification
5. Employer can now post job vacancies

---

### **Step 5B: Rejection Path**

**Location**: `src/pages/Admin/EmployerVerificationSimple.jsx` → `handleVerification()`

**Process**:
1. Admin selects "Reject" from dropdown
2. Enters rejection reason in "Verification Notes"
3. Clicks "Update Verification"
4. Database updated:
   ```javascript
   {
     verification_status: 'rejected',
     verification_notes: rejection_reason,
     verified_by: null,
     verified_at: null
   }
   ```
5. Notifications sent with rejection reason
6. Employer cannot post jobs
7. **Re-verification possible** (see Step 6)

---

### **Step 6: Re-Verification (After Rejection)**

**Location**: `src/pages/Employer/EmployerDashboard.jsx` → `handleDocumentUpload()`

**Process**:
1. Rejected employer uploads new/updated documents
2. When BOTH BIR and Permit are present:
   - Status automatically changes from `'rejected'` → `'pending'`
   - `verification_notes` cleared (fresh review)
3. Admin can review again in "Pending Review" tab
4. Cycle repeats (can be approved or rejected again)

**Key Code**:
```javascript
// src/pages/Employer/EmployerDashboard.jsx (line ~1024)
if ((originalStatus === 'unverified' || originalStatus === 'rejected') && hasBir && hasPermit) {
  updateData.verification_status = 'pending';
  updateData.verification_notes = null; // Clear notes for fresh review
}
```

---

### **Step 7: Suspension Path**

**Location**: `src/pages/Admin/EmployerVerificationSimple.jsx` → `handleVerification()`

**Process**:
1. Admin selects "Suspend" from dropdown (only available for `'approved'` employers)
2. **Required fields appear**:
   - Suspension Duration (Days) - optional (empty = indefinite)
   - Suspension Notes - **required**
3. Clicks "Update Verification"
4. Database updated:
   ```javascript
   {
     verification_status: 'suspended',
     suspension_started_at: timestamp,
     suspension_duration_days: X or NULL,
     suspension_notes: reason (required),
     verified_by: null,
     verified_at: null
   }
   ```
5. Notifications sent with duration and reason
6. Employer cannot post jobs
7. **To Unsuspend**: Admin changes status back to `'approved'`

**Special Cases**:
- **Indefinite Suspension**: Leave duration empty → requires manual unsuspension
- **Temporary Suspension**: Enter days (e.g., 7, 30, 90) → can auto-expire (future feature)

---

## 🔄 Status Transition Rules

### **Automatic Transitions** (No Admin Action Required)

| From Status | Trigger | To Status | Notes |
|-------------|---------|-----------|-------|
| `unverified` | Both documents uploaded | `pending` | Auto-update |
| `rejected` | Both documents uploaded | `pending` | Re-verification |
| `pending` | One document removed | `unverified` | Auto-revert |
| `approved` | Document removed | `unverified` | Auto-revert |
| `suspended` | Document removed | `unverified` | Auto-revert |

### **Manual Transitions** (Admin Action Required)

| From Status | Admin Action | To Status | Notes |
|-------------|--------------|----------|-------|
| `pending` | Approve | `approved` | Sets `verified_by` and `verified_at` |
| `pending` | Reject | `rejected` | Requires notes |
| `pending` | Suspend | `suspended` | Requires notes |
| `approved` | Suspend | `suspended` | Requires duration and notes |
| `suspended` | Unsuspend | `approved` | Clears suspension fields |
| `rejected` | Approve | `approved` | Re-verification approved |

---

## 📧 Notification Flow

### **When Status Changes to 'pending'**
- ❌ No automatic notification (employer can see status in dashboard)

### **When Status Changes to 'approved'**
- ✅ In-app notification
- ✅ Email: "Account Verification Approved"
- ✅ SMS: "Your employer account has been APPROVED"

### **When Status Changes to 'rejected'**
- ✅ In-app notification with reason
- ✅ Email: "Account Verification Update" (with rejection reason)
- ✅ SMS: "Your verification was REJECTED"

### **When Status Changes to 'suspended'**
- ✅ In-app notification with duration and reason
- ✅ Email: "Account Suspended" (with duration and reason)
- ✅ SMS: "Your account has been SUSPENDED" (with duration and reason)

---

## 🛡️ Business Rules

1. **Document Requirements**:
   - Both BIR Document AND Business Permit required for `'pending'` status
   - Missing either document reverts to `'unverified'`

2. **Re-Verification**:
   - Rejected employers can upload new documents
   - Status automatically changes to `'pending'` when both documents present
   - Previous rejection notes are cleared

3. **Suspension**:
   - Only `'approved'` employers can be suspended
   - Suspension notes are **required**
   - Duration is optional (NULL = indefinite)
   - Suspended employers cannot post jobs

4. **Job Posting**:
   - Only `'approved'` employers can post job vacancies
   - All other statuses (`unverified`, `pending`, `rejected`, `suspended`) cannot post

5. **Status Protection**:
   - Admin decisions (`approved`, `suspended`) are protected
   - Only document removal can revert these statuses
   - Status cannot be auto-changed from `approved`/`suspended` to `pending` by document upload

---

## 🔍 Key Files Reference

| File | Purpose |
|------|---------|
| `database/update_employer_verification_status.sql` | SQL functions for status management |
| `database/add_suspension_fields.sql` | Suspension fields and expiration check |
| `src/pages/Employer/EmployerDashboard.jsx` | Document upload and status display |
| `src/pages/Admin/EmployerVerificationSimple.jsx` | Admin verification interface |
| `src/services/emailService.js` | Email notifications |
| `src/services/smsService.js` | SMS notifications |
| `src/contexts/AuthContext.jsx` | Account creation with initial status |

---

## ✅ Summary

The employer verification flow is designed to:
- ✅ Start with `'unverified'` status on account creation
- ✅ Automatically progress to `'pending'` when documents are complete
- ✅ Require admin review for final approval
- ✅ Allow re-verification after rejection
- ✅ Support suspension with duration and notes
- ✅ Send notifications at each status change
- ✅ Protect admin decisions while allowing document updates

This ensures a smooth, transparent verification process with proper audit trails and user communication.

