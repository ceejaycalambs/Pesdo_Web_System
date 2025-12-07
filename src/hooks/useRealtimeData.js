import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';

/**
 * Custom hook for real-time data synchronization
 * Syncs jobs, applications, and other dashboard data in real-time
 * @param {string} userId - Current user ID
 * @param {string} userType - 'jobseeker', 'employer', or 'admin'
 * @param {object} callbacks - Callback functions for different data updates
 */
export const useRealtimeData = (userId, userType, callbacks = {}) => {
  const channelRef = useRef(null);
  const {
    onJobsUpdate,
    onApplicationsUpdate,
    onJobStatusChange,
    onApplicationStatusChange,
    onNewApplication,
    onNewJob
  } = callbacks;

  useEffect(() => {
    // Allow public pages (userType === 'public') even without userId
    if (!userType) {
      return;
    }
    
    // For public pages, we still need to set up subscriptions
    if (userType === 'public') {
      // Set up public subscriptions for landing page
      const channelName = 'realtime-data-public';
      channelRef.current = supabase.channel(channelName);

      // Subscribe to job status changes (for statistics)
      channelRef.current
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs'
          },
          (payload) => {
            console.log('🔄 Job updated (public):', payload);
            if (onJobsUpdate) {
              onJobsUpdate(payload);
            }
            if (onJobStatusChange) {
              const oldStatus = payload.old?.status;
              const newStatus = payload.new?.status;
              if (oldStatus !== newStatus) {
                onJobStatusChange(payload.new, oldStatus, newStatus);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'jobs',
            filter: `status=eq.approved`
          },
          (payload) => {
            console.log('🆕 New approved job (public):', payload);
            if (onNewJob) {
              onNewJob(payload.new);
            }
            if (onJobsUpdate) {
              onJobsUpdate(payload);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Real-time data sync active for public landing page');
          }
        });

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      };
    }
    
    // For authenticated users, require userId
    if (!userId) {
      return;
    }

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `realtime-data-${userType}-${userId}`;
    channelRef.current = supabase.channel(channelName);

    if (userType === 'employer') {
      // Subscribe to job status changes (pending/approved/rejected)
      channelRef.current
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: `employer_id=eq.${userId}`
          },
          (payload) => {
            console.log('🔄 Job updated (employer):', payload);
            if (onJobsUpdate) {
              onJobsUpdate(payload);
            }
            if (onJobStatusChange) {
              const oldStatus = payload.old?.status;
              const newStatus = payload.new?.status;
              if (oldStatus !== newStatus) {
                onJobStatusChange(payload.new, oldStatus, newStatus);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'jobs',
            filter: `employer_id=eq.${userId}`
          },
          (payload) => {
            console.log('🆕 New job created (employer):', payload);
            if (onNewJob) {
              onNewJob(payload.new);
            }
            if (onJobsUpdate) {
              onJobsUpdate(payload);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'applications'
          },
          (payload) => {
            // Check if this application is for one of the employer's jobs
            // We'll need to verify this in the callback
            console.log('🔄 Application updated (employer):', payload);
            if (onApplicationsUpdate) {
              onApplicationsUpdate(payload);
            }
            if (onApplicationStatusChange) {
              const oldStatus = payload.old?.status;
              const newStatus = payload.new?.status;
              if (oldStatus !== newStatus) {
                onApplicationStatusChange(payload.new, oldStatus, newStatus);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'applications'
          },
          (payload) => {
            console.log('🆕 New application (employer):', payload);
            if (onNewApplication) {
              onNewApplication(payload.new);
            }
            if (onApplicationsUpdate) {
              onApplicationsUpdate(payload);
            }
          }
        );
    } else if (userType === 'jobseeker') {
      // Subscribe to job listings updates (new jobs, status changes)
      channelRef.current
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs'
          },
          (payload) => {
            // Only notify if job is approved (visible to jobseekers)
            if (payload.new.status === 'approved') {
              console.log('🔄 Job updated (jobseeker):', payload);
              if (onJobsUpdate) {
                onJobsUpdate(payload);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'jobs',
            filter: `status=eq.approved`
          },
          (payload) => {
            console.log('🆕 New job available (jobseeker):', payload);
            if (onNewJob) {
              onNewJob(payload.new);
            }
            if (onJobsUpdate) {
              onJobsUpdate(payload);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'applications',
            filter: `jobseeker_id=eq.${userId}`
          },
          (payload) => {
            console.log('🔄 Application status changed (jobseeker):', payload);
            if (onApplicationsUpdate) {
              onApplicationsUpdate(payload);
            }
            if (onApplicationStatusChange) {
              const oldStatus = payload.old?.status;
              const newStatus = payload.new?.status;
              if (oldStatus !== newStatus) {
                onApplicationStatusChange(payload.new, oldStatus, newStatus);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'applications',
            filter: `jobseeker_id=eq.${userId}`
          },
          (payload) => {
            console.log('🆕 Application created (jobseeker):', payload);
            if (onNewApplication) {
              onNewApplication(payload.new);
            }
            if (onApplicationsUpdate) {
              onApplicationsUpdate(payload);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'employer_profiles'
          },
          (payload) => {
            // When employer verification status changes (e.g., to suspended), refresh jobs
            const oldStatus = payload.old?.verification_status;
            const newStatus = payload.new?.verification_status;
            if (oldStatus !== newStatus) {
              console.log('🔄 Employer verification status changed (jobseeker):', {
                employerId: payload.new.id,
                oldStatus,
                newStatus
              });
              // Refresh jobs list when employer status changes (especially if suspended)
              if (onJobsUpdate) {
                onJobsUpdate({ new: { id: payload.new.id, verification_status: newStatus } });
              }
            }
          }
        );
    } else if (userType === 'admin' || userType === 'super_admin') {
      // Subscribe to all job status changes for admin
      channelRef.current
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs'
          },
          (payload) => {
            console.log('🔄 Job updated (admin):', payload);
            if (onJobsUpdate) {
              onJobsUpdate(payload);
            }
            if (onJobStatusChange) {
              const oldStatus = payload.old?.status;
              const newStatus = payload.new?.status;
              if (oldStatus !== newStatus) {
                onJobStatusChange(payload.new, oldStatus, newStatus);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'jobs'
          },
          (payload) => {
            console.log('🆕 New job pending (admin):', payload);
            if (onNewJob) {
              onNewJob(payload.new);
            }
            if (onJobsUpdate) {
              onJobsUpdate(payload);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobvacancypending'
          },
          (payload) => {
            console.log('🔄 Pending job updated (admin):', payload);
            if (onJobsUpdate) {
              onJobsUpdate(payload);
            }
            if (onJobStatusChange) {
              const oldStatus = payload.old?.status;
              const newStatus = payload.new?.status;
              if (oldStatus !== newStatus) {
                onJobStatusChange(payload.new, oldStatus, newStatus);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'jobvacancypending'
          },
          (payload) => {
            console.log('🆕 New job pending approval (admin):', payload);
            if (onNewJob) {
              onNewJob(payload.new);
            }
            if (onJobsUpdate) {
              onJobsUpdate(payload);
            }
          }
        );
    }

    // Subscribe to the channel
    channelRef.current.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Real-time data sync active for ${userType}:`, userId);
      } else if (status === 'CHANNEL_ERROR') {
        // Only log errors in production or if not in React StrictMode
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ Real-time channel error (non-critical, will retry)');
        }
        // Don't throw error - this is non-critical and shouldn't break the app
      } else if (status === 'TIMED_OUT') {
        // Only log in production
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ Real-time channel timed out (non-critical)');
        }
      }
      // Don't log CLOSED status - it's expected during component unmount/remount in development
    });

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        // Unsubscribe silently to prevent CLOSED warnings during cleanup
        // This is expected in React StrictMode (development)
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          // Ignore cleanup errors - channel may already be closed
        }
        channelRef.current = null;
      }
    };
  }, [userId, userType, onJobsUpdate, onApplicationsUpdate, onJobStatusChange, onApplicationStatusChange, onNewApplication, onNewJob]);

  // Return a function to manually refresh (useful for error recovery)
  const refresh = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    // Trigger re-subscription by updating a dependency
    // This is handled by the useEffect above
  }, []);

  return { refresh };
};

