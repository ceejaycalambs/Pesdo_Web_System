/**
 * SMS Setup Verification Script
 * Run this to check if SMS Gateway is properly configured
 * 
 * Usage: node verify-sms-setup.js
 */

const SUPABASE_URL = 'https://qslbiuijmwhirnbyghrh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzbGJpdWlqbXdoaXJuYnlnaHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNjA4MTgsImV4cCI6MjA3NTgzNjgxOH0.VIJ7zDksm3QSghp_cePmn3An_M6WciDEE2GkXJ7QA90';

async function verifySMSSetup() {
  console.log('🔍 Verifying SMS Gateway Setup...\n');

  // Test 1: Check if Edge Function exists
  console.log('1️⃣ Testing Edge Function availability...');
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    
    if (response.ok || response.status === 200 || response.status === 204) {
      console.log('   ✅ Edge Function "send-sms" is accessible\n');
    } else {
      console.log(`   ❌ Edge Function returned status: ${response.status}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Cannot reach Edge Function: ${error.message}\n`);
  }

  // Test 2: Test SMS function with dummy data
  console.log('2️⃣ Testing SMS function (this will fail if secrets not set, but that\'s OK)...');
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: '+639123456789',
        message: 'Test message'
      })
    });

    const data = await response.json().catch(() => ({ error: 'Could not parse response' }));
    
    if (response.ok) {
      console.log('   ✅ SMS function responded successfully');
      console.log('   📊 Response:', JSON.stringify(data, null, 2), '\n');
    } else {
      if (data.error?.includes('credentials not configured') || data.error?.includes('SMS_GATEWAY')) {
        console.log('   ⚠️  Secrets not configured (expected if not set yet)');
        console.log('   💡 Run: supabase secrets set SMS_GATEWAY_USERNAME=7ONAGO');
        console.log('   💡 Run: supabase secrets set SMS_GATEWAY_PASSWORD=25mmhgtotnjptk');
        console.log('   💡 Run: supabase secrets set SMS_GATEWAY_DEVICE_ID=JOfKfT_s1aT-kOYRNVFjy\n');
      } else {
        console.log(`   ❌ SMS function error: ${data.error || data.message || 'Unknown error'}\n`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error testing SMS function: ${error.message}\n`);
  }

  console.log('📋 Next Steps:');
  console.log('   1. Deploy Edge Function: supabase functions deploy send-sms');
  console.log('   2. Set secrets (see above)');
  console.log('   3. Verify Android device is online');
  console.log('   4. Test via browser console or Supabase Dashboard\n');
}

// Run verification
verifySMSSetup().catch(console.error);

