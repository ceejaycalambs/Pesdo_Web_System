/**
 * SMS Service
 * Handles sending SMS via Android SMS Gateway
 */

import { supabase } from '../supabase';

/**
 * Send SMS via Android SMS Gateway
 * NOTE: This calls a Supabase Edge Function to keep SMS Gateway credentials secure
 * 
 * @param {Object} options - SMS options
 * @param {string} options.to - Recipient phone number (E.164 format: +639123456789)
 * @param {string} options.message - SMS message body
 * @returns {Promise<Object>} - Result object
 */
export const sendSMS = async ({ to, message }) => {
  try {
    // Call Supabase Edge Function (Recommended)
    // This keeps your SMS Gateway credentials secure on the server
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: { to, message }
    });

    if (error) {
      console.error('❌ SMS sending error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ SMS sent successfully');
    return { success: true, data };

  } catch (error) {
    console.error('Error sending SMS:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Format phone number to E.164 format (required by SMS Gateway)
 * @param {string} phoneNumber - Phone number in any format
 * @param {string} countryCode - Default country code (e.g., 'PH' for Philippines)
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phoneNumber, countryCode = 'PH') => {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Philippines phone number handling
  if (countryCode === 'PH') {
    // If starts with 0, replace with country code 63
    if (cleaned.startsWith('0')) {
      cleaned = '63' + cleaned.substring(1);
    }
    // If doesn't start with country code, add it
    else if (!cleaned.startsWith('63')) {
      cleaned = '63' + cleaned;
    }
  }

  // Add + prefix
  return '+' + cleaned;
};

/**
 * Validate phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} - True if valid
 */
export const validatePhoneNumber = (phoneNumber) => {
  // Basic validation: should be 10-15 digits after country code
  const cleaned = phoneNumber.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
};

/**
 * SMS Templates
 */

// Application status update SMS
export const sendApplicationStatusSMS = async (phoneNumber, userName, jobTitle, status, companyName) => {
  const statusMessages = {
    accepted: `Hi ${userName}! Great news! Your application for ${jobTitle} at ${companyName} has been ACCEPTED. Check your dashboard for details. - PESDO`,
    rejected: `Hi ${userName}! Thank you for applying. Your application for ${jobTitle} at ${companyName} was not selected. Keep applying! - PESDO`,
    referred: `Hi ${userName}! You've been REFERRED for ${jobTitle} at ${companyName}. The employer will review your profile. - PESDO`
  };

  const message = statusMessages[status] || statusMessages.rejected;
  const formattedPhone = formatPhoneNumber(phoneNumber);

  return await sendSMS({ to: formattedPhone, message });
};

// New application notification (for employers)
export const sendNewApplicationSMS = async (phoneNumber, employerName, jobseekerName, jobTitle) => {
  const message = `Hi ${employerName}! New application received for ${jobTitle} from ${jobseekerName}. Check your dashboard. - PESDO`;
  const formattedPhone = formatPhoneNumber(phoneNumber);

  return await sendSMS({ to: formattedPhone, message });
};

// Job approval notification (for employers)
export const sendJobApprovalSMS = async (phoneNumber, employerName, jobTitle, status) => {
  const message = status === 'approved'
    ? `Hi ${employerName}! Your job vacancy "${jobTitle}" has been APPROVED and is now live. - PESDO`
    : `Hi ${employerName}! Update on your job vacancy "${jobTitle}": ${status}. Check dashboard for details. - PESDO`;
  
  const formattedPhone = formatPhoneNumber(phoneNumber);

  return await sendSMS({ to: formattedPhone, message });
};

// Welcome SMS
export const sendWelcomeSMS = async (phoneNumber, userName, userType) => {
  const message = `Welcome to PESDO, ${userName}! Your ${userType} account is ready. Visit ${process.env.REACT_APP_BASE_URL || 'pesdo.gov.ph'} to get started. - PESDO`;
  const formattedPhone = formatPhoneNumber(phoneNumber);

  return await sendSMS({ to: formattedPhone, message });
};

