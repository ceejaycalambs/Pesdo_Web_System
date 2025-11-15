import { supabase } from '../supabase.js';

/**
 * Log an activity to the activity_log table
 * @param {Object} params
 * @param {string} params.userId - User ID performing the action
 * @param {string} params.userType - Type of user: 'jobseeker', 'employer', 'admin', 'super_admin'
 * @param {string} params.actionType - Type of action: 'job_approved', 'jobseeker_referred', etc.
 * @param {string} params.actionDescription - Human-readable description
 * @param {string} params.entityType - Type of entity affected: 'job', 'application', 'profile', etc.
 * @param {string} params.entityId - ID of the entity affected
 * @param {Object} params.metadata - Additional data about the action
 */
export const logActivity = async ({
  userId,
  userType,
  actionType,
  actionDescription,
  entityType = null,
  entityId = null,
  metadata = {}
}) => {
  try {
    // Get user agent if available (IP address removed)
    const userAgent = metadata.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null);

    console.log('📝 Inserting activity log:', {
      user_id: userId,
      user_type: userType,
      action_type: actionType,
      action_description: actionDescription
    });

    // Try using RPC function first (bypasses RLS, more reliable for account creation)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('insert_activity_log', {
        p_user_id: userId,
        p_user_type: userType,
        p_action_type: actionType,
        p_action_description: actionDescription,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_metadata: metadata,
        p_user_agent: userAgent
      });

      if (!rpcError && rpcData) {
        console.log('✅ Activity log inserted successfully via RPC:', rpcData);
        return; // Success, exit early
      } else if (rpcError && !rpcError.message?.includes('function') && rpcError.code !== '42883') {
        // RPC function exists but failed, log and fall through to direct insert
        console.warn('⚠️ RPC function failed, trying direct insert:', rpcError);
      } else {
        // RPC function doesn't exist, fall through to direct insert
        console.log('ℹ️ RPC function not available, using direct insert');
      }
    } catch (rpcErr) {
      // RPC function doesn't exist or other error, fall through to direct insert
      console.log('ℹ️ RPC function not available, using direct insert:', rpcErr.message);
    }

    // Fallback to direct insert (will work if RLS policy allows it)
    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        user_id: userId,
        user_type: userType,
        action_type: actionType,
        action_description: actionDescription,
        entity_type: entityType,
        entity_id: entityId,
        metadata: metadata,
        user_agent: userAgent
      })
      .select();

    if (error) {
      console.error('❌ Error logging activity:', error);
      console.error('❌ Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      // Don't throw error - logging should not break the main functionality
    } else {
      console.log('✅ Activity log inserted successfully:', data);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error - logging should not break the main functionality
  }
};

/**
 * Log a login attempt to the login_log table
 * @param {Object} params
 * @param {string} params.userId - User ID (null if login failed)
 * @param {string} params.userType - Type of user: 'jobseeker', 'employer', 'admin', 'super_admin'
 * @param {string} params.email - Email used for login
 * @param {string} params.status - 'success', 'failed', 'blocked'
 * @param {string} params.failureReason - Reason for failed login
 * @param {string} params.userAgent - User agent string
 */
export const logLogin = async ({
  userId = null,
  userType,
  email,
  status,
  failureReason = null,
  userAgent = null
}) => {
  try {
    const { error } = await supabase
      .from('login_log')
      .insert({
        user_id: userId,
        user_type: userType,
        email: email,
        login_status: status,
        failure_reason: failureReason,
        user_agent: userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null)
      });

    if (error) {
      console.error('Error logging login:', error);
      // Don't throw error - logging should not break the main functionality
    }
  } catch (error) {
    console.error('Error logging login:', error);
    // Don't throw error - logging should not break the main functionality
  }
};

