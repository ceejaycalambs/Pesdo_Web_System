// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: Send SMS via Twilio API
// 
// Deploy this function:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Login: supabase login
// 3. Link project: supabase link --project-ref your-project-ref
// 4. Deploy: supabase functions deploy send-sms
// 
// Set secrets:
// supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid
// supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
// supabase secrets set TWILIO_PHONE_NUMBER=+1234567890
//
// Get credentials from: https://console.twilio.com
// Free trial: $15.50 credits (~1,000 SMS)
//
// Note: We declare Deno for local linting; Supabase Edge provides it at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

interface SendSMSRequest {
  to: string;
  message: string;
}

function badRequest(message: string, details?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: message, details }), {
    status: 400,
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests - MUST return 200 status
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  let payload: SendSMSRequest;
  try {
    payload = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { to, message } = payload || {};
  if (!to || !message) {
    return badRequest('Missing required fields: to, message');
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  console.log('🔐 Credentials check:', {
    hasAccountSid: !!accountSid,
    hasAuthToken: !!authToken,
    hasPhoneNumber: !!twilioPhoneNumber,
    accountSidLength: accountSid?.length || 0,
    authTokenLength: authToken?.length || 0
  });

  if (!accountSid || !authToken || !twilioPhoneNumber) {
    const missing: string[] = [];
    if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
    if (!twilioPhoneNumber) missing.push('TWILIO_PHONE_NUMBER');
    
    console.error('❌ Missing credentials:', missing);
    return new Response(
      JSON.stringify({ 
        error: 'Twilio credentials not configured',
        missing: missing,
        message: `Set these secrets: ${missing.join(', ')}. Get them from https://console.twilio.com`
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }

  // Normalize phone number to E.164 format (+63XXXXXXXXXX for Philippines)
  // Handles: 09123456789, +639123456789, 639123456789, 9123456789
  let cleaned = to.replace(/[\s-]/g, '');
  
  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle Philippine numbers (country code 63)
  if (cleaned.startsWith('63')) {
    // Already has country code: 639123456789 -> +639123456789
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Local format: 09123456789 -> +639123456789
    cleaned = '+63' + cleaned.substring(1);
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    // Without leading 0: 9123456789 -> +639123456789
    cleaned = '+63' + cleaned;
  } else {
    // Default: add + if not present
    cleaned = cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  }
  
  const normalizedPhone = cleaned;

  // Twilio API endpoint
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  // Create Basic Auth header (Twilio uses Account SID:Auth Token)
  const authString = btoa(`${accountSid}:${authToken}`);

  // Log request details (without sensitive data)
  console.log('📤 SMS Request:', {
    endpoint: 'Twilio API',
    phone: normalizedPhone,
    messageLength: message.length,
    fromNumber: twilioPhoneNumber
  });

  try {
    // Twilio requires form-urlencoded data
    const formData = new URLSearchParams({
      To: normalizedPhone,
      From: twilioPhoneNumber,
      Body: message,
    });

    console.log('📤 Sending SMS via Twilio:', {
      to: normalizedPhone,
      from: twilioPhoneNumber,
      messageLength: message.length
    });

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    console.log('📥 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('❌ Twilio error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send SMS via Twilio', 
          details: errorText,
          status: response.status
        }),
        {
          status: response.status || 502,
          headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    const data = await response.json().catch(() => {
      console.warn('⚠️ Could not parse response as JSON, treating as success');
      return { success: true };
    });

    console.log('✅ SMS sent successfully via Twilio:', {
      messageId: data.sid || null,
      phone: normalizedPhone,
      status: data.status
    });

    return ok({ 
      success: true, 
      messageId: data.sid || null, 
      phone: normalizedPhone,
      status: data.status,
      response: data 
    });
  } catch (error) {
    console.error('❌ Twilio request exception:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 200)
    });
    return new Response(
      JSON.stringify({ 
        error: 'Failed to connect to Twilio', 
        details: error.message
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});

