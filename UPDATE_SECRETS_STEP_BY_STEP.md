# Step-by-Step: Update SMS Secrets in Supabase

## Current Status
You're still getting **401 Unauthorized** because the secrets in Supabase don't match your SMS Gateway app.

## Your Correct Credentials (from SMS Gateway app):
- **Username:** `00PKL3`
- **Password:** `aslp2vayrpzsrq`
- **Device ID:** `nmJJWgn3v2QsOhUg12b-n`

## Step-by-Step Instructions

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh
2. Login if needed

### Step 2: Navigate to Edge Functions
1. Click **"Edge Functions"** in the left sidebar
2. Click on **"send-sms"** function

### Step 3: Go to Settings
1. Click on the **"Settings"** tab (usually at the top, next to "Code", "Logs", etc.)

### Step 4: Find Secrets Section
1. Scroll down to find **"Secrets"** section
2. You should see a list of secrets or a button to add secrets

### Step 5: Update Each Secret

**Option A: If secrets already exist (you can edit them):**
1. Click on `SMS_GATEWAY_USERNAME`
2. Change value to: `00PKL3`
3. Save
4. Click on `SMS_GATEWAY_PASSWORD`
5. Change value to: `aslp2vayrpzsrq`
6. Save
7. Click on `SMS_GATEWAY_DEVICE_ID`
8. Change value to: `nmJJWgn3v2QsOhUg12b-n`
9. Save

**Option B: If secrets don't exist (you need to add them):**
1. Click **"+ Add Secret"** or **"New Secret"** button
2. Add first secret:
   - **Key:** `SMS_GATEWAY_USERNAME`
   - **Value:** `00PKL3`
   - Save
3. Add second secret:
   - **Key:** `SMS_GATEWAY_PASSWORD`
   - **Value:** `aslp2vayrpzsrq`
   - Save
4. Add third secret:
   - **Key:** `SMS_GATEWAY_DEVICE_ID`
   - **Value:** `nmJJWgn3v2QsOhUg12b-n`
   - Save

### Step 6: Verify Secrets Are Set
After updating, you should see all 3 secrets listed:
- ✅ `SMS_GATEWAY_USERNAME`
- ✅ `SMS_GATEWAY_PASSWORD`
- ✅ `SMS_GATEWAY_DEVICE_ID`

### Step 7: Test Again
1. Go back to the **"Invoke"** or **"Test"** tab
2. Use the same test payload:
   ```json
   {
     "to": "+639159324811",
     "message": "Test message from PESDO"
   }
   ```
3. Click **"Invoke"** or **"Run"**

### Step 8: Check Response
**Expected result:**
- ✅ Status: **200 OK** (not 401)
- ✅ Response: `{"success": true, ...}`
- ✅ You receive SMS on your phone!

**If still 401:**
- Double-check the values match exactly (case-sensitive!)
- Make sure you saved each secret
- Wait a few seconds and try again (secrets might take a moment to update)

## Quick Copy-Paste Values

**Username:**
```
00PKL3
```

**Password:**
```
aslp2vayrpzsrq
```

**Device ID:**
```
nmJJWgn3v2QsOhUg12b-n
```

## Troubleshooting

### Can't find Secrets section?
- Look for **"Environment Variables"** or **"Config"** instead
- Some Supabase versions have secrets in a different location
- Try clicking on the function name → Settings → look for secrets

### Secrets not saving?
- Make sure you click **"Save"** after entering each value
- Check for any error messages
- Try refreshing the page and checking again

### Still getting 401 after updating?
1. **Verify values match exactly:**
   - Username: `00PKL3` (not `00pkl3` or `00PKL3 ` with spaces)
   - Password: `aslp2vayrpzsrq` (exact match)
   - Device ID: `nmJJWgn3v2QsOhUg12b-n` (exact match, including dashes)

2. **Check Edge Function logs:**
   - Go to **Logs** tab
   - Look for `🔐 Credentials check:`
   - Should show the new values are loaded

3. **Wait a moment:**
   - Secrets might take a few seconds to propagate
   - Try again after 10-20 seconds

## After Success

Once you get **200 OK**:
- ✅ SMS function is working!
- ✅ You can now use it in your app
- ✅ Try referring a jobseeker - SMS should be sent!

---

**Need help?** Share a screenshot of your Secrets section if you're having trouble finding it!

