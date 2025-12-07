import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NotificationButton from '../../components/NotificationButton';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { useRealtimeData } from '../../hooks/useRealtimeData';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { supabase } from '../../supabase.js';
import { logActivity } from '../../utils/activityLogger';
import { sendApplicationStatusSMS } from '../../services/smsService';
import { sendApplicationStatusEmail, sendNewJobSubmissionEmail } from '../../services/emailService';
import './EmployerDashboard.css';

const NAV_ITEMS = [
  { key: 'profile', label: 'Company Profile', icon: '🏢' },
  { key: 'documents', label: 'Upload Documentary Requirements', icon: '📄' },
  { key: 'submit', label: 'Submit a Job Vacancy', icon: '📝' },
  { key: 'manage', label: 'Manage Job Vacancy', icon: '📋' }
];

const DOCUMENT_CONFIG = {
  bir: {
    label: 'BIR 2303 / Certificate of Registration',
    column: 'bir_document_url',
    folder: 'employers/bir',
    accept: '.pdf,.jpg,.jpeg,.png',
    helper: 'Upload your BIR registration certificate (PDF or image).'
  },
  permit: {
    label: 'Business Permit / Mayor’s Permit',
    column: 'business_permit_url',
    folder: 'employers/business-permit',
    accept: '.pdf,.jpg,.jpeg,.png',
    helper: 'Upload your business permit (PDF or image).'
  },
  logo: {
    label: 'Company Logo',
    column: 'company_logo_url',
    folder: 'employers/company-logo',
    accept: '.jpg,.jpeg,.png,.webp',
    helper: 'Upload your company logo (PNG/JPG/WebP).'
  }
};

const formatStatusLabel = (value = '', options = {}) => {
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) return '';
  if (options.treatApprovedAsVerified && normalized === 'approved') return 'Verified';
  
  // Special handling for withdrawn status
  if (normalized === 'withdrawn') return 'Withdrawn';

  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatDateLabel = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatJobseekerName = (profile, fallbackEmail) => {
  if (!profile) return fallbackEmail || 'Jobseeker';
  const parts = [profile.first_name, profile.last_name].filter(Boolean);
  let name = parts.join(' ');
  if (profile.suffix) {
    name = `${name} ${profile.suffix}`.trim();
  }
  return name || profile.email || fallbackEmail || 'Jobseeker';
};

const getApplicationStatusClass = (status) => {
  const normalized = (status || '').toString().trim().toLowerCase();
  if (!normalized) return 'unknown';
  return normalized.replaceAll(/\s+/g, '-');
};

// Format phone number for display (remove +63 prefix, show only 9XXXXXXXXX)
const formatPhoneForDisplay = (phone) => {
  if (!phone) return '';
  // Remove +63 prefix if present
  let cleaned = String(phone).replace(/[\s-]/g, '');
  if (cleaned.startsWith('+63')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('63')) {
    cleaned = cleaned.substring(2);
  }
  // Remove leading 0 if present (shouldn't happen but just in case)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
};

// Format phone number for storage (ensure +639XXXXXXXXX format)
const formatPhoneForStorage = (phone) => {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[\s-]/g, '');
  
  // Remove +63 prefix if present to normalize
  if (cleaned.startsWith('+63')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('63')) {
    cleaned = cleaned.substring(2);
  }
  
  // Remove leading 0 if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Ensure it starts with 9 and has 10 digits
  if (cleaned.startsWith('9') && cleaned.length === 10) {
    return `+63${cleaned}`;
  }
  
  // If already in +63 format, return as is
  if (cleaned.startsWith('+63')) {
    return cleaned;
  }
  
  // If it's a valid 10-digit number starting with 9, add +63
  if (/^9\d{9}$/.test(cleaned)) {
    return `+63${cleaned}`;
  }
  
  // Return null if invalid
  return null;
};

const defaultDocumentState = {
  bir: { uploading: false, success: '', error: '' },
  permit: { uploading: false, success: '', error: '' },
  logo: { uploading: false, success: '', error: '' }
};

const defaultJobForm = {
  position_title: '',
  job_description: '',
  nature_of_work: '',
  place_of_work: '',
  salary: '',
  vacancy_count: '',
  work_experience_months: '',
  educational_level: '',
  course_shs_strand: '',
  license: '',
  eligibility: '',
  certification: '',
  language_dialect: '',
  other_qualifications: '',
  accepts_pwd: 'No',
  pwd_types: {
    visual: false,
    hearing: false,
    speech: false,
    physical: false,
    mental: false,
  },
  pwd_types_others: '',
  accepts_ofw: 'No',
  valid_from: '',
  valid_until: ''
};

