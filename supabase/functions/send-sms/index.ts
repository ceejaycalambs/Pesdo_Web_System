// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: Send SMS via SMS-Gate.app API
// 
// Deploy this function:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Login: supabase login
// 3. Link project: supabase link --project-ref your-project-ref
// 4. Deploy: supabase functions deploy send-sms
// 
// Set secrets:
// supabase secrets set SMS_GATEWAY_USERNAME=7ONAGO
// supabase secrets set SMS_GATEWAY_PASSWORD=25mmhgtotnjptk
// supabase secrets set SMS_GATEWAY_DEVICE_ID=JOfKfT_s1aT-kOYRNVFjy
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
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  const username = Deno.env.get('SMS_GATEWAY_USERNAME');
  const password = Deno.env.get('SMS_GATEWAY_PASSWORD');
  const deviceId = Deno.env.get('SMS_GATEWAY_DEVICE_ID');

  if (!username || !password || !deviceId) {
    return new Response(
      JSON.stringify({ 
        error: 'SMS Gateway credentials not configured. Set SMS_GATEWAY_USERNAME, SMS_GATEWAY_PASSWORD, and SMS_GATEWAY_DEVICE_ID secrets.' 
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

  // SMS-Gate.app API endpoint
  const apiUrl = 'https://api.sms-gate.app/mobile/v1';
  const smsEndpoint = `${apiUrl}/send`;

  // Create Basic Auth header
  const authString = btoa(`${username}:${password}`);

  try {
    const response = await fetch(smsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify({
        device_id: deviceId,
        phone_number: normalizedPhone,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('SMS Gateway error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: errorText }),
        {
          status: response.status || 502,
          headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    const data = await response.json().catch(() => ({ success: true }));
    return ok({ 
      success: true, 
      messageId: data.id || data.messageId || data.sid || null, 
      phone: normalizedPhone,
      response: data 
    });
  } catch (error) {
    console.error('SMS Gateway request error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to connect to SMS Gateway', details: error.message }),
      {
        status: 500,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});

