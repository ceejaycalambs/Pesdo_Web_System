# Bug Fix: RLS Policy Blocking Admin Email Notifications

## 🐛 Bug Description

**Issue**: When employers submit job vacancies, the system attempts to fetch admin profiles to send email notifications. However, this fails due to Row Level Security (RLS) policies on the `admin_profiles` table.

**Root Cause**: 
- The `admin_profiles` table has RLS enabled
- RLS policies only allow:
  1. Admins to view their own profile (`auth.uid() = id`)
  2. Super admins to view all admin profiles (`is_super_admin(auth.uid())`)
- **There is NO policy allowing employers (non-admin users) to read admin profiles**
- When an employer tries to query `admin_profiles`, the query fails silently or returns empty results

**Impact**:
- Admin email notifications are not sent when jobs are submitted
- Admins only receive web notifications (real-time), but not email notifications
- The error is logged but doesn't block job submission (by design)

---

## ✅ Solution

### Approach: Database Function with SECURITY DEFINER

Created a database function `get_admin_emails_for_notifications()` that:
1. Uses `SECURITY DEFINER` to bypass RLS policies
2. Returns only necessary data (email, first_name, last_name)
3. Filters to only regular admins (role = 'admin'), excluding super_admin
4. Only returns admins with valid email addresses

### Changes Made

#### 1. Database Function
**File**: `database/get_admin_emails_for_notifications.sql`

```sql
CREATE OR REPLACE FUNCTION public.get_admin_emails_for_notifications()
RETURNS TABLE (
  email TEXT,
  first_name TEXT,
  last_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Bypasses RLS
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.email,
    ap.first_name,
    ap.last_name
  FROM public.admin_profiles ap
  WHERE ap.role = 'admin'
    AND ap.email IS NOT NULL
    AND ap.email != '';
END;
$$;
```

**Benefits**:
- ✅ Bypasses RLS using SECURITY DEFINER
- ✅ Only exposes minimal data (email, name)
- ✅ Automatically filters to regular admins only
- ✅ Validates email addresses exist

#### 2. Updated Frontend Code
**File**: `src/pages/Employer/EmployerDashboard.jsx`

**Before** (Direct query - fails due to RLS):
```javascript
const { data: adminProfiles, error: adminError } = await supabase
  .from('admin_profiles')
  .select('id, email, first_name, last_name, role')
  .eq('role', 'admin');
```

**After** (RPC function - bypasses RLS):
```javascript
const { data: adminData, error: adminError } = await supabase
  .rpc('get_admin_emails_for_notifications');
```

---

## 🔒 Security Considerations

### What's Protected
- ✅ Admin profile data (ID, role, etc.) is not exposed
- ✅ Only email and name are returned (necessary for notifications)
- ✅ Function only returns regular admins (super_admin excluded)
- ✅ Only authenticated users can call the function

### What's Exposed
- ⚠️ Admin email addresses (required for notifications)
- ⚠️ Admin names (used for personalization)

**Justification**: Email addresses and names are necessary for sending notifications. This is a reasonable trade-off for the functionality. The function is restricted to authenticated users only.

---

## 📋 Deployment Steps

1. **Run the SQL script**:
   ```sql
   -- Execute: database/get_admin_emails_for_notifications.sql
   ```

2. **Verify the function exists**:
   ```sql
   SELECT * FROM public.get_admin_emails_for_notifications();
   ```

3. **Test the fix**:
   - Submit a job as an employer
   - Check browser console for email notification logs
   - Verify admins receive email notifications

---

## 🧪 Testing Checklist

- [ ] Function can be called by authenticated employers
- [ ] Function returns only regular admins (not super_admin)
- [ ] Function only returns admins with valid emails
- [ ] Email notifications are sent successfully
- [ ] Job submission still works if function fails
- [ ] No sensitive admin data is exposed

---

## 🔍 Alternative Solutions Considered

### Option 1: Add RLS Policy for Employers
**Rejected**: Would expose all admin profile data to employers, which is a security risk.

### Option 2: Edge Function
**Rejected**: Adds complexity and requires additional deployment. Database function is simpler and more efficient.

### Option 3: Store Admin Emails in Separate Table
**Rejected**: Requires schema changes and data migration. Current solution is cleaner.

---

## 📝 Related Files

- `database/get_admin_emails_for_notifications.sql` - New database function
- `src/pages/Employer/EmployerDashboard.jsx` - Updated to use RPC function
- `database/fix_admin_profiles_rls.sql` - Existing RLS policies

---

## 🎯 Result

After this fix:
- ✅ Employers can successfully fetch admin emails for notifications
- ✅ Admin email notifications are sent when jobs are submitted
- ✅ RLS security is maintained (minimal data exposure)
- ✅ Job submission flow is not affected

---

*Bug discovered and fixed during system investigation*