const EmployerDashboard = () => {
  const { currentUser, logout } = useAuth();
  const employerId = currentUser?.id;
  
  const [activeTab, setActiveTab] = useState('profile');
  const [jobStatusTab, setJobStatusTab] = useState('pending'); // 'pending', 'approved', 'rejected', 'completed'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Disable body scrolling on desktop, enable on mobile
  useEffect(() => {
    const handleResize = () => {
      const isMobileNow = window.innerWidth <= 768;
      if (!isMobileNow) {
        document.body.style.overflowY = 'hidden';
        document.body.style.height = '100vh';
      } else {
        document.body.style.overflowY = 'auto';
        document.body.style.height = '';
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.body.style.overflowY = '';
      document.body.style.height = '';
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Close mobile menu when clicking overlay or pressing Escape
  useEffect(() => {
    const handleOverlayClick = (e) => {
      if (e.target && e.target.classList.contains('js-sidebar-overlay')) {
        setMobileMenuOpen(false);
      }
    };
    
    const handleEscape = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    
    // Use capture phase to ensure overlay click is handled
    document.addEventListener('click', handleOverlayClick, true);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('click', handleOverlayClick, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  // Ensure sidebar is closed on mobile by default
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        setMobileMenuOpen(false);
      }
    };
    
    // Check on mount
    checkMobile();
    
    // Check on resize
    const handleResize = () => {
      checkMobile();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const {
    notifications: employerNotifications,
    unreadCount: employerUnreadCount,
    markAsRead: markEmployerNotificationAsRead,
    markAllAsRead: markAllEmployerNotificationsAsRead,
    requestNotificationPermission: requestEmployerNotificationPermission
  } = useRealtimeNotifications(employerId, 'employer');

  useEffect(() => {
    requestEmployerNotificationPermission();
  }, []);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    business_name: '',
    acronym: '',
    establishment_type: '',
    tin: '',
    employer_type: '',
    total_workforce: '',
    line_of_business: '',
    full_address: '',
    owner_president_name: '',
    contact_person_name: '',
    contact_position: '',
    telephone_number: '',
    mobile_number: '',
    fax_number: '',
    contact_email: ''
  });
  const [profileMessage, setProfileMessage] = useState({ type: null, text: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('pending');

  // Only approved employers can post jobs (not suspended, rejected, or pending)
  const isVerified = verificationStatus === 'approved';

  const [documentState, setDocumentState] = useState(defaultDocumentState);
  const [documentSelection, setDocumentSelection] = useState({
    bir: null,
    permit: null,
    logo: null
  });

  const [jobForm, setJobForm] = useState(defaultJobForm);
  const [jobMessage, setJobMessage] = useState({ type: null, text: '' });
  const [jobSaving, setJobSaving] = useState(false);

  const [pendingJobs, setPendingJobs] = useState([]);
  const [approvedJobs, setApprovedJobs] = useState([]);
  const [rejectedJobs, setRejectedJobs] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobApplications, setJobApplications] = useState({});
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedJobStatus, setSelectedJobStatus] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [isProcessingApplication, setIsProcessingApplication] = useState(false);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [selectedApplicationProfile, setSelectedApplicationProfile] = useState(null);
  const [loadingApplicationProfile, setLoadingApplicationProfile] = useState(false);

  const filterJobsByQuery = useCallback(
    (jobs) => {
      if (!jobSearchQuery.trim()) {
        return jobs;
      }
      const query = jobSearchQuery.toLowerCase().trim();
      return jobs.filter((job) => {
        const fields = [
          job.title,
          job.position_title,
          job.location,
          job.place_of_work,
          job.work_location,
          job.job_description,
          job.description,
          job.nature_of_work,
          job.employment_type,
          job.job_type,
          job.salary_range,
          job.salary,
          job.company_name
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        return fields.some((field) => field.includes(query));
      });
    },
    [jobSearchQuery]
  );

  const filteredPendingJobs = useMemo(
    () => filterJobsByQuery(pendingJobs),
    [filterJobsByQuery, pendingJobs]
  );

  const filteredApprovedJobs = useMemo(
    () => filterJobsByQuery(approvedJobs),
    [filterJobsByQuery, approvedJobs]
  );

  const filteredRejectedJobs = useMemo(
    () => filterJobsByQuery(rejectedJobs),
    [filterJobsByQuery, rejectedJobs]
  );

  const filteredCompletedJobs = useMemo(
    () => filterJobsByQuery(completedJobs),
    [filterJobsByQuery, completedJobs]
  );

  const extractStoragePathFromUrl = (publicUrl) => {
    if (!publicUrl) return null;
    try {
      const url = new URL(publicUrl);
      const marker = '/object/public/files/';
      const index = url.pathname.indexOf(marker);
      if (index === -1) return null;
      return decodeURIComponent(url.pathname.slice(index + marker.length));
    } catch (error) {
      console.warn('Unable to parse storage URL:', publicUrl, error);
      return null;
    }
  };

  const deleteStorageFile = async (publicUrl) => {
    const storagePath = extractStoragePathFromUrl(publicUrl);
    if (!storagePath) return;
    const { error } = await supabase.storage.from('files').remove([storagePath]);
    if (error) {
      console.warn('Failed to remove storage object:', storagePath, error);
    }
  };

  useEffect(() => {
    if (!employerId) return;
    fetchProfile();
    fetchJobs();
  }, [employerId]);

  // Set up real-time data synchronization
  useRealtimeData(
    employerId,
    'employer',
    {
      onJobsUpdate: (payload) => {
        console.log('🔄 Real-time job update received, refreshing jobs...');
        // Refresh jobs when any job is updated
        fetchJobs();
      },
      onJobStatusChange: (job, oldStatus, newStatus) => {
        console.log(`📊 Job status changed: ${oldStatus} → ${newStatus}`, job);
        // Refresh jobs when status changes
        fetchJobs();
      },
      onNewJob: (job) => {
        console.log('🆕 New job created, refreshing jobs...', job);
        // Refresh jobs when a new job is created
        fetchJobs();
      },
      onApplicationsUpdate: async (payload) => {
        // Check if this application is for one of the employer's jobs
        const jobId = payload.new?.job_id;
        if (jobId) {
          // Verify this job belongs to the employer
          const { data: job } = await supabase
            .from('jobs')
            .select('employer_id')
            .eq('id', jobId)
            .single();
          
          if (job && job.employer_id === employerId) {
            console.log('🔄 Real-time application update received, refreshing jobs...');
            fetchJobs();
          }
        }
      },
      onApplicationStatusChange: async (application, oldStatus, newStatus) => {
        // Check if this application is for one of the employer's jobs
        const jobId = application?.job_id;
        if (jobId) {
          const { data: job } = await supabase
            .from('jobs')
            .select('employer_id')
            .eq('id', jobId)
            .single();
          
          if (job && job.employer_id === employerId) {
            console.log(`📊 Application status changed: ${oldStatus} → ${newStatus}`, application);
            fetchJobs();
          }
        }
      },
      onNewApplication: async (application) => {
        // Check if this application is for one of the employer's jobs
        const jobId = application?.job_id;
        if (jobId) {
          const { data: job } = await supabase
            .from('jobs')
            .select('employer_id')
            .eq('id', jobId)
            .single();
          
          if (job && job.employer_id === employerId) {
            console.log('🆕 New application received, refreshing jobs...', application);
            fetchJobs();
          }
        }
      }
    }
  );

  useEffect(() => {
    if (!jobDetailsOpen) return undefined;

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        handleCloseJobDetails();
      }
    };

    globalThis.addEventListener('keydown', handleEscKey);

    return () => {
      globalThis.removeEventListener('keydown', handleEscKey);
    };
  }, [jobDetailsOpen]);

  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      setProfileError('');

      const { data, error } = await supabase
        .from('employer_profiles')
        .select('*, suspension_duration_days, suspension_started_at, suspension_notes')
        .eq('id', employerId)
        .maybeSingle();

      if (error) throw error;

      setProfile(data);
      setProfileForm({
        business_name: data?.business_name || '',
        acronym: data?.acronym || '',
        establishment_type: data?.establishment_type || '',
        tin: data?.tin || '',
        employer_type: data?.employer_type || '',
        total_workforce: data?.total_workforce || '',
        line_of_business: data?.line_of_business || '',
        full_address: data?.full_address || '',
        owner_president_name: data?.owner_president_name || '',
        contact_person_name: data?.contact_person_name || '',
        contact_position: data?.contact_position || '',
        telephone_number: data?.telephone_number || '',
        mobile_number: formatPhoneForDisplay(data?.mobile_number || ''),
        fax_number: data?.fax_number || '',
        contact_email: data?.contact_email || ''
      });
      setVerificationStatus(data?.verification_status || 'unverified');
      // Store suspension info for display
      if (data?.verification_status === 'suspended') {
        // Suspension info is already in profile state
      }
    } catch (error) {
      console.error('Error fetching employer profile:', error);
      setProfileError(error.message || 'Failed to load profile.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchJobs = async () => {
    if (!employerId) return;
    try {
      setJobsLoading(true);
      setJobsError('');

      const [pendingResult, approvedResult] = await Promise.all([
        supabase
          .from('jobvacancypending')
          .select('*')
          .eq('employer_id', employerId)
          // Don't filter by status - we want all statuses (pending, rejected, etc.)
          .order('created_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('*')
          .eq('employer_id', employerId)
          // Don't filter by status - we want all statuses
          .order('created_at', { ascending: false })
      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (approvedResult.error) throw approvedResult.error;

      const pendingRows = pendingResult.data || [];
      const approvedRows = approvedResult.data || [];

      const pending = [];
      const rejectedFromPending = [];

      for (const job of pendingRows) {
        const status = (job.status || 'pending').toString().trim().toLowerCase();
        if (status === 'pending') {
          pending.push(job);
        } else if (status === 'rejected') {
          rejectedFromPending.push(job);
        } else {
          // Log any unexpected statuses for debugging
          console.log('⚠️ Job with unexpected status:', { id: job.id, status: job.status, title: job.position_title });
        }
      }

      // Debug logging to help troubleshoot rejected jobs
      console.log('📊 Job Status Summary:', {
        totalPendingRows: pendingRows.length,
        pending: pending.length,
        rejectedFromPending: rejectedFromPending.length,
        rejectedJobs: rejectedFromPending.map(j => ({ id: j.id, status: j.status, title: j.position_title }))
      });

      const approved = approvedRows.filter((job) => {
        const status = (job.status || '').toString().trim().toLowerCase();
        return status === 'approved' || status === 'active';
      });

      const rejectedFromActive = approvedRows.filter((job) => {
        const status = (job.status || '').toString().trim().toLowerCase();
        return status === 'rejected';
      });

      const rejected = [...rejectedFromPending, ...rejectedFromActive].sort((a, b) => {
        const dateA = new Date(a.reviewed_at || a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.reviewed_at || b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });

      // Final debug log
      console.log('📋 Final Job Counts:', {
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        rejectedFromPending: rejectedFromPending.length,
        rejectedFromActive: rejectedFromActive.length
      });

      const jobIds = Array.from(
        new Set(
          [...pending, ...approved, ...rejected]
            .map((job) => job.id)
            .filter(Boolean)
        )
      );

      let applicationsByJob = {};
      if (jobIds.length) {
        const { data: applicationRows, error: applicationsError } = await supabase
          .from('applications')
          .select(
            `
              id,
              status,
              job_id,
              jobseeker_id,
              applied_at,
              created_at,
              updated_at,
              jobseeker_profiles (
                first_name,
                last_name,
                suffix,
                email,
                age,
                resume_url,
                nc1_certificate_url,
                nc1_certificate_uploaded_at,
                nc2_certificate_url,
                nc2_certificate_uploaded_at,
                nc3_certificate_url,
                nc3_certificate_uploaded_at,
                nc4_certificate_url,
                nc4_certificate_uploaded_at,
                other_certificates
              )
            `
          )
          .in('job_id', jobIds)
          .order('created_at', { ascending: false });

        if (applicationsError) {
          console.warn('Unable to load job applications for employer dashboard:', applicationsError.message);
        } else if (Array.isArray(applicationRows)) {
          applicationsByJob = applicationRows.reduce((acc, application) => {
            if (!application.job_id) return acc;
            if (!acc[application.job_id]) acc[application.job_id] = [];
            acc[application.job_id].push(application);
            return acc;
          }, {});
        }
      }

      // Calculate completed jobs (all vacancies filled)
      const completed = [];
      const stillOpen = [];
      
      for (const job of approved) {
        const jobId = job.id;
        const jobApplicationsList = applicationsByJob[jobId] || [];
        
        // Count accepted/hired applications
        const acceptedCount = jobApplicationsList.filter((app) => {
          const status = (app.status || '').toLowerCase();
          return status === 'accepted' || status === 'hired';
        }).length;
        
        // Get vacancy count
        const vacancyCount = job.vacancy_count || job.total_positions || job.vacancies || 0;
        
        // Job is completed if all vacancies are filled
        if (vacancyCount > 0 && acceptedCount >= vacancyCount) {
          completed.push(job);
        } else {
          stillOpen.push(job);
        }
      }
      
      setPendingJobs(pending);
      setApprovedJobs(stillOpen); // Only show non-completed approved jobs in approved tab
      setCompletedJobs(completed);
      setRejectedJobs(rejected);
      setJobApplications((prev) => {
        const next = {};

        // Get list of canceled referrals from localStorage
        let canceledReferralIds = [];
        try {
          canceledReferralIds = JSON.parse(localStorage.getItem('canceled_referrals') || '[]');
        } catch (e) {
          console.warn('Failed to read canceled referrals from localStorage:', e);
        }

        for (const jobId of Object.keys(applicationsByJob)) {
          next[jobId] = applicationsByJob[jobId].map((application) => {
            const statusNormalized = (application.status || '').toLowerCase();
            const previous = prev[jobId]?.find((item) => item.id === application.id);
            
            // was_referred should only be true if current status is 'referred'
            const wasReferred = statusNormalized === 'referred';
            
            // Track if application was ever referred (even if now canceled)
            // Check: 1) previous state, 2) current status, 3) localStorage (canceled referrals)
            const wasEverReferred = 
              previous?.was_ever_referred || 
              statusNormalized === 'referred' ||
              canceledReferralIds.includes(application.id);

            return {
              ...application,
              status: statusNormalized,
              was_referred: wasReferred,
              was_ever_referred: wasEverReferred
            };
          });
        }

        return next;
      });
    } catch (error) {
      console.error('Error fetching jobs for employer:', error);
      setJobsError(error.message || 'Failed to load job vacancies.');
      setJobApplications({});
    } finally {
      setJobsLoading(false);
    }
  };

  // Handle notification click - navigate to relevant section
  const handleNotificationClick = useCallback((notification) => {
    const notificationData = notification?.data;
    if (!notificationData) return;

    // Switch to manage tab to see jobs/applications
    setActiveTab('manage');

    // Check if this is a job status notification or application notification
    if (notificationData.job_id) {
      // Find the job in the jobs list (include completed jobs)
      const allJobs = [...pendingJobs, ...approvedJobs, ...rejectedJobs, ...completedJobs];
      const job = allJobs.find(j => j.id === notificationData.job_id);
      
      if (job) {
        // Determine job status - check if it's in completed jobs first
        let statusClass = 'pending';
        let targetTab = 'pending';
        
        if (completedJobs.some(j => j.id === job.id)) {
          statusClass = 'completed';
          targetTab = 'completed';
        } else {
          const status = (job.status || '').toLowerCase();
          if (status === 'approved' || status === 'active') {
            statusClass = 'approved';
            targetTab = 'approved';
          } else if (status === 'rejected') {
            statusClass = 'rejected';
            targetTab = 'rejected';
          }
        }
        
        // Set the appropriate tab and open job details
        setJobStatusTab(targetTab);
        
        // Open job details
        setSelectedJob(job);
        setSelectedJobStatus(statusClass);
        setSelectedApplication(null);
        setSelectedApplicationProfile(null);
        setLoadingApplicationProfile(false);
        setIsApplicationModalOpen(false);
        setJobDetailsOpen(true);
        
        // Refresh applications when opening job details
        if (job?.id) {
          fetchJobs();
        }
      } else {
        // If job not found, refresh and try again
        fetchJobs().then(() => {
          setTimeout(() => {
            const updatedAllJobs = [...pendingJobs, ...approvedJobs, ...rejectedJobs, ...completedJobs];
            const updatedJob = updatedAllJobs.find(j => j.id === notificationData.job_id);
            if (updatedJob) {
              let statusClass = 'pending';
              let targetTab = 'pending';
              
              if (completedJobs.some(j => j.id === updatedJob.id)) {
                statusClass = 'completed';
                targetTab = 'completed';
              } else {
                const status = (updatedJob.status || '').toLowerCase();
                if (status === 'approved' || status === 'active') {
                  statusClass = 'approved';
                  targetTab = 'approved';
                } else if (status === 'rejected') {
                  statusClass = 'rejected';
                  targetTab = 'rejected';
                }
              }
              setJobStatusTab(targetTab);
              
              // Open job details
              setSelectedJob(updatedJob);
              setSelectedJobStatus(statusClass);
              setSelectedApplication(null);
              setSelectedApplicationProfile(null);
              setLoadingApplicationProfile(false);
              setIsApplicationModalOpen(false);
              setJobDetailsOpen(true);
              
              if (updatedJob?.id) {
                fetchJobs();
              }
            }
          }, 500);
        });
      }
    } else if (notificationData.id && notification.source === 'notification') {
      // This is a direct notification (e.g., verification status)
      // Just switch to manage tab - the user can see their jobs
      setJobStatusTab('pending');
    }
  }, [pendingJobs, approvedJobs, rejectedJobs, completedJobs, fetchJobs]);

  const profileDisplayName = useMemo(() => profile?.business_name || 'Company Profile', [profile]);

  const setDocumentFeedback = (type, updates) => {
    setDocumentState((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...updates }
    }));
  };

  const handleProfileInputChange = (field, value) => {
    // Special handling for mobile_number - only allow digits, max 10 digits starting with 9
    if (field === 'mobile_number') {
      // Remove all non-digit characters
      let cleaned = value.replace(/\D/g, '');
      // Only allow if it starts with 9 and has max 10 digits
      if (cleaned === '' || (cleaned.startsWith('9') && cleaned.length <= 10)) {
        setProfileForm((prev) => ({
          ...prev,
          [field]: cleaned
        }));
      }
    } else {
      setProfileForm((prev) => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!employerId) return;

    setProfileSaving(true);
    setProfileMessage({ type: null, text: '' });

    try {
      // Format mobile_number for storage (+639XXXXXXXXX)
      const mobileNumberValue = formatPhoneForStorage(profileForm.mobile_number);
      
      const payload = {
        ...profileForm,
        mobile_number: mobileNumberValue,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('employer_profiles')
        .update(payload)
        .eq('id', employerId);

      if (error) throw error;

      setProfile((prev) => ({ ...prev, ...payload }));
      setProfileMessage({ type: 'success', text: 'Profile updated successfully.' });
      setIsEditingProfile(false);

      // Log activity with employer name
      if (currentUser?.id && profile) {
        const employerName = profile.business_name || profile.contact_person_name || profile.email || 'Unknown';
        await logActivity({
          userId: currentUser.id,
          userType: 'employer',
          actionType: 'profile_updated',
          actionDescription: `${employerName} updated profile information`,
          entityType: 'profile',
          entityId: employerId,
          metadata: {
            updatedFields: Object.keys(payload),
            businessName: payload.business_name || profile?.business_name
          }
        });
      }
    } catch (error) {
      console.error('Failed to update employer profile:', error);
      setProfileMessage({
        type: 'error',
        text: error.message || 'Unable to save changes right now. Please try again.'
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRemoveDocument = async (type) => {
    if (!employerId) return;
    const config = DOCUMENT_CONFIG[type];
    if (!config) return;

    setDocumentFeedback(type, { uploading: true, success: '', error: '' });

    try {
      const currentUrl = profile?.[config.column];
      if (currentUrl) {
        await deleteStorageFile(currentUrl);
      }

      // Prepare update data
      const updateData = {
        [config.column]: null,
        updated_at: new Date().toISOString()
      };

      // Check if removing a required document (BIR or permit)
      // If removing and status is 'pending', revert to 'unverified'
      // Only revert if status is 'pending' (don't override admin decisions like 'approved' or 'rejected')
      const currentStatus = profile?.verification_status || 'unverified';
      if ((type === 'bir' || type === 'permit') && currentStatus === 'pending') {
        // Check if the other required document is still present
        const hasBir = type === 'bir' ? null : (profile?.bir_document_url || null);
        const hasPermit = type === 'permit' ? null : (profile?.business_permit_url || null);
        
        // If both documents won't be present after removal, revert to 'unverified'
        if (!hasBir || !hasPermit) {
          updateData.verification_status = 'unverified';
        }
      }

      const { error } = await supabase
        .from('employer_profiles')
        .update(updateData)
        .eq('id', employerId);

      if (error) throw error;

      setProfile((prev) => ({
        ...prev,
        [config.column]: null,
        ...(updateData.verification_status ? { verification_status: updateData.verification_status } : {})
      }));

      setDocumentSelection((prev) => ({ ...prev, [type]: null }));

      setDocumentFeedback(type, {
        uploading: false,
        success: `${config.label} removed successfully.`,
        error: ''
      });
    } catch (error) {
      console.error(`Failed to remove ${type} document:`, error);
      setDocumentFeedback(type, {
        uploading: false,
        success: '',
        error: error.message || 'Unable to remove file. Please try again.'
      });
    }
  };

  const handleDocumentSelect = (type, e) => {
    const file = e.target.files?.[0] || null;
    setDocumentSelection((prev) => ({ ...prev, [type]: file }));
    setDocumentFeedback(type, { uploading: false, success: '', error: '' });

    if (type === 'logo' && file) {
      handleDocumentUpload(type, file);
    }
  };

  const handleDocumentUpload = async (type, fileOverride) => {
    const file = fileOverride || documentSelection[type];
    if (!file || !employerId) return;

    const config = DOCUMENT_CONFIG[type];
    if (!config) return;

    // Store original status before any changes - used for comparison and logging
    const originalStatus = profile?.verification_status || 'unverified';

    setDocumentFeedback(type, { uploading: true, success: '', error: '' });

    const extension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const filePath = `${config.folder}/${employerId}-${Date.now()}.${extension}`;

    try {
      const currentUrl = profile?.[config.column];
      if (currentUrl) {
        await deleteStorageFile(currentUrl);
      }

      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl }
      } = supabase.storage.from('files').getPublicUrl(filePath);

      // STEP 1: First, update the document URL in the database
      // This ensures the RPC function can see the new document when checking
      const { error: docUpdateError, data: docUpdateData } = await supabase
        .from('employer_profiles')
        .update({
          [config.column]: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', employerId)
        .select('bir_document_url, business_permit_url, verification_status')
        .single();
      
      // Verify the update was successful
      if (!docUpdateData) {
        throw new Error('Failed to update document URL - no data returned');
      }
      
      if (docUpdateError) throw docUpdateError;

      console.log('📄 Document URL saved to database:', {
        type,
        url: publicUrl,
        current_status: docUpdateData?.verification_status,
        has_bir: !!docUpdateData?.bir_document_url,
        has_permit: !!docUpdateData?.business_permit_url,
        bir_url: docUpdateData?.bir_document_url,
        permit_url: docUpdateData?.business_permit_url
      });

      // STEP 2: For BIR or Permit documents, always call RPC function to update status
      // The RPC function will check the database directly and handle status transitions correctly
      // This ensures rejected -> pending works correctly when both documents are present
      if (type === 'bir' || type === 'permit') {
        // Add a small delay to ensure database transaction is committed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Double-check database state before calling RPC
        const { data: preRpcCheck, error: preRpcError } = await supabase
          .from('employer_profiles')
          .select('bir_document_url, business_permit_url, verification_status')
          .eq('id', employerId)
          .single();
        
        if (preRpcError) {
          console.error('❌ Failed to verify document state before RPC:', preRpcError);
        } else {
          const hasBirPre = preRpcCheck?.bir_document_url && preRpcCheck.bir_document_url.trim() !== '';
          const hasPermitPre = preRpcCheck?.business_permit_url && preRpcCheck.business_permit_url.trim() !== '';
          console.log(`📄 Pre-RPC check (${type}):`, {
            status: preRpcCheck?.verification_status,
            has_bir: hasBirPre,
            has_permit: hasPermitPre,
            bir_url_length: preRpcCheck?.bir_document_url?.length || 0,
            permit_url_length: preRpcCheck?.business_permit_url?.length || 0
          });
        }
        
        console.log(`📄 Calling RPC to update status after ${type} upload...`);
        const { error: rpcError, data: rpcData } = await supabase.rpc('update_employer_verification_status', {
          p_employer_id: employerId
        });
        
        if (rpcError) {
          console.warn('⚠️ RPC status update failed, using fallback logic:', rpcError);
          
          // Fallback: Fetch current state from database to get accurate document status
          const { data: currentProfile, error: fetchCurrentError } = await supabase
            .from('employer_profiles')
            .select('bir_document_url, business_permit_url, verification_status')
            .eq('id', employerId)
            .single();
          
          if (fetchCurrentError) {
            console.error('❌ Failed to fetch current profile for fallback:', fetchCurrentError);
            throw fetchCurrentError;
          }
          
          if (currentProfile) {
            const hasBir = currentProfile.bir_document_url && currentProfile.bir_document_url.trim() !== '';
            const hasPermit = currentProfile.business_permit_url && currentProfile.business_permit_url.trim() !== '';
            const currentStatus = currentProfile.verification_status || 'unverified';
            
            console.log('🔍 Fallback check:', { hasBir, hasPermit, currentStatus });
            
            // Only update if status allows and both documents are present
            if ((currentStatus === 'unverified' || currentStatus === 'rejected') && hasBir && hasPermit) {
              console.log('✅ Updating status via fallback: rejected/unverified → pending');
              const { error: updateError } = await supabase
                .from('employer_profiles')
                .update({
                  verification_status: 'pending',
                  verification_notes: null, // Clear previous rejection notes
                  updated_at: new Date().toISOString()
                })
                .eq('id', employerId);
              if (updateError) {
                console.error('❌ Fallback status update failed:', updateError);
                throw updateError;
              }
            } else if (currentStatus === 'pending' && (!hasBir || !hasPermit)) {
              // If status is pending and a document is missing, revert to unverified
              console.log('⚠️ Reverting status via fallback: pending → unverified (missing documents)');
              const { error: updateError } = await supabase
                .from('employer_profiles')
                .update({
                  verification_status: 'unverified',
                  updated_at: new Date().toISOString()
                })
                .eq('id', employerId);
              if (updateError) {
                console.error('❌ Fallback status revert failed:', updateError);
                throw updateError;
              }
            }
          }
        } else {
          console.log('✅ RPC status update succeeded');
          
          // Wait a bit for RPC to complete, then check if status was actually updated
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Verify the RPC actually updated the status
          const { data: postRpcCheck, error: postRpcError } = await supabase
            .from('employer_profiles')
            .select('bir_document_url, business_permit_url, verification_status')
            .eq('id', employerId)
            .single();
          
          if (!postRpcError && postRpcCheck) {
            const hasBirPost = postRpcCheck.bir_document_url && postRpcCheck.bir_document_url.trim() !== '';
            const hasPermitPost = postRpcCheck.business_permit_url && postRpcCheck.business_permit_url.trim() !== '';
            
            // If RPC succeeded but status is still 'rejected' with both documents, force update
            if (postRpcCheck.verification_status === 'rejected' && hasBirPost && hasPermitPost) {
              console.log('⚠️ RPC succeeded but status still rejected - forcing direct update');
              const { error: forceUpdateError } = await supabase
                .from('employer_profiles')
                .update({
                  verification_status: 'pending',
                  verification_notes: null,
                  updated_at: new Date().toISOString()
                })
                .eq('id', employerId);
              
              if (forceUpdateError) {
                console.error('❌ Force update failed:', forceUpdateError);
              } else {
                console.log('✅ Force update succeeded - status changed to pending');
              }
            }
          }
        }
      }

      // STEP 3: Re-fetch profile to get updated status (RPC function may have changed it)
      const { data: updatedProfile, error: fetchError } = await supabase
        .from('employer_profiles')
        .select('verification_status, bir_document_url, business_permit_url, verification_notes')
        .eq('id', employerId)
        .single();
      
      if (fetchError) {
        console.error('❌ Failed to fetch updated profile:', fetchError);
      } else {
        console.log('📊 Profile after document upload:', {
          verification_status: updatedProfile?.verification_status,
          has_bir: !!updatedProfile?.bir_document_url,
          has_permit: !!updatedProfile?.business_permit_url,
          original_status: originalStatus,
          status_changed: originalStatus !== updatedProfile?.verification_status
        });
      }

      // Update profile state with new document URL and status
      const newStatusFromDB = updatedProfile?.verification_status || profile?.verification_status || originalStatus;
      console.log(`🔄 Updating profile state: ${profile?.verification_status || 'unknown'} → ${newStatusFromDB}`);
      
      setProfile((prev) => ({
        ...prev,
        [config.column]: publicUrl,
        verification_status: newStatusFromDB,
        bir_document_url: updatedProfile?.bir_document_url || prev?.bir_document_url,
        business_permit_url: updatedProfile?.business_permit_url || prev?.business_permit_url,
        verification_notes: updatedProfile?.verification_notes || prev?.verification_notes
      }));

      // Update verification status in state - this is what the UI badge reads from
      // Always update if we have a new status from the database
      if (newStatusFromDB && newStatusFromDB !== verificationStatus) {
        console.log(`🔄 Updating verificationStatus state: ${verificationStatus} → ${newStatusFromDB}`);
        setVerificationStatus(newStatusFromDB);
      } else if (newStatusFromDB) {
        console.log(`ℹ️ VerificationStatus state unchanged: ${verificationStatus} (database: ${newStatusFromDB})`);
      }

      // If status changed from rejected to pending, log it for debugging
      if (originalStatus === 'rejected' && newStatusFromDB === 'pending') {
        console.log('✅ Status successfully changed from rejected to pending!');
        // Force a full profile refresh to ensure UI updates
        setTimeout(() => {
          fetchProfile();
        }, 500);
      } else if (originalStatus === 'rejected' && newStatusFromDB !== 'pending') {
        console.warn(`⚠️ Status is still 'rejected' after uploading both documents. Expected 'pending'. Current status: ${newStatusFromDB}`);
        console.warn('⚠️ Debug info:', {
          updatedProfile_status: updatedProfile?.verification_status,
          profile_status: profile?.verification_status,
          originalStatus,
          has_bir: !!updatedProfile?.bir_document_url,
          has_permit: !!updatedProfile?.business_permit_url
        });
      }

      setDocumentSelection((prev) => ({ ...prev, [type]: null }));

      // Log activity with employer name
      if (currentUser?.id && profile) {
        const employerName = profile.business_name || profile.contact_person_name || profile.email || 'Unknown';
        
        // Use specific action types based on document type
        let actionType;
        if (type === 'logo') {
          actionType = 'company_logo_uploaded';
        } else if (type === 'bir') {
          actionType = 'bir_document_uploaded';
        } else if (type === 'permit') {
          actionType = 'business_permit_uploaded';
        } else {
          actionType = 'document_uploaded';
        }
        
        await logActivity({
          userId: currentUser.id,
          userType: 'employer',
          actionType: actionType,
          actionDescription: `${employerName} uploaded ${config.label}: ${file.name}`,
          entityType: 'profile',
          entityId: employerId,
          metadata: {
            documentType: type,
            documentLabel: config.label,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          }
        });
      }

      // Show appropriate success message based on status change
      const finalStatusForMessage = updatedProfile?.verification_status || originalStatus;
      let successMessage = `${config.label} uploaded successfully.`;
      
      if (finalStatusForMessage === 'pending' && originalStatus === 'rejected') {
        successMessage = `${config.label} uploaded successfully. Your documents have been resubmitted for review.`;
      } else if (finalStatusForMessage === 'pending' && originalStatus === 'unverified') {
        const otherDocType = type === 'bir' ? 'Business Permit' : 'BIR Document';
        const hasOtherDoc = type === 'bir' ? (updatedProfile?.business_permit_url || hasPermit) : (updatedProfile?.bir_document_url || hasBir);
        if (hasOtherDoc) {
          successMessage = `${config.label} uploaded successfully. Both documents are now complete. Your verification request has been submitted for review.`;
        } else {
          successMessage = `${config.label} uploaded successfully. Please upload your ${otherDocType} to complete your verification request.`;
        }
      }

      setDocumentFeedback(type, {
        uploading: false,
        success: successMessage,
        error: ''
      });
    } catch (error) {
      console.error(`Failed to upload ${type} document:`, error);
      setDocumentFeedback(type, {
        uploading: false,
        success: '',
        error: error.message || 'Upload failed. Please try again.'
      });
    }
  };

  const handleJobInputChange = (field, value) => {
    setJobForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePwdTypeChange = (type, checked) => {
    setJobForm((prev) => ({
      ...prev,
      pwd_types: {
        ...prev.pwd_types,
        [type]: checked
      }
    }));
  };

  const handlePwdOtherChange = (value) => {
    setJobForm((prev) => ({
      ...prev,
      pwd_types_others: value
    }));
  };

  const handleOpenJobDetails = async (job, status) => {
    setSelectedJob({ ...job });
    setSelectedJobStatus(status);
    setSelectedApplication(null);
    setSelectedApplicationProfile(null);
    setLoadingApplicationProfile(false);
    setIsApplicationModalOpen(false);
    setJobDetailsOpen(true);
    
    // Refresh applications when opening job details to get latest status
    // This ensures canceled referrals are properly filtered
    if (job?.id) {
      await fetchJobs();
    }
  };

  const handleCloseJobDetails = () => {
    setSelectedApplication(null);
    setSelectedApplicationProfile(null);
    setLoadingApplicationProfile(false);
    setIsApplicationModalOpen(false);
    setJobDetailsOpen(false);
    setSelectedJob(null);
    setSelectedJobStatus(null);
  };

  const handleSelectApplication = async (application) => {
    if (!application?.jobseeker_id) {
      setSelectedApplication(application);
      setSelectedApplicationProfile(null);
      setLoadingApplicationProfile(false);
      setIsApplicationModalOpen(true);
      return;
    }

    setSelectedApplication(application);
    setLoadingApplicationProfile(true);
    setSelectedApplicationProfile(null);
    setIsApplicationModalOpen(true);

    try {
      const { data, error } = await supabase
        .from('jobseeker_profiles')
        .select('*')
        .eq('id', application.jobseeker_id)
        .maybeSingle();

      if (error) throw error;
      setSelectedApplicationProfile(data || null);
    } catch (error) {
      console.error('Failed to load jobseeker profile:', error);
      setSelectedApplicationProfile(null);
    } finally {
      setLoadingApplicationProfile(false);
    }
  };

  const handleCloseApplicationModal = () => {
    setIsApplicationModalOpen(false);
    setSelectedApplication(null);
    setSelectedApplicationProfile(null);
    setLoadingApplicationProfile(false);
  };

  const mutateApplicationStatus = async (applicationId, nextStatus) => {
    const { error } = await supabase
      .from('applications')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId);

    if (error) throw error;
  };

  const handleApplicationDecision = async (application, decision) => {
    if (!application?.id) return;

    setIsProcessingApplication(true);

    try {
      let nextStatus = 'referred';
      if (decision === 'accept') {
        nextStatus = 'accepted';
      } else if (decision === 'reject') {
        nextStatus = 'rejected';
      }

      await mutateApplicationStatus(application.id, nextStatus);

      // Send SMS notification to jobseeker (non-blocking)
      try {
        // Fetch jobseeker profile to get phone number
        const { data: jobseekerProfile } = await supabase
          .from('jobseeker_profiles')
          .select('phone, first_name, last_name')
          .eq('id', application.jobseeker_id)
          .single();

        // Fetch job details
        const { data: jobData } = await supabase
          .from('jobs')
          .select('position_title, employer_id')
          .eq('id', application.job_id)
          .single();

        // Fetch employer profile for company name
        const { data: employerProfile } = await supabase
          .from('employer_profiles')
          .select('business_name')
          .eq('id', jobData?.employer_id || profile?.id)
          .single();

        if (jobseekerProfile && jobData) {
          const jobseekerName = `${jobseekerProfile.first_name || ''} ${jobseekerProfile.last_name || ''}`.trim() || 'Jobseeker';
          const companyName = employerProfile?.business_name || profile?.business_name || 'Company';
          const jobTitle = jobData.position_title || 'Job Vacancy';

          // Send SMS if phone number is available
          if (jobseekerProfile.phone) {
            try {
              await sendApplicationStatusSMS(
                jobseekerProfile.phone,
                jobseekerName,
                jobTitle,
                nextStatus,
                companyName
              );
              console.log('✅ SMS notification sent to jobseeker');
            } catch (smsError) {
              console.error('⚠️ Failed to send SMS notification (non-critical):', smsError);
            }
          }

          // Send Email if email is available
          if (jobseekerProfile.email) {
            try {
              await sendApplicationStatusEmail(
                jobseekerProfile.email,
                jobseekerName,
                jobTitle,
                nextStatus,
                companyName
              );
              console.log('✅ Email notification sent to jobseeker');
            } catch (emailError) {
              console.error('⚠️ Failed to send email notification (non-critical):', emailError);
            }
          }
        }
      } catch (notificationError) {
        // Notification failures should not block the main action
        console.error('⚠️ Failed to send notifications (non-critical):', notificationError);
      }

      setJobApplications((prev) => {
        const updated = { ...prev };

        // Update the application status within each job entry
        for (const jobId of Object.keys(updated)) {
          updated[jobId] = updated[jobId].map((item) =>
            item.id === application.id
              ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
              : item
          );
        }

        return updated;
      });

      setSelectedApplication((prev) =>
        prev && prev.id === application.id
          ? {
              ...prev,
              status: nextStatus,
              updated_at: new Date().toISOString(),
              was_referred: nextStatus === 'referred'
            }
          : prev
      );
    } catch (error) {
      console.error('Failed to update application status:', error);
      alert(error.message || 'Unable to update application status right now.');
    } finally {
      setIsProcessingApplication(false);
    }
  };

  const handleSubmitJob = async (event) => {
    event.preventDefault();
    if (!employerId) return;

    setJobSaving(true);
    setJobMessage({ type: null, text: '' });

    // Validate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const validFrom = jobForm.valid_from || null;
    const validUntil = jobForm.valid_until || null;

    // Validate valid_from: cannot be in the past
    if (validFrom) {
      const validFromDate = new Date(validFrom);
      validFromDate.setHours(0, 0, 0, 0);
      
      if (validFromDate < today) {
        setJobMessage({
          type: 'error',
          text: 'Valid From date cannot be in the past. Please select today or a future date.'
        });
        setJobSaving(false);
        return;
      }
    }

    // Validate valid_until: must be after valid_from (if both are provided)
    if (validFrom && validUntil) {
      const validFromDate = new Date(validFrom);
      const validUntilDate = new Date(validUntil);
      validFromDate.setHours(0, 0, 0, 0);
      validUntilDate.setHours(0, 0, 0, 0);
      
      if (validUntilDate <= validFromDate) {
        setJobMessage({
          type: 'error',
          text: 'Valid Until date must be after Valid From date.'
        });
        setJobSaving(false);
        return;
      }
    }

    // If only valid_until is provided, it should be in the future
    if (validUntil && !validFrom) {
      const validUntilDate = new Date(validUntil);
      validUntilDate.setHours(0, 0, 0, 0);
      
      if (validUntilDate < today) {
        setJobMessage({
          type: 'error',
          text: 'Valid Until date cannot be in the past.'
        });
        setJobSaving(false);
        return;
      }
    }

    const pwdTypesArray =
      jobForm.accepts_pwd === 'Yes'
        ? [
            ...Object.entries(jobForm.pwd_types)
              .filter(([key, value]) => value && ['visual', 'hearing', 'speech', 'physical', 'mental'].includes(key))
              .map(([key]) => key),
            ...(jobForm.pwd_types_others ? [jobForm.pwd_types_others] : [])
          ]
        : [];

    const payload = {
      employer_id: employerId,
      position_title: jobForm.position_title,
      job_description: jobForm.job_description,
      nature_of_work: jobForm.nature_of_work,
      place_of_work: jobForm.place_of_work,
      salary_range: jobForm.salary,
      vacancy_count: jobForm.vacancy_count ? Number(jobForm.vacancy_count) : 1,
      work_experience_months: jobForm.work_experience_months
        ? Number(jobForm.work_experience_months)
        : null,
      other_qualifications: jobForm.other_qualifications || null,
      educational_level: jobForm.educational_level || null,
      course_shs_strand: jobForm.course_shs_strand || null,
      license: jobForm.license || null,
      eligibility: jobForm.eligibility || null,
      certification: jobForm.certification || null,
      language_dialect: jobForm.language_dialect || null,
      accepts_pwd: jobForm.accepts_pwd,
      pwd_types: pwdTypesArray,
      pwd_others_specify: jobForm.accepts_pwd === 'Yes' ? jobForm.pwd_types_others || null : null,
      accepts_ofw: jobForm.accepts_ofw,
      posting_date: new Date().toISOString().slice(0, 10), // Set to current date for submission (admin will set actual posting date on approval)
      valid_from: validFrom,
      valid_until: validUntil,
      status: 'pending'
    };

    try {
      const { error } = await supabase
        .from('jobvacancypending')
        .insert([payload]);

      if (error) throw error;

      // Notify admins via email (non-blocking)
      // Use RPC function to bypass RLS and get admin emails
      try {
        const { data: adminData, error: adminError } = await supabase
          .rpc('get_admin_emails_for_notifications');

        if (!adminError && adminData && adminData.length > 0) {
          const employerName = profile?.contact_person_name || 'Employer';
          const companyName = profile?.business_name || null;
          const jobTitle = jobForm.position_title;

          // Send email notifications to all admins in parallel (non-blocking)
          const emailPromises = adminData.map(async (admin) => {
            const adminName = admin.first_name && admin.last_name
              ? `${admin.first_name} ${admin.last_name}`
              : admin.first_name || admin.last_name || 'Admin';

            try {
              await sendNewJobSubmissionEmail(
                admin.email,
                adminName,
                jobTitle,
                employerName,
                companyName
              );
              console.log(`✅ Email notification sent to admin: ${admin.email}`);
            } catch (emailError) {
              console.error(`❌ Failed to send email to admin ${admin.email}:`, emailError);
              // Don't throw - continue with other admins
            }
          });

          // Execute all email sends in parallel (non-blocking)
          Promise.all(emailPromises).catch((err) => {
            console.error('Error sending admin notifications:', err);
            // Don't block the main flow
          });
        } else if (adminError) {
          console.error('Error fetching admin emails for notification:', adminError);
        }
      } catch (notificationError) {
        console.error('Error in admin notification process:', notificationError);
        // Don't block the main flow - job submission was successful
      }

      setJobMessage({ type: 'success', text: 'Job vacancy submitted for review.' });
      setJobForm(defaultJobForm);
      setDocumentSelection((prev) => ({ ...prev, bir: null, permit: null }));
      fetchJobs();
    } catch (error) {
      console.error('Failed to submit job vacancy:', error);
      setJobMessage({
        type: 'error',
        text: error.message || 'Unable to submit the job vacancy. Please try again.'
      });
    } finally {
      setJobSaving(false);
    }
  };

  const renderProfileSection = () => {
    if (loadingProfile) {
      return <div className="loading">Loading company profile…</div>;
    }

    if (profileError) {
      return (
        <div className="error-panel">
          <div>Failed to load your profile.</div>
          <div className="error-details">{profileError}</div>
        </div>
      );
    }

    const normalizedStatus = profile?.verification_status || verificationStatus || '';
    const statusLabel = formatStatusLabel(normalizedStatus, { treatApprovedAsVerified: true });

    return (
      <form className="profile-form employer-profile-form" onSubmit={handleSaveProfile}>
        <div className="profile-avatar-banner company-banner">
          <div className="profile-avatar-wrapper company-logo-wrapper">
            {profile?.company_logo_url ? (
              <img src={profile.company_logo_url} alt={`${profileDisplayName} logo`} />
            ) : (
              <span className="profile-avatar-initials">
                {profileDisplayName
                  .split(' ')
                  .map((part) => part[0] || '')
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'EM'}
              </span>
            )}
          </div>
          <div className="profile-avatar-text">
            <div className="company-display-name-row">
              <div className="company-display-name">{profileDisplayName}</div>
              {statusLabel ? (
                <span className={`status-badge ${normalizedStatus}`}>
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <div className="company-display-email">
              {profile?.email || currentUser?.email}
            </div>
            <div className="profile-avatar-actions">
              <label className="profile-avatar-upload">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => handleDocumentSelect('logo', e)}
                  disabled={documentState.logo.uploading}
                />
                {documentState.logo.uploading ? 'Uploading…' : 'Choose Logo'}
              </label>
            </div>
            {documentState.logo.error ? (
              <div className="profile-avatar-message error">{documentState.logo.error}</div>
            ) : null}
            {documentState.logo.success ? (
              <div className="profile-avatar-message success">{documentState.logo.success}</div>
            ) : null}
          </div>
        </div>

        <section>
          <h2>Company Profile</h2>
          <div className="form-grid">
            <label className="form-field full">
              <span>Business Name *</span>
              <input
                type="text"
                value={profileForm.business_name}
                onChange={(e) => handleProfileInputChange('business_name', e.target.value)}
                required
                disabled={true}
              />
            </label>
            <label className="form-field">
              <span>Acronym / Abbreviation</span>
              <input
                type="text"
                value={profileForm.acronym}
                onChange={(e) => handleProfileInputChange('acronym', e.target.value)}
                disabled={!isEditingProfile}
              />
            </label>
            <label className="form-field">
              <span>Establishment Type</span>
              <select
                value={profileForm.establishment_type}
                onChange={(e) =>
                  handleProfileInputChange('establishment_type', e.target.value)
                }
                disabled={!isEditingProfile}
              >
                <option value="">Select type</option>
                <option value="Main Office">Main Office</option>
                <option value="Branch">Branch</option>
              </select>
            </label>
            <label className="form-field">
              <span>Tax Identification Number</span>
              <input
                type="text"
                value={profileForm.tin}
                onChange={(e) => handleProfileInputChange('tin', e.target.value)}
                disabled={!isEditingProfile}
              />
            </label>
            <label className="form-field full">
              <span>Employer Type</span>
              <select
                value={profileForm.employer_type}
                onChange={(e) => handleProfileInputChange('employer_type', e.target.value)}
                disabled={!isEditingProfile}
              >
                <option value="">Select employer type</option>
                <optgroup label="Public">
                  <option value="Public - National Government Agency">
                    National Government Agency
                  </option>
                  <option value="Public - Local Government Unit">Local Government Unit</option>
                  <option value="Public - Government-owned or Controlled Corporation">
                    Government-owned and Controlled Corporation
                  </option>
                  <option value="Public - State/Local University or College">
                    State / Local University or College
                  </option>
                </optgroup>
                <optgroup label="Private">
                  <option value="Private - Direct Hire">Direct Hire</option>
                  <option value="Private - Local Recruitment Agency">
                    Local Recruitment Agency
                  </option>
                  <option value="Private - Overseas Recruitment Agency">
                    Overseas Recruitment Agency
                  </option>
                  <option value="Private - DO 174">D.O. 174</option>
                </optgroup>
              </select>
            </label>
            <label className="form-field">
              <span>Total Workforce</span>
              <select
                value={profileForm.total_workforce}
                onChange={(e) => handleProfileInputChange('total_workforce', e.target.value)}
                disabled={!isEditingProfile}
              >
                <option value="">Select workforce size</option>
                <option value="Micro (1-9)">Micro (1-9)</option>
                <option value="Small (10-99)">Small (10-99)</option>
                <option value="Medium (100-199)">Medium (100-199)</option>
                <option value="Large (200 and up)">Large (200 and up)</option>
              </select>
            </label>
            <label className="form-field">
              <span>Line of Business / Industry</span>
              <input
                type="text"
                value={profileForm.line_of_business}
                onChange={(e) => handleProfileInputChange('line_of_business', e.target.value)}
                disabled={!isEditingProfile}
              />
            </label>
            <label className="form-field full">
              <span>Full Address</span>
              <input
                type="text"
                value={profileForm.full_address}
                onChange={(e) => handleProfileInputChange('full_address', e.target.value)}
                disabled={!isEditingProfile}
              />
            </label>
          </div>
        </section>

        <section>
          <h2>Company Contact Details</h2>
          <div className="form-grid">
            <label className="form-field">
              <span>Name of Owner / President (Full Name)</span>
              <input
                type="text"
                value={profileForm.owner_president_name}
                onChange={(e) =>
                  handleProfileInputChange('owner_president_name', e.target.value)
                }
                disabled={!isEditingProfile}
              />
            </label>
            <label className="form-field">
              <span>Contact Person (Full Name)</span>
              <input
                type="text"
                value={profileForm.contact_person_name}
                onChange={(e) =>
                  handleProfileInputChange('contact_person_name', e.target.value)
                }
                disabled={!isEditingProfile}
              />
            </label>
            <label className="form-field">
              <span>Position</span>
              <input
                type="text"
                value={profileForm.contact_position}
                onChange={(e) => handleProfileInputChange('contact_position', e.target.value)}
                disabled={!isEditingProfile}
              />
            </label>
            <label className="form-field">
              <span>Telephone Number</span>
              <input
                type="text"
                value={profileForm.telephone_number}
                onChange={(e) => handleProfileInputChange('telephone_number', e.target.value)}
                disabled={!isEditingProfile}
              />
            </label>
            <label className="form-field">
              <span>Mobile Number</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#666',
                  userSelect: 'none',
                  padding: '8px 4px'
                }}>+63</span>
                <input
                  type="tel"
                  value={profileForm.mobile_number}
                  onChange={(e) => handleProfileInputChange('mobile_number', e.target.value)}
                  placeholder="9XXXXXXXXX"
                  disabled={!isEditingProfile}
                  style={{ flex: 1 }}
                  maxLength={10}
                />
              </div>
            </label>
            <label className="form-field">
              <span>Fax Number</span>
              <input
                type="text"
                value={profileForm.fax_number}
                onChange={(e) => handleProfileInputChange('fax_number', e.target.value)}
                disabled={!isEditingProfile}
              />
            </label>
            <label className="form-field">
              <span>Contact Email Address</span>
              <input
                type="email"
                value={profileForm.contact_email}
                onChange={(e) => handleProfileInputChange('contact_email', e.target.value)}
                disabled={!isEditingProfile}
              />
            </label>
          </div>
        </section>

        {profileMessage.text ? (
          <div className={`form-message ${profileMessage.type}`}>{profileMessage.text}</div>
        ) : null}

        <div className="form-actions">
          <button
            type="button"
            className="outline-btn"
            onClick={() => {
              if (isEditingProfile) {
                setIsEditingProfile(false);
                fetchProfile();
              } else {
                setIsEditingProfile(true);
              }
            }}
            disabled={profileSaving}
          >
            {isEditingProfile ? 'Cancel' : 'Edit Profile'}
          </button>
          <button
            type="submit"
            className="primary-btn"
            disabled={!isEditingProfile || profileSaving}
          >
            {profileSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    );
  };

  const renderDocumentCard = (key) => {
    const config = DOCUMENT_CONFIG[key];
    if (!config) return null;

    const state = documentState[key] || { uploading: false, success: '', error: '' };

    return (
      <div key={key} className="employer-document-card">
        <h3>{config.label}</h3>
        <p className="employer-document-helper">{config.helper}</p>
        <div className="document-upload-row">
          <label className="employer-document-upload">
            <input
              type="file"
              accept={config.accept}
              onChange={(e) => handleDocumentSelect(key, e)}
              disabled={state.uploading}
            />
            <span>Choose File</span>
          </label>
          <button
            type="button"
            className="primary-btn compact"
            onClick={() => handleDocumentUpload(key)}
            disabled={!documentSelection[key] || state.uploading}
          >
            {state.uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {documentSelection[key]?.name ? (
          <div className="selected-file">Selected: {documentSelection[key]?.name}</div>
        ) : null}
        {profile?.[config.column] ? (
          <div className="employer-document-actions">
            <a
              className="outline-btn compact"
              href={profile[config.column]}
              target="_blank"
              rel="noopener noreferrer"
            >
              View File
            </a>
            <button
              type="button"
              className="outline-btn compact danger"
              onClick={() => handleRemoveDocument(key)}
              disabled={state.uploading || !profile?.[config.column]}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="employer-document-placeholder">No file uploaded yet.</div>
        )}
        {state.error ? (
          <div className="employer-document-message error">{state.error}</div>
        ) : null}
        {state.success ? (
          <div className="employer-document-message success">{state.success}</div>
        ) : null}
      </div>
    );
  };

  const renderDocumentUpload = () => (
    <section className="dashboard-panel employer-documents-wrapper">
      <div className="employer-documents-banner">
        <h2>Upload Documentary Requirements</h2>
        <p>
          Provide official documents to support your account. Approved documents help PESDO
          validate your legitimacy and speed up job vacancy approvals.
        </p>
      </div>

      <div className="employer-document-grid">
        {['bir', 'permit'].map((key) => renderDocumentCard(key))}
      </div>
    </section>
  );

  const renderSubmitJob = () => (
    <form className="profile-form" onSubmit={handleSubmitJob}>
      <section>
        <h2>Submit a Job Vacancy</h2>
        <p className="section-subtitle">
          Provide the role's details. All approved vacancies appear to jobseekers once reviewed by PESDO.
        </p>
        {isVerified ? null : (
          <div className={`form-message ${verificationStatus === 'suspended' ? 'error' : 'warning'}`}>
            {verificationStatus === 'suspended' ? (
              <>
                <strong>⛔ Your account has been suspended.</strong>
                {profile?.suspension_duration_days ? (
                  <p>Your suspension will last for {profile.suspension_duration_days} day{profile.suspension_duration_days !== 1 ? 's' : ''}.</p>
                ) : (
                  <p>Your suspension is indefinite until manually reinstated by an administrator.</p>
                )}
                {profile?.suspension_notes && (
                  <p><strong>Reason:</strong> {profile.suspension_notes}</p>
                )}
                <p>You cannot post new job vacancies while your account is suspended.</p>
              </>
            ) : (
              'Your account must be verified before you can submit job vacancies.'
            )}
          </div>
        )}
        <h3 className="section-title">Position Details</h3>
        <div className="form-grid">
          <label className="form-field">
            <span>Position Title *</span>
            <input
              type="text"
              value={jobForm.position_title}
              onChange={(e) => handleJobInputChange('position_title', e.target.value)}
              required
              disabled={!isVerified}
            />
          </label>
          <label className="form-field">
            <span>Nature of Work *</span>
            <select
              value={jobForm.nature_of_work}
              onChange={(e) => handleJobInputChange('nature_of_work', e.target.value)}
              required
              disabled={!isVerified}
            >
              <option value="">Select nature of work</option>
              <option value="Permanent">Permanent</option>
              <option value="Contractual">Contractual</option>
              <option value="Project-Based">Project-Based</option>
              <option value="Internship">Internship</option>
              <option value="Part-time">Part-time</option>
              <option value="Work from home">Work from home</option>
            </select>
          </label>
          <label className="form-field">
            <span>Place of Work *</span>
            <input
              type="text"
              value={jobForm.place_of_work}
              onChange={(e) => handleJobInputChange('place_of_work', e.target.value)}
              required
              disabled={!isVerified}
            />
          </label>
          <label className="form-field">
            <span>Salary Range</span>
            <input
              type="text"
              value={jobForm.salary}
              onChange={(e) => handleJobInputChange('salary', e.target.value)}
              disabled={!isVerified}
            />
          </label>
          <label className="form-field">
            <span>Vacancy Count</span>
            <input
              type="number"
              min="1"
              value={jobForm.vacancy_count}
              onChange={(e) => handleJobInputChange('vacancy_count', e.target.value)}
              disabled={!isVerified}
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="section-title">Qualification Requirements</h3>
        <label className="form-field">
          <span>Job Description *</span>
          <textarea
            rows={5}
            value={jobForm.job_description}
            onChange={(e) => handleJobInputChange('job_description', e.target.value)}
            required
            disabled={!isVerified}
          />
        </label>

        <label className="form-field">
          <span>Other qualifications</span>
          <textarea
            rows={3}
            value={jobForm.other_qualifications}
            onChange={(e) => handleJobInputChange('other_qualifications', e.target.value)}
            disabled={!isVerified}
          />
        </label>

        <div className="form-grid">
          <label className="form-field">
            <span>Work experience (month/s)</span>
            <input
              type="number"
              min="0"
              value={jobForm.work_experience_months}
              onChange={(e) =>
                handleJobInputChange('work_experience_months', e.target.value)
              }
              disabled={!isVerified}
            />
          </label>
          <label className="form-field">
            <span>Educational level</span>
            <select
              value={jobForm.educational_level}
              onChange={(e) => handleJobInputChange('educational_level', e.target.value)}
              disabled={!isVerified}
            >
              <option value="">Select education level</option>
              <option value="Elementary">Elementary</option>
              <option value="High School">High School</option>
              <option value="Senior High School">Senior High School</option>
              <option value="Vocational">Vocational</option>
              <option value="Bachelor's Degree">Bachelor's Degree</option>
              <option value="Master's Degree">Master's Degree</option>
              <option value="Doctorate">Doctorate</option>
            </select>
          </label>
          <label className="form-field">
            <span>Course / SHS Strand</span>
            <input
              type="text"
              value={jobForm.course_shs_strand}
              onChange={(e) => handleJobInputChange('course_shs_strand', e.target.value)}
              disabled={!isVerified}
            />
          </label>
          <label className="form-field">
            <span>License</span>
            <input
              type="text"
              value={jobForm.license}
              onChange={(e) => handleJobInputChange('license', e.target.value)}
              disabled={!isVerified}
            />
          </label>
          <label className="form-field">
            <span>Eligibility</span>
            <input
              type="text"
              value={jobForm.eligibility}
              onChange={(e) => handleJobInputChange('eligibility', e.target.value)}
              disabled={!isVerified}
            />
          </label>
          <label className="form-field">
            <span>Certification</span>
            <input
              type="text"
              value={jobForm.certification}
              onChange={(e) => handleJobInputChange('certification', e.target.value)}
              disabled={!isVerified}
            />
          </label>
          <label className="form-field">
            <span>Language / dialect spoken</span>
            <input
              type="text"
              value={jobForm.language_dialect}
              onChange={(e) => handleJobInputChange('language_dialect', e.target.value)}
              disabled={!isVerified}
            />
          </label>
        </div>
      </section>

      <section>
        <h2>Accessibility & Inclusivity</h2>
        <div className="form-grid accessibility-grid">
          <fieldset className="form-field full">
            <legend>Accepts persons with disabilities (PWD)</legend>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="accepts_pwd"
                  value="Yes"
                  checked={jobForm.accepts_pwd === 'Yes'}
                  onChange={(e) => handleJobInputChange('accepts_pwd', e.target.value)}
                  disabled={!isVerified}
                />
                <span>Yes</span>
              </label>
              <label className="radio-option with-suboptions">
                <input
                  type="radio"
                  name="accepts_pwd"
                  value="No"
                  checked={jobForm.accepts_pwd === 'No'}
                  onChange={(e) => handleJobInputChange('accepts_pwd', e.target.value)}
                  disabled={!isVerified}
                />
                <span>No</span>
              </label>
            </div>

            {jobForm.accepts_pwd === 'Yes' ? (
              <div className="checkbox-grid pwd-types-grid">
                {['visual', 'hearing', 'speech', 'physical', 'mental'].map((type) => (
                  <label key={type} className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={Boolean(jobForm.pwd_types[type])}
                      onChange={(e) => handlePwdTypeChange(type, e.target.checked)}
                      disabled={!isVerified}
                    />
                    <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                  </label>
                ))}
                <input
                  type="text"
                  className="inline-input"
                  placeholder="Others (please specify)"
                  value={jobForm.pwd_types_others}
                  onChange={(e) => handlePwdOtherChange(e.target.value)}
                  disabled={!isVerified}
                />
              </div>
            ) : null}
          </fieldset>

          <fieldset className="form-field">
            <legend>Accepts returning OFWs</legend>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="accepts_ofw"
                  value="Yes"
                  checked={jobForm.accepts_ofw === 'Yes'}
                  onChange={(e) => handleJobInputChange('accepts_ofw', e.target.value)}
                  disabled={!isVerified}
                />
                <span>Yes</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="accepts_ofw"
                  value="No"
                  checked={jobForm.accepts_ofw === 'No'}
                  onChange={(e) => handleJobInputChange('accepts_ofw', e.target.value)}
                  disabled={!isVerified}
                />
                <span>No</span>
              </label>
            </div>
          </fieldset>
        </div>
      </section>

      <section>
        <h3 className="section-title">Posting Details</h3>
        <p className="section-subtitle" style={{ marginBottom: '16px', fontSize: '0.9rem', color: '#64748b' }}>
          Set when the job vacancy will be open for applications. Leave blank to make it immediately available after approval.
        </p>
        <div className="form-grid">
          <label className="form-field">
            <span>Valid From</span>
            <input
              type="date"
              value={jobForm.valid_from}
              onChange={(e) => handleJobInputChange('valid_from', e.target.value)}
              disabled={!isVerified}
              min={new Date().toISOString().split('T')[0]}
              title="Select today or a future date. This is when jobseekers can start applying."
            />
          </label>
          <label className="form-field">
            <span>Valid Until</span>
            <input
              type="date"
              value={jobForm.valid_until}
              onChange={(e) => handleJobInputChange('valid_until', e.target.value)}
              disabled={!isVerified}
              min={jobForm.valid_from || new Date().toISOString().split('T')[0]}
              title={jobForm.valid_from ? "Must be after Valid From date" : "Select today or a future date"}
            />
          </label>
        </div>
      </section>

      {jobMessage.text ? (
        <div className={`form-message ${jobMessage.type}`}>{jobMessage.text}</div>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="primary-btn" disabled={jobSaving || !isVerified}>
          {jobSaving ? 'Submitting…' : 'Submit Job Vacancy'}
        </button>
      </div>
    </form>
  );

  const renderManageJobs = () => {
    if (jobsLoading) {
      return <div className="loading">Loading your vacancies…</div>;
    }

    if (jobsError) {
      return (
        <div className="error-panel">
          <div>Unable to load job vacancies.</div>
          <div className="error-details">{jobsError}</div>
        </div>
      );
    }

    const hasPending = (pendingJobs || []).length > 0;
    const hasApproved = (approvedJobs || []).length > 0;
    const hasRejected = (rejectedJobs || []).length > 0;
    const hasCompleted = (completedJobs || []).length > 0;
    const hasFilteredPending = filteredPendingJobs.length > 0;
    const hasFilteredApproved = filteredApprovedJobs.length > 0;
    const hasFilteredRejected = filteredRejectedJobs.length > 0;
    const hasFilteredCompleted = filteredCompletedJobs.length > 0;

    if (!hasPending && !hasApproved && !hasRejected && !hasCompleted) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No job vacancies found</h3>
          <p>
            Submit a job vacancy to have it reviewed by PESDO administrators. Approved jobs will
            appear here and on the jobseeker dashboard.
          </p>
        </div>
      );
    }

    const resolveVacancyCount = (job) => {
      if (typeof job.vacancy_count === 'number') return job.vacancy_count;
      if (typeof job.total_positions === 'number') return job.total_positions;
      if (typeof job.vacancies === 'number') return job.vacancies;
      return 0;
    };

    const getJobMetrics = (job) => {
      const jobId = job.id;
    const jobList = jobId ? jobApplications[jobId] || [] : [];
    const nonCountingStatuses = new Set(['rejected', 'withdrawn', 'cancelled']);
    const activeResponses = jobList.filter(
      (application) => !nonCountingStatuses.has((application.status || '').toLowerCase())
    );
    const acceptedApplications = activeResponses.filter(
      (application) => (application.status || '').toLowerCase() === 'accepted'
    );
    const pendingReferredApplications = activeResponses.filter(
      (application) => (application.status || '').toLowerCase() === 'referred'
    );

    const applicants = acceptedApplications.filter((application) => !application.was_referred).length;
    const referred = pendingReferredApplications.length;
    const vacancy = resolveVacancyCount(job);
    const responses = acceptedApplications.length;
    const filled = vacancy > 0 && responses >= vacancy;
      return {
        applicants,
        referred,
        vacancy,
        responses,
        filled
      };
    };

    const getLocationLabel = (job) =>
      job.place_of_work || job.location || job.work_location || 'Not specified';

    const getNatureLabel = (job) =>
      job.nature_of_work || job.employment_type || job.job_type || 'Not specified';

    const getSalaryLabel = (job) =>
      job.salary_range || job.salary || job.compensation || 'Not specified';

    const getPostedLabel = (job) =>
      formatDateLabel(job.created_at || job.posting_date || job.submitted_at);

    const getValidFromLabel = (job) =>
      formatDateLabel(job.valid_from || job.validFrom);

    const getValidUntilLabel = (job) =>
      formatDateLabel(job.valid_until || job.validUntil);

    const renderJobCard = (job, statusLabel, statusClass) => {
      const metrics = getJobMetrics(job);
      const locationLabel = getLocationLabel(job);
      const natureLabel = getNatureLabel(job);
      const salaryLabel = getSalaryLabel(job);
      const postedLabel = getPostedLabel(job);
      const validFromLabel = getValidFromLabel(job);
      const validUntilLabel = getValidUntilLabel(job);
      const vacancyLabel = metrics.vacancy || '—';
      const responsesLabel = `${metrics.responses}/${metrics.vacancy || '—'}`;
      const statusChipText = metrics.filled ? 'Filled' : 'Open';

      return (
        <div key={job.id} className="job-card modern">
          <div className="job-card-header">
            <h3 className="job-card-title">{job.title || job.position_title || 'Untitled Role'}</h3>
            <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
          </div>

          <div className="job-card-summary">
            <div className="job-meta-grid">
              <div className="meta-item">
                <span className="meta-label">📍 Location</span>
                <span className="meta-value">{locationLabel}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">💼 Nature of Work</span>
                <span className="meta-value">{natureLabel}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">💰 Salary Range</span>
                <span className="meta-value">{salaryLabel}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">📄 Vacancies</span>
                <span className="meta-value">{vacancyLabel}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">🗓 Posted</span>
                <span className="meta-value">{postedLabel}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">📅 Valid From</span>
                <span className="meta-value">{validFromLabel}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">⏳ Valid Until</span>
                <span className="meta-value">{validUntilLabel}</span>
              </div>
            </div>
          </div>

          <p className="job-description modern">
            {job.description || job.job_description || 'No description provided.'}
          </p>

          {statusClass === 'rejected' && job.review_notes ? (
            <div className="job-alert warning">
              <span className="meta-label">Rejection Note</span>
              <p>{job.review_notes}</p>
            </div>
          ) : null}

          <div className="job-metrics">
            <div className="metric-card">
              <span>Vacancies</span>
              <strong>{vacancyLabel}</strong>
            </div>
            <div className="metric-card">
              <span>Applicants</span>
              <strong>{metrics.applicants}</strong>
            </div>
            <div className="metric-card">
              <span>Referred</span>
              <strong>{metrics.referred}</strong>
            </div>
            <div className={`fill-chip ${metrics.filled ? 'filled' : 'open'}`}>
              {statusChipText}
              {metrics.vacancy ? (
                <span className="fill-progress">({responsesLabel})</span>
              ) : null}
            </div>
          </div>

          <div className="job-card-footer">
            <span className="job-updated">
              Updated {formatDateLabel(job.updated_at || job.created_at || job.submitted_at)}
            </span>
            <button
              type="button"
              className="outline-btn compact"
              onClick={() => handleOpenJobDetails(job, statusClass)}
            >
              View Details
            </button>
          </div>
        </div>
      );
    };

    const getCurrentJobs = () => {
      switch (jobStatusTab) {
        case 'pending':
          return {
            jobs: filteredPendingJobs,
            hasJobs: hasFilteredPending,
            statusLabel: 'Pending',
            statusClass: 'pending',
            emptyMessage: jobSearchQuery ? 'No pending jobs match your search.' : 'No pending jobs at this time.'
          };
        case 'approved':
          return {
            jobs: filteredApprovedJobs,
            hasJobs: hasFilteredApproved,
            statusLabel: 'Approved',
            statusClass: 'approved',
            emptyMessage: jobSearchQuery ? 'No approved jobs match your search.' : 'No approved jobs at this time.'
          };
        case 'rejected':
          return {
            jobs: filteredRejectedJobs,
            hasJobs: hasFilteredRejected,
            statusLabel: 'Rejected',
            statusClass: 'rejected',
            emptyMessage: jobSearchQuery ? 'No rejected jobs match your search.' : 'No rejected jobs at this time.'
          };
        case 'completed':
          return {
            jobs: filteredCompletedJobs,
            hasJobs: hasFilteredCompleted,
            statusLabel: 'Completed',
            statusClass: 'completed',
            emptyMessage: jobSearchQuery ? 'No completed jobs match your search.' : 'No completed jobs at this time.'
          };
        default:
          return {
            jobs: [],
            hasJobs: false,
            statusLabel: 'Pending',
            statusClass: 'pending',
            emptyMessage: 'No jobs found.'
          };
      }
    };

    const currentJobs = getCurrentJobs();

    return (
      <>
        <div className="panel-stack manage-panel-stack">
          {/* Job Status Tabs */}
          <div className="job-status-tabs">
            <button
              type="button"
              className={`job-status-tab ${jobStatusTab === 'pending' ? 'active' : ''}`}
              onClick={() => setJobStatusTab('pending')}
            >
              <span>Pending Review</span>
              {pendingJobs.length > 0 && (
                <span className="tab-count">{pendingJobs.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`job-status-tab ${jobStatusTab === 'approved' ? 'active' : ''}`}
              onClick={() => setJobStatusTab('approved')}
            >
              <span>Approved</span>
              {approvedJobs.length > 0 && (
                <span className="tab-count">{approvedJobs.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`job-status-tab ${jobStatusTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setJobStatusTab('rejected')}
            >
              <span>Rejected</span>
              {rejectedJobs.length > 0 && (
                <span className="tab-count">{rejectedJobs.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`job-status-tab ${jobStatusTab === 'completed' ? 'active' : ''}`}
              onClick={() => setJobStatusTab('completed')}
            >
              <span>Complete Job Vacancy</span>
              {completedJobs.length > 0 && (
                <span className="tab-count">{completedJobs.length}</span>
              )}
            </button>
          </div>

          {/* Current Tab Content */}
          <section className="dashboard-panel">
            <h2>
              {jobStatusTab === 'pending' ? 'Pending Review' :
               jobStatusTab === 'approved' ? 'Approved Vacancies' :
               jobStatusTab === 'rejected' ? 'Rejected Vacancies' :
               'Complete Job Vacancy'}
            </h2>
            {currentJobs.hasJobs ? (
              <div className="cards-row">
                {currentJobs.jobs.map((job) => renderJobCard(job, currentJobs.statusLabel, currentJobs.statusClass))}
              </div>
            ) : (
              <div className="empty-state compact">
                <p>{currentJobs.emptyMessage}</p>
              </div>
            )}
          </section>
        </div>

        {renderJobDetailsModal()}
        {renderApplicationModal()}
      </>
    );
  };

  const renderJobDetailsModal = () => {
    if (!jobDetailsOpen || !selectedJob) {
      return null;
    }

    const applicationsForSelectedJob = jobApplications[selectedJob.id] || [];
    
    // Filter applicants: exclude those that were ever referred (even if canceled)
    // Since canceled referrals are now deleted, we only need to check was_ever_referred flag
    const activeApplicants = applicationsForSelectedJob.filter(
      (application) => !application.was_referred && !application.was_ever_referred
    );
    
    // Only show currently referred applicants
    const referredApplicants = applicationsForSelectedJob.filter(
      (application) => application.was_referred
    );
    return (
      <div className="employer-modal-overlay">
        <button
          type="button"
          className="employer-modal-backdrop"
          aria-label="Close job details"
          onClick={handleCloseJobDetails}
        />
        <dialog
          className="employer-modal"
          open
          aria-modal="true"
          aria-labelledby="employer-modal-title"
        >
          <div className="employer-modal-header">
            <div className="employer-modal-heading">
              <h3 id="employer-modal-title">
                {selectedJob.title || selectedJob.position_title || 'Job Vacancy Details'}
              </h3>
              <p className="employer-modal-subtitle">
                {selectedJob.location || selectedJob.place_of_work || '—'}
              </p>
            </div>
            <div className="employer-modal-actions">
              <span className={`status-pill ${selectedJobStatus || 'pending'}`}>
                {formatStatusLabel(selectedJobStatus)}
              </span>
              <button type="button" className="modal-close-btn" onClick={handleCloseJobDetails}>
                ×
              </button>
            </div>
          </div>

          <div className="employer-modal-body">
            <div className="modal-section">
              <h4>Position Overview</h4>
              <div className="modal-meta-grid">
                <div className="modal-meta-item">
                  <span>Employment Type</span>
                  <strong>
                    {selectedJob.nature_of_work || selectedJob.employment_type || '—'}
                  </strong>
                </div>
                <div className="modal-meta-item">
                  <span>Vacancy Count</span>
                  <strong>{selectedJob.vacancy_count || selectedJob.total_positions || '—'}</strong>
                </div>
                <div className="modal-meta-item">
                <span>Salary Range</span>
                  <strong>{selectedJob.salary_range || selectedJob.salary || '—'}</strong>
                </div>
                <div className="modal-meta-item">
                  <span>Posting Date</span>
                  <strong>{formatDateLabel(selectedJob.posting_date || selectedJob.created_at)}</strong>
                </div>
                <div className="modal-meta-item">
                  <span>Valid Until</span>
                  <strong>{formatDateLabel(selectedJob.valid_until)}</strong>
                </div>
              </div>
            </div>

            <div className="modal-section">
              <h4>Job Description</h4>
              <p>{selectedJob.job_description || selectedJob.description || 'No description provided.'}</p>
            </div>

            <div className="modal-section">
              <h4>Applications & Referrals</h4>
              <div className="job-applicants">
                <div className="applicant-group">
                  <div className="group-title">Applicants</div>
                  {activeApplicants.length > 0 ? (
                    <ul className="applicant-list">
                      {activeApplicants.map((application) => (
                        <li key={application.id} className="applicant-item">
                          <div className="applicant-info">
                            <span className="applicant-name">
                              {formatJobseekerName(
                                application.jobseeker_profiles,
                                application.jobseeker_profiles?.email
                              )}
                            </span>
                            <span className="applicant-date">
                              Applied {formatDateLabel(application.applied_at || application.created_at)}
                            </span>
                          </div>
                          <div className="applicant-actions">
                            <span className={`applicant-status ${getApplicationStatusClass(application.status)}`}>
                              {formatStatusLabel(application.status)}
                            </span>
                            <button
                              type="button"
                              className="inline-link"
                              onClick={() => handleSelectApplication(application)}
                            >
                              View
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="applicant-empty">No applicants yet.</p>
                  )}
                </div>
                <div className="applicant-group">
                  <div className="group-title">Referred by PESDO</div>
                  {referredApplicants.length > 0 ? (
                    <ul className="applicant-list">
                      {referredApplicants.map((application) => (
                        <li key={application.id} className="applicant-item">
                          <div className="applicant-info">
                            <span className="applicant-name">
                              {formatJobseekerName(
                                application.jobseeker_profiles,
                                application.jobseeker_profiles?.email
                              )}
                            </span>
                            <span className="applicant-date">
                              Referred {formatDateLabel(application.updated_at || application.created_at)}
                            </span>
                          </div>
                          <div className="applicant-actions">
                            <span className={`applicant-status ${getApplicationStatusClass(application.status)}`}>
                              {formatStatusLabel(application.status)}
                            </span>
                            <button
                              type="button"
                              className="inline-link"
                              onClick={() => handleSelectApplication(application)}
                            >
                              View
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="applicant-empty">No referrals yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </dialog>
      </div>
    );
  };

  const renderApplicationModal = () => {
    if (!isApplicationModalOpen || !selectedApplication) {
      return null;
    }

    const applicationStatus = (selectedApplication.status || '').toLowerCase();
    const decisionWindowStatuses = new Set(['pending', 'referred']);
    const canAccept = decisionWindowStatuses.has(applicationStatus);
    const canReject = decisionWindowStatuses.has(applicationStatus);
    const profile = selectedApplicationProfile || selectedApplication.jobseeker_profiles || {};
    const preferredJobs = Array.isArray(profile.preferred_jobs) ? profile.preferred_jobs.filter(Boolean) : [];
    const isProfileLoading = loadingApplicationProfile && !selectedApplicationProfile;
    let employmentStatusLabel = profile.employment_status || '—';
    if (profile.status === true) {
      employmentStatusLabel = 'Employed';
    } else if (profile.status === false) {
      employmentStatusLabel = 'Unemployed';
    }

    return (
      <div className="employer-modal-overlay application">
        <button
          type="button"
          className="employer-modal-backdrop"
          aria-label="Close applicant details"
          onClick={handleCloseApplicationModal}
        />
        <dialog
          className="employer-modal applicant-modal"
          open
          aria-modal="true"
          aria-labelledby="applicant-modal-title"
        >
          <div className="employer-modal-header applicant">
            <div className="applicant-avatar">
              {profile.profile_picture_url ? (
                <img src={profile.profile_picture_url} alt={`${formatJobseekerName(profile, profile.email)} avatar`} />
              ) : (
                <span>
                  {formatJobseekerName(profile, profile.email)
                    .split(' ')
                    .map((part) => part[0]?.toUpperCase())
                    .join('')
                    .slice(0, 2)}
                </span>
              )}
            </div>
            <div className="employer-modal-heading">
              <h3 id="applicant-modal-title">
                {formatJobseekerName(profile, profile.email)}
              </h3>
              <p className="employer-modal-subtitle">{profile.email || 'No email provided'}</p>
            </div>
            <div className="employer-modal-actions">
              <span className={`applicant-status ${getApplicationStatusClass(selectedApplication.status)}`}>
                {formatStatusLabel(selectedApplication.status)}
              </span>
              <button type="button" className="modal-close-btn" onClick={handleCloseApplicationModal}>
                ×
              </button>
            </div>
          </div>

          <div className="employer-modal-body">
            {isProfileLoading ? (
              <div className="modal-section">
                <p className="applicant-empty">Loading applicant profile…</p>
              </div>
            ) : (
              <>
                <div className="modal-section">
                  <h4>Profile Summary</h4>
                  <div className="applicant-info-grid">
                    <div className="modal-meta-item">
                      <span>Phone</span>
                      <strong>{profile.phone || '—'}</strong>
                    </div>
                    <div className="modal-meta-item">
                      <span>Address</span>
                      <strong>{profile.address || '—'}</strong>
                    </div>
                    <div className="modal-meta-item">
                      <span>Gender</span>
                      <strong>{profile.gender || '—'}</strong>
                    </div>
                    <div className="modal-meta-item">
                      <span>Age</span>
                      <strong>{profile.age ? `${profile.age} years old` : '—'}</strong>
                    </div>
                    <div className="modal-meta-item">
                      <span>Civil Status</span>
                      <strong>{profile.civil_status || '—'}</strong>
                    </div>
                    <div className="modal-meta-item">
                      <span>Education</span>
                      <strong>{profile.education || '—'}</strong>
                    </div>
                    <div className="modal-meta-item">
                      <span>Employment Status</span>
                      <strong>{employmentStatusLabel}</strong>
                    </div>
                  </div>
                </div>

                {preferredJobs.length ? (
                  <div className="modal-section">
                    <h4>Preferred Jobs</h4>
                    <ul className="preferred-job-list">
                      {preferredJobs.map((job, index) => (
                        <li key={`${job}-${index}`}>{job}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {profile.bio ? (
                  <div className="modal-section">
                    <h4>Summary</h4>
                    <p>{profile.bio}</p>
                  </div>
                ) : null}

                {/* Certificates Section */}
                {(profile.nc1_certificate_url || 
                  profile.nc2_certificate_url || 
                  profile.nc3_certificate_url || 
                  profile.nc4_certificate_url || 
                  (Array.isArray(profile.other_certificates) && profile.other_certificates.length > 0)) && (
                  <div className="modal-section">
                    <h4>🏆 Certificates</h4>
                    
                    {/* NC Certificates */}
                    {profile.nc1_certificate_url && (
                      <div className="modal-meta-item certificate-item">
                        <span>NC I Certificate</span>
                        <div className="certificate-actions">
                          <a
                            href={profile.nc1_certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-link"
                          >
                            📄 View Certificate
                          </a>
                          <a
                            href={profile.nc1_certificate_url}
                            download
                            className="inline-link"
                            style={{ marginLeft: '10px' }}
                          >
                            ⬇️ Download
                          </a>
                        </div>
                        {profile.nc1_certificate_uploaded_at && (
                          <span style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
                            Uploaded: {formatDateLabel(profile.nc1_certificate_uploaded_at)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {profile.nc2_certificate_url && (
                      <div className="modal-meta-item certificate-item">
                        <span>NC II Certificate</span>
                        <div className="certificate-actions">
                          <a
                            href={profile.nc2_certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-link"
                          >
                            📄 View Certificate
                          </a>
                          <a
                            href={profile.nc2_certificate_url}
                            download
                            className="inline-link"
                            style={{ marginLeft: '10px' }}
                          >
                            ⬇️ Download
                          </a>
                        </div>
                        {profile.nc2_certificate_uploaded_at && (
                          <span style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
                            Uploaded: {formatDateLabel(profile.nc2_certificate_uploaded_at)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {profile.nc3_certificate_url && (
                      <div className="modal-meta-item certificate-item">
                        <span>NC III Certificate</span>
                        <div className="certificate-actions">
                          <a
                            href={profile.nc3_certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-link"
                          >
                            📄 View Certificate
                          </a>
                          <a
                            href={profile.nc3_certificate_url}
                            download
                            className="inline-link"
                            style={{ marginLeft: '10px' }}
                          >
                            ⬇️ Download
                          </a>
                        </div>
                        {profile.nc3_certificate_uploaded_at && (
                          <span style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
                            Uploaded: {formatDateLabel(profile.nc3_certificate_uploaded_at)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {profile.nc4_certificate_url && (
                      <div className="modal-meta-item certificate-item">
                        <span>NC IV Certificate</span>
                        <div className="certificate-actions">
                          <a
                            href={profile.nc4_certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-link"
                          >
                            📄 View Certificate
                          </a>
                          <a
                            href={profile.nc4_certificate_url}
                            download
                            className="inline-link"
                            style={{ marginLeft: '10px' }}
                          >
                            ⬇️ Download
                          </a>
                        </div>
                        {profile.nc4_certificate_uploaded_at && (
                          <span style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
                            Uploaded: {formatDateLabel(profile.nc4_certificate_uploaded_at)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Other Certificates */}
                    {Array.isArray(profile.other_certificates) && profile.other_certificates.length > 0 && (
                      <div className="modal-meta-item certificate-item">
                        <span>Other Certificates</span>
                        <div className="other-certificates-list" style={{ marginTop: '10px' }}>
                          {profile.other_certificates.map((cert, index) => (
                            <div key={index} className="other-certificate-item" style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '10px' }}>
                              <div className="certificate-info">
                                <strong style={{ color: '#1f2937', fontSize: '0.95rem', display: 'block', marginBottom: '4px' }}>
                                  {cert.type || `Certificate ${index + 1}`}
                                </strong>
                                {cert.file_name && (
                                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', display: 'block', marginBottom: '4px' }}>
                                    File: {cert.file_name}
                                  </span>
                                )}
                                {cert.uploaded_at && (
                                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', display: 'block' }}>
                                    Uploaded: {formatDateLabel(cert.uploaded_at)}
                                  </span>
                                )}
                              </div>
                              {cert.url && (
                                <div className="certificate-actions" style={{ marginTop: '8px' }}>
                                  <a
                                    href={cert.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-link"
                                  >
                                    📄 View
                                  </a>
                                  <a
                                    href={cert.url}
                                    download
                                    className="inline-link"
                                    style={{ marginLeft: '10px' }}
                                  >
                                    ⬇️ Download
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="modal-section">
                  <h4>Resume</h4>
                  {profile.resume_url ? (
                    <a
                      href={profile.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-link"
                    >
                      View Resume
                    </a>
                  ) : (
                    <p className="applicant-empty">No resume uploaded.</p>
                  )}
                </div>
              </>
            )}

            <div className="applicant-action-row">
              <button
                type="button"
                className="outline-btn compact danger"
                onClick={() => handleApplicationDecision(selectedApplication, 'reject')}
                disabled={isProcessingApplication || !canReject}
              >
                Reject
              </button>
              <button
                type="button"
                className="primary-btn compact"
                onClick={() => handleApplicationDecision(selectedApplication, 'accept')}
                disabled={isProcessingApplication || !canAccept}
              >
                Accept
              </button>
            </div>
          </div>
        </dialog>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileSection();
      case 'documents':
        return renderDocumentUpload();
      case 'submit':
        return renderSubmitJob();
      case 'manage':
        return renderManageJobs();
      default:
        return null;
    }
  };

  return (
    <div className="js-dashboard employer-dashboard">
      <button 
        type="button"
        className={`js-mobile-menu-toggle ${mobileMenuOpen ? 'menu-open' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMobileMenuOpen(prev => !prev);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMobileMenuOpen(prev => !prev);
        }}
        aria-label="Toggle menu"
        style={{ zIndex: 1001, touchAction: 'manipulation' }}
      >
        <span style={{ fontSize: '20px', lineHeight: '1', display: 'block', pointerEvents: 'none', userSelect: 'none' }}>
          ☰
        </span>
      </button>
      <div 
        className={`js-sidebar-overlay ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside className={`js-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMobileMenuOpen(false);
            }}
            aria-label="Close menu"
            style={{ display: 'none' }}
          >
            ✕
          </button>
          <div className="brand-mark">Employer Dashboard</div>
          <div className="user-snapshot">
            <div className="user-name">{profileDisplayName}</div>
            <div className="user-email">
              {currentUser?.email || profile?.email || '—'}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.key);
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button 
            type="button" 
            className="outline-btn full" 
            onClick={() => {
              setMobileMenuOpen(false);
              logout();
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="js-main">
        <header className="main-header">
          <div className="header-top">
            {activeTab === 'manage' && (
              <div className="header-search">
                <div className="header-search-input-wrapper">
                  <input
                    type="text"
                    className="header-search-input"
                    placeholder="Search jobs by title, location, description, nature, or salary..."
                    value={jobSearchQuery}
                    onChange={(e) => setJobSearchQuery(e.target.value)}
                  />
                  <span className="header-search-icon">🔍</span>
                  {jobSearchQuery && (
                    <button
                      type="button"
                      className="header-search-clear"
                      onClick={() => setJobSearchQuery('')}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
                {jobSearchQuery && (
                  <div className="header-search-count">
                    Found {
                      jobStatusTab === 'pending' ? filteredPendingJobs.length :
                      jobStatusTab === 'approved' ? filteredApprovedJobs.length :
                      jobStatusTab === 'rejected' ? filteredRejectedJobs.length :
                      filteredCompletedJobs.length
                    } job(s)
                  </div>
                )}
              </div>
            )}

            <div className="header-actions">
              <NotificationButton
                notifications={employerNotifications}
                unreadCount={employerUnreadCount}
                onMarkAsRead={markEmployerNotificationAsRead}
                onMarkAllAsRead={markAllEmployerNotificationsAsRead}
                onNotificationClick={handleNotificationClick}
              />
            </div>
          </div>
        </header>

        <div className="panel-stack">{renderContent()}</div>
      </main>
    </div>
  );
};

export default EmployerDashboard;