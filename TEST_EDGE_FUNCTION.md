# Step 4: Testing the Edge Function - Detailed Guide

## Where to Test

### In Supabase Dashboard:

1. **Navigate to the Function:**
   - Go to: https://supabase.com/dashboard/project/qslbiuijmwhirnbyghrh
   - Click **Edge Functions** in the left sidebar
   - Click on **`send-sms`** function

2. **Open the Test/Invoke Panel:**
   - Look for a button labeled **"Invoke"**, **"Test"**, or **"Run"**
   - It's usually at the top right of the function page
   - Or look for a tab called **"Invoke"** or **"Test"**

3. **Prepare the Test Payload:**
   - You'll see a text area or JSON editor
   - Enter this JSON (replace with your actual phone number):
   ```json
   {
     "to": "+639123456789",
     "message": "Test message from PESDO - This is a test SMS"
   }
   ```
   
   **Important:** 
   - Replace `+639123456789` with a real phone number you can test with
   - Use your own phone number to verify it works
   - Format must be: `+639XXXXXXXXX` (10 digits after +63)

4. **Click "Invoke" or "Run":**
   - The function will execute
   - Wait a few seconds for the response

5. **Check the Response:**
   
   **✅ Success Response (should look like this):**
   ```json
   {
     "success": true,
     "messageId": "some-id-here",
     "phone": "+639123456789",
     "response": { ... }
   }
   ```
   
   **❌ Error Response (if something is wrong):**
   ```json
   {
     "error": "SMS Gateway credentials not configured",
     "missing": ["SMS_GATEWAY_USERNAME", ...]
   }
   ```
   OR
   ```json
   {
     "error": "Failed to send SMS",
     "details": "..."
   }
   ```

6. **Check the Logs:**
   - Click on the **"Logs"** tab (next to Code, Settings, etc.)
   - You should see logs like:
     - `🔐 Credentials check: { hasUsername: true, ... }`
     - `📤 SMS Request: { endpoint: ..., phone: ... }`
     - `📥 Response status: 200 OK`
     - `✅ SMS sent successfully`

---

## What Each Response Means

### ✅ Success Response
**What it means:**
- Function is deployed correctly
- Secrets are set correctly
- SMS was sent to the API
- You should receive the SMS on your phone

**Next steps:**
- Check your phone for the test message
- If you received it, SMS is working! ✅
- If you didn't receive it, check Android device (see troubleshooting below)

---

### ❌ "Credentials not configured" Error
**What it means:**
- Secrets are missing or not set correctly

**How to fix:**
1. Go to function **Settings** → **Secrets**
2. Verify all 3 secrets exist:
   - `SMS_GATEWAY_USERNAME`
   - `SMS_GATEWAY_PASSWORD`
   - `SMS_GATEWAY_DEVICE_ID`
3. If missing, add them with the correct values
4. Test again

---

### ❌ "Failed to send SMS" Error
**What it means:**
- Function is working, but SMS Gateway API returned an error
- Could be: wrong credentials, device offline, network issue

**How to fix:**
1. Check the `details` field in the error response
2. Verify Android device is online
3. Check SMS Gateway app is running
4. Verify credentials match the app settings

---

### ❌ "Failed to connect to SMS Gateway" Error
**What it means:**
- Cannot reach the SMS Gateway API
- Network issue or API endpoint is wrong

**How to fix:**
1. Check Android device internet connection
2. Verify SMS Gateway app is running
3. Check if `api.sms-gate.app` is accessible

---

## Visual Guide: Where to Find Test Button

The test/invoke button is usually located in one of these places:

**Option A: Top Right Corner**
```
┌─────────────────────────────────────┐
│  send-sms Function                  │
│  [Code] [Settings] [Logs] [Invoke]  │  ← Click "Invoke"
└─────────────────────────────────────┘
```

**Option B: Inside Function Page**
```
┌─────────────────────────────────────┐
│  Function: send-sms                 │
│                                     │
│  [Deploy] [Invoke] [Settings]      │  ← Click "Invoke"
│                                     │
│  Code Editor:                       │
│  ...                                │
└─────────────────────────────────────┘
```

**Option C: Separate Tab**
```
Tabs: [Code] [Settings] [Logs] [Invoke]  ← Click "Invoke" tab
```

---

## Example Test Scenarios

### Test 1: Basic Test
```json
{
  "to": "+639123456789",
  "message": "Test from PESDO"
}
```
**Expected:** Success response, SMS received on phone

---

### Test 2: Test with Your Phone Number
```json
{
  "to": "+639876543210",
  "message": "Hello! This is a test SMS from PESDO system."
}
```
**Expected:** You receive SMS on your phone

---

### Test 3: Test Error Handling (Invalid Phone)
```json
{
  "to": "123",
  "message": "Test"
}
```
**Expected:** Error response (phone number invalid)

---

## After Successful Test

Once the test works in Supabase Dashboard:

1. **Go back to your app** (localhost:5173)
2. **Try referring a jobseeker again**
3. **Check browser console** - should see:
   - `✅ SMS Service: SMS sent successfully`
   - No CORS errors
4. **Check your phone** - should receive SMS

---

## Troubleshooting Test Failures

### If test returns error immediately:
- Check function logs for details
- Verify secrets are set
- Check function code is correct

### If test succeeds but no SMS received:
- Check Android device is online
- Verify SMS Gateway app is running
- Check device has SMS credits
- Verify phone number format is correct

### If test times out:
- Check Android device internet connection
- Verify SMS Gateway app is connected to cloud server
- Check if API endpoint is correct

---

## Quick Test Checklist

Before testing, verify:
- [ ] Function is deployed
- [ ] All 3 secrets are set
- [ ] Android device is online
- [ ] SMS Gateway app is running
- [ ] Cloud server is enabled in app
- [ ] You have a test phone number ready

After testing, verify:
- [ ] Test returns success response
- [ ] Logs show successful request
- [ ] SMS received on phone (if test succeeded)
- [ ] No errors in function logs

