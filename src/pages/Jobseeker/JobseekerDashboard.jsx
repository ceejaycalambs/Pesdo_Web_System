import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { supabase } from '../../supabase.js';
import NotificationButton from '../../components/NotificationButton';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { logActivity } from '../../utils/activityLogger';
import './JobseekerDashboard.css';

const NAV_ITEMS = [
  { key: 'all-jobs', label: 'All Jobs', icon: '🗂️' },
  { key: 'applied', label: 'Applied & Referred', icon: '📌' },
  { key: 'profile', label: 'Edit Profile', icon: '📝' },
  { key: 'resume', label: 'Resume & CV', icon: '📄' }
];

const STATUS_LABELS = {
  pending: 'Pending Review',
  in_review: 'In Review',
  shortlisted: 'Shortlisted',
  referred: 'Referred by PESDO',
  accepted: 'Accepted',
  hired: 'Hired',
  rejected: 'Rejected'
};

const JOB_TYPE_OPTIONS = ['all', 'Full-time', 'Part-time', 'Contract', 'Internship', 'Project-based'];
const APPLICATION_STATUS_OPTIONS = ['all', 'pending', 'in_review', 'shortlisted', 'referred', 'accepted', 'hired', 'rejected'];

const MAX_RESUME_SIZE_MB = 10;
const MAX_AVATAR_SIZE_MB = 10;
const ALLOWED_RESUME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const ALLOWED_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const sanitizeString = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const resolveEmploymentStatus = (value) => {
  if (value === true || value === 'employed' || value === 'true') {
    return 'employed';
  }
  if (value === false || value === 'unemployed' || value === 'false') {
    return 'unemployed';
  }
  return '';
};

