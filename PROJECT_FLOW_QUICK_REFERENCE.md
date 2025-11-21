# 🚀 PESDO Project - Quick Reference Guide

## 📋 User Types & Their Flows

### 👤 **JOBSEEKER**
```
Sign Up → Profile Setup → Browse Jobs → Apply → Get Status Updates
```

**Key Actions:**
- ✅ View available jobs
- ✅ Apply to jobs
- ✅ Track application status
- ✅ Receive notifications (Email/SMS/In-App)

**Dashboard Sections:**
- All Jobs
- Applied & Referred
- Edit Profile
- Resume & CV

---

### 🏢 **EMPLOYER**
```
Sign Up → Upload Documents → Wait for Verification → Post Jobs → Manage Applications
```

**Key Actions:**
- ✅ Upload verification documents (BIR + Permit)
- ✅ Submit job vacancies
- ✅ Manage job postings
- ✅ Review applications
- ✅ Accept/Reject applications

**Verification Status Flow:**
```
unverified → pending → approved ✅
                ↓
            rejected → (re-upload docs) → pending → approved ✅
```

**Dashboard Sections:**
- Company Profile
- Upload Documents
- Submit Job Vacancy
- Manage Job Vacancy

---

### 👨‍💼 **ADMIN**
```
Login → Review Pending Items → Approve/Reject → Monitor System
```

**Key Actions:**
- ✅ Review & approve/reject jobs
- ✅ Verify employer accounts
- ✅ Refer jobseekers to jobs
- ✅ Manage users
- ✅ View analytics

**Dashboard Sections:**
- Dashboard (Overview)
- Job Management
- Employer Verification
- User Management
- Analytics
- Activity Logs (Super Admin only)

---

## 🔄 Key Process Flows

### **1. Employer Verification**
```
Account Created (unverified)
    ↓
Upload BIR Document
    ↓
Upload Business Permit
    ↓
Status Auto → pending
    ↓
Admin Reviews
    ↓
[Approve] → approved ✅ | [Reject] → rejected ❌ | [Suspend] → suspended ⛔
```

### **2. Job Submission**
```
Employer Submits Job
    ↓
Job in 'jobvacancypending' (status: pending)
    ↓
Admin Reviews
    ↓
[Approve] → Job in 'jobs' (visible to jobseekers) ✅
[Reject] → Job stays in pending (status: rejected) ❌
```

### **3. Job Application**
```
Jobseeker Applies
    ↓
Application Created (status: pending)
    ↓
Employer Notified (Email + SMS)
    ↓
Employer Reviews
    ↓
[Accept] → status: accepted ✅
[Reject] → status: rejected ❌
    ↓
Jobseeker Notified (Email + SMS)
```

### **4. Admin Referral**
```
Admin Views Job
    ↓
Clicks "Refer Jobseekers"
    ↓
Selects Jobseeker
    ↓
Application Created (status: referred)
    ↓
Jobseeker Notified (Email + SMS)
```

---

## 📧 Notification Triggers

| **Who** | **When** | **What** |
|---------|----------|----------|
| **Jobseeker** | Applies to job | Employer gets Email + SMS |
| **Jobseeker** | Application status changes | Gets Email + SMS |
| **Employer** | Receives application | Gets Email + SMS |
| **Employer** | Job approved/rejected | Gets Email + SMS |
| **Employer** | Account verified/rejected/suspended | Gets Email + SMS |
| **Admin** | New job submitted | Gets Email (no SMS) |

---

## 🗂️ Database Tables

| **Table** | **Purpose** |
|-----------|-------------|
| `jobseeker_profiles` | Jobseeker information |
| `employer_profiles` | Employer info + verification status |
| `admin_profiles` | Admin info + role |
| `jobs` | Approved job vacancies |
| `jobvacancypending` | Pending job submissions |
| `applications` | Job applications |
| `notifications` | In-app notifications |
| `activity_logs` | System activity tracking |

---

## 🔑 Key Files Reference

### **Authentication**
- `src/contexts/AuthContext.jsx` - User authentication & profile management

### **Employer**
- `src/pages/Employer/EmployerDashboard.jsx` - Employer dashboard
- `src/pages/Admin/EmployerVerificationSimple.jsx` - Admin verification interface

### **Jobseeker**
- `src/pages/Jobseeker/JobseekerDashboard.jsx` - Jobseeker dashboard

### **Admin**
- `src/pages/Admin/JobManagementSimplified.jsx` - Job management
- `src/pages/Admin/AdminDashboard.jsx` - Admin dashboard

### **Services**
- `src/services/emailService.js` - Email notifications
- `src/services/smsService.js` - SMS notifications

### **Database**
- `database/update_employer_verification_status.sql` - Verification RPC functions

---

## ⚡ Quick Troubleshooting

### **Employer can't post jobs?**
- Check `verification_status` in `employer_profiles`
- Must be `'approved'` to post jobs

### **Job not visible to jobseekers?**
- Check if job is in `jobs` table (not `jobvacancypending`)
- Check `status` = `'approved'`
- Check `valid_from` date (must be today or past)

### **Application not showing?**
- Check `applications` table
- Verify `jobseeker_id` and `job_id` are correct
- Check application status

### **Notifications not sending?**
- Check Edge Functions are deployed
- Verify email/SMS service credentials
- Check browser console for errors

---

## 📝 Status Values Reference

### **Employer Verification Status:**
- `unverified` - No documents uploaded
- `pending` - Documents uploaded, awaiting review
- `approved` - Verified, can post jobs
- `rejected` - Verification rejected
- `suspended` - Account suspended

### **Job Status:**
- `pending` - Awaiting admin approval
- `approved` - Approved, visible to jobseekers
- `rejected` - Rejected by admin
- `completed` - All vacancies filled

### **Application Status:**
- `pending` - Awaiting employer review
- `referred` - Referred by admin
- `accepted` - Accepted by employer
- `rejected` - Rejected by employer
- `hired` - Hired by employer
- `withdrawn` - Withdrawn by jobseeker

---

## 🎯 Common Workflows

### **New Employer Onboarding:**
1. Employer signs up
2. Uploads BIR document
3. Uploads Business Permit
4. Status auto-changes to `pending`
5. Admin reviews and approves
6. Employer can now post jobs

### **Job Posting Process:**
1. Employer fills job form
2. Job submitted to `jobvacancypending`
3. Admins notified via email
4. Admin reviews and approves
5. Job moved to `jobs` table
6. Job visible to jobseekers

### **Application Process:**
1. Jobseeker views job
2. Clicks "Apply Now"
3. Application created
4. Employer notified
5. Employer reviews application
6. Employer accepts/rejects
7. Jobseeker notified

---

## 🔍 Important Notes

- **Real-time Updates**: All data syncs in real-time using Supabase Realtime
- **Notifications**: Email and SMS sent in parallel (non-blocking)
- **Verification**: Automatic status updates when documents are uploaded
- **Job Visibility**: Only approved jobs with valid dates are visible
- **Application Eligibility**: Jobseekers can only apply to open jobs they haven't applied to

---

For detailed flow diagrams and code references, see `PROJECT_COMPLETE_FLOW.md`


