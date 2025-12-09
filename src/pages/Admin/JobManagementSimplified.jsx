import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import NotificationButton from '../../components/NotificationButton';
import { logActivity } from '../../utils/activityLogger';
import { sendJobApprovalSMS, sendApplicationStatusSMS } from '../../services/smsService';
import { sendJobApprovalEmail, sendApplicationStatusEmail } from '../../services/emailService';
import './JobManagement.css';

const CERTIFICATE_LEVELS = ['nc1', 'nc2', 'nc3', 'nc4'];
const CERTIFICATE_KEYWORDS = {
  nc1: ['nc1', 'nc 1', 'nc-i', 'nc i'],
  nc2: ['nc2', 'nc 2', 'nc-ii', 'nc ii'],
  nc3: ['nc3', 'nc 3', 'nc-iii', 'nc iii'],
  nc4: ['nc4', 'nc 4', 'nc-iv', 'nc iv']
};

const JobManagementSimplified = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingJobs, setPendingJobs] = useState([]);
  const [approvedJobs, setApprovedJobs] = useState([]);
  const [rejectedJobs, setRejectedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobApplicantsForModal, setJobApplicantsForModal] = useState([]);
  const [loadingJobApplicants, setLoadingJobApplicants] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [jobseekers, setJobseekers] = useState([]);
  const [selectedJobForReferral, setSelectedJobForReferral] = useState(null);
  const [isReferring, setIsReferring] = useState(null); // Track which jobseeker ID is being referred (null = none)
  const [isCancelingReferral, setIsCancelingReferral] = useState(null); // Track which jobseeker ID is having referral canceled (null = none)
  const [showReferJobseekersModal, setShowReferJobseekersModal] = useState(false);
  const [applications, setApplications] = useState([]);
  const [selectedResumeUrl, setSelectedResumeUrl] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showCertificatesModal, setShowCertificatesModal] = useState(false);
  const [selectedCertificatesJobseeker, setSelectedCertificatesJobseeker] = useState(null);
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [referSearchTerm, setReferSearchTerm] = useState('');
  const [referStatusFilter, setReferStatusFilter] = useState('all');
  const [referNameSearch, setReferNameSearch] = useState('');
  const [adminRole, setAdminRole] = useState(null); // 'admin' or 'super_admin'
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [jobToReject, setJobToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Realtime notifications
  const {
    notifications: realtimeNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    requestNotificationPermission
  } = useRealtimeNotifications(currentUser?.id, 'admin');

  const applicationsByJob = useMemo(() => {
    const map = new Map();
    for (const application of applications || []) {
      if (!application?.job_id) continue;
      if (!map.has(application.job_id)) {
        map.set(application.job_id, []);
      }
      map.get(application.job_id).push(application);
    }
    return map;
  }, [applications]);

  const NATURE_OF_WORK_OPTIONS = [
    'Permanent',
    'Contractual',
    'Project-Based',
    'Internship',
    'Part-time',
    'Work from home'
  ];

  const jobStatusOptions = useMemo(() => {
    const set = new Set();
    for (const job of [...pendingJobs, ...approvedJobs]) {
      const status = (job?.status || '').toString().trim().toLowerCase();
      if (status) {
        set.add(status);
      }
    }
    return Array.from(set);
  }, [pendingJobs, approvedJobs]);

  const referStatusOptions = [
    { value: 'all', label: 'All jobs' },
    { value: 'needs', label: 'No referrals yet' },
    { value: 'has', label: 'With referrals' },
    { value: 'filled', label: 'Filled positions' }
  ];

  const normalize = (value) => (value || '').toString().toLowerCase();

  const formatEmploymentStatus = (status) => {
    if (status === true || normalize(status) === 'employed') return 'Employed';
    if (status === false || normalize(status) === 'unemployed') return 'Unemployed';
    return 'Not specified';
  };

  // Calculate placed count for a job (hired + accepted statuses)
  const getPlacedCount = useCallback((jobId) => {
    const jobApplications = applicationsByJob.get(jobId) || [];
    const placedCount = jobApplications.filter((application) => {
      const status = normalize(application.status);
      return status === 'hired' || status === 'accepted';
    }).length;
    return placedCount;
  }, [applicationsByJob, normalize]);

  const applyJobFilters = (jobs, fallbackStatus, enableStatusFilter = true) =>
    jobs.filter((job) => {
      const statusValue = normalize(job.status) || normalize(fallbackStatus);
      if (enableStatusFilter && jobStatusFilter !== 'all' && statusValue !== normalize(jobStatusFilter)) {
        return false;
      }

      if (jobTypeFilter !== 'all') {
        const jobType = normalize(job.nature_of_work || job.job_type);
        if (jobType !== normalize(jobTypeFilter)) {
          return false;
        }
      }

      if (jobSearchTerm) {
        const search = normalize(jobSearchTerm);
        const haystacks = [
          job.position_title,
          job.title,
          job.job_description,
          job.description,
          job.business_name,
          job.employer_profiles?.business_name,
          job.location,
          job.place_of_work,
          job.job_type,
          job.nature_of_work
        ].map(normalize);

        if (!haystacks.some((text) => text.includes(search))) {
          return false;
        }
      }

      return true;
    });

  const filteredPendingJobs = useMemo(
    () => applyJobFilters(pendingJobs, 'pending', false),
    [pendingJobs, jobSearchTerm, jobTypeFilter]
  );

  // Calculate archived jobs (jobs where all positions are filled)
  const filteredArchivedJobs = useMemo(() => {
    const archived = approvedJobs.filter((job) => {
      const placedCount = getPlacedCount(job.id);
      const vacancyCount = Number(job.vacancy_count || job.total_positions || 0);
      return vacancyCount > 0 && placedCount >= vacancyCount;
    });
    return applyJobFilters(archived, 'archived', false);
  }, [approvedJobs, applicationsByJob, jobSearchTerm, jobTypeFilter, getPlacedCount]);

  // Active approved jobs (not archived)
  const filteredActiveApprovedJobs = useMemo(() => {
    const active = approvedJobs.filter((job) => {
      const placedCount = getPlacedCount(job.id);
      const vacancyCount = Number(job.vacancy_count || job.total_positions || 0);
      return !(vacancyCount > 0 && placedCount >= vacancyCount);
    });
    return applyJobFilters(active, 'approved', false);
  }, [approvedJobs, applicationsByJob, jobSearchTerm, jobTypeFilter, getPlacedCount]);

  const filteredRejectedJobs = useMemo(
    () => applyJobFilters(rejectedJobs, 'rejected', false),
    [rejectedJobs, jobSearchTerm, jobTypeFilter]
  );

  const filteredReferJobs = useMemo(() => {
    return approvedJobs.filter((job) => {
      const jobApplications = applicationsByJob.get(job.id) || [];
      const referredCount = jobApplications.filter((application) => normalize(application.status) === 'referred').length;
      const acceptedCount = jobApplications.filter((application) => normalize(application.status) === 'accepted').length;
      const vacancyCount = Number(job.vacancy_count || job.total_positions || 0);

      if (referSearchTerm) {
        const search = normalize(referSearchTerm);
        const haystacks = [
          job.position_title,
          job.title,
          job.business_name,
          job.location,
          job.place_of_work,
          job.job_type,
          job.nature_of_work
        ].map(normalize);

        if (!haystacks.some((text) => text.includes(search))) {
          return false;
        }
      }

      if (referStatusFilter === 'needs' && referredCount > 0) {
        return false;
      }

      if (referStatusFilter === 'has' && referredCount === 0) {
        return false;
      }

      if (referStatusFilter === 'filled') {
        if (!vacancyCount || acceptedCount < vacancyCount) {
          return false;
        }
      }

      return true;
    });
  }, [approvedJobs, applicationsByJob, referSearchTerm, referStatusFilter]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Prevent trackpad gesture scrolling
  useEffect(() => {
    const preventTrackpadGestures = (e) => {
      // Prevent wheel events with ctrl/meta key (trackpad pinch/zoom gestures)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        return false;
      }
      // Prevent horizontal scrolling from trackpad gestures
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        return false;
      }
    };

    const container = document.querySelector('.job-management');
    if (container) {
      container.addEventListener('wheel', preventTrackpadGestures, { passive: false });
      container.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });
      container.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', preventTrackpadGestures);
      }
    };
  }, []);

  useEffect(() => {
    // Always fetch admin role from database to ensure it's correct for the current user
    // Don't trust localStorage as it might be stale or from a different user
    if (currentUser?.id) {
      supabase
        .from('admin_profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            const role = data.role || 'admin';
            setAdminRole(role);
            // Only update localStorage if it matches the current user's actual role
            localStorage.setItem('admin_role', role);
          } else {
            setAdminRole('admin');
            localStorage.setItem('admin_role', 'admin');
          }
        });
    }
  }, [currentUser]);

  useEffect(() => {
    fetchJobs();
    fetchApplications();
  }, []);

  // Refresh applications when modal opens
  useEffect(() => {
    if (showReferJobseekersModal) {
      fetchApplications();
    }
  }, [showReferJobseekersModal]);

  // Fetch job applicants when job modal opens (for approved jobs only)
  useEffect(() => {
    if (showJobModal && selectedJob) {
      fetchApplications();
      // Fetch jobseekers who applied to this job (only for approved jobs)
      if (selectedJob.jobType === 'approved' || selectedJob.status === 'approved') {
        fetchJobApplicantsForModal(selectedJob.id);
      } else {
        setJobApplicantsForModal([]);
      }
    }
  }, [showJobModal, selectedJob]);

  // Fetch applications to check referral status
  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*');

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  // Fetch jobseekers who applied to a specific job
  const fetchJobApplicantsForModal = async (jobId) => {
    if (!jobId) {
      setJobApplicantsForModal([]);
      return;
    }

    try {
      setLoadingJobApplicants(true);
      
      // Fetch applications for this job
      const { data: jobApplications, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId);

      if (appError) throw appError;

      if (!jobApplications || jobApplications.length === 0) {
        setJobApplicantsForModal([]);
        setLoadingJobApplicants(false);
        return;
      }

      // Get unique jobseeker IDs
      const jobseekerIds = [...new Set(jobApplications.map(app => app.jobseeker_id).filter(Boolean))];

      if (jobseekerIds.length === 0) {
        setJobApplicantsForModal([]);
        setLoadingJobApplicants(false);
        return;
      }

      // Fetch jobseeker profiles
      const { data: jobseekerProfiles, error: profileError } = await supabase
        .from('jobseeker_profiles')
        .select('id, first_name, last_name, email, phone')
        .in('id', jobseekerIds);

      if (profileError) throw profileError;

      // Combine applications with jobseeker profiles
      const applicantsWithStatus = jobApplications.map(application => {
        const profile = jobseekerProfiles?.find(p => p.id === application.jobseeker_id);
        return {
          applicationId: application.id,
          jobseekerId: application.jobseeker_id,
          status: application.status || 'pending',
          appliedAt: application.created_at || application.applied_at,
          firstName: profile?.first_name || 'Unknown',
          lastName: profile?.last_name || '',
          email: profile?.email || 'No email',
          phone: profile?.phone || 'No phone'
        };
      });

      // Sort by applied date (newest first)
      applicantsWithStatus.sort((a, b) => {
        const dateA = new Date(a.appliedAt || 0);
        const dateB = new Date(b.appliedAt || 0);
        return dateB - dateA;
      });

      setJobApplicantsForModal(applicantsWithStatus);
    } catch (error) {
      console.error('Error fetching job applicants:', error);
      setJobApplicantsForModal([]);
    } finally {
      setLoadingJobApplicants(false);
    }
  };

  // Fetch jobseekers for referral
  const formatJobseekerName = (profile) => {
    const parts = [];
    if (profile.first_name) parts.push(profile.first_name);
    if (profile.last_name) parts.push(profile.last_name);
    let name = parts.join(' ');
    const suffix = profile.suffix ? profile.suffix.trim() : '';
    if (suffix) {
      name = name ? `${name}, ${suffix}` : suffix;
    }
    return name;
  };

  const fetchJobseekers = async () => {
    try {
      const { data, error } = await supabase
        .from('jobseeker_profiles')
        .select('id, first_name, last_name, suffix, email, phone, bio, profile_picture_url, resume_url, preferred_jobs, status, gender, age, address, work_experience_months, nc1_certificate_url, nc2_certificate_url, nc3_certificate_url, nc4_certificate_url, other_certificates')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobseekers(data || []);
    } catch (error) {
      console.error('Error fetching jobseekers:', error);
      showNotification('error', 'Failed to load jobseekers');
    }
  };

  const normalizeNumber = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  };

  // Calculate match score based on certificates and experience
  const calculateMatchScore = (jobseeker, job) => {
    let score = 0;

    // Use jobseeker's actual work experience, not the job's requirement
    const jobseekerExperienceMonths = normalizeNumber(jobseeker.work_experience_months) ?? 0;

    // Add 2 points per month of work experience (e.g., 6 months = 12 points)
    score += jobseekerExperienceMonths * 2;

    // NC Certificate base values (no multiplier)
    const certificateValues = {
      nc1: 10,
      nc2: 20,
      nc3: 30,
      nc4: 40
    };

    if (jobseeker.nc1_certificate_url) score += certificateValues.nc1;
    if (jobseeker.nc2_certificate_url) score += certificateValues.nc2;
    if (jobseeker.nc3_certificate_url) score += certificateValues.nc3;
    if (jobseeker.nc4_certificate_url) score += certificateValues.nc4;

    // Other certificates: 5 points each (no multiplier)
    const otherCertCount = Array.isArray(jobseeker.other_certificates)
      ? jobseeker.other_certificates.length
      : 0;
    if (otherCertCount > 0) {
      score += otherCertCount * 5;
    }

    // Preferred job match bonus
    const jobTitle = (job.position_title || job.title || '').toLowerCase();
    const preferredJobs = Array.isArray(jobseeker.preferred_jobs)
      ? jobseeker.preferred_jobs.map((j) => j.toLowerCase())
      : [];

    if (preferredJobs.some((pref) => pref && (jobTitle.includes(pref) || pref.includes(jobTitle)))) {
      score += 15;
    }

    return Math.round(score);
  };

  // Handle viewing resume
  const handleViewResume = (resumeUrl) => {
    console.log('📄 Viewing resume, URL:', resumeUrl);
    if (!resumeUrl) {
      console.warn('⚠️ No resume URL provided');
      showNotification('error', 'Resume not available for this jobseeker.');
      return;
    }
    setSelectedResumeUrl(resumeUrl);
    setShowResumeModal(true);
    console.log('✅ Resume modal opened');
  };

  const handleViewCertificates = (jobseeker) => {
    setSelectedCertificatesJobseeker(jobseeker);
    setShowCertificatesModal(true);
  };

  // Handle opening refer jobseekers modal for a job
  const handleOpenReferModal = (job) => {
    setSelectedJobForReferral(job);
    fetchJobseekers();
    setShowReferJobseekersModal(true);
  };

  // Handle referring a jobseeker to a job
  const handleReferJobseeker = async (jobseekerId) => {
    if (!selectedJobForReferral || !jobseekerId) {
      showNotification('error', 'Please select a jobseeker');
      return;
    }

    try {
      setIsReferring(jobseekerId);

      // Use RPC function to create/update referred application (bypasses RLS)
      const { data, error } = await supabase.rpc('create_referred_application', {
        p_jobseeker_id: jobseekerId,
        p_job_id: selectedJobForReferral.id,
        p_status: 'referred'
      });

      if (error) {
        console.error('RPC error:', error);
        // Fallback to direct insert/update if RPC fails
        const { data: existingApp } = await supabase
          .from('applications')
          .select('id, status')
          .eq('job_id', selectedJobForReferral.id)
          .eq('jobseeker_id', jobseekerId)
          .maybeSingle();

        if (existingApp) {
          const { error: updateError } = await supabase
            .from('applications')
            .update({ status: 'referred' })
            .eq('id', existingApp.id);

          if (updateError) throw updateError;
          showNotification('success', `✅ Jobseeker referred successfully! (Updated existing application)`);
        } else {
          const { error: insertError } = await supabase
            .from('applications')
            .insert([{
              jobseeker_id: jobseekerId,
              job_id: selectedJobForReferral.id,
              status: 'referred',
              applied_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            }]);

          if (insertError) throw insertError;
          showNotification('success', `✅ Jobseeker referred successfully!`);
        }
      } else {
        // RPC function succeeded
        const action = data?.action || 'created';
        showNotification('success', `✅ Jobseeker referred successfully! (${action === 'updated' ? 'Updated existing application' : 'Created new application'})`);
      }

      // Log activity with admin name
      if (currentUser?.id) {
        // Get admin name
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('first_name, last_name, username, email')
          .eq('id', currentUser.id)
          .maybeSingle();
        
        const adminName = adminProfile 
          ? `${adminProfile.first_name || ''} ${adminProfile.last_name || ''}`.trim() || adminProfile.username || adminProfile.email || 'Admin'
          : 'Admin';
        
        // Get jobseeker name for logging
        const jobseeker = jobseekers.find(js => js.id === jobseekerId);
        const jobseekerName = jobseeker 
          ? `${jobseeker.first_name || ''} ${jobseeker.last_name || ''}`.trim() || jobseeker.email
          : 'Unknown';

        // Fetch employer profile for company name
        let companyName = 'the company';
        if (selectedJobForReferral.employer_id) {
          const { data: employerProfile } = await supabase
            .from('employer_profiles')
            .select('business_name')
            .eq('id', selectedJobForReferral.employer_id)
            .maybeSingle();
          companyName = employerProfile?.business_name || selectedJobForReferral.business_name || 'the company';
        }

        await logActivity({
          userId: currentUser.id,
          userType: adminRole === 'super_admin' ? 'super_admin' : 'admin',
          actionType: 'jobseeker_referred',
          actionDescription: `${adminName} referred ${jobseekerName} to ${selectedJobForReferral.position_title || selectedJobForReferral.title} of ${companyName}`,
          entityType: 'application',
          entityId: null, // Application ID might not be available immediately
          metadata: {
            adminName: adminName,
            jobseekerId: jobseekerId,
            jobseekerName: jobseekerName,
            jobId: selectedJobForReferral.id,
            jobTitle: selectedJobForReferral.position_title || selectedJobForReferral.title,
            companyName: companyName
          }
        });
      }

      // Send SMS and Email notifications to jobseeker (non-blocking)
      try {
        // Get jobseeker profile for phone number and email
        const jobseeker = jobseekers.find(js => js.id === jobseekerId);
        
        // Fetch employer profile for company name
        const { data: employerProfile } = await supabase
          .from('employer_profiles')
          .select('business_name')
          .eq('id', selectedJobForReferral.employer_id)
          .single();

        if (selectedJobForReferral && jobseeker) {
          const jobseekerName = `${jobseeker.first_name || ''} ${jobseeker.last_name || ''}`.trim() || jobseeker.email || 'Jobseeker';
          const companyName = employerProfile?.business_name || 'Company';
          const jobTitle = selectedJobForReferral.position_title || selectedJobForReferral.title || 'Job Vacancy';

          // Send SMS if phone number is available
          if (jobseeker.phone) {
            try {
              await sendApplicationStatusSMS(
                jobseeker.phone,
                jobseekerName,
                jobTitle,
                'referred',
                companyName
              );
              console.log('✅ SMS notification sent to jobseeker for referral');
            } catch (smsError) {
              console.error('⚠️ Failed to send SMS notification (non-critical):', smsError);
            }
          }

          // Send Email if email is available
          if (jobseeker.email) {
            try {
              await sendApplicationStatusEmail(
                jobseeker.email,
                jobseekerName,
                jobTitle,
                'referred',
                companyName
              );
              console.log('✅ Email notification sent to jobseeker for referral');
            } catch (emailError) {
              console.error('⚠️ Failed to send email notification (non-critical):', emailError);
            }
          }
        } else {
          console.log('⚠️ Notifications not sent - missing jobseeker or job data', {
            hasJobseeker: !!jobseeker,
            hasJob: !!selectedJobForReferral
          });
        }
      } catch (notificationError) {
        // Notification failures should not block the main action
        console.error('⚠️ Failed to send notifications (non-critical):', notificationError);
      }

      // Refresh applications and jobseekers
      await fetchApplications();
      await fetchJobseekers();
      
    } catch (error) {
      console.error('Error referring jobseeker:', error);
      showNotification('error', `Failed to refer jobseeker: ${error.message}`);
    } finally {
      setIsReferring(null);
    }
  };

  // Handle canceling a referral
  const handleCancelReferral = async (jobseekerId) => {
    if (!selectedJobForReferral || !jobseekerId) {
      showNotification('error', 'Unable to cancel referral');
      return;
    }

    try {
      setIsCancelingReferral(jobseekerId);

      // Find the existing application
      const { data: existingApp, error: fetchError } = await supabase
        .from('applications')
        .select('id, status')
        .eq('job_id', selectedJobForReferral.id)
        .eq('jobseeker_id', jobseekerId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!existingApp) {
        showNotification('error', 'Application not found');
        return;
      }

      // Delete the application entirely since it was a referral, not a real application
      // This ensures it doesn't appear in jobseeker's "Applied & Referred" section
      const { error: deleteError } = await supabase
        .from('applications')
        .delete()
        .eq('id', existingApp.id);

      if (deleteError) throw deleteError;

      showNotification('success', '✅ Referral canceled successfully!');

      // Log activity with admin name
      if (currentUser?.id) {
        // Get admin name
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('first_name, last_name, username, email')
          .eq('id', currentUser.id)
          .maybeSingle();
        
        const adminName = adminProfile 
          ? `${adminProfile.first_name || ''} ${adminProfile.last_name || ''}`.trim() || adminProfile.username || adminProfile.email || 'Admin'
          : 'Admin';
        
        const jobseeker = jobseekers.find(js => js.id === jobseekerId);
        const jobseekerName = jobseeker 
          ? `${jobseeker.first_name || ''} ${jobseeker.last_name || ''}`.trim() || jobseeker.email
          : 'Unknown';

        // Fetch employer profile for company name
        let companyName = 'the company';
        if (selectedJobForReferral.employer_id) {
          const { data: employerProfile } = await supabase
            .from('employer_profiles')
            .select('business_name')
            .eq('id', selectedJobForReferral.employer_id)
            .maybeSingle();
          companyName = employerProfile?.business_name || selectedJobForReferral.business_name || 'the company';
        }

        await logActivity({
          userId: currentUser.id,
          userType: adminRole === 'super_admin' ? 'super_admin' : 'admin',
          actionType: 'referral_canceled',
          actionDescription: `${adminName} canceled referral for ${jobseekerName} from ${selectedJobForReferral.position_title || selectedJobForReferral.title} of ${companyName}`,
          entityType: 'application',
          entityId: existingApp.id,
          metadata: {
            adminName: adminName,
            jobseekerId: jobseekerId,
            jobseekerName: jobseekerName,
            jobId: selectedJobForReferral.id,
            jobTitle: selectedJobForReferral.position_title || selectedJobForReferral.title,
            companyName: companyName
          }
        });
      }

      // Refresh applications and jobseekers
      await fetchApplications();
      await fetchJobseekers();
      
    } catch (error) {
      console.error('Error canceling referral:', error);
      showNotification('error', `Failed to cancel referral: ${error.message}`);
    } finally {
      setIsCancelingReferral(null);
    }
  };

  // Render refer jobseeker tab - styled like employer manage jobs
  const renderReferJobseeker = () => {
    if (loading) {
      return (
        <div className="job-management-simplified">
          <div className="loading-screen">
            <div className="loading-spinner"></div>
            <p>Loading jobs...</p>
          </div>
        </div>
      );
    }

    const hasJobs = filteredReferJobs.length > 0;

    return (
      <div className="tab-content">
        <h2>👤 Refer Jobseeker to Job Vacancy</h2>
        {renderReferFilters()}
        {hasJobs ? (
          <div className="jobs-list">
          {filteredReferJobs.map((job) => {
            const jobApplications = applicationsByJob.get(job.id) || [];
            const referredApplications = jobApplications.filter((app) => normalize(app.status) === 'referred');

            return (
              <div
                key={job.id}
                className="job-item clickable-job-item"
                onClick={() => handleOpenReferModal(job)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenReferModal(job);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="job-item-header">
                  <div className="job-item-logo">
                    {job.company_logo_url ? (
                      <img src={job.company_logo_url} alt={`${job.business_name || 'Company'} logo`} />
                    ) : (
                      <span className="job-logo-placeholder">🏢</span>
                    )}
                  </div>
                  <h3>{job.title || job.position_title}</h3>
                  <span className="job-status-badge status-approved">Approved</span>
                </div>

                <div className="job-details-grid">
                  <div className="job-detail-item">
                    <span className="job-detail-label">🏢 Company:</span>
                    <span className="job-detail-value">{job.business_name || 'Not specified'}</span>
                  </div>
                  <div className="job-detail-item">
                    <span className="job-detail-label">📍 Location:</span>
                    <span className="job-detail-value">
                      {job.location || job.place_of_work || 'Not specified'}
                    </span>
                  </div>
                  <div className="job-detail-item">
                    <span className="job-detail-label">💼 Nature of Work:</span>
                    <span className="job-detail-value">{job.nature_of_work || job.job_type || 'Not specified'}</span>
                  </div>
                  <div className="job-detail-item">
                    <span className="job-detail-label">💰 Salary:</span>
                    <span className="job-detail-value">
                      {job.salary_range ? `₱${job.salary_range}` : job.salary ? `₱${job.salary}` : 'Not specified'}
                    </span>
                  </div>
                  <div className="job-detail-item">
                    <span className="job-detail-label">📋 Vacancies:</span>
                    <span className="job-detail-value">{job.vacancy_count || 'Not specified'}</span>
                  </div>
                  <div className="job-detail-item">
                    <span className="job-detail-label">📅 Posted:</span>
                    <span className="job-detail-value">
                      {new Date(job.created_at || job.posting_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  {job.valid_from && (
                    <div className="job-detail-item">
                      <span className="job-detail-label">📆 Valid From:</span>
                      <span className="job-detail-value">
                        {new Date(job.valid_from).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  {job.valid_until && (
                    <div className="job-detail-item">
                      <span className="job-detail-label">⏰ Valid Until:</span>
                      <span className="job-detail-value">
                        {new Date(job.valid_until).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <p className="job-description-text">
                  {job.description || job.job_description || 'No description available.'}
                </p>

                <div className="job-meta">
                  <span className="applications-count">
                    👤 {referredApplications.length} Referred
                  </span>
                  {(() => {
                    const placedCount = getPlacedCount(job.id);
                    const vacancyCount = Number(job.vacancy_count || job.total_positions || 0);
                    const placedDisplay = vacancyCount > 0 
                      ? `${placedCount}/${vacancyCount} Placed` 
                      : placedCount > 0 
                        ? `${placedCount} Placed` 
                        : '0 Placed';
                    
                    return placedCount > 0 || vacancyCount > 0 ? (
                      <span className="placed-count" title={`${placedCount} jobseeker(s) placed/hired`}>
                        🎉 {placedDisplay}
                      </span>
                    ) : null;
                  })()}
                </div>

                <div className="job-item-action-hint">Click to refer jobseekers →</div>
              </div>
            );
          })}
          </div>
        ) : (
          <div className="no-jobs">
            <div className="no-jobs-icon">📋</div>
            <h3>No Approved Jobs</h3>
            <p>No approved job vacancies match the current filters.</p>
          </div>
        )}
      </div>
    );
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);

      // Step 1: Get list of existing employer IDs
      const { data: employerRows, error: employerErr } = await supabase
        .from('employer_profiles')
        .select('id');
      if (employerErr) throw employerErr;
      const existingEmployerIds = (employerRows || []).map((r) => r.id).filter(Boolean);

      // If no employers exist, return empty job lists early
      if (!existingEmployerIds.length) {
        setPendingJobs([]);
        setApprovedJobs([]);
        setRejectedJobs([]);
        setLoading(false);
        return;
      }

      const [pendingResult, approvedResult] = await Promise.all([
        supabase
          .from('jobvacancypending')
          .select('*')
          .in('employer_id', existingEmployerIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('*')
          .in('employer_id', existingEmployerIds)
          .order('created_at', { ascending: false })
      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (approvedResult.error) throw approvedResult.error;

      const pendingRows = pendingResult.data || [];
      const approvedRows = approvedResult.data || [];

      const employerIds = new Set();
      pendingRows.forEach((job) => {
        if (job.employer_id) employerIds.add(job.employer_id);
      });
      approvedRows.forEach((job) => {
        if (job.employer_id) employerIds.add(job.employer_id);
      });

      let employerMap = {};
      if (employerIds.size) {
        const { data: employerData, error: employerError } = await supabase
          .from('employer_profiles')
          .select('id, business_name, company_logo_url')
          .in('id', Array.from(employerIds));

        if (employerError) {
          console.error('Error fetching employers:', employerError);
        } else {
          employerMap = Object.fromEntries(
            (employerData || []).map((emp) => [
              emp.id,
              {
                business_name: emp.business_name,
                company_logo_url: emp.company_logo_url
              }
            ])
          );
          console.log(`✅ Loaded ${Object.keys(employerMap).length} employers for ${employerIds.size} unique employer IDs`);
        }
      } else {
        console.log('⚠️ No employer IDs found in jobs');
      }

      // Filter out jobs from deleted employers
      // ONLY include jobs where the employer_id exists AND the employer still exists in employer_profiles
      const pendingList = [];
      const rejectedList = [];
      
      for (const job of pendingRows) {
        const status = (job.status || 'pending').toLowerCase();
        
        // STRICT: Only include jobs with a valid employer_id that exists in employerMap
        if (!job.employer_id) {
          console.log(`Skipping job ${job.id} - no employer_id`);
          continue;
        }
        
        if (!employerMap[job.employer_id]) {
          console.log(`Skipping job ${job.id} - employer ${job.employer_id} has been deleted`);
          continue;
        }
        
        const jobWithEmployer = {
          ...job,
          business_name: employerMap[job.employer_id]?.business_name || 'Company Name Not Provided',
          company_logo_url:
            job.employer_profiles?.company_logo_url ||
            job.company_logo_url ||
            employerMap[job.employer_id]?.company_logo_url ||
            null
        };
        
        if (status === 'pending') {
          pendingList.push(jobWithEmployer);
        } else if (status === 'rejected') {
          rejectedList.push(jobWithEmployer);
        }
      }
 
      const approvedList = [];
      const archivedList = [];
      
      for (const job of approvedRows) {
        const status = (job.status || '').toLowerCase();
        if (status !== 'approved' && status !== 'active') continue;
        
        // STRICT: Only include jobs with a valid employer_id that exists in employerMap
        if (!job.employer_id) {
          console.log(`Skipping job ${job.id} - no employer_id`);
          continue;
        }
        
        if (!employerMap[job.employer_id]) {
          console.log(`Skipping job ${job.id} - employer ${job.employer_id} has been deleted`);
          continue;
        }
        
        const jobWithEmployer = {
          ...job,
          business_name: employerMap[job.employer_id]?.business_name || 'Company Name Not Provided',
          company_logo_url:
            job.employer_profiles?.company_logo_url ||
            job.company_logo_url ||
            employerMap[job.employer_id]?.company_logo_url ||
            null
        };
        
        approvedList.push(jobWithEmployer);
      }

      console.log(`📊 Filtered results: ${pendingList.length} pending, ${approvedList.length} approved, ${rejectedList.length} rejected jobs`);
      
      setPendingJobs(pendingList);
      setApprovedJobs(approvedList);
      setRejectedJobs(rejectedList);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      showNotification('error', `Failed to load jobs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle notification click - open job details modal
  const handleNotificationClick = useCallback((notification) => {
    const notificationData = notification?.data;
    if (!notificationData) {
      console.warn('⚠️ Notification has no data:', notification);
      return;
    }

    // Extract job ID from notification data
    // Admin notifications come from jobvacancypending table (pending jobs only)
    const jobId = notificationData.id || notificationData.job_id;
    
    if (!jobId) {
      console.warn('⚠️ Notification has no job ID:', notificationData);
      return;
    }

    console.log('📋 Admin notification clicked for job:', jobId);

    // Admin notifications are for pending jobs, so check pendingJobs first
    let foundJob = pendingJobs.find(j => j.id === jobId);
    let jobType = 'pending';

    // If not found in pending, check approvedJobs (in case it was just approved)
    if (!foundJob) {
      foundJob = approvedJobs.find(j => j.id === jobId);
      jobType = 'approved';
    }

    if (foundJob) {
      // Job found, switch to appropriate tab and open modal
      setActiveTab(jobType === 'pending' ? 'pending' : 'approved');
      handleViewJob(foundJob, jobType);
    } else {
      // Job not found, refetch jobs and retry
      console.log('🔄 Job not found in current list, refetching...');
      fetchJobs().then(() => {
        // Wait a bit for state to update, then retry
        setTimeout(() => {
          // Use the updated state after fetchJobs completes
          // We need to access the latest state, so we'll query directly
          console.log('🔍 Querying database directly for job:', jobId);
          
          // Try jobvacancypending first (pending jobs)
          supabase
            .from('jobvacancypending')
            .select('*')
            .eq('id', jobId)
            .single()
            .then(({ data, error }) => {
              if (!error && data) {
                setActiveTab('pending');
                handleViewJob(data, 'pending');
              } else {
                // Try jobs table (approved jobs)
                supabase
                  .from('jobs')
                  .select('*')
                  .eq('id', jobId)
                  .single()
                  .then(({ data: jobData, error: jobError }) => {
                    if (!jobError && jobData) {
                      setActiveTab('approved');
                      handleViewJob(jobData, 'approved');
                    } else {
                      console.error('❌ Job not found in database:', jobId);
                      showNotification('error', 'Job not found. It may have been deleted.');
                    }
                  });
              }
            });
        }, 500);
      });
    }
  }, [pendingJobs, approvedJobs]);

  const sanitizeText = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const sanitizeArray = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) {
      const cleaned = value.map((entry) => (typeof entry === 'string' ? entry.trim() : entry)).filter(Boolean);
      return cleaned.length ? cleaned : null;
    }
    if (typeof value === 'string') {
      const parsed = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      return parsed.length ? parsed : null;
    }
    return null;
  };

  const sanitizeNumber = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleApproveJob = async (job) => {
    try {
      console.log('✅ Approving job:', job);

      const pwdTypes = sanitizeArray(job.pwd_types);
      // Set posting_date to current date when admin approves (this is when the job is actually posted)
      const postingDate = new Date().toISOString().slice(0, 10);

      const approvedJobData = {
        id: job.id,
        employer_id: job.employer_id,
        posted_by: job.employer_id,
        salary_range: sanitizeText(job.salary_range),
        status: 'approved',
        nature_of_work: sanitizeText(job.nature_of_work),
        vacancy_count: sanitizeNumber(job.vacancy_count),
        work_experience_months: sanitizeNumber(job.work_experience_months),
        other_qualifications: sanitizeText(job.other_qualifications),
        educational_level: sanitizeText(job.educational_level),
        course_shs_strand: sanitizeText(job.course_shs_strand),
        license: sanitizeText(job.license),
        eligibility: sanitizeText(job.eligibility),
        certification: sanitizeText(job.certification),
        language_dialect: sanitizeText(job.language_dialect),
        accepts_pwd: sanitizeText(job.accepts_pwd),
        pwd_types: pwdTypes,
        pwd_others_specify: sanitizeText(job.pwd_others_specify),
        accepts_ofw: sanitizeText(job.accepts_ofw),
        posting_date: postingDate,
        valid_from: job.valid_from || null,
        valid_until: job.valid_until || null,
        position_title: sanitizeText(job.position_title),
        job_description: sanitizeText(job.job_description) || sanitizeText(job.description),
        place_of_work: sanitizeText(job.place_of_work || job.job_location),
        created_at: job.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: insertData, error: insertError } = await supabase
        .from('jobs')
        .upsert([approvedJobData], { onConflict: 'id' })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('✅ Job approved and inserted:', insertData);

      const { error: updateError } = await supabase
        .from('jobvacancypending')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUser?.id || null,
          review_notes: null
        })
        .eq('id', job.id);

      if (updateError) throw updateError;
 
      // Create notification for employer
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          employer_id: job.employer_id,
          type: 'job_approved',
          title: 'Job Vacancy Approved',
          message: `Your job vacancy for "${job.position_title}" has been approved and is now live!`,
          job_id: insertData?.id,
          is_read: false,
          created_at: new Date().toISOString()
        }])
        .select();

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
      } else {
        console.log('✅ Notification created:', notificationData);
      }

      // Send SMS and Email notifications to employer (non-blocking)
      try {
        // Fetch employer profile
        const { data: employerProfile } = await supabase
          .from('employer_profiles')
          .select('mobile_number, email, contact_email, business_name, contact_person_name')
          .eq('id', job.employer_id)
          .single();

        if (employerProfile) {
          const employerName = employerProfile.contact_person_name || employerProfile.business_name || 'Employer';
          const jobTitle = job.position_title || job.title || 'Job Vacancy';
          const employerEmail = employerProfile.contact_email || employerProfile.email;

          // Send SMS if mobile number is available
          if (employerProfile.mobile_number) {
            sendJobApprovalSMS(
              employerProfile.mobile_number,
              employerName,
              jobTitle,
              'approved'
            ).then(() => {
              console.log('✅ SMS notification sent to employer');
            }).catch((smsError) => {
              console.error('⚠️ Failed to send SMS notification (non-critical):', smsError);
            });
          }

          // Send Email if email is available
          if (employerEmail) {
            sendJobApprovalEmail(
              employerEmail,
              employerName,
              jobTitle,
              'approved'
            ).then(() => {
              console.log('✅ Email notification sent to employer');
            }).catch((emailError) => {
              console.error('⚠️ Failed to send email notification (non-critical):', emailError);
            });
          }
        }
      } catch (notificationError) {
        // Notification failures should not block the main action
        console.error('⚠️ Failed to send notifications (non-critical):', notificationError);
      }

      // Log activity with admin name
      if (currentUser?.id) {
        // Get admin name
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('first_name, last_name, username, email')
          .eq('id', currentUser.id)
          .maybeSingle();
        
        const adminName = adminProfile 
          ? `${adminProfile.first_name || ''} ${adminProfile.last_name || ''}`.trim() || adminProfile.username || adminProfile.email || 'Admin'
          : 'Admin';

        // Fetch employer profile for company name
        let companyName = 'the company';
        if (job.employer_id) {
          const { data: employerProfile } = await supabase
            .from('employer_profiles')
            .select('business_name')
            .eq('id', job.employer_id)
            .maybeSingle();
          companyName = employerProfile?.business_name || job.business_name || 'the company';
        }

        await logActivity({
          userId: currentUser.id,
          userType: adminRole === 'super_admin' ? 'super_admin' : 'admin',
          actionType: 'job_approved',
          actionDescription: `${adminName} approved ${job.position_title || job.title || 'job vacancy'} of ${companyName}`,
          entityType: 'job',
          entityId: insertData?.id || job.id,
          metadata: {
            adminName: adminName,
            jobTitle: job.position_title,
            employerId: job.employer_id,
            vacancyCount: job.vacancy_count,
            companyName: companyName
          }
        });
      }

      // Refresh jobs
      setTimeout(() => {
        fetchJobs();
      }, 500);

      showNotification('success', '✅ Job vacancy approved successfully!');
      
    } catch (error) {
      console.error('Error approving job:', error);
      showNotification('error', `❌ Error approving job: ${error.message}`);
    }
  };

  const handleRejectJob = async (job, reason) => {
    if (!job?.id) {
      showNotification('error', 'Unable to reject job: missing job information.');
      return false;
    }

    const rejectionNote = sanitizeText(reason);
    if (!rejectionNote) {
      showNotification('error', 'Please provide a note before rejecting the job.');
      return false;
    }

    try {
      const timestamp = new Date().toISOString();

      const { error } = await supabase
        .from('jobvacancypending')
        .update({
          status: 'rejected',
          updated_at: timestamp,
          reviewed_at: timestamp,
          reviewed_by: currentUser?.id || null,
          review_notes: rejectionNote
        })
        .eq('id', job.id);

      if (error) throw error;

      if (job.employer_id) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert([{
            employer_id: job.employer_id,
            type: 'job_rejected',
            title: 'Job Vacancy Rejected',
            message: rejectionNote
              ? `Your job vacancy for "${job.position_title || job.title || 'Job'}" was rejected. Reason: ${rejectionNote}`
              : `Your job vacancy for "${job.position_title || job.title || 'Job'}" was rejected. Please review and resubmit.`,
            job_id: job.id,
            is_read: false,
            created_at: timestamp
          }]);

        if (notificationError) {
          console.error('Error creating rejection notification:', notificationError);
        }
      }

      // Send SMS and Email notifications to employer (non-blocking)
      try {
        // Fetch employer profile
        const { data: employerProfile } = await supabase
          .from('employer_profiles')
          .select('mobile_number, email, contact_email, business_name, contact_person_name')
          .eq('id', job.employer_id)
          .single();

        if (employerProfile) {
          const employerName = employerProfile.contact_person_name || employerProfile.business_name || 'Employer';
          const jobTitle = job.position_title || job.title || 'Job Vacancy';
          const employerEmail = employerProfile.contact_email || employerProfile.email;

          // Send SMS if mobile number is available
          if (employerProfile.mobile_number) {
            sendJobApprovalSMS(
              employerProfile.mobile_number,
              employerName,
              jobTitle,
              'rejected',
              rejectionNote
            ).then(() => {
              console.log('✅ SMS notification sent to employer for rejection');
            }).catch((smsError) => {
              console.error('⚠️ Failed to send SMS notification (non-critical):', smsError);
            });
          }

          // Send Email if email is available
          if (employerEmail) {
            sendJobApprovalEmail(
              employerEmail,
              employerName,
              jobTitle,
              'rejected',
              rejectionNote
            ).then(() => {
              console.log('✅ Email notification sent to employer for rejection');
            }).catch((emailError) => {
              console.error('⚠️ Failed to send email notification (non-critical):', emailError);
            });
          }
        }
      } catch (notificationError) {
        // Notification failures should not block the main action
        console.error('⚠️ Failed to send notifications (non-critical):', notificationError);
      }

      if (currentUser?.id) {
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('first_name, last_name, username, email')
          .eq('id', currentUser.id)
          .maybeSingle();

        const adminName = adminProfile
          ? `${adminProfile.first_name || ''} ${adminProfile.last_name || ''}`.trim() ||
            adminProfile.username ||
            adminProfile.email ||
            'Admin'
          : 'Admin';

        let companyName = job.business_name || 'the company';
        if (job.employer_id) {
          const { data: employerProfile } = await supabase
            .from('employer_profiles')
            .select('business_name')
            .eq('id', job.employer_id)
            .maybeSingle();
          companyName = employerProfile?.business_name || companyName;
        }

        await logActivity({
          userId: currentUser.id,
          userType: adminRole === 'super_admin' ? 'super_admin' : 'admin',
          actionType: 'job_rejected',
          actionDescription: `${adminName} rejected ${job.position_title || job.title || 'a job vacancy'} of ${companyName}`,
          entityType: 'job',
          entityId: job.id,
          metadata: {
            adminName,
            jobTitle: job.position_title || job.title,
            employerId: job.employer_id,
            vacancyCount: job.vacancy_count,
            companyName,
            rejectionReason: rejectionNote
          }
        });
      }

      await fetchJobs();
      showNotification('success', '❌ Job vacancy rejected.');
      return true;
    } catch (rejectError) {
      console.error('Error rejecting job:', rejectError);
      showNotification('error', `Failed to reject job: ${rejectError.message}`);
      return false;
    }
  };

  const openRejectModal = (job) => {
    setJobToReject(job);
    setRejectReason(job.review_notes || '');
    setShowRejectModal(true);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setJobToReject(null);
    setRejectReason('');
    setIsRejecting(false);
  };

  const handleRejectModalSubmit = async () => {
    if (!jobToReject) return;
    if (!rejectReason.trim()) {
      showNotification('error', 'Please add a rejection note before submitting.');
      return;
    }
    setIsRejecting(true);
    const success = await handleRejectJob(jobToReject, rejectReason);
    setIsRejecting(false);
    if (success) {
      closeRejectModal();
    }
  };

  const handleViewJob = (job, jobType) => {
    setSelectedJob({ ...job, jobType });
    setShowJobModal(true);
    // Fetch applicants for this job
    if (job.id) {
      fetchJobApplicants(job.id);
    }
  };

  const handleEditJob = (job) => {
    console.log('✏️ Opening edit modal for job:', job);
    setSelectedJob(job);
    setEditForm({
      position_title: job.position_title || '',
      job_description: job.job_description || '',
      nature_of_work: job.nature_of_work || '',
      place_of_work: job.place_of_work || '',
      salary_range: job.salary_range || '',
      vacancy_count: job.vacancy_count || '',
      work_experience_months: job.work_experience_months || '',
      educational_level: job.educational_level || '',
      course_shs_strand: job.course_shs_strand || '',
      license: job.license || '',
      eligibility: job.eligibility || '',
      certification: job.certification || '',
      language_dialect: job.language_dialect || '',
      other_qualifications: job.other_qualifications || '',
      accepts_pwd: job.accepts_pwd || 'No',
      pwd_types: job.pwd_types || [],
      pwd_others_specify: job.pwd_others_specify || '',
      accepts_ofw: job.accepts_ofw || 'No',
      posting_date: job.posting_date || '',
      valid_from: job.valid_from || '',
      valid_until: job.valid_until || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateJob = async () => {
    try {
      setIsUpdating(true);
      console.log('🔄 Updating job:', selectedJob.id, 'with data:', editForm);
      
      const { error } = await supabase
        .from('jobvacancypending')
        .update(editForm)
        .eq('id', selectedJob.id);

      if (error) throw error;

      console.log('✅ Job updated successfully');
      
      // Close modal and refresh data
      setShowEditModal(false);
      setSelectedJob(null);
      await fetchJobs();
      
      showNotification('success', '✅ Job updated successfully!');
      
    } catch (error) {
      console.error('❌ Error updating job:', error);
      showNotification('error', `❌ Failed to update job: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Notification system
  const showNotification = (type, message) => {
    setNotification({ type, message, show: true });
    // Auto-hide after 4 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  const renderJobFilters = (showStatusFilter = true) => (
    <div className={`job-filter-toolbar ${showStatusFilter ? '' : 'without-status'}`}>
      <div className="filter-group search">
        <span className="filter-icon">🔍</span>
        <input
          type="text"
          className="filter-input"
          placeholder="Search jobs by company, title, or location"
          value={jobSearchTerm}
          onChange={(e) => setJobSearchTerm(e.target.value)}
        />
        {jobSearchTerm ? (
          <button className="filter-clear" onClick={() => setJobSearchTerm('')} title="Clear search">
            ✕
          </button>
        ) : null}
      </div>

      {showStatusFilter && (
        <div className="filter-group">
          <label>Status</label>
          <select value={jobStatusFilter} onChange={(e) => setJobStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {jobStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="filter-group">
        <label>Nature of Work</label>
        <select value={jobTypeFilter} onChange={(e) => setJobTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {NATURE_OF_WORK_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {(jobSearchTerm || (showStatusFilter && jobStatusFilter !== 'all') || jobTypeFilter !== 'all') && (
        <button
          className="filter-reset"
          onClick={() => {
            setJobSearchTerm('');
            setJobStatusFilter('all');
            setJobTypeFilter('all');
          }}
        >
          Clear Filters
        </button>
      )}
    </div>
  );

  const renderReferFilters = () => (
    <div className="job-filter-toolbar">
      <div className="filter-group search">
        <span className="filter-icon">🔍</span>
        <input
          type="text"
          className="filter-input"
          placeholder="Search approved jobs..."
          value={referSearchTerm}
          onChange={(e) => setReferSearchTerm(e.target.value)}
        />
        {referSearchTerm ? (
          <button className="filter-clear" onClick={() => setReferSearchTerm('')} title="Clear search">
            ✕
          </button>
        ) : null}
      </div>

      <div className="filter-group">
        <label>Referral Status</label>
        <select value={referStatusFilter} onChange={(e) => setReferStatusFilter(e.target.value)}>
          {referStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {(referSearchTerm || referStatusFilter !== 'all') && (
        <button
          className="filter-reset"
          onClick={() => {
            setReferSearchTerm('');
            setReferStatusFilter('all');
          }}
        >
          Clear Filters
        </button>
      )}
    </div>
  );

  const renderPendingJobs = () => {
    const hasJobs = filteredPendingJobs.length > 0;

    return (
      <>
        {renderJobFilters(false)}
        {hasJobs ? (
          <div className="table-wrapper">
            <table className="jobs-table pending">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Position</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Vacancies</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPendingJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        {job.company_logo_url && (
                          <img src={job.company_logo_url} alt="logo" style={{width:28,height:28,borderRadius:4,objectFit:'cover'}} />
                        )}
                        <span>{job.business_name || 'Company Name Not Provided'}</span>
                      </div>
                    </td>
                    <td>{job.position_title}</td>
                    <td>{job.place_of_work}</td>
                    <td>{job.nature_of_work}</td>
                    <td>{job.vacancy_count}</td>
                    <td><span className="status-badge pending">Pending</span></td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <button className="btn-quick view" onClick={() => handleViewJob(job, 'pending')}>View</button>
                      <button className="btn-danger" onClick={() => openRejectModal(job)}>Reject</button>
                      <button className="btn-primary" onClick={() => handleApproveJob(job)}>Approve</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-jobs">
            <div className="no-jobs-icon">📋</div>
            <h3>No Pending Jobs</h3>
            <p>Try adjusting your filters or refresh the list.</p>
          </div>
        )}
      </>
    );
  };

  const renderApprovedJobs = () => {
    const hasJobs = filteredActiveApprovedJobs.length > 0;

    return (
      <>
        {renderJobFilters(false)}
        {hasJobs ? (
          <div className="table-wrapper">
            <table className="jobs-table approved">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Position</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Vacancies</th>
                  <th>Placed</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredActiveApprovedJobs.map((job) => {
                  const placedCount = getPlacedCount(job.id);
                  const vacancyCount = Number(job.vacancy_count || job.total_positions || 0);
                  const placedDisplay = vacancyCount > 0 
                    ? `${placedCount}/${vacancyCount}` 
                    : placedCount > 0 
                      ? `${placedCount}` 
                      : '0';
                  
                  return (
                    <tr key={job.id}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          {job.company_logo_url && (
                            <img src={job.company_logo_url} alt="logo" style={{width:28,height:28,borderRadius:4,objectFit:'cover'}} />
                          )}
                          <span>{job.business_name || 'Company Name Not Provided'}</span>
                        </div>
                      </td>
                      <td>{job.title || job.position_title}</td>
                      <td>{job.location || job.place_of_work}</td>
                      <td>{job.job_type || job.nature_of_work}</td>
                      <td>{job.vacancy_count || job.total_positions || '—'}</td>
                      <td>
                        <span className="placed-count-badge" title={`${placedCount} jobseeker(s) placed/hired`}>
                          🎉 {placedDisplay}
                        </span>
                      </td>
                      <td><span className="status-badge approved">Approved</span></td>
                      <td style={{whiteSpace:'nowrap'}}>
                        <button className="btn-secondary" onClick={() => handleViewJob(job, 'approved')}>View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-jobs">
            <div className="no-jobs-icon">✅</div>
            <h3>No Approved Jobs</h3>
            <p>Try adjusting your filters or refresh the list.</p>
          </div>
        )}
      </>
    );
  };

  const renderRejectedJobs = () => {
    const hasJobs = filteredRejectedJobs.length > 0;

    return (
      <>
        {renderJobFilters(false)}
        {hasJobs ? (
          <div className="table-wrapper">
            <table className="jobs-table rejected">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Position</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Vacancies</th>
                  <th>Status</th>
                  <th>Rejection Note</th>
                  <th>Rejected Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRejectedJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        {job.company_logo_url && (
                          <img src={job.company_logo_url} alt="logo" style={{width:28,height:28,borderRadius:4,objectFit:'cover'}} />
                        )}
                        <span>{job.business_name || 'Company Name Not Provided'}</span>
                      </div>
                    </td>
                    <td>{job.position_title || job.title}</td>
                    <td>{job.place_of_work || job.location}</td>
                    <td>{job.nature_of_work || job.job_type}</td>
                    <td>{job.vacancy_count || '—'}</td>
                    <td><span className="status-badge rejected">Rejected</span></td>
                    <td>{job.review_notes || '—'}</td>
                    <td>
                      {job.reviewed_at 
                        ? new Date(job.reviewed_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : '—'}
                    </td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <button className="btn-quick view" onClick={() => handleViewJob(job, 'rejected')}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-jobs">
            <div className="no-jobs-icon">❌</div>
            <h3>No Rejected Jobs</h3>
            <p>No rejected job vacancies found.</p>
          </div>
        )}
      </>
    );
  };

  const renderArchivedJobs = () => {
    const hasJobs = filteredArchivedJobs.length > 0;

    return (
      <>
        {renderJobFilters(false)}
        {hasJobs ? (
          <div className="table-wrapper">
            <table className="jobs-table archived">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Position</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Vacancies</th>
                  <th>Placed</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchivedJobs.map((job) => {
                  const placedCount = getPlacedCount(job.id);
                  const vacancyCount = Number(job.vacancy_count || job.total_positions || 0);
                  const placedDisplay = vacancyCount > 0 
                    ? `${placedCount}/${vacancyCount}` 
                    : placedCount > 0 
                      ? `${placedCount}` 
                      : '0';
                  
                  return (
                    <tr key={job.id}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          {job.company_logo_url && (
                            <img src={job.company_logo_url} alt="logo" style={{width:28,height:28,borderRadius:4,objectFit:'cover'}} />
                          )}
                          <span>{job.business_name || 'Company Name Not Provided'}</span>
                        </div>
                      </td>
                      <td>{job.title || job.position_title}</td>
                      <td>{job.location || job.place_of_work}</td>
                      <td>{job.job_type || job.nature_of_work}</td>
                      <td>{job.vacancy_count || job.total_positions || '—'}</td>
                      <td>
                        <span className="placed-count-badge" title={`${placedCount} jobseeker(s) placed/hired`}>
                          🎉 {placedDisplay}
                        </span>
                      </td>
                      <td><span className="status-badge archived">Archived</span></td>
                      <td style={{whiteSpace:'nowrap'}}>
                        <button className="btn-secondary" onClick={() => handleViewJob(job, 'archived')}>View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-jobs">
            <div className="no-jobs-icon">📦</div>
            <h3>No Archived Jobs</h3>
            <p>No completed job placements found. Jobs are archived when all positions are filled.</p>
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="job-management-simplified">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading job management...</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getYesNoLabel = (value) => {
    const normalized = (value || '').toString().trim().toLowerCase();
    if (normalized === 'yes' || normalized === 'true') return 'Yes';
    if (normalized === 'no' || normalized === 'false') return 'No';
    return 'Not specified';
  };

  const getPwdTypesList = (types, other) => {
    const list = Array.isArray(types) ? types.filter(Boolean) : [];
    if (other) {
      list.push(other);
    }
    return list;
  };

  return (
    <div className="job-management">
      {/* Notification */}
      {notification && notification.show && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">
            <span className="notification-message">{notification.message}</span>
            <button 
              className="notification-close"
              onClick={hideNotification}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header - Matching Admin Dashboard */}
      <div className="job-management-header">
        <div className="header-content">
          <div className="header-left">
            <h1>💼 Job Management</h1>
            <p>Manage job vacancies from verified employers.</p>
          </div>
          <div className="header-right">
                  <NotificationButton
                    notifications={realtimeNotifications}
                    unreadCount={unreadCount}
                    onMarkAsRead={markAsRead}
                    onMarkAllAsRead={markAllAsRead}
                    onNotificationClick={handleNotificationClick}
                  />
            <button 
              className="back-btn"
              onClick={() => {
                const host = typeof window !== 'undefined' ? window.location.hostname : '';
                navigate(host.startsWith('admin.') ? '/dashboard' : '/admin/dashboard');
              }}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="job-management-main">
        {/* Tabs */}
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            ⏳ Pending Job Vacancy
          </button>
          <button 
            className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            ✅ Approved Job Vacancy
          </button>
          <button 
            className={`tab ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('rejected')}
          >
            ❌ Rejected Job Vacancy
          </button>
          <button 
            className={`tab ${activeTab === 'archived' ? 'active' : ''}`}
            onClick={() => setActiveTab('archived')}
          >
            📦 Archived (Complete Job Placement)
          </button>
          <button 
            className={`tab ${activeTab === 'refer' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('refer');
              fetchJobseekers();
            }}
          >
            👤 Refer Jobseeker
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'pending' && renderPendingJobs()}
          {activeTab === 'approved' && renderApprovedJobs()}
          {activeTab === 'rejected' && renderRejectedJobs()}
          {activeTab === 'archived' && renderArchivedJobs()}
          {activeTab === 'refer' && renderReferJobseeker()}
        </div>
      </div>

      {/* Job Details Modal - Admin Friendly Design */}
      {showJobModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowJobModal(false)}>
          <div className="modal-content admin-job-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header admin-header">
              <div className="header-info">
                <h2>📋 Job Vacancy Details</h2>
                <div className="job-status-badge">
                  {selectedJob.jobType === 'pending' ? (
                    <span className="status-pending">⏳ PENDING REVIEW</span>
                  ) : (
                    <span className="status-approved">✅ APPROVED</span>
                  )}
                </div>
              </div>
              <button 
                className="close-modal-btn"
                onClick={() => setShowJobModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body admin-body">
              {/* Company & Basic Info Section */}
              <div className="admin-section company-section">
                <div className="section-header">
                  <h3>🏢 Company Information</h3>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Company Name</label>
                    <span className="company-name">{selectedJob.business_name || 'Company Name Not Provided'}</span>
                  </div>
                  <div className="info-item">
                    <label>Position Title</label>
                    <span className="position-title">{selectedJob.position_title || selectedJob.title}</span>
                  </div>
                  <div className="info-item">
                    <label>Work Location</label>
                    <span className="location">📍 {selectedJob.place_of_work || selectedJob.location}</span>
                  </div>
                  <div className="info-item">
                    <label>Employment Type</label>
                    <span className="job-type">{selectedJob.nature_of_work || selectedJob.job_type}</span>
                  </div>
                </div>
              </div>

              {/* Job Details Section */}
              <div className="admin-section job-details-section">
                <div className="section-header">
                  <h3>💼 Job Details</h3>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Vacancy Count</label>
                    <span className="vacancy-count">{selectedJob.vacancy_count} position(s)</span>
                  </div>
                  {selectedJob.jobType === 'approved' || selectedJob.status === 'approved' ? (
                    <div className="info-item">
                      <label>Placed/Hired</label>
                      <span className="placed-count-display">
                        {(() => {
                          const placedCount = getPlacedCount(selectedJob.id);
                          const vacancyCount = Number(selectedJob.vacancy_count || selectedJob.total_positions || 0);
                          const placedDisplay = vacancyCount > 0 
                            ? `${placedCount} of ${vacancyCount} position(s) filled` 
                            : `${placedCount} jobseeker(s) placed`;
                          
                          return (
                            <span className={placedCount >= vacancyCount && vacancyCount > 0 ? 'placed-full' : ''}>
                              🎉 {placedDisplay}
                            </span>
                          );
                        })()}
                      </span>
                    </div>
                  ) : null}
                  <div className="info-item">
                    <label>Salary Range</label>
                    <span className="salary">{selectedJob.salary_range || 'Not specified'}</span>
                  </div>
                  <div className="info-item">
                    <label>Posting Date</label>
                    <span className="posting-date">
                      {selectedJob.posting_date 
                        ? new Date(selectedJob.posting_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'Not specified'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Valid From</label>
                    <span className="valid-from">
                      {selectedJob.valid_from 
                        ? new Date(selectedJob.valid_from).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'Not specified'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Valid Until</label>
                    <span className="valid-until">
                      {selectedJob.valid_until 
                        ? new Date(selectedJob.valid_until).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Job Description Section */}
              <div className="admin-section description-section">
                <div className="section-header">
                  <h3>📝 Job Description</h3>
                </div>
                <div className="description-content">
                  <p>{selectedJob.job_description || selectedJob.description || 'No description provided'}</p>
                </div>
              </div>

              {/* Requirements Section */}
              <div className="admin-section requirements-section">
                <div className="section-header">
                  <h3>🎯 Requirements & Qualifications</h3>
                </div>
                <div className="requirements-grid">
                  <div className="requirement-category">
                    <h4>📚 Education & Experience</h4>
                    <div className="requirement-items">
                      <div className="requirement-item">
                        <label>Work Experience</label>
                        <span>{selectedJob.work_experience_months ? `${selectedJob.work_experience_months} months` : 'Not specified'}</span>
                      </div>
                      <div className="requirement-item">
                        <label>Educational Level</label>
                        <span>{selectedJob.educational_level || 'Not specified'}</span>
                      </div>
                      <div className="requirement-item">
                        <label>Course/SHS Strand</label>
                        <span>{selectedJob.course_shs_strand || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>
 
                  <div className="requirement-category">
                    <h4>🧠 Additional Qualifications</h4>
                    <div className="requirement-items">
                      <div className="requirement-item">
                        <label>Licensing (if any)</label>
                        <span>{selectedJob.license || 'Not specified'}</span>
                      </div>
                      <div className="requirement-item">
                        <label>Eligibility</label>
                        <span>{selectedJob.eligibility || 'Not specified'}</span>
                      </div>
                      <div className="requirement-item">
                        <label>Certification</label>
                        <span>{selectedJob.certification || 'Not specified'}</span>
                      </div>
                      <div className="requirement-item">
                        <label>Language/Dialect</label>
                        <span>{selectedJob.language_dialect || 'Not specified'}</span>
                      </div>
                      <div className="requirement-item full-width">
                        <label>Other Qualifications</label>
                        <span>{selectedJob.other_qualifications || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-section accessibility-display">
                <div className="section-header">
                  <h3>♿ Accessibility & Inclusivity</h3>
                </div>
                <div className="admin-accessibility-grid">
                  <div className="info-item">
                    <label>Accepts PWD Applicants</label>
                    <span>{getYesNoLabel(selectedJob.accepts_pwd)}</span>
                  </div>
                  {(() => {
                    const pwdTypes = getPwdTypesList(selectedJob.pwd_types, selectedJob.pwd_others_specify);
                    if (!pwdTypes.length) {
                      return null;
                    }
                    return (
                      <div className="info-item">
                        <label>Accepted PWD Types</label>
                        <ul className="info-list">
                          {pwdTypes.map((type) => (
                            <li key={type}>{type}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                  <div className="info-item">
                    <label>Accepts Returning OFWs</label>
                    <span>{getYesNoLabel(selectedJob.accepts_ofw)}</span>
                  </div>
                </div>
              </div>

              {/* Jobseekers List Section - Only for approved jobs */}
              {selectedJob.jobType === 'approved' || selectedJob.status === 'approved' ? (
                <div className="admin-section jobseekers-section">
                  <div className="section-header">
                    <h3>👥 Jobseekers Who Applied</h3>
                    <span className="applicants-count-badge">
                      {loadingJobApplicants ? 'Loading...' : `${jobApplicantsForModal.length} applicant(s)`}
                    </span>
                  </div>
                  
                  {loadingJobApplicants ? (
                    <div className="loading-applicants">
                      <p>Loading applicants...</p>
                    </div>
                  ) : jobApplicantsForModal.length === 0 ? (
                    <div className="no-applicants">
                      <p>No jobseekers have applied to this job yet.</p>
                    </div>
                  ) : (
                    <div className="applicants-list-container">
                      <table className="applicants-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Applied Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobApplicantsForModal.map((applicant) => {
                            const statusClass = (applicant.status || 'pending').toLowerCase();
                            const statusLabel = 
                              statusClass === 'pending' ? '⏳ Pending' :
                              statusClass === 'in_review' ? '👀 In Review' :
                              statusClass === 'shortlisted' ? '⭐ Shortlisted' :
                              statusClass === 'referred' ? '📋 Referred' :
                              statusClass === 'accepted' ? '✅ Accepted' :
                              statusClass === 'hired' ? '🎉 Hired' :
                              statusClass === 'rejected' ? '❌ Rejected' :
                              '⏳ Pending';
                            
                            const fullName = `${applicant.firstName} ${applicant.lastName}`.trim() || 'Unknown';
                            const appliedDate = applicant.appliedAt 
                              ? new Date(applicant.appliedAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : 'N/A';

                            return (
                              <tr key={applicant.applicationId}>
                                <td className="applicant-name">{fullName}</td>
                                <td className="applicant-email">{applicant.email}</td>
                                <td className="applicant-phone">{applicant.phone}</td>
                                <td>
                                  <span className={`applicant-status-badge status-${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="applicant-date">{appliedDate}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            
            <div className="modal-footer admin-footer">
              <div className="footer-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => setShowJobModal(false)}
                >
                  Close Details
                </button>
                {selectedJob.jobType === 'pending' && (
                  <div className="approval-actions">
                    <button 
                      className="btn-danger"
                      onClick={() => {
                        openRejectModal(selectedJob);
                      }}
                    >
                      ❌ Reject Job
                    </button>
                    <button 
                      className="btn-primary"
                      onClick={() => {
                        handleApproveJob(selectedJob);
                        setShowJobModal(false);
                      }}
                    >
                      ✅ Approve Job
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Job Modal */}
      {showRejectModal && jobToReject && (
        <div 
          className="modal-overlay" 
          onClick={closeRejectModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
        >
          <div 
            className="modal-content reject-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="reject-modal-title">❌ Reject Job Vacancy</h2>
            </div>
            <div className="modal-body">
              <p>
                Provide a brief note explaining why <strong>{jobToReject.position_title || jobToReject.title}</strong> from <strong>{jobToReject.business_name}</strong> is being rejected.
                This note will be shared with the employer via notifications, email, SMS, and the rejected jobs tab.
              </p>
              <div className="form-group">
                <label htmlFor="reject-reason-input">Rejection Note *</label>
                <textarea
                  id="reject-reason-input"
                  className="form-textarea"
                  rows={4}
                  placeholder="Example: Missing required business permit or supporting documents."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={closeRejectModal}
                disabled={isRejecting}
              >
                Cancel
              </button>
              <button 
                className="btn-danger"
                onClick={handleRejectModalSubmit}
                disabled={isRejecting}
              >
                {isRejecting ? 'Rejecting...' : 'Reject Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refer Jobseekers Modal */}
      {showReferJobseekersModal && selectedJobForReferral && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowReferJobseekersModal(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowReferJobseekersModal(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="refer-modal-title"
        >
          <div 
            className="modal-content applicants-modal" 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="header-info">
                <h2 id="refer-modal-title">👤 Refer Jobseekers</h2>
                <p className="job-title-info">
                  {selectedJobForReferral.title || selectedJobForReferral.position_title} - {selectedJobForReferral.business_name}
                </p>
              </div>
              <button 
                className="close-modal-btn"
                onClick={() => setShowReferJobseekersModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {(() => {
                // Filter jobseekers who haven't applied or been accepted/rejected
                const normalizedSearch = referNameSearch.trim().toLowerCase();
                let availableJobseekers = jobseekers.filter((jobseeker) => {
                  const fullName = formatJobseekerName(jobseeker).toLowerCase();
                  const email = (jobseeker.email || '').toLowerCase();
                  const preferredJobs = Array.isArray(jobseeker.preferred_jobs)
                    ? jobseeker.preferred_jobs.filter(Boolean).join(' ').toLowerCase()
                    : '';
                  const employmentStatus = formatEmploymentStatus(jobseeker.status).toLowerCase();
                  const gender = (jobseeker.gender || '').toLowerCase();
                  const age = jobseeker.age ? String(jobseeker.age).toLowerCase() : '';
                  const address = (jobseeker.address || '').toLowerCase();
                  const matchesSearch =
                    !normalizedSearch ||
                    fullName.includes(normalizedSearch) ||
                    email.includes(normalizedSearch) ||
                    preferredJobs.includes(normalizedSearch) ||
                    employmentStatus.includes(normalizedSearch) ||
                    gender.includes(normalizedSearch) ||
                    age.includes(normalizedSearch) ||
                    address.includes(normalizedSearch);

                  if (!matchesSearch) {
                    return false;
                  }

                  const existingApp = applications.find(
                    app => app.job_id === selectedJobForReferral.id && 
                           app.jobseeker_id === jobseeker.id
                  );
                  
                  // Only show if:
                  // 1. No application exists, OR
                  // 2. Application exists but status is 'referred' (can see already referred ones), OR
                  // 3. Application exists with 'pending' status (canceled referrals become pending - can refer again), OR
                  // 4. Application exists with 'withdrawn' status (jobseeker canceled - admin can still refer)
                  // Exclude: 'accepted', 'rejected', 'hired'
                  if (!existingApp) return true; // No application - can refer
                  const appStatus = (existingApp.status || '').toLowerCase();
                  if (appStatus === 'referred') return true; // Already referred - show for reference
                  if (appStatus === 'pending') return true; // Pending (including canceled referrals) - can refer
                  if (appStatus === 'withdrawn') return true; // Withdrawn (jobseeker canceled) - admin can still refer
                  return false; // Has accepted/rejected/hired - hide
                });

                // Calculate scores and sort by score (highest first)
                availableJobseekers = availableJobseekers.map(jobseeker => ({
                  ...jobseeker,
                  matchScore: calculateMatchScore(jobseeker, selectedJobForReferral)
                })).sort((a, b) => b.matchScore - a.matchScore);

                return (
                  <>
                    <div className="jobseeker-modal-toolbar">
                      <label htmlFor="jobseeker-search">Search jobseekers</label>
                      <div className="jobseeker-search-field">
                        <span className="filter-icon">🔍</span>
                        <input
                          id="jobseeker-search"
                          type="text"
                          placeholder="Search by name, email, jobs, status, gender, age, or address..."
                          value={referNameSearch}
                          onChange={(e) => setReferNameSearch(e.target.value)}
                        />
                        {referNameSearch && (
                          <button
                            className="filter-clear"
                            onClick={() => setReferNameSearch('')}
                            type="button"
                            title="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="jobseekers-list">
                      {availableJobseekers.length === 0 ? (
                        <div className="no-applicants search-empty">
                          <div className="no-applicants-icon">🔍</div>
                          <h3>No Matches Found</h3>
                          <p>Try a different name or email. Clear the search to see everyone again.</p>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table className="jobs-table refer-jobseekers">
                            <thead>
                              <tr>
                                <th>Score</th>
                                <th>Jobseeker</th>
                                <th>Email</th>
                                <th>Preferred Jobs</th>
                                <th>Status</th>
                                <th>Gender</th>
                                <th>Age</th>
                                <th>Address</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {availableJobseekers.map((jobseeker) => {
                                const existingApp = applications.find(
                                  (app) =>
                                    app.job_id === selectedJobForReferral.id &&
                                    app.jobseeker_id === jobseeker.id
                                );
                                const isReferred = existingApp?.status === 'referred';
                                const resumeUrl = jobseeker.resume_url;
                                const preferredJobsList = Array.isArray(jobseeker.preferred_jobs)
                                  ? jobseeker.preferred_jobs.filter(Boolean)
                                  : [];
                                const employmentStatusLabel = formatEmploymentStatus(jobseeker.status);
                                const matchScore = jobseeker.matchScore || 0;

                                return (
                                  <tr key={jobseeker.id}>
                                    <td>
                                      <span className="match-score" style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: '40px',
                                        height: '32px',
                                        padding: '0 12px',
                                        borderRadius: '16px',
                                        fontWeight: '700',
                                        fontSize: '14px',
                                        backgroundColor: matchScore >= 40 ? 'rgba(34, 197, 94, 0.15)' : matchScore >= 20 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                        color: matchScore >= 40 ? '#047857' : matchScore >= 20 ? '#b45309' : '#64748b'
                                      }}>
                                        {matchScore}
                                      </span>
                                    </td>
                                    <td>{formatJobseekerName(jobseeker) || 'Unnamed Jobseeker'}</td>
                                    <td>{jobseeker.email || '—'}</td>
                                    <td>{preferredJobsList.length ? preferredJobsList.join(', ') : 'Not specified'}</td>
                                    <td>{employmentStatusLabel}</td>
                                    <td>{jobseeker.gender || 'Not specified'}</td>
                                    <td>{jobseeker.age ? `${jobseeker.age}` : '—'}</td>
                                    <td>{jobseeker.address || 'Not specified'}</td>
                                    <td>
                                      <div className="action-buttons">
                                        {resumeUrl ? (
                                          <button
                                            className="btn-view-resume"
                                            onClick={() => handleViewResume(resumeUrl)}
                                          >
                                            View Resume
                                          </button>
                                        ) : (
                                          <span className="no-resume-indicator">No Resume</span>
                                        )}
                                        <button
                                          className="btn-view-certificates"
                                          onClick={() => handleViewCertificates(jobseeker)}
                                          type="button"
                                        >
                                          View Certificates
                                        </button>
                                      </div>
                                      {isReferred ? (
                                        <button
                                          className="btn-cancel-referral"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancelReferral(jobseeker.id);
                                          }}
                                          disabled={isCancelingReferral === jobseeker.id}
                                          type="button"
                                        >
                                          {isCancelingReferral === jobseeker.id ? 'Canceling...' : 'Cancel Referral'}
                                        </button>
                                      ) : (
                                        <button
                                          className={`btn-refer ${isReferred ? 'referred' : ''}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReferJobseeker(jobseeker.id);
                                          }}
                                          disabled={isReferring === jobseeker.id || isReferred}
                                          type="button"
                                        >
                                          {isReferring === jobseeker.id ? 'Referring...' : 'Refer'}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowReferJobseekersModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Viewer Modal */}
      {showResumeModal && (
        <div 
          className="modal-overlay resume-modal-overlay" 
          style={{ zIndex: 3000 }}
          onClick={() => setShowResumeModal(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowResumeModal(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-modal-title"
        >
          <div 
            className="modal-content resume-viewer-modal" 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            style={{ zIndex: 3001 }}
          >
            <div className="modal-header">
              <h2 id="resume-modal-title">Resume</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowResumeModal(false)}
                aria-label="Close resume viewer"
              >
                ×
              </button>
            </div>
            <div className="modal-body resume-viewer-body">
              {!selectedResumeUrl ? (
                <div className="no-resume-message">
                  <div className="no-resume-icon">📄</div>
                  <h3>Resume Not Available</h3>
                  <p>The jobseeker has not uploaded a resume yet.</p>
                </div>
              ) : selectedResumeUrl.toLowerCase().includes('.pdf') || selectedResumeUrl.toLowerCase().includes('application/pdf') ? (
                <iframe
                  src={selectedResumeUrl}
                  className="resume-iframe"
                  title="Resume"
                  onError={(e) => {
                    console.error('❌ Error loading PDF:', e);
                  }}
                />
              ) : (
                <div className="resume-image-container">
                  <img
                    src={selectedResumeUrl}
                    alt="Resume"
                    className="resume-image"
                    onError={(e) => {
                      console.error('❌ Error loading image:', e);
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `
                        <div class="no-resume-message">
                          <div class="no-resume-icon">⚠️</div>
                          <h3>Unable to Load Resume</h3>
                          <p>The resume file could not be displayed. Please try again later.</p>
                        </div>
                      `;
                    }}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowResumeModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificates Modal */}
      {showCertificatesModal && selectedCertificatesJobseeker && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 3500 }}
          onClick={() => setShowCertificatesModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="certificates-modal-title"
        >
          <div 
            className="modal-content certificates-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="certificates-modal-title">📑 Jobseeker Certificates</h2>
            </div>
            <div className="modal-body certificates-body">
              <div className="certificate-section">
                <h3>TESDA NC Certificates</h3>
                <ul className="certificate-list">
                  {[
                    { key: 'nc1_certificate_url', label: 'NC I' },
                    { key: 'nc2_certificate_url', label: 'NC II' },
                    { key: 'nc3_certificate_url', label: 'NC III' },
                    { key: 'nc4_certificate_url', label: 'NC IV' }
                  ].map(({ key, label }) => {
                    const url = selectedCertificatesJobseeker[key];
                    return (
                      <li key={key}>
                        <span>{label}</span>
                        {url ? (
                          <div className="certificate-actions">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-view-certificates">
                              View
                            </a>
                            <a href={url} download className="btn-view-certificates secondary">
                              Download
                            </a>
                          </div>
                        ) : (
                          <span className="no-resume-indicator">Not uploaded</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="certificate-section">
                <h3>Other Certificates</h3>
                {Array.isArray(selectedCertificatesJobseeker.other_certificates) &&
                selectedCertificatesJobseeker.other_certificates.length ? (
                  <ul className="certificate-list">
                    {selectedCertificatesJobseeker.other_certificates.map((cert, idx) => (
                      <li key={`${cert.type}-${idx}`}>
                        <div>
                          <span>{cert.type || 'Certificate'}</span>
                          {cert.uploaded_at ? (
                            <small>Uploaded on {formatDate(cert.uploaded_at)}</small>
                          ) : null}
                        </div>
                        {cert.url ? (
                          <div className="certificate-actions">
                            <a href={cert.url} target="_blank" rel="noopener noreferrer" className="btn-view-certificates">
                              View
                            </a>
                            <a href={cert.url} download className="btn-view-certificates secondary">
                              Download
                            </a>
                          </div>
                        ) : (
                          <span className="no-resume-indicator">File missing</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-certificates">No other certificates uploaded.</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowCertificatesModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Edit Job Modal */}
      {showEditModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Edit Job Vacancy</h2>
            </div>
            
            <div className="modal-body">
              <div className="edit-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Position Title *</label>
                    <input
                      type="text"
                      value={editForm.position_title}
                      onChange={(e) => setEditForm(prev => ({ ...prev, position_title: e.target.value }))}
                      className="form-input"
                      placeholder="Enter position title"
                    />
                  </div>
                  <div className="form-group">
                    <label>Vacancy Count *</label>
                    <input
                      type="number"
                      value={editForm.vacancy_count}
                      onChange={(e) => setEditForm(prev => ({ ...prev, vacancy_count: e.target.value }))}
                      className="form-input"
                      placeholder="Number of vacancies"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Job Description *</label>
                  <textarea
                    value={editForm.job_description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, job_description: e.target.value }))}
                    className="form-textarea"
                    rows="4"
                    placeholder="Describe the job responsibilities and requirements"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Nature of Work *</label>
                    <select
                      value={editForm.nature_of_work}
                      onChange={(e) => setEditForm(prev => ({ ...prev, nature_of_work: e.target.value }))}
                      className="form-select"
                    >
                      <option value="">Select work type</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Remote">Remote</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Place of Work *</label>
                    <input
                      type="text"
                      value={editForm.place_of_work}
                      onChange={(e) => setEditForm(prev => ({ ...prev, place_of_work: e.target.value }))}
                      className="form-input"
                      placeholder="Work location"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Salary Range</label>
                    <input
                      type="text"
                      value={editForm.salary_range}
                      onChange={(e) => setEditForm(prev => ({ ...prev, salary_range: e.target.value }))}
                      className="form-input"
                      placeholder="e.g., ₱15,000 - ₱25,000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Work Experience (months)</label>
                    <input
                      type="number"
                      value={editForm.work_experience_months}
                      onChange={(e) => setEditForm(prev => ({ ...prev, work_experience_months: e.target.value }))}
                      className="form-input"
                      placeholder="Required experience"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Educational Level</label>
                    <select
                      value={editForm.educational_level}
                      onChange={(e) => setEditForm(prev => ({ ...prev, educational_level: e.target.value }))}
                      className="form-select"
                    >
                      <option value="">Select education level</option>
                      <option value="Elementary">Elementary</option>
                      <option value="High School">High School</option>
                      <option value="Senior High School">Senior High School</option>
                      <option value="Vocational">Vocational</option>
                      <option value="College">College</option>
                      <option value="Post Graduate">Post Graduate</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Course/SHS Strand</label>
                    <input
                      type="text"
                      value={editForm.course_shs_strand}
                      onChange={(e) => setEditForm(prev => ({ ...prev, course_shs_strand: e.target.value }))}
                      className="form-input"
                      placeholder="Specific course or strand"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>License</label>
                    <input
                      type="text"
                      value={editForm.license}
                      onChange={(e) => setEditForm(prev => ({ ...prev, license: e.target.value }))}
                      className="form-input"
                      placeholder="Required licenses"
                    />
                  </div>
                  <div className="form-group">
                    <label>Eligibility</label>
                    <input
                      type="text"
                      value={editForm.eligibility}
                      onChange={(e) => setEditForm(prev => ({ ...prev, eligibility: e.target.value }))}
                      className="form-input"
                      placeholder="Civil service eligibility"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Other Qualifications</label>
                  <textarea
                    value={editForm.other_qualifications}
                    onChange={(e) => setEditForm(prev => ({ ...prev, other_qualifications: e.target.value }))}
                    className="form-textarea"
                    rows="3"
                    placeholder="Additional qualifications or requirements"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Posting Date</label>
                    <input
                      type="date"
                      value={editForm.posting_date}
                      onChange={(e) => setEditForm(prev => ({ ...prev, posting_date: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Valid From</label>
                    <input
                      type="date"
                      value={editForm.valid_from}
                      onChange={(e) => setEditForm(prev => ({ ...prev, valid_from: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Valid Until</label>
                    <input
                      type="date"
                      value={editForm.valid_until}
                      onChange={(e) => setEditForm(prev => ({ ...prev, valid_until: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowEditModal(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleUpdateJob}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : 'Update Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobManagementSimplified;
