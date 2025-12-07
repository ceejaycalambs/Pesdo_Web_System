import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

/**
 * Custom hook for Supabase Realtime notifications
 * @param {string} userId - Current user ID
 * @param {string} userType - 'jobseeker', 'employer', or 'admin'
 */
export const useRealtimeNotifications = (userId, userType) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);
  const pollingRef = useRef(null);
  const hasNotificationAPI = typeof globalThis !== 'undefined' && 'Notification' in globalThis;

  // Get storage keys
  const getReadNotificationsKey = () => `read_notifications_${userId}_${userType}`;
  const getNotificationHistoryKey = () => `notification_history_${userId}_${userType}`;

  // Load read notifications from localStorage
  const getReadNotifications = () => {
    if (!userId) return new Set();
    try {
      const stored = localStorage.getItem(getReadNotificationsKey());
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (error) {
      console.error('Error loading read notifications:', error);
      return new Set();
    }
  };

  // Save read notifications to localStorage
  const saveReadNotifications = (readSet) => {
    if (!userId) return;
    try {
      localStorage.setItem(getReadNotificationsKey(), JSON.stringify(Array.from(readSet)));
    } catch (error) {
      console.error('Error saving read notifications:', error);
    }
  };

  // Load notification history from localStorage
  const getNotificationHistory = () => {
    if (!userId) return [];
    try {
      const stored = localStorage.getItem(getNotificationHistoryKey());
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading notification history:', error);
      return [];
    }
  };

  // Save notification history to localStorage (keep last 100)
  const saveNotificationHistory = (notifications) => {
    if (!userId) return;
    try {
      // Keep only the last 100 notifications to avoid localStorage size limits
      const history = notifications.slice(0, 100);
      localStorage.setItem(getNotificationHistoryKey(), JSON.stringify(history));
    } catch (error) {
      console.error('Error saving notification history:', error);
    }
  };

  // Fetch initial notifications
  const fetchNotifications = async () => {
    if (!userId) {
      // Load from history even without userId
      const history = getNotificationHistory();
      setNotifications(history);
      setUnreadCount(history.filter(n => !n.read).length);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // First, load from history to show notifications immediately
      let history = getNotificationHistory();
      if (history.length > 0) {
        setNotifications(history);
        setUnreadCount(history.filter(n => !n.read).length);
      }
      
      const readNotifications = getReadNotifications();
      let combinedData = [];

      if (userType === 'jobseeker') {
        // Jobseekers: Get notifications about their applications
        const {
          data: applicationRows,
          error: applicationsError
        } = await supabase
          .from('applications')
          .select('*')
          .eq('jobseeker_id', userId)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (applicationsError) {
          console.error('Error fetching jobseeker notifications from database:', applicationsError);
        } else if (applicationRows && applicationRows.length > 0) {
          const jobIds = Array.from(
            new Set(applicationRows.map((row) => row.job_id).filter(Boolean))
          );

          const jobMap = new Map();
          const employerMap = new Map();

          if (jobIds.length > 0) {
            const {
              data: jobsData,
              error: jobsError
            } = await supabase
              .from('jobs')
              .select('id, employer_id, position_title, salary_range, nature_of_work, vacancy_count, job_description, place_of_work')
              .in('id', jobIds);

            if (jobsError) {
              console.error('Error fetching jobs for jobseeker notifications:', jobsError);
            } else if (jobsData) {
              jobsData.forEach((job) => {
                jobMap.set(job.id, job);
              });

              const employerIds = Array.from(
                new Set(jobsData.map((job) => job.employer_id).filter(Boolean))
              );

              if (employerIds.length > 0) {
                const {
                  data: employersData,
                  error: employersError
                } = await supabase
                  .from('employer_profiles')
                  .select('id, business_name')
                  .in('id', employerIds);

                if (employersError) {
                  console.error('Error fetching employer profiles for jobseeker notifications:', employersError);
                } else if (employersData) {
                  employersData.forEach((employer) => {
                    employerMap.set(employer.id, employer);
                  });
                }
              }
            }
          }

          const enrichedApplications = applicationRows.map((application) => {
            const jobInfo = application.job_id ? jobMap.get(application.job_id) : null;
            const employerInfo = jobInfo?.employer_id ? employerMap.get(jobInfo.employer_id) : null;

            return {
              ...application,
              jobs: jobInfo
                ? {
                    ...jobInfo,
                    employer_business_name: employerInfo?.business_name || null
                  }
                : null
            };
          });

          combinedData = combinedData.concat(
            enrichedApplications.map((item) => ({ ...item, __source: 'application' }))
          );
        }
      } else if (userType === 'employer') {
        // Employers: Get notifications about new applications to their jobs
        const { data: employerJobs, error: employerJobsError } = await supabase
          .from('jobs')
          .select('id')
          .eq('employer_id', userId);

        if (employerJobsError) {
          console.error('Error fetching employer jobs for notifications:', employerJobsError);
        } else if (employerJobs && employerJobs.length > 0) {
          const jobIds = employerJobs.map(job => job.id);
          // Fetch applications separately to avoid ambiguous relationship error
          const { data: applicationData, error: applicationError } = await supabase
            .from('applications')
            .select('id, job_id, jobseeker_id, status, applied_at, created_at')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false })
            .limit(50);

          if (applicationError) {
            console.error('Error fetching employer application notifications:', applicationError);
          } else if (applicationData && applicationData.length > 0) {
            // Fetch job details separately
            const appJobIds = Array.from(new Set(applicationData.map(app => app.job_id).filter(Boolean)));
            const { data: jobsData } = await supabase
              .from('jobs')
              .select('id, position_title, employer_id')
              .in('id', appJobIds);

            // Fetch jobseeker profiles separately
            const appJobseekerIds = Array.from(new Set(applicationData.map(app => app.jobseeker_id).filter(Boolean)));
            const { data: jobseekerProfiles } = await supabase
              .from('jobseeker_profiles')
              .select('id, first_name, last_name, suffix')
              .in('id', appJobseekerIds);

            // Combine the data
            const jobsMap = new Map((jobsData || []).map(job => [job.id, job]));
            const jobseekersMap = new Map((jobseekerProfiles || []).map(js => [js.id, js]));

            combinedData = combinedData.concat(
              applicationData
                .filter(item => {
                  const status = (item.status || '').toLowerCase();
                  return status === 'pending' || status === 'referred';
                })
                .map(item => ({
                  ...item,
                  jobs: jobsMap.get(item.job_id) || null,
                  jobseeker_profiles: jobseekersMap.get(item.jobseeker_id) || null,
                  __source: 'application'
                }))
            );
          }
        }

        // Employers: Fetch direct notifications (e.g., verification, job approvals)
        const { data: notificationRows, error: notificationError } = await supabase
          .from('notifications')
          .select('*')
          .eq('employer_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (notificationError) {
          console.error('Error fetching employer notifications table:', notificationError);
        } else if (notificationRows) {
          combinedData = combinedData.concat(notificationRows.map(item => ({ ...item, __source: 'notification' })));
        }
      } else if (userType === 'admin') {
        // Admins: Get notifications about pending jobs only (jobs that need approval)
        const { data, error } = await supabase
          .from('jobvacancypending')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching admin notifications from database:', error);
        } else if (data) {
          combinedData = combinedData.concat(data.map(item => ({ ...item, __source: 'jobvacancy' })));
        }
      }

      if (combinedData.length > 0) {
        // Transform current data into notification format
        const currentNotifications = combinedData.map(item => {
          const timestamp = item.updated_at || item.created_at || item.applied_at || new Date().toISOString();
          const source = item.__source || 'application';
          const notificationId = `${source}_${item.id}_${timestamp}`;
          const isRead = readNotifications.has(notificationId);
          const enrichedItem = { ...item, __source: source };

          return {
            id: notificationId,
            originalId: item.id,
            type: getNotificationType(enrichedItem, userType),
            message: getNotificationMessage(enrichedItem, userType),
            timestamp: timestamp,
            read: isRead,
            data: enrichedItem,
            source
          };
        });

        // Create a map of current notifications by ID
        const currentNotificationsMap = new Map(currentNotifications.map(n => [n.id, n]));
        const historyIds = new Set(history.map(h => h.id));

        // Update history with current notifications (preserve read status from history)
        for (const histNotif of history) {
          if (currentNotificationsMap.has(histNotif.id)) {
            const current = currentNotificationsMap.get(histNotif.id);
            current.read = histNotif.read;
          }
        }

        // Add new notifications from current data that aren't in history
        for (const notif of currentNotifications) {
          if (!historyIds.has(notif.id)) {
            history.push(notif);
            historyIds.add(notif.id);
          }
        }

        // Remove old notifications (keep only last 100)
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        history = history.slice(0, 100);

        // Save updated history
        saveNotificationHistory(history);

        setNotifications(history);
        setUnreadCount(history.filter(n => !n.read).length);
      } else {
        // If no data fetched, fall back to history only
        setNotifications(history);
        setUnreadCount(history.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Set up realtime subscription
  useEffect(() => {
    if (!userId || !userType) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      // Even without userId, try to load from history
      const history = getNotificationHistory();
      if (history.length > 0) {
        setNotifications(history);
        setUnreadCount(history.filter(n => !n.read).length);
      }
      setLoading(false);
      return;
    }

    // Fetch initial notifications
    fetchNotifications();

    // Set up polling as a fallback to ensure new notifications are fetched
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    pollingRef.current = setInterval(() => {
      fetchNotifications();
    }, 20000); // Poll every 20 seconds

    // Set up realtime channel
    if (userType === 'jobseeker') {
      // Subscribe to application status changes for jobseekers
      channelRef.current = supabase
        .channel(`jobseeker-notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'applications',
            filter: `jobseeker_id=eq.${userId}`
          },
          (payload) => {
            console.log('🔔 Application status changed:', payload);
            handleRealtimeUpdate(payload, userType);
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
            console.log('🔔 New application created:', payload);
            handleRealtimeUpdate(payload, userType);
          }
        )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                console.log('✅ Jobseeker notifications subscribed');
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                // Only log errors in production (CLOSED is expected in development)
                if (process.env.NODE_ENV === 'production') {
                  console.warn('⚠️ Jobseeker notification channel issue (non-critical):', status);
                }
              }
              // Don't log CLOSED - it's expected during component unmount/remount
            });
    } else if (userType === 'employer') {
      // Subscribe to new applications for employers
      const setupEmployerSubscription = async () => {
        const { data: employerJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('employer_id', userId);

        if (employerJobs && employerJobs.length > 0) {
          const jobIdSet = new Set(employerJobs.map(job => job.id));
          
          channelRef.current = supabase
            .channel(`employer-notifications-${userId}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'applications'
              },
              (payload) => {
                // Check if the application is for one of the employer's jobs
                if (jobIdSet.has(payload.new.job_id)) {
                  console.log('🔔 New application received:', payload);
                  handleRealtimeUpdate(payload, userType, 'application');
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
                if (jobIdSet.has(payload.new.job_id)) {
                  console.log('🔔 Application updated:', payload);
                  handleRealtimeUpdate(payload, userType, 'application');
                }
              }
            )
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `employer_id=eq.${userId}`
              },
              (payload) => {
                console.log('🔔 Employer direct notification:', payload);
                handleRealtimeUpdate(payload, userType, 'notification');
              }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                console.log('✅ Employer notifications subscribed');
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                // Only log errors in production (CLOSED is expected in development)
                if (process.env.NODE_ENV === 'production') {
                  console.warn('⚠️ Employer notification channel issue (non-critical):', status);
                }
              }
              // Don't log CLOSED - it's expected during component unmount/remount
            });
        }
      };

      setupEmployerSubscription();
    } else if (userType === 'admin') {
      // Subscribe to new pending jobs for admins (only INSERT events for pending jobs)
      channelRef.current = supabase
        .channel(`admin-notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'jobvacancypending',
            filter: 'status=eq.pending'
          },
          (payload) => {
            // Only notify if the new job is pending
            if (payload.new.status === 'pending') {
              console.log('🔔 New job pending approval:', payload);
              handleRealtimeUpdate(payload, userType);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Admin notifications subscribed');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Only log errors in production (CLOSED is expected in development)
            if (process.env.NODE_ENV === 'production') {
              console.warn('⚠️ Admin notification channel issue (non-critical):', status);
            }
          }
          // Don't log CLOSED - it's expected during component unmount/remount
        });
    }

    // Cleanup on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
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
  }, [userId, userType]);

  // Handle realtime updates
  const handleRealtimeUpdate = (payload, userType, sourceOverride = null) => {
    if (userType === 'employer' && payload.eventType === 'UPDATE') {
      const previousStatus = (payload.old?.status || '').toLowerCase();
      const nextStatus = (payload.new?.status || '').toLowerCase();
      if (previousStatus !== nextStatus && (nextStatus === 'accepted' || nextStatus === 'rejected')) {
        return;
      }
    }

    const baseSource = sourceOverride || payload.new.__source || (payload.table === 'notifications' ? 'notification' : 'application');
    const timestamp = payload.new.updated_at || payload.new.created_at || payload.new.applied_at || new Date().toISOString();
    const notificationId = `${baseSource}_${payload.new.id}_${timestamp}`;
    
    // Check if already read
    const readNotifications = getReadNotifications();
    const isRead = readNotifications.has(notificationId);
    
    // Fetch related data for better notification message
    const fetchRelatedData = async () => {
      if (baseSource === 'notification') {
        return { ...payload.new, __source: 'notification' };
      }

      let enrichedData = { ...payload.new, __source: baseSource };

      if (userType === 'jobseeker' && payload.new.job_id) {
        // Fetch job and employer details for jobseekers
        let jobData = null;
        let employerData = null;

        const { data: jobRow, error: jobError } = await supabase
          .from('jobs')
          .select('id, employer_id, position_title, salary_range, nature_of_work, vacancy_count, job_description, place_of_work')
          .eq('id', payload.new.job_id)
          .single();

        if (!jobError && jobRow) {
          jobData = jobRow;
          if (jobRow.employer_id) {
            const { data: employerRow, error: employerError } = await supabase
              .from('employer_profiles')
              .select('id, business_name')
              .eq('id', jobRow.employer_id)
              .single();
            if (!employerError && employerRow) {
              employerData = employerRow;
            }
          }
        }

        if (jobData) {
          enrichedData = {
            ...payload.new,
            jobs: {
              ...jobData,
              employer_business_name: employerData?.business_name || null
            }
          };
        }
      } else if (userType === 'employer' && payload.new.jobseeker_id) {
        // Fetch jobseeker and job details for employers
        const [jobseekerData, jobData] = await Promise.all([
          supabase.from('jobseeker_profiles').select('*').eq('id', payload.new.jobseeker_id).single(),
          supabase.from('jobs').select('*').eq('id', payload.new.job_id).single()
        ]);
        if (jobseekerData.data) {
          enrichedData = { ...enrichedData, jobseeker_profiles: jobseekerData.data };
        }
        if (jobData.data) {
          enrichedData = { ...enrichedData, jobs: jobData.data };
        }
      }
      
      return enrichedData;
    };
    
    fetchRelatedData().then(enrichedData => {
      const dataWithSource = { ...enrichedData, __source: baseSource };
      const newNotification = {
        id: notificationId,
        originalId: payload.new.id,
        type: getNotificationType(dataWithSource, userType),
        message: getNotificationMessage(dataWithSource, userType),
        timestamp: timestamp,
        read: isRead,
        data: dataWithSource,
        source: baseSource
      };

      setNotifications(prev => {
        // Remove duplicate if exists and add new one at the top
        const filtered = prev.filter(n => n.id !== notificationId);
        const updated = [newNotification, ...filtered].slice(0, 100); // Keep last 100
        
        // Save to history
        saveNotificationHistory(updated);
        
        return updated;
      });
      
      if (!isRead) {
        setUnreadCount(prev => prev + 1);
      }
      
      // Show browser notification if permission granted and not read
      if (hasNotificationAPI && globalThis.Notification.permission === 'granted' && !isRead) {
        const BrowserNotification = globalThis.Notification;
        const notificationInstance = new BrowserNotification('PESDO Notification', {
          body: newNotification.message,
          icon: '/favicon.ico'
        });
        if (typeof notificationInstance.close === 'function') {
          setTimeout(() => notificationInstance.close(), 5000);
        }
      }
    });
  };

  // Mark notification as read
  const markAsRead = (notificationId) => {
    // Add to read notifications in localStorage
    const readNotifications = getReadNotifications();
    readNotifications.add(notificationId);
    saveReadNotifications(readNotifications);

    setNotifications(prev => {
      const updated = prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      // Save updated history
      saveNotificationHistory(updated);
      return updated;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Mark all as read
  const markAllAsRead = () => {
    // Add all notification IDs to read notifications in localStorage
    const readNotifications = getReadNotifications();
    for (const notif of notifications) {
      if (!notif.read) {
        readNotifications.add(notif.id);
      }
    }
    saveReadNotifications(readNotifications);

    setNotifications(prev => {
      const updated = prev.map(notif => ({ ...notif, read: true }));
      // Save updated history
      saveNotificationHistory(updated);
      return updated;
    });
    setUnreadCount(0);
  };

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if (hasNotificationAPI && globalThis.Notification.permission === 'default') {
      try {
        await globalThis.Notification.requestPermission();
      } catch (error) {
        console.warn('Notification permission request failed:', error);
      }
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refreshNotifications: fetchNotifications,
    requestNotificationPermission
  };
};

// Helper functions
const getNotificationType = (item, userType) => {
  if (item.__source === 'notification') {
    const notifType = item.type || '';
    if (notifType.includes('approved') || notifType.includes('verified') || notifType.includes('success')) return 'success';
    if (notifType.includes('rejected') || notifType.includes('denied') || notifType.includes('error')) return 'error';
    return 'info';
  }

  if (userType === 'jobseeker') {
    if (item.status === 'accepted') return 'success';
    if (item.status === 'rejected') return 'error';
    if (item.status === 'referred') return 'info';
    return 'info';
  } else if (userType === 'employer') {
    return 'info';
  } else if (userType === 'admin') {
    if (item.status === 'approved') return 'success';
    if (item.status === 'rejected') return 'error';
    return 'info';
  }
  return 'info';
};

const getNotificationMessage = (item, userType) => {
  if (item.__source === 'notification') {
    if (item.message) return item.message;
    if (item.title) return item.title;
    return '📢 You have a new notification.';
  }

  if (userType === 'jobseeker') {
    const jobTitle = item.jobs?.position_title || item.jobs?.title || 'a job';
    const companyName =
      item.jobs?.employer_business_name ||
      item.jobs?.business_name ||
      item.jobs?.employer_profiles?.business_name ||
      '';
    if (item.status === 'accepted') {
      return companyName
        ? `🎉 You were accepted by ${companyName} for the "${jobTitle}" position!`
        : `🎉 Your application for "${jobTitle}" has been accepted!`;
    } else if (item.status === 'rejected') {
      return `❌ Your application for "${jobTitle}" was not selected.`;
    } else if (item.status === 'referred') {
      return companyName
        ? `📬 PESDO admin referred you to ${companyName} for the "${jobTitle}" position.`
        : `📬 PESDO admin referred you to "${jobTitle}".`;
    }
    return `📝 Application status updated for "${jobTitle}".`;
  } else if (userType === 'employer') {
    const jobTitle = item.jobs?.position_title || item.jobs?.title || 'your job';
    const applicantName = (() => {
      if (!item.jobseeker_profiles) return 'A jobseeker';
      const profile = item.jobseeker_profiles;
      const parts = [];
      if (profile.first_name) parts.push(profile.first_name);
      if (profile.last_name) parts.push(profile.last_name);
      let name = parts.join(' ');
      const suffixValue = profile.suffix ? profile.suffix.trim() : '';
      if (suffixValue) {
        name = name ? `${name}, ${suffixValue}` : suffixValue;
      }
      return name || profile.email || 'A jobseeker';
    })();
    const status = (item.status || '').toLowerCase();
    if (status === 'referred') {
      return `👤 Admin referred ${applicantName} to "${jobTitle}".`;
    }
    return `📝 ${applicantName} applied to "${jobTitle}".`;
  } else if (userType === 'admin') {
    // Admin notifications are only for pending jobs
    const jobTitle = item.position_title || 'a job vacancy';
    return `📋 New job vacancy "${jobTitle}" pending approval.`;
  }
  return 'New notification';
};

