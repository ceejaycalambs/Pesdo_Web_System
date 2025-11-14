import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import NotificationButton from '../../components/NotificationButton';
import './JobManagement.css';

const JobManagementSimplified = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingJobs, setPendingJobs] = useState([]);
  const [approvedJobs, setApprovedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [jobseekers, setJobseekers] = useState([]);
  const [selectedJobForReferral, setSelectedJobForReferral] = useState(null);
  const [isReferring, setIsReferring] = useState(false);
  const [showReferJobseekersModal, setShowReferJobseekersModal] = useState(false);
  const [applications, setApplications] = useState([]);
  const [selectedResumeUrl, setSelectedResumeUrl] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [referSearchTerm, setReferSearchTerm] = useState('');
  const [referStatusFilter, setReferStatusFilter] = useState('all');
  const [referNameSearch, setReferNameSearch] = useState('');

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

  const filteredApprovedJobs = useMemo(
    () => applyJobFilters(approvedJobs, 'approved', false),
    [approvedJobs, jobSearchTerm, jobTypeFilter]
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
        .select('id, first_name, last_name, suffix, email, bio, profile_picture_url, resume_url, preferred_jobs, status, gender, age, address')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobseekers(data || []);
    } catch (error) {
      console.error('Error fetching jobseekers:', error);
      showNotification('error', 'Failed to load jobseekers');
    }
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
      setIsReferring(true);

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

      // Refresh applications and jobseekers
      await fetchApplications();
      await fetchJobseekers();
      
    } catch (error) {
      console.error('Error referring jobseeker:', error);
      showNotification('error', `Failed to refer jobseeker: ${error.message}`);
    } finally {
      setIsReferring(false);
    }
  };

  // Render refer jobseeker tab - styled like employer manage jobs
  const renderReferJobseeker = () => {
    if (loading) {
      return <div className="loading">Loading jobs...</div>;
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
                </div>

                <p className="job-description-text">
                  {job.description || job.job_description || 'No description available.'}
                </p>

                <div className="job-meta">
                  <span className="applications-count">
                    👤 {referredApplications.length} Referred
                  </span>
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

      const [pendingResult, approvedResult] = await Promise.all([
        supabase
          .from('jobvacancypending')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('*')
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

        if (!employerError) {
          employerMap = Object.fromEntries(
            (employerData || []).map((emp) => [
              emp.id,
              {
                business_name: emp.business_name,
                company_logo_url: emp.company_logo_url
              }
            ])
          );
        }
      }

      const pendingList = [];
      for (const job of pendingRows) {
        const status = (job.status || 'pending').toLowerCase();
        if (status !== 'pending') continue;
        pendingList.push({
          ...job,
          business_name: employerMap[job.employer_id]?.business_name || 'Company Name Not Provided',
          company_logo_url:
            job.employer_profiles?.company_logo_url ||
            job.company_logo_url ||
            employerMap[job.employer_id]?.company_logo_url ||
            null
        });
      }
 
      const approvedList = approvedRows
        .filter((job) => {
          const status = (job.status || '').toLowerCase();
          return status === 'approved' || status === 'active';
        })
        .map((job) => ({
          ...job,
          business_name: employerMap[job.employer_id]?.business_name || 'Company Name Not Provided',
          company_logo_url:
            job.employer_profiles?.company_logo_url ||
            job.company_logo_url ||
            employerMap[job.employer_id]?.company_logo_url ||
            null
        }));

      setPendingJobs(pendingList);
      setApprovedJobs(approvedList);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      showNotification('error', `Failed to load jobs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
      const postingDate =
        job.posting_date ||
        (job.created_at ? new Date(job.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

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

  const handleViewJob = (job, jobType) => {
    setSelectedJob({ ...job, jobType });
    setShowJobModal(true);
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
          <div className="jobs-grid">
        {filteredPendingJobs.map((job) => (
          <div key={job.id} className="job-card pending">
            <div className="job-header">
              {job.company_logo_url && (
                <div className="job-card-logo">
                  <img src={job.company_logo_url} alt={`${job.business_name || 'Company'} logo`} />
                </div>
              )}
              <h3>{job.business_name || 'Company Name Not Provided'}</h3>
              <span className="status-badge pending">Pending</span>
            </div>
            <div className="job-details">
              <div className="job-info">
                <div className="editable-field static">
                  <strong>Position:</strong>
                  <span>{job.position_title}</span>
                </div>
                <div className="editable-field static">
                  <strong>Location:</strong>
                  <span>{job.place_of_work}</span>
                </div>
                <div className="editable-field static">
                  <strong>Type:</strong>
                  <span>{job.nature_of_work}</span>
                </div>
                <div className="editable-field static">
                  <strong>Vacancies:</strong>
                  <span>{job.vacancy_count}</span>
                </div>
              </div>

              <div className="job-quick-actions">
                <button
                  className="btn-quick view"
                  onClick={() => handleViewJob(job, 'pending')}
                >
                  View Details
                </button>
                <button 
                  className="btn-warning"
                  onClick={() => handleEditJob(job)}
                >
                  Edit
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => handleApproveJob(job)}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        ))}
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
    const hasJobs = filteredApprovedJobs.length > 0;

    return (
      <>
        {renderJobFilters(false)}
        {hasJobs ? (
          <div className="jobs-grid">
        {filteredApprovedJobs.map((job) => (
          <div key={job.id} className="job-card approved">
            <div className="job-header">
              {job.company_logo_url && (
                <div className="job-card-logo">
                  <img src={job.company_logo_url} alt={`${job.business_name || 'Company'} logo`} />
                </div>
              )}
              <h3>{job.business_name || 'Company Name Not Provided'}</h3>
              <span className="status-badge approved">Approved</span>
            </div>
            <div className="job-details">
              <div className="job-info">
                <div className="editable-field static">
                  <strong>Position:</strong>
                  <span>{job.title || job.position_title}</span>
                </div>
                <div className="editable-field static">
                  <strong>Location:</strong>
                  <span>{job.location || job.place_of_work}</span>
                </div>
                <div className="editable-field static">
                  <strong>Type:</strong>
                  <span>{job.job_type || job.nature_of_work}</span>
                </div>
                <div className="editable-field static">
                  <strong>Vacancies:</strong>
                  <span>{job.vacancy_count || job.total_positions || '—'}</span>
                </div>
              </div>
              <div className="job-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => handleViewJob(job, 'approved')}
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
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

  if (loading) {
    return <div className="loading">Loading job management...</div>;
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
                    onNotificationClick={(notification) => {
                      // Admin is already on the job management page
                      // If notification is about a pending job, we could scroll to it or highlight it
                      if (notification.data && notification.data.id) {
                        console.log('📋 Notification clicked for job:', notification.data.id);
                        // The job should already be visible in the pending jobs list
                        // Could add scroll-to functionality here if needed
                      }
                    }}
                  />
            <button 
              className="back-btn"
              onClick={() => navigate('/admin/dashboard')}
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
                  <div className="info-item">
                    <label>Salary Range</label>
                    <span className="salary">{selectedJob.salary_range || 'Not specified'}</span>
                  </div>
                  <div className="info-item">
                    <label>Posting Date</label>
                    <span className="posting-date">{selectedJob.posting_date || 'Not specified'}</span>
                  </div>
                  <div className="info-item">
                    <label>Valid Until</label>
                    <span className="valid-until">{selectedJob.valid_until || 'Not specified'}</span>
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
                      className="btn-warning"
                      onClick={() => {
                        setShowJobModal(false);
                        handleEditJob(selectedJob);
                      }}
                    >
                      ✏️ Edit Job
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
                const availableJobseekers = jobseekers.filter((jobseeker) => {
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
                  // 2. Application exists but status is 'referred' (can see already referred ones)
                  // Exclude: 'pending', 'accepted', 'rejected'
                  if (!existingApp) return true; // No application - can refer
                  if (existingApp.status === 'referred') return true; // Already referred - show for reference
                  return false; // Has applied/accepted/rejected - hide
                });

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
                        availableJobseekers.map((jobseeker) => {
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

                          return (
                            <div key={jobseeker.id} className="jobseeker-card">
                              <div className="jobseeker-header">
                                <div className="jobseeker-info">
                                  <div className="jobseeker-avatar">
                                    {jobseeker.profile_picture_url ? (
                                      <img
                                        src={jobseeker.profile_picture_url}
                                        alt={formatJobseekerName(jobseeker) || 'Jobseeker'}
                                      />
                                    ) : (
                                      <div className="avatar-placeholder">
                                        {jobseeker.first_name?.[0]?.toUpperCase() ||
                                          jobseeker.last_name?.[0]?.toUpperCase() ||
                                          'J'}
                                      </div>
                                    )}
                                  </div>
                                  <div className="jobseeker-details">
                                    <h4>{formatJobseekerName(jobseeker) || jobseeker.email || 'Unnamed Jobseeker'}</h4>
                                    <p className="jobseeker-email">{jobseeker.email}</p>
                                  </div>
                                </div>
                                <div className={`referral-status-badge ${isReferred ? 'referred' : 'not-referred'}`}>
                                  {isReferred ? '👤 Referred' : '⏳ Not Referred'}
                                </div>
                              </div>

                              <div className="jobseeker-body">
                                {jobseeker.bio && (
                                  <div className="jobseeker-bio">
                                    <strong>Bio:</strong> {jobseeker.bio}
                                  </div>
                                )}

                                <div className="jobseeker-meta">
                                  <div>
                                    <span className="meta-label">Preferred Jobs</span>
                                    <span>
                                      {preferredJobsList.length
                                        ? preferredJobsList.join(', ')
                                        : 'Not specified'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="meta-label">Employment Status</span>
                                    <span>{employmentStatusLabel}</span>
                                  </div>
                                  <div>
                                    <span className="meta-label">Gender</span>
                                    <span>{jobseeker.gender || 'Not specified'}</span>
                                  </div>
                                  <div>
                                    <span className="meta-label">Age</span>
                                    <span>{jobseeker.age ? `${jobseeker.age} years old` : 'Not specified'}</span>
                                  </div>
                                  <div>
                                    <span className="meta-label">Address</span>
                                    <span>{jobseeker.address || 'Not specified'}</span>
                                  </div>
                                </div>

                                <div className="jobseeker-actions">
                                  {resumeUrl ? (
                                    <button
                                      className="btn-view-resume"
                                      onClick={() => {
                                        console.log('🔍 Resume URL from profile:', resumeUrl);
                                        handleViewResume(resumeUrl);
                                      }}
                                    >
                                      📄 View Resume
                                    </button>
                                  ) : (
                                    <span className="no-resume-indicator">📄 No Resume Available</span>
                                  )}
                                  <button
                                    className={`btn-refer ${isReferred ? 'referred' : ''}`}
                                    onClick={() => handleReferJobseeker(jobseeker.id)}
                                    disabled={isReferring || isReferred}
                                  >
                                    {isReferred
                                      ? '✅ Already Referred'
                                      : isReferring
                                      ? '⏳ Referring...'
                                      : '👤 Refer'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
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
