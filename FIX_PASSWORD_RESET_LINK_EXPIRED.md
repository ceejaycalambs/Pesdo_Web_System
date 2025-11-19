# Fix: Password Reset Link "Invalid or Expired" Error

## 🔍 Problem
Password reset email is received, but clicking the link shows "Invalid or expired reset link" error.

## ✅ Common Causes & Solutions

### 1. Reset Link Already Used
**Issue**: Password reset links can only be used once.

**Solution**: Request a new password reset link.

### 2. Reset Link Expired
**Issue**: Password reset links expire after 1 hour (default Supabase setting).

**Solution**: 
- Request a new password reset link
- Use the link within 1 hour of receiving it

### 3. Redirect URL Mismatch
**Issue**: The redirect URL in the email doesn't match what's configured in Supabase.

**Check**:
1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Verify the redirect URL in the email matches one of the allowed URLs
3. The URL format should be: `https://pesdosurigao.online/reset-password?type=jobseeker` (or `employer`)

**Fix**: Add the exact redirect URL to Supabase's allowed redirect URLs list.

### 4. Hash Fragments Not Processed
**Issue**: The URL hash fragments (`#access_token=...`) aren't being processed correctly.

**Check Browser Console**:
- Look for logs starting with `🔐`
- Check if `access_token` is present in the hash
- Check if session is being set correctly

**Solution**: The code has been updated to:
- Add detailed logging
- Preserve query params when clearing hash
- Wait longer for automatic processing
- Verify session after setting

### 5. Multiple Tabs/Windows
**Issue**: If you have multiple tabs open, one might have already used the reset link.

**Solution**: 
- Close all tabs
- Request a new reset link
- Use it in a fresh tab

### 6. Browser Cache/Storage Issues
**Issue**: Old session data might be interfering.

**Solution**:
1. Clear browser cache and localStorage
2. Open in incognito/private mode
3. Try a different browser

## 🔧 Debugging Steps

### Step 1: Check Browser Console
When you click the reset link, check the browser console for:

```
🔐 Checking password reset session...
🔐 Current URL: ...
🔐 Hash: ...
🔐 Hash params: { hasAccessToken: true, hashType: 'recovery', ... }
```

**What to look for**:
- ✅ `hasAccessToken: true` - Token is present
- ✅ `hashType: 'recovery'` - Correct type
- ❌ `hasAccessToken: false` - Token missing (link might be corrupted)
- ❌ `error: '...'` - Error from Supabase

### Step 2: Check Session Error
If you see:
```
❌ Error setting session from hash: ...
```

**Common errors**:
- `"Invalid token"` - Link expired or already used
- `"Token has expired"` - Link expired (request new one)
- `"Invalid refresh token"` - Link corrupted or expired

### Step 3: Verify Supabase Configuration

1. **Check Redirect URLs**:
   - Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
   - Ensure these URLs are in the list:
     - `https://pesdosurigao.online/reset-password`
     - `https://pesdosurigao.online/reset-password?type=jobseeker`
     - `https://pesdosurigao.online/reset-password?type=employer`

2. **Check Site URL**:
   - Set **Site URL** to: `https://pesdosurigao.online`

3. **Check Email Template**:
   - Go to **Authentication** → **Email Templates** → **Reset Password**
   - Ensure `{{ .ConfirmationURL }}` is in the template
   - This is the reset link that gets sent

### Step 4: Test with Fresh Link

1. Request a new password reset
2. Check email immediately
3. Click link within 5 minutes
4. Use in a fresh browser tab (or incognito)

## 🎯 Quick Fix Checklist

- [ ] Request a new password reset link
- [ ] Use the link within 1 hour
- [ ] Use the link in a fresh browser tab
- [ ] Check browser console for errors
- [ ] Verify redirect URL is in Supabase allowed list
- [ ] Clear browser cache if issues persist
- [ ] Try a different browser

## 📝 Code Changes Made

The `ResetPassword.jsx` component has been updated to:

1. **Better Logging**: Added detailed console logs to track the reset process
2. **Preserve Query Params**: When clearing hash, query params (`?type=jobseeker`) are preserved
3. **Session Verification**: After setting session, it's verified before proceeding
4. **Longer Wait Time**: Increased wait time for Supabase's automatic processing (1 second)
5. **Better Error Messages**: More specific error messages based on the error type

## 🔍 What the Logs Tell You

### ✅ Success Flow:
```
🔐 Checking password reset session...
🔐 Hash params: { hasAccessToken: true, hashType: 'recovery' }
🔐 Processing password reset link from URL hash...
🔐 Setting session with access token...
✅ Session set successfully from hash
✅ User ID: ...
✅ Valid session found for password reset
```

### ❌ Failure Flow:
```
🔐 Checking password reset session...
🔐 Hash params: { hasAccessToken: false }  // Token missing
❌ No valid session found
```

OR

```
🔐 Setting session with access token...
❌ Error setting session from hash: Invalid token
```

## 🚀 Next Steps

1. **Try the reset link again** with the improved code
2. **Check browser console** for detailed logs
3. **If still failing**, check:
   - Supabase Auth Logs (Dashboard → Logs → Auth Logs)
   - Email link format (should have `#access_token=...&type=recovery`)
   - Redirect URL configuration

## 💡 Pro Tips

1. **Test in Incognito**: Eliminates cache/storage issues
2. **Check Email Source**: View email source to see the actual link format
3. **Copy Link Manually**: If clicking doesn't work, copy the link and paste in address bar
4. **Check Network Tab**: See if any requests are failing
5. **Supabase Logs**: Check Supabase Dashboard → Logs → Auth Logs for server-side errors