const JobseekerDashboard = () => {
  const { currentUser, userData, logout } = useAuth();
  const jobseekerId = currentUser?.id;

  const {
    notifications: jobseekerNotifications,
    unreadCount: jobseekerUnreadCount,
    markAsRead: markJobseekerNotificationAsRead,
    markAllAsRead: markAllJobseekerNotificationsAsRead,
    requestNotificationPermission: requestJobseekerNotificationPermission
  } = useRealtimeNotifications(jobseekerId, 'jobseeker');

  useEffect(() => {
    requestJobseekerNotificationPermission();
  }, []);
  
  const [activeTab, setActiveTab] = useState('all-jobs');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    suffix: '',
    phone: '',
    address: '',
    age: '',
    gender: '',
    civil_status: '',
    education: '',
    employment_status: '',
    preferred_job_1: '',
    preferred_job_2: '',
    preferred_job_3: '',
    bio: ''
  });
  const [profileMessage, setProfileMessage] = useState({ type: null, text: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  const [resumeState, setResumeState] = useState({
    uploading: false,
    success: '',
    error: ''
  });
  const [resumePendingFile, setResumePendingFile] = useState(null);
  const resumeInputRef = useRef(null);

  const [avatarState, setAvatarState] = useState({
    uploading: false,
    success: '',
    error: ''
  });

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

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [jobSearch, setJobSearch] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState({ type: null, text: '' });

  useEffect(() => {
    if (!jobseekerId) return;
    fetchDashboardData();
  }, [jobseekerId]);

  useEffect(() => {
    if (!showJobModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showJobModal]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setProfileMessage({ type: null, text: '' });

    try {
      // First, fetch existing employer IDs to ensure we don't show jobs from deleted employers
      const { data: employerRows, error: employerErr } = await supabase
        .from('employer_profiles')
        .select('id');
      if (employerErr) throw employerErr;
      const existingEmployerIds = (employerRows || []).map(r => r.id).filter(Boolean);

      const [profileRes, jobsRes, applicationsRes] = await Promise.all([
        supabase
          .from('jobseeker_profiles')
          .select('*')
          .eq('id', jobseekerId)
          .maybeSingle(),
        supabase
          .from('jobs')
          .select('*')
          .in('employer_id', existingEmployerIds.length ? existingEmployerIds : ['00000000-0000-0000-0000-000000000000'])
          .eq('status', 'approved')
          .order('created_at', { ascending: false }),
        supabase
          .from('applications')
          .select('id, status, applied_at, created_at, job_id')
          .eq('jobseeker_id', jobseekerId)
          .order('created_at', { ascending: false })
      ]);

      if (profileRes.error && profileRes.error.code !== 'PGRST116') {
        throw profileRes.error;
      }
      if (jobsRes.error) throw jobsRes.error;
      if (applicationsRes.error) throw applicationsRes.error;

      const profileData = profileRes.data || null;
      setProfile(profileData);

      const employmentStatusValue = resolveEmploymentStatus(
        profileData?.status ?? profileData?.employment_status ?? null
      );

      const preferredJobsArray = Array.isArray(profileData?.preferred_jobs)
        ? profileData.preferred_jobs
        : [];

      setProfileForm({
        first_name: profileData?.first_name || '',
        last_name: profileData?.last_name || '',
        suffix: profileData?.suffix || '',
        phone: profileData?.phone || profileData?.contact_no || '',
        address: profileData?.address || '',
        age: profileData?.age ? String(profileData.age) : '',
        gender: profileData?.gender || '',
        civil_status: profileData?.civil_status || '',
        education: profileData?.education || '',
        employment_status: employmentStatusValue,
        preferred_job_1: preferredJobsArray[0] || '',
        preferred_job_2: preferredJobsArray[1] || '',
        preferred_job_3: preferredJobsArray[2] || '',
        bio: profileData?.bio || ''
      });

      const jobsData = jobsRes.data || [];
      const jobIds = jobsData.map((job) => job.id).filter(Boolean);
      const acceptedCountMap = new Map();

      if (jobIds.length) {
        const { data: acceptedApplications, error: acceptedApplicationsError } = await supabase
          .from('applications')
          .select('job_id')
          .in('job_id', jobIds)
          .in('status', ['accepted', 'hired']);

        if (acceptedApplicationsError) {
          console.warn(
            'Unable to fetch accepted application counts:',
            acceptedApplicationsError.message
          );
        } else if (Array.isArray(acceptedApplications)) {
          for (const record of acceptedApplications) {
            if (!record?.job_id) continue;
            const current = acceptedCountMap.get(record.job_id) || 0;
            acceptedCountMap.set(record.job_id, current + 1);
          }
        }
      }
      const applicationsData = applicationsRes.data || [];

      // Ensure we have job data for applications even if job is not currently approved
      const jobMap = new Map(jobsData.map((job) => [job.id, job]));
      const missingJobIds = applicationsData
        .map((application) => application.job_id)
        .filter((jobId) => jobId && !jobMap.has(jobId));

      if (missingJobIds.length) {
        const { data: extraJobs, error: extraJobsError } = await supabase
          .from('jobs')
          .select('*')
          .in('employer_id', existingEmployerIds.length ? existingEmployerIds : ['00000000-0000-0000-0000-000000000000'])
          .in('id', Array.from(new Set(missingJobIds)));

        if (extraJobsError) {
          console.warn('Unable to fetch additional job details for applications:', extraJobsError.message);
        } else if (Array.isArray(extraJobs)) {
          for (const job of extraJobs) {
            jobMap.set(job.id, job);
          }
        }
      }

      // Fetch employer profiles for the jobs we have
      const employerIds = Array.from(
        new Set(
          Array.from(jobMap.values())
            .map((job) => job.employer_id)
            .filter(Boolean)
        )
      );

      let employerMap = new Map();
      if (employerIds.length) {
        const { data: employerProfiles, error: employerError } = await supabase
          .from('employer_profiles')
          .select('id, business_name, acronym, full_address, company_logo_url')
          .in('id', employerIds);

        if (employerError) {
          console.warn('Unable to fetch employer profiles:', employerError.message);
        } else if (Array.isArray(employerProfiles)) {
          employerMap = new Map(employerProfiles.map((profile) => [profile.id, profile]));
        }
      }

      const normalizedJobs = jobsData.map((job) => {
        const employerProfile = employerMap.get(job.employer_id);
        const location =
          job.job_location ||
          job.work_location ||
          job.place_of_work ||
          employerProfile?.full_address ||
          job.location ||
          job.address ||
          'Location not specified';

        const vacancyRaw =
          job.vacancy_count ??
          job.total_positions ??
          job.vacancies ??
          job.vacancy ??
          null;

        let vacancyCount = null;
        if (typeof vacancyRaw === 'number' && Number.isFinite(vacancyRaw)) {
          if (vacancyRaw >= 0) {
            vacancyCount = vacancyRaw;
          }
        } else if (vacancyRaw !== null && vacancyRaw !== undefined) {
          const trimmedValue = `${vacancyRaw}`.trim();
          if (trimmedValue) {
            const parsed = Number.parseInt(trimmedValue, 10);
            if (Number.isFinite(parsed) && parsed >= 0) {
              vacancyCount = parsed;
            }
          }
        }

        const acceptedCount = acceptedCountMap.get(job.id) || 0;
        let matchPercentage = null;
        if (typeof vacancyCount === 'number') {
          if (vacancyCount > 0) {
            matchPercentage = Math.min(
              100,
              Math.round((acceptedCount / vacancyCount) * 100)
            );
          } else {
            matchPercentage = 0;
          }
        }

        return {
          id: job.id,
          title: job.title || job.position_title || 'Untitled Role',
          company:
            employerProfile?.business_name || job.company_name || 'Company name unavailable',
          acronym: employerProfile?.acronym || job.acronym || '',
          logoUrl: job.company_logo_url || employerProfile?.company_logo_url || null,
          location,
          employmentType: job.employment_type || job.job_type || job.nature_of_work || 'Not specified',
          salaryRange: job.salary_range || job.salary || 'Salary not specified',
          description: job.job_description || job.description || '',
          createdAt: job.created_at,
          postedAt: job.created_at || job.posting_date || job.submitted_at || job.updated_at || null,
          vacancyCount,
          acceptedCount,
          matchPercentage,
          employer_id: job.employer_id || null,
          nature_of_work: job.nature_of_work || null,
          work_experience_months: job.work_experience_months ?? null,
          other_qualifications: job.other_qualifications || null,
          educational_level: job.educational_level || null,
          course_shs_strand: job.course_shs_strand || null,
          license: job.license || null,
          eligibility: job.eligibility || null,
          certification: job.certification || null,
          language_dialect: job.language_dialect || null,
          accepts_pwd: job.accepts_pwd || null,
          pwd_types: Array.isArray(job.pwd_types)
            ? job.pwd_types
            : typeof job.pwd_types === 'string' && job.pwd_types.trim()
            ? job.pwd_types.split(',').map((value) => value.trim()).filter(Boolean)
            : [],
          pwd_others_specify: job.pwd_others_specify || null,
          accepts_ofw: job.accepts_ofw || null,
          valid_from: job.valid_from || null,
          valid_until: job.valid_until || null,
          posting_date: job.posting_date || null,
          place_of_work: job.place_of_work || null
        };
      });
      setJobs(normalizedJobs);

      const normalizedApplications = applicationsData.map((application) => {
        const job = jobMap.get(application.job_id) || {};
        // If the job no longer exists (e.g., employer deleted), skip this application
        if (!job || !job.id) {
          return null;
        }
        const employerProfile = employerMap.get(job.employer_id);
        const location =
          job.job_location ||
          job.work_location ||
          job.place_of_work ||
          employerProfile?.full_address ||
          job.location ||
          'Location not specified';

        const salaryRange =
          job.salaryRange || job.salary_range || job.salary || 'Salary not specified';
        const logoUrl =
          job.logoUrl || job.company_logo_url || employerProfile?.company_logo_url || null;

        const requirements = {
          education: job.educational_level || job.requirements?.education || null,
          experience: job.work_experience_months ?? job.requirements?.experience ?? null,
          license: job.license || job.requirements?.license || null,
          eligibility: job.eligibility || job.requirements?.eligibility || null,
          certification: job.certification || job.requirements?.certification || null,
          languages: job.language_dialect || job.requirements?.languages || null
        };

        const inclusivity = {
          acceptsPwd: job.accepts_pwd ?? job.inclusivity?.acceptsPwd ?? null,
          pwdTypes: Array.isArray(job.pwd_types)
            ? job.pwd_types
            : Array.isArray(job.inclusivity?.pwdTypes)
            ? job.inclusivity.pwdTypes
            : [],
          acceptsOfw: job.accepts_ofw ?? job.inclusivity?.acceptsOfw ?? null,
          notes: job.pwd_others_specify || job.inclusivity?.notes || null
        };

        const employerContact = {
          name: job.contact_person_name || employerProfile?.contact_person_name || null,
          email: job.contact_email || employerProfile?.contact_email || null,
          phone:
            job.contact_phone ||
            employerProfile?.mobile_number ||
            employerProfile?.telephone_number ||
            null
        };

        return {
          id: application.id,
          status: (application.status || 'pending').toLowerCase(),
          appliedAt: application.applied_at || application.created_at,
          job: {
            id: job.id,
            title: job.title || job.position_title || 'Job Vacancy',
            company:
              employerProfile?.business_name ||
              job.company_name ||
              'Company name unavailable',
            acronym: employerProfile?.acronym || job.acronym || '',
            employmentType:
              job.employmentType ||
              job.employment_type ||
              job.job_type ||
              job.nature_of_work ||
              'Not specified',
            location,
            salaryRange,
            description: job.description || job.job_description || '',
            requirements,
            inclusivity,
            employerContact,
            employerAddress: employerProfile?.full_address || null,
            logoUrl,
            matchPercentage:
              typeof job.matchPercentage === 'number' ? job.matchPercentage : null,
            vacancyCount:
              job.vacancyCount ??
              job.vacancy_count ??
              job.total_positions ??
              job.vacancies ??
              null,
            postedAt: job.postedAt || job.created_at || job.posting_date || null,
            validFrom: job.valid_from || job.validFrom || null,
            validUntil: job.valid_until || job.validUntil || null,
            employer_id: job.employer_id || null,
            nature_of_work: job.nature_of_work || null,
            work_experience_months: job.work_experience_months ?? null,
            other_qualifications: job.other_qualifications || null,
            educational_level: job.educational_level || null,
            course_shs_strand: job.course_shs_strand || null,
            license: job.license || null,
            eligibility: job.eligibility || null,
            certification: job.certification || null,
            language_dialect: job.language_dialect || null,
            accepts_pwd: inclusivity.acceptsPwd,
            pwd_types: inclusivity.pwdTypes,
            pwd_others_specify: inclusivity.notes,
            accepts_ofw: inclusivity.acceptsOfw
          },
          referred: (application.status || '').toLowerCase() === 'referred'
        };
      }).filter(Boolean);
      setAppliedJobs(normalizedApplications);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setProfileMessage({
        type: 'error',
        text: 'We had trouble loading your dashboard. Please refresh the page.'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
        job.company.toLowerCase().includes(jobSearch.toLowerCase()) ||
        job.location.toLowerCase().includes(jobSearch.toLowerCase());

      const matchesType =
        jobTypeFilter === 'all' ||
        (job.employmentType && job.employmentType.toLowerCase() === jobTypeFilter.toLowerCase());

      return matchesSearch && matchesType;
    });
  }, [jobs, jobSearch, jobTypeFilter]);

  const filteredApplications = useMemo(() => {
    return appliedJobs.filter((application) => {
      const matchesStatus =
        applicationStatusFilter === 'all' || application.status === applicationStatusFilter;

      return matchesStatus;
    });
  }, [appliedJobs, applicationStatusFilter]);

  const hasAppliedToSelectedJob = useMemo(() => {
    if (!selectedJob) return false;
    return appliedJobs.some((application) => application.job.id === selectedJob.id);
  }, [selectedJob, appliedJobs]);

  const selectedJobApplication = useMemo(() => {
    if (!selectedJob) return null;
    return appliedJobs.find((application) => application.job.id === selectedJob.id) || null;
  }, [selectedJob, appliedJobs]);

  const canCancelSelectedJobApplication = useMemo(() => {
    if (!selectedJobApplication) return false;
    const status = selectedJobApplication.status?.toLowerCase();
    return status === 'pending' || status === 'in_review';
  }, [selectedJobApplication]);

  const isJobValidForApplication = useMemo(() => {
    if (!selectedJob) return true;
    const validFrom = selectedJob.valid_from || selectedJob.validFrom;
    if (!validFrom) return true; // If no valid_from, allow application
    
    const validFromDate = new Date(validFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    validFromDate.setHours(0, 0, 0, 0);
    
    return validFromDate <= today; // Valid if today or in the past
  }, [selectedJob]);

  const applyButtonLabel = useMemo(() => {
    if (hasAppliedToSelectedJob) return 'Applied';
    if (isApplying) return 'Applying…';
    if (!isJobValidForApplication) return 'Not Yet Open';
    return 'Apply Now';
  }, [hasAppliedToSelectedJob, isApplying, isJobValidForApplication]);

  const jobModalDetails = useMemo(() => {
    if (!selectedJob) return null;

    const matchDisplay =
      typeof selectedJob.matchPercentage === 'number' ? `${selectedJob.matchPercentage}%` : '—';

    const vacancyDisplay =
      selectedJob.vacancyCount !== null && selectedJob.vacancyCount !== undefined
        ? selectedJob.vacancyCount
        : '—';

    const acceptedDisplay =
      typeof selectedJob.acceptedCount === 'number' ? selectedJob.acceptedCount : 0;

    const salaryDisplay = selectedJob.salaryRange || 'Salary not specified';

    const postedDisplay = selectedJob.postedAt
      ? formatDate(selectedJob.postedAt)
      : formatDate(selectedJob.createdAt);

    const trimmedDescription = selectedJob.description?.trim();
    const description = trimmedDescription?.length
      ? selectedJob.description
      : 'No job description provided.';

    const workExperienceLabel =
      typeof selectedJob.work_experience_months === 'number'
        ? `${selectedJob.work_experience_months} month(s)`
        : 'Not specified';

    const pwdTypesLabel =
      Array.isArray(selectedJob.pwd_types) && selectedJob.pwd_types.length
        ? selectedJob.pwd_types.join(', ')
        : '—';

    const rawValidFrom = selectedJob.valid_from || selectedJob.validFrom || null;
    const formattedValidFrom = rawValidFrom ? formatDate(rawValidFrom) : 'Not specified';
    const rawValidUntil = selectedJob.valid_until || selectedJob.validUntil || null;
    const formattedValidUntil = rawValidUntil ? formatDate(rawValidUntil) : 'Not specified';

    return {
      assignmentType: `${selectedJob.location} / ${selectedJob.employmentType}`,
      location: selectedJob.location || 'Location not specified',
      employmentType: selectedJob.employmentType || 'Not specified',
      matchDisplay,
      vacancyDisplay,
      acceptedDisplay,
      salaryDisplay,
      postedDisplay,
      description,
      employerId: selectedJob.employer_id || null,
      jobId: selectedJob.id || null,
      natureOfWork: selectedJob.nature_of_work || selectedJob.employmentType || 'Not specified',
      salaryRange: selectedJob.salaryRange || 'Salary not specified',
      placeOfWork: selectedJob.place_of_work || selectedJob.location || 'Not specified',
      workExperienceMonths: workExperienceLabel,
      otherQualifications: selectedJob.other_qualifications || 'Not specified',
      educationalLevel: selectedJob.educational_level || 'Not specified',
      courseOrStrand: selectedJob.course_shs_strand || 'Not specified',
      license: selectedJob.license || 'Not specified',
      eligibility: selectedJob.eligibility || 'Not specified',
      certification: selectedJob.certification || 'Not specified',
      language: selectedJob.language_dialect || 'Not specified',
      acceptsPwd: selectedJob.accepts_pwd || 'Not specified',
      pwdTypes: pwdTypesLabel,
      pwdOthers: selectedJob.pwd_others_specify || '—',
      acceptsOfw: selectedJob.accepts_ofw || 'Not specified',
      validFrom: formattedValidFrom,
      validUntil: formattedValidUntil
    };
  }, [selectedJob]);

  const profileAvatarUrl = profile?.profile_picture_url;

  const profileDisplayName = useMemo(() => {
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
    return name || 'Jobseeker Profile';
  }, [profile]);

  const profileDisplayEmail = profile?.email || userData?.email || '';

  const profileInitials = useMemo(() => {
    const initials = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .join('');

    if (initials) return initials.slice(0, 2);
    if (profileDisplayEmail) return profileDisplayEmail[0]?.toUpperCase() || 'J';
    return 'JP';
  }, [profile, profileDisplayEmail]);

  const handleProfileInputChange = (field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResetProfileForm = () => {
    if (!profile) return;

    const employmentStatusValue = resolveEmploymentStatus(
      profile?.status ?? profile?.employment_status ?? null
    );

    const preferredJobsArray = Array.isArray(profile?.preferred_jobs)
      ? profile.preferred_jobs
      : [];

    setProfileForm({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      suffix: profile?.suffix || '',
      phone: profile?.phone || profile?.contact_no || '',
      address: profile?.address || '',
      gender: profile?.gender || '',
      civil_status: profile?.civil_status || '',
      education: profile?.education || '',
      employment_status: employmentStatusValue,
      preferred_job_1: preferredJobsArray[0] || '',
      preferred_job_2: preferredJobsArray[1] || '',
      preferred_job_3: preferredJobsArray[2] || '',
      bio: profile?.bio || ''
    });
    setProfileMessage({ type: null, text: '' });
  setIsEditingProfile(false);
  };

  const handleToggleEditProfile = () => {
    if (isEditingProfile) {
      handleResetProfileForm();
      setIsEditingProfile(false);
    } else {
      setIsEditingProfile(true);
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!jobseekerId) return;

    setProfileSaving(true);
    setProfileMessage({ type: null, text: '' });

    const phoneValue = sanitizeString(profileForm.phone);
    const isEmployed = profileForm.employment_status === 'employed';

    const preferredJobs = [
      sanitizeString(profileForm.preferred_job_1),
      sanitizeString(profileForm.preferred_job_2),
      sanitizeString(profileForm.preferred_job_3)
    ].filter(Boolean);

    const ageValue = profileForm.age ? Number.parseInt(profileForm.age, 10) : null;
    const payload = {
      first_name: sanitizeString(profileForm.first_name),
      last_name: sanitizeString(profileForm.last_name),
      suffix: sanitizeString(profileForm.suffix),
      phone: phoneValue,
      address: sanitizeString(profileForm.address),
      age: (ageValue && ageValue > 0 && ageValue <= 150) ? ageValue : null,
      gender: sanitizeString(profileForm.gender),
      civil_status: sanitizeString(profileForm.civil_status),
      education: sanitizeString(profileForm.education),
      status: isEmployed,
      preferred_jobs: preferredJobs.length ? preferredJobs : null,
      bio: sanitizeString(profileForm.bio),
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('jobseeker_profiles')
        .update(payload)
        .eq('id', jobseekerId);

      if (error) throw error;

      setProfile((prev) => ({
        ...prev,
        ...payload
      }));

      setProfileMessage({
        type: 'success',
        text: 'Profile updated successfully.'
      });
      setIsEditingProfile(false);

      // Log activity with jobseeker name
      if (currentUser?.id && profile) {
        const jobseekerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown';
        await logActivity({
          userId: currentUser.id,
          userType: 'jobseeker',
          actionType: 'profile_updated',
          actionDescription: `${jobseekerName} updated profile information`,
          entityType: 'profile',
          entityId: jobseekerId,
          metadata: {
            updatedFields: Object.keys(payload)
          }
        });
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setProfileMessage({
        type: 'error',
        text: 'Unable to save changes right now. Please try again.'
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleResumeFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setResumeState({ uploading: false, success: '', error: '' });

    if (!jobseekerId) {
      setResumeState({
        uploading: false,
        success: '',
        error: 'You must be logged in to upload a resume.'
      });
      event.target.value = '';
      return;
    }

    if (!ALLOWED_RESUME_TYPES.has(file.type)) {
      setResumePendingFile(null);
      setResumeState({
        uploading: false,
        success: '',
        error: 'Please upload a PDF or Word document.'
      });
      event.target.value = '';
      return;
    }

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > MAX_RESUME_SIZE_MB) {
      setResumePendingFile(null);
      setResumeState({
        uploading: false,
        success: '',
        error: `File is too large. Maximum allowed size is ${MAX_RESUME_SIZE_MB} MB.`
      });
      event.target.value = '';
      return;
    }

    setResumePendingFile(file);
    setResumeState({
      uploading: false,
      success: `Ready to upload “${file.name}”. Click Upload to continue.`,
      error: ''
    });
  };

  const handleResumeUpload = async () => {
    if (!resumePendingFile || !jobseekerId) {
      setResumeState({
        uploading: false,
        success: '',
        error: 'Please choose a resume file before uploading.'
      });
      return;
    }

    const file = resumePendingFile;
    if (!ALLOWED_RESUME_TYPES.has(file.type)) {
      setResumeState({
        uploading: false,
        success: '',
        error: 'Please upload a PDF or Word document.'
      });
      setResumePendingFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
      return;
    }

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > MAX_RESUME_SIZE_MB) {
      setResumeState({
        uploading: false,
        success: '',
        error: `File is too large. Maximum allowed size is ${MAX_RESUME_SIZE_MB} MB.`
      });
      setResumePendingFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
      return;
    }

    setResumeState({ uploading: true, success: '', error: '' });

    if (profile?.resume_url) {
      await deleteStorageFile(profile.resume_url);
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const filePath = `jobseekers/${jobseekerId}/resume-${Date.now()}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl }
      } = supabase.storage.from('files').getPublicUrl(filePath);

      const updatedAt = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('jobseeker_profiles')
        .update({
          resume_url: publicUrl,
          updated_at: updatedAt
        })
        .eq('id', jobseekerId);

      if (updateError) throw updateError;

      setProfile((prev) => ({
        ...prev,
        resume_url: publicUrl,
        updated_at: updatedAt
      }));

      // Log activity with jobseeker name
      if (currentUser?.id && profile) {
        const jobseekerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown';
        await logActivity({
          userId: currentUser.id,
          userType: 'jobseeker',
          actionType: 'resume_uploaded',
          actionDescription: `${jobseekerName} uploaded resume: ${file.name}`,
          entityType: 'profile',
          entityId: jobseekerId,
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          }
        });
      }

      setResumeState({
        uploading: false,
        success: 'Resume uploaded successfully.',
        error: ''
      });
      setResumePendingFile(null);
    } catch (error) {
      console.error('Failed to upload resume:', error);
      setResumeState({
        uploading: false,
        success: '',
        error: 'Unable to upload resume. Please try again.'
      });
    } finally {
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
    }
  };

  const handleResumeRemove = async () => {
    if (!jobseekerId || !profile?.resume_url) return;

    setResumeState({ uploading: true, success: '', error: '' });

    try {
      await deleteStorageFile(profile.resume_url);

      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from('jobseeker_profiles')
        .update({
          resume_url: null,
          updated_at: updatedAt
        })
        .eq('id', jobseekerId);

      if (error) throw error;

      setProfile((prev) => ({
        ...prev,
        resume_url: null,
        updated_at: updatedAt
      }));

      setResumePendingFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }

      setResumeState({
        uploading: false,
        success: 'Resume removed successfully.',
        error: ''
      });
    } catch (error) {
      console.error('Failed to remove resume:', error);
      setResumeState({
        uploading: false,
        success: '',
        error: 'Unable to remove resume right now. Please try again.'
      });
    }
  };

  const handleProfileAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !jobseekerId) return;

    setAvatarState({ uploading: true, success: '', error: '' });

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setAvatarState({
        uploading: false,
        success: '',
        error: 'Please upload a JPEG, PNG, or WebP image.'
      });
      event.target.value = '';
      return;
    }

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > MAX_AVATAR_SIZE_MB) {
      setAvatarState({
        uploading: false,
        success: '',
        error: `Image is too large. Maximum allowed size is ${MAX_AVATAR_SIZE_MB} MB.`
      });
      event.target.value = '';
      return;
    }

    if (profile?.profile_picture_url) {
      await deleteStorageFile(profile.profile_picture_url);
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `profiles/${jobseekerId}/profile_picture-${Date.now()}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl }
      } = supabase.storage.from('files').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('jobseeker_profiles')
        .update({
          profile_picture_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobseekerId);

      if (updateError) throw updateError;

      setProfile((prev) => ({
        ...prev,
        profile_picture_url: publicUrl,
        updated_at: new Date().toISOString()
      }));

      // Log activity with jobseeker name
      if (currentUser?.id && profile) {
        const jobseekerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown';
        await logActivity({
          userId: currentUser.id,
          userType: 'jobseeker',
          actionType: 'avatar_uploaded',
          actionDescription: `${jobseekerName} uploaded profile photo: ${file.name}`,
          entityType: 'profile',
          entityId: jobseekerId,
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          }
        });
      }

      setAvatarState({
        uploading: false,
        success: 'Profile photo updated successfully.',
        error: ''
      });
    } catch (error) {
      console.error('Failed to upload profile photo:', error);
      setAvatarState({
        uploading: false,
        success: '',
        error: 'Unable to update profile photo. Please try again.'
      });
    } finally {
      event.target.value = '';
    }
  };

  const handleProfileAvatarRemove = async () => {
    if (!jobseekerId) return;

    setAvatarState({ uploading: true, success: '', error: '' });

    try {
      if (profile?.profile_picture_url) {
        await deleteStorageFile(profile.profile_picture_url);
      }

      const { error: updateError } = await supabase
        .from('jobseeker_profiles')
        .update({
          profile_picture_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobseekerId);

      if (updateError) throw updateError;

      setProfile((prev) => ({
        ...prev,
        profile_picture_url: null,
        updated_at: new Date().toISOString()
      }));

      setAvatarState({
        uploading: false,
        success: 'Profile photo removed.',
        error: ''
      });
    } catch (error) {
      console.error('Failed to remove profile photo:', error);
      setAvatarState({
        uploading: false,
        success: '',
        error: 'Unable to remove profile photo. Please try again.'
      });
    }
  };

  const handleViewJob = (job) => {
    setSelectedJob(job);
    setShowJobModal(true);
    setApplyFeedback({ type: null, text: '' });
    setIsApplying(false);
  };

  const handleCloseJobModal = () => {
    setShowJobModal(false);
    setSelectedJob(null);
    setApplyFeedback({ type: null, text: '' });
    setIsApplying(false);
  };

  const handleApplyToJob = async () => {
    if (!selectedJob?.id || !jobseekerId || hasAppliedToSelectedJob || isApplying) return;

    // Check if job is valid (valid_from must be today or in the past)
    const validFrom = selectedJob.valid_from || selectedJob.validFrom;
    if (validFrom) {
      const validFromDate = new Date(validFrom);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      validFromDate.setHours(0, 0, 0, 0);
      
      if (validFromDate > today) {
        setApplyFeedback({
          type: 'error',
          text: `This job is not yet open for applications. Applications will be accepted starting ${formatDate(validFrom)}.`
        });
        return;
      }
    }

    setIsApplying(true);
    setApplyFeedback({ type: null, text: '' });

    const timestamp = new Date().toISOString();
    const payload = {
      job_id: selectedJob.id,
      jobseeker_id: jobseekerId,
      status: 'pending',
      applied_at: timestamp
    };

    try {
      const { data, error } = await supabase
        .from('applications')
        .insert([payload])
        .select('id, status, job_id, applied_at, created_at');

      if (error) throw error;

      const inserted = Array.isArray(data) ? data[0] : data;
      const appliedAt = inserted?.applied_at || inserted?.created_at || timestamp;

      // Log activity with jobseeker name
      if (currentUser?.id && profile) {
        const jobseekerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown';
        await logActivity({
          userId: currentUser.id,
          userType: 'jobseeker',
          actionType: 'job_applied',
          actionDescription: `${jobseekerName} applied to job: ${selectedJob.title || selectedJob.position_title || 'Job Vacancy'}`,
          entityType: 'application',
          entityId: inserted?.id,
          metadata: {
            jobId: selectedJob.id,
            jobTitle: selectedJob.title || selectedJob.position_title,
            employerId: selectedJob.employer_id
          }
        });
      }

      const normalizedApplication = {
        id: inserted?.id,
        status: (inserted?.status || 'pending').toLowerCase(),
        appliedAt,
        job: {
          ...selectedJob,
          title: selectedJob.title || selectedJob.position_title || 'Job Vacancy',
          company: selectedJob.company || 'Company name unavailable',
          employmentType: selectedJob.employmentType || 'Not specified',
          location: selectedJob.location || 'Location not specified',
          salaryRange: selectedJob.salaryRange || 'Salary not specified',
          logoUrl: selectedJob.logoUrl || null,
          employerContact: selectedJob.employerContact || null,
          employerAddress: selectedJob.employerAddress || null
        },
        referred: false
      };

      setAppliedJobs((prev) => [normalizedApplication, ...prev]);

      if (selectedJob.employer_id) {
        const jobseekerDisplayName = (() => {
          const parts = [];
          if (profile?.first_name) parts.push(profile.first_name);
          if (profile?.last_name) parts.push(profile.last_name);
          let name = parts.join(' ').trim();
          if (profile?.suffix) {
            name = name ? `${name}, ${profile.suffix}` : profile.suffix;
          }
          return name || profile?.email || currentUser?.email || 'A jobseeker';
        })();

        const jobTitle = selectedJob.title || 'your job vacancy';

        const notificationPayload = {
          employer_id: selectedJob.employer_id,
          job_id: selectedJob.id,
          type: 'application_submitted',
          title: 'New Job Application',
          message: `${jobseekerDisplayName} applied to "${jobTitle}".`,
          is_read: false,
          created_at: timestamp
        };

        const { error: notificationError } = await supabase
          .from('notifications')
          .insert([notificationPayload]);

        if (notificationError) {
          console.warn('Failed to write employer notification for application:', notificationError.message);
        }
      }

      setApplyFeedback({ type: 'success', text: 'Application submitted successfully.' });
    } catch (error) {
      console.error('Failed to submit application:', error);
      setApplyFeedback({
        type: 'error',
        text: error.message || 'Unable to submit the application. Please try again.'
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancelApplication = async (applicationId) => {
    if (!applicationId || !jobseekerId) return;

    const confirmed = window.confirm('Are you sure you want to cancel this application? This action cannot be undone.');
    if (!confirmed) return;

    // Check if this is the currently selected job's application before removing from list
    const currentApplication = appliedJobs.find((app) => app.id === applicationId);
    const isSelectedJobApplication = selectedJob && currentApplication && currentApplication.job.id === selectedJob.id;

    try {
      // Update application status to 'withdrawn'
      const { error } = await supabase
        .from('applications')
        .update({ status: 'withdrawn' })
        .eq('id', applicationId)
        .eq('jobseeker_id', jobseekerId);

      if (error) throw error;

      // Remove from applied jobs list
      setAppliedJobs((prev) => prev.filter((app) => app.id !== applicationId));

      // If canceling from job modal, close the modal and show feedback
      if (isSelectedJobApplication) {
        setApplyFeedback({ type: 'success', text: 'Application cancelled successfully.' });
        // Close modal after a short delay
        setTimeout(() => {
          handleCloseJobModal();
        }, 1500);
      } else {
        // Show success message in profile section
        setProfileMessage({
          type: 'success',
          text: 'Application cancelled successfully.'
        });

        // Clear message after 3 seconds
        setTimeout(() => {
          setProfileMessage({ type: null, text: '' });
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to cancel application:', error);
      const errorMessage = error.message || 'Unable to cancel the application. Please try again.';
      
      if (isSelectedJobApplication) {
        setApplyFeedback({ type: 'error', text: errorMessage });
      } else {
        setProfileMessage({
          type: 'error',
          text: errorMessage
        });
      }
    }
  };

  const renderAllJobs = () => {
    if (filteredJobs.length === 0) {
    return (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No jobs found</h3>
          <p>Try adjusting your search or filters to discover more opportunities.</p>
      </div>
    );
  }

    return (
      <div className="job-table-wrapper">
        <div className="job-table-scroll">
          <div className="job-table">
            <div className="job-table-header">
              <div>Job ID</div>
              <div />
              <div>Employer</div>
              <div>Position</div>
              <div>Assignment / Type</div>
              <div>Match</div>
              <div>Vacancies</div>
              <div>Salary</div>
              <div>Status</div>
              <div>Action</div>
            </div>
            <div className="job-table-body">
              {filteredJobs.map((job) => {
                const jobIdDisplay = job.id ? job.id.toString().slice(0, 8).toUpperCase() : '—';
                const assignmentType = `${job.location} / ${job.employmentType}`;
                const matchDisplay =
                  typeof job.matchPercentage === 'number'
                    ? `${job.matchPercentage}%`
                    : '—';
                const vacancyDisplay =
                  job.vacancyCount !== null && job.vacancyCount !== undefined
                    ? job.vacancyCount
                    : '—';
                const statusDisplay = job.postedAt
                  ? `Posted on ${formatDate(job.postedAt)}`
                  : `Posted on ${formatDate(job.createdAt)}`;

                return (
                  <div key={job.id} className="job-table-row">
                    <div className="job-table-cell job-id">{jobIdDisplay}</div>
                    <div className="job-table-cell job-logo">
                      {job.logoUrl ? (
                        <img src={job.logoUrl} alt={`${job.company} logo`} />
                      ) : (
                        <div className="logo-placeholder">
                          {job.company
                            .split(' ')
                            .map((part) => part[0]?.toUpperCase())
                            .join('')
                            .slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="job-table-cell job-employer">
                      <div className="job-employer-name">{job.company}</div>
                      {job.acronym ? (
                        <div className="job-employer-acronym">{job.acronym}</div>
                      ) : null}
                    </div>
                    <div className="job-table-cell job-position">{job.title}</div>
                    <div className="job-table-cell job-assignment">{assignmentType}</div>
                    <div className="job-table-cell job-match">{matchDisplay}</div>
                    <div className="job-table-cell job-vacancies">{vacancyDisplay}</div>
                    <div className="job-table-cell job-salary">{job.salaryRange}</div>
                    <div className="job-table-cell job-status">{statusDisplay}</div>
                    <div className="job-table-cell job-action">
                      <button
                        type="button"
                        className="view-button"
                        onClick={() => handleViewJob(job)}
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAppliedJobs = () => {
    if (filteredApplications.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No applications yet</h3>
          <p>Start applying to jobs to track your application status here.</p>
          </div>
      );
    }

    return (
      <div className="cards-column">
        {filteredApplications.map((application) => {
          const statusKey = application.status;
          const statusLabel = STATUS_LABELS[statusKey] || statusKey;

          return (
            <div key={application.id} className="application-card">
              <div className="application-header">
                <div className="application-header-main">
                  <div className="application-logo">
                    {application.job.logoUrl ? (
                      <img
                        src={application.job.logoUrl}
                        alt={`${application.job.company} logo`}
                      />
                    ) : (
                      <div className="logo-placeholder">
                        {application.job.company
                          .split(' ')
                          .map((part) => part[0]?.toUpperCase())
                          .join('')
                          .slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3>{application.job.title}</h3>
                    <div className="application-meta">
                      <span>{application.job.company}</span>
                      {application.job.acronym ? (
                        <>
                          <span>•</span>
                          <span>{application.job.acronym}</span>
                        </>
                      ) : null}
                      <span>•</span>
                      <span>{application.job.location}</span>
                    </div>
                  </div>
                </div>
                <span className={`status-pill ${statusKey}`}>{statusLabel}</span>
              </div>

              <div className="application-details">
                <div className="detail-item">
                  <span className="detail-label">Employment Type</span>
                  <span className="detail-value">{application.job.employmentType}</span>
            </div>
                <div className="detail-item">
                  <span className="detail-label">Salary Range</span>
                  <span className="detail-value">{application.job.salaryRange}</span>
                </div>
                {application.job.validFrom && (
                  <div className="detail-item">
                    <span className="detail-label">Valid From</span>
                    <span className="detail-value">{formatDate(application.job.validFrom)}</span>
                  </div>
                )}
                {application.job.validUntil && (
                  <div className="detail-item">
                    <span className="detail-label">Valid Until</span>
                    <span className="detail-value">{formatDate(application.job.validUntil)}</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="detail-label">Applied On</span>
                  <span className="detail-value">{formatDate(application.appliedAt)}</span>
                </div>
              </div>

              <div className="application-actions">
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => handleViewJob({ ...application.job })}
                >
                  View Details
                </button>
              </div>

              {application.referred ? (
                <div className="referral-banner">
                  🎯 This application was referred by the PESDO administrator.
              </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderProfileForm = () => (
    <form className="profile-form" onSubmit={handleSaveProfile}>
      <div className="profile-avatar-banner">
        <div className="profile-avatar-wrapper">
          {profileAvatarUrl ? (
            <img src={profileAvatarUrl} alt={`${profileDisplayName} avatar`} />
          ) : (
            <span className="profile-avatar-initials">{profileInitials}</span>
          )}
        </div>
        <div className="profile-avatar-text">
          <div className="profile-avatar-actions">
            <label className="profile-avatar-upload">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleProfileAvatarUpload}
                disabled={avatarState.uploading}
              />
              {avatarState.uploading ? 'Uploading…' : 'Change Photo'}
            </label>
            {profileAvatarUrl ? (
              <button
                type="button"
                className="profile-avatar-reset"
                onClick={handleProfileAvatarRemove}
                disabled={avatarState.uploading}
              >
                Remove
              </button>
            ) : null}
          </div>
          {avatarState.error ? (
            <div className="profile-avatar-message error">{avatarState.error}</div>
          ) : null}
          {avatarState.success ? (
            <div className="profile-avatar-message success">{avatarState.success}</div>
          ) : null}
        </div>
      </div>

      <section>
        <h2>Personal Information</h2>
        <div className="form-grid">
          <label className="form-field">
            <span>First Name *</span>
                    <input
                      type="text"
                      value={profileForm.first_name}
              onChange={(e) => handleProfileInputChange('first_name', e.target.value)}
                      required
              disabled
                    />
          </label>
          <label className="form-field">
            <span>Last Name *</span>
                    <input
                      type="text"
                      value={profileForm.last_name}
              onChange={(e) => handleProfileInputChange('last_name', e.target.value)}
                      required
              disabled
                    />
          </label>
          <label className="form-field">
            <span>Suffix</span>
                    <input
                      type="text"
                      value={profileForm.suffix}
              onChange={(e) => handleProfileInputChange('suffix', e.target.value)}
                      placeholder="e.g., Jr., Sr., III"
              disabled={!isEditingProfile}
                    />
          </label>
          <label className="form-field">
            <span>Contact Number</span>
                    <input
                      type="tel"
              value={profileForm.phone}
              onChange={(e) => handleProfileInputChange('phone', e.target.value)}
              placeholder="09XXXXXXXXX"
              disabled={!isEditingProfile}
            />
          </label>
          <label className="form-field full">
            <span>Address</span>
                    <input
                      type="text"
                      value={profileForm.address}
              onChange={(e) => handleProfileInputChange('address', e.target.value)}
                      placeholder="Complete address"
              disabled={!isEditingProfile}
                    />
          </label>
          <label className="form-field">
            <span>Gender</span>
                    <select
                      value={profileForm.gender}
              onChange={(e) => handleProfileInputChange('gender', e.target.value)}
              disabled={!isEditingProfile}
                    >
              <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                        </label>
          <label className="form-field">
            <span>Age</span>
                    <input
                      type="number"
                      min="1"
                      max="150"
                      value={profileForm.age}
              onChange={(e) => handleProfileInputChange('age', e.target.value)}
                      placeholder="Enter your age"
              disabled={!isEditingProfile}
                    />
          </label>
          <label className="form-field">
            <span>Civil Status</span>
            <select
              value={profileForm.civil_status}
              onChange={(e) => handleProfileInputChange('civil_status', e.target.value)}
              disabled={!isEditingProfile}
            >
              <option value="">Select status</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Separated">Separated</option>
              <option value="Widowed">Widowed</option>
            </select>
          </label>
                    </div>
      </section>

      <section>
        <h2>Professional Information</h2>
        <div className="form-grid">
          <label className="form-field">
            <span>Educational Level</span>
            <select
              value={profileForm.education}
              onChange={(e) => handleProfileInputChange('education', e.target.value)}
              disabled={!isEditingProfile}
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
            <span>Employment Status</span>
            <select
              value={profileForm.employment_status}
              onChange={(e) => handleProfileInputChange('employment_status', e.target.value)}
              disabled={!isEditingProfile}
            >
              <option value="">Select status</option>
              <option value="unemployed">Unemployed</option>
              <option value="employed">Employed</option>
            </select>
          </label>
          <label className="form-field">
            <span>Preferred Job (Primary)</span>
                    <input
                      type="text"
                      value={profileForm.preferred_job_1}
              onChange={(e) => handleProfileInputChange('preferred_job_1', e.target.value)}
                      placeholder="e.g., Web Developer"
              disabled={!isEditingProfile}
                    />
          </label>
          <label className="form-field">
            <span>Preferred Job (Secondary)</span>
                    <input
                      type="text"
                      value={profileForm.preferred_job_2}
              onChange={(e) => handleProfileInputChange('preferred_job_2', e.target.value)}
                      placeholder="e.g., UI/UX Designer"
              disabled={!isEditingProfile}
                    />
          </label>
          <label className="form-field">
            <span>Preferred Job (Third)</span>
            <input
              type="text"
              value={profileForm.preferred_job_3}
              onChange={(e) => handleProfileInputChange('preferred_job_3', e.target.value)}
              placeholder="e.g., Graphic Designer"
              disabled={!isEditingProfile}
            />
          </label>
          <label className="form-field full">
            <span>Short Bio</span>
            <textarea
              rows={3}
              value={profileForm.bio}
              onChange={(e) => handleProfileInputChange('bio', e.target.value)}
              placeholder="Introduce yourself in a few sentences."
              disabled={!isEditingProfile}
            />
          </label>
                  </div>
      </section>

      {profileMessage.text ? (
        <div className={`form-message ${profileMessage.type}`}>
          {profileMessage.text}
                      </div>
      ) : null}

      <div className="form-actions">
        <button
          type="button"
          className="outline-btn"
          onClick={handleToggleEditProfile}
          disabled={profileSaving}
        >
          {isEditingProfile ? 'Cancel' : 'Edit Profile'}
        </button>
        <button type="submit" className="primary-btn" disabled={!isEditingProfile || profileSaving}>
          {profileSaving ? 'Saving...' : 'Save Changes'}
        </button>
                        </div>
    </form>
  );

  const renderResumeSection = () => {
    const hasResume = Boolean(profile?.resume_url);
    const fileName = profile?.resume_url
      ? profile.resume_url.split('/').pop()?.split('?')[0]
      : '';
    const uploadedDate = profile?.resume_uploaded_at || profile?.updated_at || null;

    return (
      <div className="resume-section">
        <div className="resume-card upload">
          <div className="resume-card-header">
            <h2>Upload Resume / CV</h2>
            <p className="muted">
              Provide your latest resume so employers can review your qualifications instantly.
            </p>
          </div>

          <div className="resume-card-body">
            <label className="upload-control">
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleResumeFileSelect}
                disabled={resumeState.uploading}
              />
              <span className="upload-button">{resumeState.uploading ? 'Uploading…' : 'Choose File'}</span>
            </label>

            <button
            type="button"
            className="primary-btn"
            onClick={handleResumeUpload}
            disabled={resumeState.uploading || !resumePendingFile}
            >
              Upload
            </button>
          </div>

          <p className="upload-hint">
            Accepted formats: PDF, DOC, DOCX — up to {MAX_RESUME_SIZE_MB} MB.
          </p>

          {resumeState.error ? <div className="form-message error">{resumeState.error}</div> : null}
          {resumeState.success ? <div className="form-message success">{resumeState.success}</div> : null}
        </div>

        <div className="resume-card preview">
          <div className="resume-card-header">
            <h2>Uploaded Document</h2>
            <p className="muted">
              View or download your latest resume. Keep this updated for better matching.
            </p>
          </div>

          <div className="resume-card-body">
            {hasResume ? (
              <>
                <div className="resume-file-info">
                  <div className="resume-file-icon">📄</div>
                  <div>
                    <p className="resume-filename">{fileName}</p>
                    <p className="resume-meta">
                      Uploaded on {uploadedDate ? formatDate(uploadedDate) : '—'}
                    </p>
                  </div>
                </div>
                <div className="resume-actions">
                  <a
                    href={profile.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="outline-btn"
                  >
                    View File
                  </a>
                  <a href={profile.resume_url} download className="outline-btn">
                    Download
                  </a>
                  <button
                    type="button"
                    className="outline-btn danger"
                    onClick={handleResumeRemove}
                    disabled={resumeState.uploading}
                  >
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <div className="resume-empty">
                <div className="empty-icon">📄</div>
                <h3>No document uploaded</h3>
                <p>Once you upload a resume or CV, it will appear here for quick access.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loader">
          <div className="spinner" />
          <p>Loading your dashboard…</p>
            </div>
      );
    }

    if (!profile) {
      return (
            <div className="empty-state">
          <div className="empty-icon">ℹ️</div>
          <h3>Profile not found</h3>
          <p>Your profile is being set up. Please refresh the page in a moment.</p>
    </div>
  );
    }

    switch (activeTab) {
      case 'all-jobs':
        return renderAllJobs();
      case 'applied':
        return renderAppliedJobs();
      case 'profile':
        return renderProfileForm();
      case 'resume':
        return renderResumeSection();
      default:
        return null;
    }
  };

  return (
    <div className="js-dashboard">
      <aside className="js-sidebar">
        <div className="sidebar-header">
          <div className="brand-mark">Jobseeker Dashboard</div>
          {profileDisplayName || profileDisplayEmail ? (
            <div className="user-snapshot">
              {profileDisplayName ? (
                <span className="user-name">{profileDisplayName}</span>
              ) : null}
              {profileDisplayEmail ? (
                <span className="user-email">{profileDisplayEmail}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
        <button 
              key={item.key}
              type="button"
              className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
        </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="outline-btn full" onClick={() => logout()}>
            Logout
          </button>
      </div>
      </aside>

      <main className="js-main">
        <header className="main-header">
          <div className="header-top">
            <div className="header-info">
              <h1>
                {activeTab === 'all-jobs' && 'Discover Approved Jobs'}
                {activeTab === 'applied' && 'Track Your Applications'}
                {activeTab === 'profile' && 'Edit Profile'}
                {activeTab === 'resume' && 'Resume & CV'}
              </h1>
              <p className="muted">
                {activeTab === 'all-jobs' &&
                  'Browse job vacancies approved by the PESDO administrator.'}
                {activeTab === 'applied' &&
                  'Monitor the progress of each job application and referrals.'}
                {activeTab === 'profile' &&
                  'Keep your information up to date so employers can reach you easily.'}
                {activeTab === 'resume' &&
                  'Upload and manage your latest resume or CV.'}
              </p>
            </div>
            <div className="header-actions">
              <NotificationButton
                notifications={jobseekerNotifications}
                unreadCount={jobseekerUnreadCount}
                onMarkAsRead={markJobseekerNotificationAsRead}
                onMarkAllAsRead={markAllJobseekerNotificationsAsRead}
              />
            </div>
          </div>

          {activeTab === 'all-jobs' && (
            <div className="header-controls">
              <input
                type="search"
                placeholder="Search by job title, company, or location"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
              />
              <select value={jobTypeFilter} onChange={(e) => setJobTypeFilter(e.target.value)}>
                {JOB_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All types' : option}
                  </option>
                ))}
              </select>
      </div>
          )}

          {activeTab === 'applied' && (
            <div className="header-controls">
              <select
                value={applicationStatusFilter}
                onChange={(e) => setApplicationStatusFilter(e.target.value)}
              >
                {APPLICATION_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All statuses' : STATUS_LABELS[option] || option}
                  </option>
                ))}
              </select>
        </div>
      )}
        </header>

        {renderContent()}
      </main>

      {showJobModal && selectedJob && jobModalDetails ? (
        <div className="job-modal-overlay" onClick={handleCloseJobModal}>
          <dialog
            className="job-modal"
            open
            aria-labelledby="job-modal-title"
            aria-modal="true"
            onCancel={(event) => {
              event.preventDefault();
              handleCloseJobModal();
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="job-modal-header">
              <div className="job-modal-logo">
                {selectedJob.logoUrl ? (
                  <img src={selectedJob.logoUrl} alt={`${selectedJob.company} logo`} />
                ) : (
                  <span>
                    {selectedJob.company
                      .split(' ')
                      .map((part) => part[0]?.toUpperCase())
                      .join('')
                      .slice(0, 2)}
                  </span>
                )}
              </div>
              <div>
                <h3 id="job-modal-title">{selectedJob.title}</h3>
                <p className="job-modal-subtitle">
                  {selectedJob.company}
                </p>
              </div>
            </header>
            <div className="job-modal-body">
              <div className="job-modal-grid">
                <div className="job-modal-grid-item">
                  <span className="label">Assignment / Type</span>
                  <span className="value">{jobModalDetails.assignmentType}</span>
                </div>
                <div className="job-modal-grid-item">
                  <span className="label">Place of Work</span>
                  <span className="value">{jobModalDetails.placeOfWork}</span>
                </div>
                <div className="job-modal-grid-item">
                  <span className="label">Vacancies</span>
                  <span className="value">{jobModalDetails.vacancyDisplay}</span>
                </div>
                <div className="job-modal-grid-item">
                  <span className="label">Accepted Applicants</span>
                  <span className="value">{jobModalDetails.acceptedDisplay}</span>
                </div>
                <div className="job-modal-grid-item">
                  <span className="label">Match</span>
                  <span className="value">{jobModalDetails.matchDisplay}</span>
                </div>
                <div className="job-modal-grid-item">
                  <span className="label">Salary Range</span>
                  <span className="value">{jobModalDetails.salaryDisplay}</span>
                </div>
                <div className="job-modal-grid-item">
                  <span className="label">Status</span>
                  <span className="value">{jobModalDetails.postedDisplay}</span>
                </div>
              </div>
              <div className="job-modal-description">
                <h4>Job Description</h4>
                <p>{jobModalDetails.description}</p>
              </div>
              <div className="job-modal-columns">
                <div className="job-modal-section">
                  <h4>Qualifications</h4>
                  <ul>
                    <li>
                      <strong>Educational Level:</strong> {jobModalDetails.educationalLevel}
                    </li>
                    <li>
                      <strong>Course / Strand:</strong> {jobModalDetails.courseOrStrand}
                    </li>
                    <li>
                      <strong>License:</strong> {jobModalDetails.license}
                    </li>
                    <li>
                      <strong>Eligibility:</strong> {jobModalDetails.eligibility}
                    </li>
                    <li>
                      <strong>Certification:</strong> {jobModalDetails.certification}
                    </li>
                    <li>
                      <strong>Work Experience:</strong> {jobModalDetails.workExperienceMonths}
                    </li>
                    <li>
                      <strong>Other Qualifications:</strong> {jobModalDetails.otherQualifications}
                    </li>
                  </ul>
                </div>
                <div className="job-modal-section">
                  <h4>Inclusivity</h4>
                  <ul>
                    <li>
                      <strong>Accepts PWD:</strong> {jobModalDetails.acceptsPwd}
                    </li>
                    <li>
                      <strong>PWD Types:</strong> {jobModalDetails.pwdTypes}
                  </li>
                  <li>
                    <strong>PWD Others:</strong> {jobModalDetails.pwdOthers}
                    </li>
                    <li>
                      <strong>Accepts Returning OFWs:</strong> {jobModalDetails.acceptsOfw}
                    </li>
                    <li>
                      <strong>Language / Dialect:</strong> {jobModalDetails.language}
                    </li>
                    <li>
                      <strong>Valid From:</strong> {jobModalDetails.validFrom}
                    </li>
                    <li>
                      <strong>Valid Until:</strong> {jobModalDetails.validUntil}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            {applyFeedback.text ? (
              <div className={`job-modal-feedback ${applyFeedback.type || ''}`}>
                {applyFeedback.text}
              </div>
            ) : null}
            <footer className="job-modal-footer">
              <button type="button" className="outline-btn" onClick={handleCloseJobModal}>
                Close
              </button>
              {canCancelSelectedJobApplication && (
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => handleCancelApplication(selectedJobApplication.id)}
                >
                  Cancel Application
                </button>
              )}
              <button
                type="button"
                className="primary-btn"
                onClick={handleApplyToJob}
                disabled={
                  !selectedJob ||
                  hasAppliedToSelectedJob ||
                  isApplying ||
                  !jobseekerId ||
                  !isJobValidForApplication
                }
                title={!isJobValidForApplication ? `This job will be open for applications starting ${jobModalDetails?.validFrom || 'a future date'}` : ''}
              >
                {applyButtonLabel}
              </button>
            </footer>
          </dialog>
        </div>
      ) : null}
    </div>
  );
};

export default JobseekerDashboard;

