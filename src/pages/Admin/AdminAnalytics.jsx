import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabase.js';
import './AdminDashboard.css';
import './AdminAnalytics.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

const BAR_COLORS = ['#0ea5e9', '#38bdf8', '#22d3ee', '#34d399', '#f97316'];
const DOUGHNUT_COLORS = ['#2563eb', '#f97316', '#10b981', '#6366f1'];

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser: authUser, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState('analytics');
  const [adminRole, setAdminRole] = useState(null);
  
  // Get correct paths based on host
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isAdminHost = host.startsWith('admin.');
  const loginPath = isAdminHost ? '/' : '/admin';
  const dashboardPath = isAdminHost ? '/dashboard' : '/admin/dashboard';
  const [analyticsData, setAnalyticsData] = useState({
    analytics: [],
    jobseekers: [],
    employers: [],
    vacancies: [],
    referrals: [],
    placements: []
  });
  const [jobseekerDateRange, setJobseekerDateRange] = useState({ from: '', to: '' });
  const [employerDateRange, setEmployerDateRange] = useState({ from: '', to: '' });
  const [referralDateRange, setReferralDateRange] = useState({ from: '', to: '' });
  const [placementDateRange, setPlacementDateRange] = useState({ from: '', to: '' });
  const [chartPeriod, setChartPeriod] = useState('all'); // 'all', 'monthly', 'quarterly', 'yearly'

  const analyticsSummary = analyticsData.analytics || [];

  // Helper function to filter data by period
  const filterByPeriod = (dateString) => {
    if (!dateString || chartPeriod === 'all') return true;
    
    const date = new Date(dateString);
    const now = new Date();
    
    switch (chartPeriod) {
      case 'monthly': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return date >= monthAgo;
      }
      case 'quarterly': {
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return date >= quarterAgo;
      }
      case 'yearly': {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return date >= yearAgo;
      }
      default:
        return true;
    }
  };

  const barChartData = useMemo(() => {
    if (!analyticsSummary.length) return null;

    return {
      labels: analyticsSummary.map(item => item.metric),
      datasets: [
        {
          label: 'Count',
          data: analyticsSummary.map(item => item.value),
          backgroundColor: analyticsSummary.map((_, index) => BAR_COLORS[index % BAR_COLORS.length]),
          borderRadius: 12,
          maxBarThickness: 48
        }
      ]
    };
  }, [analyticsSummary]);

  const barChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#123247',
            font: {
              weight: 600
            }
          },
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: '#123247',
            font: {
              weight: 600
            }
          },
          grid: {
            color: 'rgba(18, 50, 71, 0.08)'
          }
        }
      }
    }),
    []
  );

  const doughnutData = useMemo(() => {
    if (!analyticsSummary.length) return null;

    const placements = analyticsSummary.find(item => item.id === 'total-placements')?.value || 0;
    const referrals = analyticsSummary.find(item => item.id === 'total-referrals')?.value || 0;
    const employers = analyticsSummary.find(item => item.id === 'total-employers')?.value || 0;

    return {
      labels: ['Job Placements', 'Referrals', 'Registered Employers'],
      datasets: [
        {
          data: [placements, referrals, employers],
          backgroundColor: DOUGHNUT_COLORS.slice(0, 3),
          borderWidth: 0
        }
      ]
    };
  }, [analyticsSummary]);

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 14,
            usePointStyle: true
          }
        }
      }
    }),
    []
  );

  // Jobseeker demographic charts
  const jobseekerData = analyticsData.jobseekers || [];

  const genderChartData = useMemo(() => {
    const genderCounts = {};
    jobseekerData.forEach(seeker => {
      const gender = seeker.gender || 'Not Specified';
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;
    });

    const labels = Object.keys(genderCounts);
    const data = Object.values(genderCounts);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [jobseekerData]);

  const civilStatusChartData = useMemo(() => {
    const statusCounts = {};
    jobseekerData.forEach(seeker => {
      const status = seeker.civilStatus || 'Not Specified';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [jobseekerData]);

  const ageGroupChartData = useMemo(() => {
    const ageGroups = {
      '15-19': 0,
      '20-24': 0,
      '25-34': 0,
      '35-44': 0,
      '45-54': 0,
      '55-64': 0,
      '65+': 0,
      'Not Specified': 0
    };

    jobseekerData.forEach(seeker => {
      const age = seeker.age;
      if (!age || age < 15) {
        ageGroups['Not Specified']++;
      } else if (age >= 15 && age <= 19) {
        ageGroups['15-19']++;
      } else if (age >= 20 && age <= 24) {
        ageGroups['20-24']++;
      } else if (age >= 25 && age <= 34) {
        ageGroups['25-34']++;
      } else if (age >= 35 && age <= 44) {
        ageGroups['35-44']++;
      } else if (age >= 45 && age <= 54) {
        ageGroups['45-54']++;
      } else if (age >= 55 && age <= 64) {
        ageGroups['55-64']++;
      } else {
        ageGroups['65+']++;
      }
    });

    const labels = Object.keys(ageGroups).filter(key => ageGroups[key] > 0);
    const data = labels.map(key => ageGroups[key]);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [jobseekerData]);

  const employmentStatusChartData = useMemo(() => {
    const statusCounts = {};
    jobseekerData.forEach(seeker => {
      const status = seeker.employmentStatus || 'Not Specified';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [jobseekerData]);

  const educationChartData = useMemo(() => {
    const educationCounts = {};
    jobseekerData.forEach(seeker => {
      const education = seeker.education || 'Not Specified';
      educationCounts[education] = (educationCounts[education] || 0) + 1;
    });

    const labels = Object.keys(educationCounts);
    const data = Object.values(educationCounts);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [jobseekerData]);

  // Employer demographic charts
  const employerData = analyticsData.employers || [];

  const lineOfBusinessChartData = useMemo(() => {
    const businessCounts = {};
    employerData.forEach(employer => {
      const lineOfBusiness = employer.lineOfBusiness || 'Not Specified';
      businessCounts[lineOfBusiness] = (businessCounts[lineOfBusiness] || 0) + 1;
    });

    const labels = Object.keys(businessCounts);
    const data = Object.values(businessCounts);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [employerData]);

  const establishmentTypeChartData = useMemo(() => {
    const typeCounts = {};
    employerData.forEach(employer => {
      const type = employer.establishmentType || 'Not Specified';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const labels = Object.keys(typeCounts);
    const data = Object.values(typeCounts);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [employerData]);

  const employerTypeChartData = useMemo(() => {
    const typeCounts = {};
    employerData.forEach(employer => {
      const type = employer.employerType || 'Not Specified';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const labels = Object.keys(typeCounts);
    const data = Object.values(typeCounts);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [employerData]);

  const totalWorkforceChartData = useMemo(() => {
    const workforceCounts = {};
    employerData.forEach(employer => {
      const workforce = employer.totalWorkforce || 'Not Specified';
      workforceCounts[workforce] = (workforceCounts[workforce] || 0) + 1;
    });

    const labels = Object.keys(workforceCounts);
    const data = Object.values(workforceCounts);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [employerData]);

  // Top 10 charts
  const topPreferredJobsChartData = useMemo(() => {
    const jobCounts = {};
    
    jobseekerData.forEach(seeker => {
      // Filter by period based on registration date
      if (!filterByPeriod(seeker.registeredAt)) return;
      
      const preferredJobs = seeker.preferredJobs || [];
      if (Array.isArray(preferredJobs)) {
        preferredJobs.forEach(job => {
          if (job && job.trim()) {
            const jobName = job.trim();
            jobCounts[jobName] = (jobCounts[jobName] || 0) + 1;
          }
        });
      }
    });

    // Sort by count and get top 10
    const sortedJobs = Object.entries(jobCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const labels = sortedJobs.map(([job]) => job);
    const data = sortedJobs.map(([, count]) => count);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [jobseekerData, chartPeriod]);

  const vacancyData = analyticsData.vacancies || [];

  const topJobPositionsChartData = useMemo(() => {
    const positionCounts = {};
    
    vacancyData.forEach(vacancy => {
      // Filter by period based on posted date
      if (!filterByPeriod(vacancy.postedAt)) return;
      
      const position = vacancy.jobPosition || 'Untitled Vacancy';
      if (position && position !== '—') {
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      }
    });

    // Sort by count and get top 10
    const sortedPositions = Object.entries(positionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const labels = sortedPositions.map(([position]) => position);
    const data = sortedPositions.map(([, count]) => count);

    return {
      labels,
      datasets: [{
        label: 'Count',
        data,
        backgroundColor: BAR_COLORS.slice(0, labels.length),
        borderRadius: 8,
        maxBarThickness: 60
      }]
    };
  }, [vacancyData, chartPeriod]);

  const demographicsBarChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed.y || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#123247',
            font: {
              weight: 600
            }
          },
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: '#123247',
            font: {
              weight: 600
            }
          },
          grid: {
            color: 'rgba(18, 50, 71, 0.08)'
          }
        }
      }
    }),
    []
  );

  useEffect(() => {
    checkAdminAuth();
  }, [authUser, userData]);

  useEffect(() => {
    if (adminEmail && authUser) {
      fetchAnalyticsData();
    }
  }, [adminEmail, authUser]);

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

    const container = document.querySelector('.admin-analytics-page');
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

  const checkAdminAuth = async () => {
    // Check if user is authenticated via AuthContext
    if (!authUser) {
      // Fallback to localStorage check for backward compatibility
      const authenticated = localStorage.getItem('admin_authenticated');
      const loginTime = localStorage.getItem('admin_login_time');
      const email = localStorage.getItem('admin_email');
      
      if (authenticated === 'true' && loginTime && email) {
        const now = Date.now();
        const loginTimestamp = Number.parseInt(loginTime);
        const hoursSinceLogin = (now - loginTimestamp) / (1000 * 60 * 60);
        
        if (hoursSinceLogin < 24) {
          setAdminEmail(email);
          setLoading(false);
          return;
        } else {
          handleLogout();
          return;
        }
      } else {
        navigate(loginPath);
        return;
      }
    }

    // User is authenticated via AuthContext
    if (authUser && userData) {
      // Check if user is an admin
      const userType = userData.usertype || userData.userType;
      if (userType !== 'admin') {
        // Not an admin, redirect to login
        navigate(loginPath);
        return;
      }

      setAdminEmail(authUser.email || '');
      
      // Fetch admin role
      try {
        const { data: adminProfile, error: profileError } = await supabase
          .from('admin_profiles')
          .select('role')
          .eq('id', authUser.id)
          .single();
        
        if (!profileError && adminProfile) {
          const role = adminProfile.role || 'admin';
          setAdminRole(role);
          localStorage.setItem('admin_role', role);
        } else {
          const role = userData?.role || 'admin';
          setAdminRole(role);
          localStorage.setItem('admin_role', role);
        }
      } catch (error) {
        console.error('Error fetching admin role:', error);
        const role = userData?.role || 'admin';
        setAdminRole(role);
        localStorage.setItem('admin_role', role);
      }
      
      setLoading(false);
    } else {
      // Wait for auth to load
      setLoading(true);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      setIsDataLoaded(false);

      const { data: jobseekerProfiles, error: jobseekerError } = await supabase
        .from('jobseeker_profiles')
        .select('id, first_name, last_name, suffix, email, phone, address, gender, civil_status, education, status, age, preferred_jobs, created_at');

      if (jobseekerError) {
        console.error('Error fetching jobseeker profiles:', jobseekerError);
      }

      const { data: employerProfiles, error: employerError } = await supabase
        .from('employer_profiles')
        .select('*');

      if (employerError) {
        console.error('Error fetching employer profiles:', employerError);
      }

      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          *,
          employer_profiles ( business_name, acronym, full_address, employer_type )
        `)
        .eq('status', 'approved');

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
      }

      // Filter out jobs from deleted employers
      // Only include jobs where employer_profiles exists (employer still exists)
      const validJobs = (jobs || []).filter(job => {
        // If employer_profiles is null, the employer was deleted
        if (!job.employer_profiles) {
          console.log(`Skipping job ${job.id} - employer ${job.employer_id} has been deleted`);
          return false;
        }
        // Also check if employer_id exists and is valid
        if (!job.employer_id) {
          console.log(`Skipping job ${job.id} - no employer_id`);
          return false;
        }
        return true;
      });

      const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select('id, status, job_id, jobseeker_id, applied_at, created_at');

      if (applicationsError) {
        console.error('Error fetching applications:', applicationsError);
      }

      const formatJobseekerName = (profile) => {
        const parts = [];
        if (profile.first_name) parts.push(profile.first_name);
        if (profile.last_name) parts.push(profile.last_name);
        let name = parts.join(' ');
        const suffixValue = profile.suffix ? profile.suffix.trim() : '';
        if (suffixValue) {
          name = name ? `${name}, ${suffixValue}` : suffixValue;
        }
        return name;
      };

      const jobseekerList = (jobseekerProfiles || []).map(profile => ({
        id: profile.id,
        name: formatJobseekerName(profile) || profile.email || 'Jobseeker',
        email: profile.email || '—',
        phone: profile.phone || '—',
        address: profile.address || '—',
        gender: profile.gender || '—',
        civilStatus: profile.civil_status || '—',
        education: profile.education || '—',
        employmentStatus: profile.status === true ? 'Currently Employed' : 'Looking for Work',
        age: profile.age || null,
        preferredJobs: profile.preferred_jobs || [],
        registeredAt: profile.created_at
      }));

      const employerList = (employerProfiles || []).map(profile => ({
        id: profile.id,
        businessName: profile.business_name || '—',
        acronym: profile.acronym || '—',
        establishmentType: profile.establishment_type || '—',
        tin: profile.tin || '—',
        employerType: profile.employer_type || '—',
        totalWorkforce: profile.total_workforce || '—',
        lineOfBusiness: profile.line_of_business || '—',
        fullAddress: profile.full_address || '—',
        ownerName: profile.owner_president_name || '—',
        contactPerson: profile.contact_person_name || '—',
        contactPosition: profile.contact_position || '—',
        telephone: profile.telephone_number || '—',
        mobile: profile.mobile_number || '—',
        fax: profile.fax_number || '—',
        contactEmail: profile.contact_email || profile.email || '—',
        registeredAt: profile.created_at,
        updatedAt: profile.updated_at || null
      }));

      const vacancyList = (validJobs || []).map(job => ({
        id: job.id,
        jobPosition: job.position_title || job.title || job.job_title || 'Untitled Vacancy',
        employerName: job.employer_profiles?.business_name || '—',
        employerAcronym: job.employer_profiles?.acronym || '—',
        employerAddress: job.employer_profiles?.full_address || '—',
        employerType: job.employer_profiles?.employer_type || '—',
        jobLocation: job.job_location || job.work_location || job.place_of_work || '—',
        employmentType: job.employment_type || job.employment_type_text || job.nature_of_work || '—',
        vacancyCount: job.vacancy_count || job.total_positions || '—',
        salaryRange: job.salary_range || job.salary || '—',
        description: job.job_description || job.description || '—',
        qualifications: job.other_qualifications || job.qualifications || '—',
        education: job.educational_level || '—',
        experience: job.work_experience_months || job.required_experience || '—',
        acceptsPwd: job.accepts_pwd ? 'Yes' : 'No',
        acceptsOfw: job.accepts_ofw ? 'Yes' : 'No',
        license: job.license || '—',
        eligibility: job.eligibility || '—',
        certification: job.certification || '—',
        languages: job.language_dialect || '—',
        postedAt: job.created_at,
        validUntil: job.valid_until || '—',
        status: job.status || 'approved'
      }));

      const jobMap = new Map(vacancyList.map(job => [job.id, job]));
      const jobseekerMap = new Map((jobseekerProfiles || []).map(profile => [profile.id, profile]));

      const referralStatuses = new Set(['referred']);
      const placementStatuses = new Set(['accepted', 'hired', 'placed']);

      const referralList = (applications || [])
        .filter(app => {
          // Only include referrals for jobs that still exist (from valid employers)
          if (!app.job_id || !jobMap.has(app.job_id)) {
            return false;
          }
          return referralStatuses.has((app.status || '').toLowerCase());
        })
        .map(app => {
          const job = jobMap.get(app.job_id) || {};
          const seeker = jobseekerMap.get(app.jobseeker_id) || {};
          const seekerName = formatJobseekerName(seeker) || seeker.email || 'Jobseeker';

          return {
            id: app.id,
            jobTitle: job.jobPosition || 'Job Vacancy',
            employer: job.employerName || '—',
            employerAddress: job.employerAddress || '—',
            jobseeker: seekerName,
            jobseekerGender: seeker.gender || '—',
            appliedAt: app.applied_at || app.created_at
          };
        });

      const normalizePlacementStatus = (status) => {
        const normalized = (status || '').toLowerCase();
        if (['approved', 'accepted', 'hired', 'placed'].includes(normalized)) {
          return 'Hired';
        }
        if (!status) return 'Completed';
        return status.charAt(0).toUpperCase() + status.slice(1);
      };

      const placementList = (applications || [])
        .filter(app => {
          // Only include placements for jobs that still exist (from valid employers)
          if (!app.job_id || !jobMap.has(app.job_id)) {
            return false;
          }
          return placementStatuses.has((app.status || '').toLowerCase());
        })
        .map(app => {
          const job = jobMap.get(app.job_id) || {};
          const seeker = jobseekerMap.get(app.jobseeker_id) || {};
          const seekerName = formatJobseekerName(seeker) || seeker.email || 'Jobseeker';

          return {
            id: app.id,
            jobTitle: job.jobPosition || 'Job Vacancy',
            employer: job.employerName || '—',
            employerAddress: job.employerAddress || '—',
            employerType: job.employerType || '—',
            jobseeker: seekerName,
            jobseekerGender: seeker.gender || '—',
            status: normalizePlacementStatus(app.status),
            appliedAt: app.applied_at || app.created_at
          };
        });

      const analyticsSummary = [
        { id: 'total-jobseekers', metric: 'Registered Jobseekers', value: jobseekerList.length },
        { id: 'total-employers', metric: 'Registered Employers', value: employerList.length },
        { id: 'total-vacancies', metric: 'Approved Vacancies', value: vacancyList.length },
        { id: 'total-referrals', metric: 'Referrals', value: referralList.length },
        { id: 'total-placements', metric: 'Job Placements', value: placementList.length }
      ];

      setAnalyticsData({
        analytics: analyticsSummary,
        jobseekers: jobseekerList,
        employers: employerList,
        vacancies: vacancyList,
        referrals: referralList,
        placements: placementList
      });

      setError('');
      setIsDataLoaded(true);
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setError(`Failed to load analytics: ${err.message}`);
      setIsDataLoaded(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalyticsData();
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_login_time');
      localStorage.removeItem('admin_email');
      await supabase.auth.signOut();
      setAdminEmail('');
      navigate(loginPath);
    } catch (err) {
      console.error('Error during admin logout:', err);
      navigate(loginPath);
    }
  };

  const analyticsCounts = {
    analytics: analyticsData.analytics.length,
    jobseekers: analyticsData.jobseekers.length,
    employers: analyticsData.employers.length,
    vacancies: analyticsData.vacancies.length,
    referrals: analyticsData.referrals.length,
    placements: analyticsData.placements.length
  };

  const analyticsConfig = {
    analytics: {
      label: 'Analytics',
      description: 'Quick overview of key system metrics.',
      columns: [
        { header: 'Metric', accessor: item => item.metric, csvAccessor: item => item.metric || '' },
        { header: 'Value', accessor: item => item.value.toString(), csvAccessor: item => String(item.value ?? '') }
      ],
      empty: 'No analytics summary available.'
    },
    jobseekers: {
      label: 'Registered Jobseekers',
      description: 'List of jobseekers who have created their accounts.',
      columns: [
        { header: 'Name', accessor: item => item.name, csvAccessor: item => item.name || '' },
        { header: 'Email', accessor: item => item.email, csvAccessor: item => item.email || '' },
        { header: 'Phone', accessor: item => item.phone || '—', csvAccessor: item => item.phone || '' },
        { header: 'Address', accessor: item => item.address || '—', csvAccessor: item => item.address || '' },
        { header: 'Gender', accessor: item => item.gender || '—', csvAccessor: item => item.gender || '' },
        { header: 'Civil Status', accessor: item => item.civilStatus || '—', csvAccessor: item => item.civilStatus || '' },
        { header: 'Education', accessor: item => item.education || '—', csvAccessor: item => item.education || '' },
        { header: 'Employment Status', accessor: item => item.employmentStatus || '—', csvAccessor: item => item.employmentStatus || '' },
        { header: 'Registered On', accessor: item => item.registeredAt ? new Date(item.registeredAt).toLocaleDateString('en-CA') : '—', csvAccessor: item => item.registeredAt ? new Date(item.registeredAt).toISOString().split('T')[0] : '' }
      ],
      empty: 'No jobseekers registered yet.'
    },
    employers: {
      label: 'Registered Employers',
      description: 'Businesses and organizations registered in the system.',
      columns: [
        { header: 'Business Name', accessor: item => item.businessName, csvAccessor: item => item.businessName || '' },
        { header: 'Acronym', accessor: item => item.acronym || '—', csvAccessor: item => item.acronym || '' },
        { header: 'Establishment Type', accessor: item => item.establishmentType || '—', csvAccessor: item => item.establishmentType || '' },
        { header: 'TIN', accessor: item => item.tin || '—', csvAccessor: item => item.tin || '' },
        { header: 'Employer Type', accessor: item => item.employerType || '—', csvAccessor: item => item.employerType || '' },
        { header: 'Total Workforce', accessor: item => item.totalWorkforce || '—', csvAccessor: item => item.totalWorkforce || '' },
        { header: 'Line of Business', accessor: item => item.lineOfBusiness || '—', csvAccessor: item => item.lineOfBusiness || '' },
        { header: 'Full Address', accessor: item => item.fullAddress || '—', csvAccessor: item => item.fullAddress || '' },
        { header: 'Owner/President', accessor: item => item.ownerName || '—', csvAccessor: item => item.ownerName || '' },
        { header: 'Contact Person', accessor: item => item.contactPerson || '—', csvAccessor: item => item.contactPerson || '' },
        { header: 'Contact Position', accessor: item => item.contactPosition || '—', csvAccessor: item => item.contactPosition || '' },
        { header: 'Telephone Number', accessor: item => item.telephone || '—', csvAccessor: item => item.telephone || '' },
        { header: 'Mobile Number', accessor: item => item.mobile || '—', csvAccessor: item => item.mobile || '' },
        { header: 'Fax Number', accessor: item => item.fax || '—', csvAccessor: item => item.fax || '' },
        { header: 'Contact Email', accessor: item => item.contactEmail || '—', csvAccessor: item => item.contactEmail || '' },
        { header: 'Registered On', accessor: item => item.registeredAt ? new Date(item.registeredAt).toLocaleDateString('en-CA') : '—', csvAccessor: item => item.registeredAt ? new Date(item.registeredAt).toISOString().split('T')[0] : '' },
        { header: 'Last Updated', accessor: item => item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-CA') : '—', csvAccessor: item => item.updatedAt ? new Date(item.updatedAt).toISOString().split('T')[0] : '' }
      ],
      empty: 'No employers registered yet.'
    },
    vacancies: {
      label: 'Vacancies Solicited',
      description: 'Approved job vacancies submitted by employers.',
      columns: [
        { header: 'Job Position', accessor: item => item.jobPosition, csvAccessor: item => item.jobPosition || '' },
        { header: 'Employer', accessor: item => item.employerName || '—', csvAccessor: item => item.employerName || '' },
        { header: 'Acronym', accessor: item => item.employerAcronym || '—', csvAccessor: item => item.employerAcronym || '' },
        { header: 'Employer Address', accessor: item => item.employerAddress || '—', csvAccessor: item => item.employerAddress || '' },
        { header: 'Job Location', accessor: item => item.jobLocation || '—', csvAccessor: item => item.jobLocation || '' },
        { header: 'Nature of Work', accessor: item => item.employmentType || '—', csvAccessor: item => item.employmentType || '' },
        { header: 'Vacancies', accessor: item => item.vacancyCount || '—', csvAccessor: item => item.vacancyCount || '' },
        { header: 'Salary Range', accessor: item => item.salaryRange || '—', csvAccessor: item => item.salaryRange || '' },
        { header: 'Education', accessor: item => item.education || '—', csvAccessor: item => item.education || '' },
        { header: 'Experience (months)', accessor: item => item.experience || '—', csvAccessor: item => item.experience || '' },
        { header: 'Accepts PWD', accessor: item => item.acceptsPwd || '—', csvAccessor: item => item.acceptsPwd || '' },
        { header: 'Accepts OFW', accessor: item => item.acceptsOfw || '—', csvAccessor: item => item.acceptsOfw || '' },
        { header: 'License', accessor: item => item.license || '—', csvAccessor: item => item.license || '' },
        { header: 'Eligibility', accessor: item => item.eligibility || '—', csvAccessor: item => item.eligibility || '' },
        { header: 'Certification', accessor: item => item.certification || '—', csvAccessor: item => item.certification || '' },
        { header: 'Languages', accessor: item => item.languages || '—', csvAccessor: item => item.languages || '' },
        { header: 'Qualifications', accessor: item => item.qualifications || '—', csvAccessor: item => item.qualifications || '' },
        { header: 'Description', accessor: item => item.description || '—', csvAccessor: item => item.description || '' },
        { header: 'Posted On', accessor: item => item.postedAt ? new Date(item.postedAt).toLocaleDateString('en-CA') : '—', csvAccessor: item => item.postedAt ? new Date(item.postedAt).toISOString().split('T')[0] : '' },
        { header: 'Valid Until', accessor: item => item.validUntil && item.validUntil !== '—' ? new Date(item.validUntil).toLocaleDateString('en-CA') : '—', csvAccessor: item => item.validUntil && item.validUntil !== '—' ? new Date(item.validUntil).toISOString().split('T')[0] : '' }
      ],
      empty: 'No approved job vacancies found.'
    },
    referrals: {
      label: 'Referrals',
      description: 'Applications referred by the admin team.',
      columns: [
        { header: 'Job Position', accessor: item => item.jobTitle, csvAccessor: item => item.jobTitle || '' },
        { header: 'Employer', accessor: item => item.employer || '—', csvAccessor: item => item.employer || '' },
        { header: 'Employer Address', accessor: item => item.employerAddress || '—', csvAccessor: item => item.employerAddress || '' },
        { header: 'Jobseeker', accessor: item => item.jobseeker, csvAccessor: item => item.jobseeker || '' },
        { header: 'Jobseeker Gender', accessor: item => item.jobseekerGender || '—', csvAccessor: item => item.jobseekerGender || '' },
        { header: 'Referral Date', accessor: item => item.appliedAt ? new Date(item.appliedAt).toLocaleDateString('en-CA') : '—', csvAccessor: item => item.appliedAt ? new Date(item.appliedAt).toISOString().split('T')[0] : '' }
      ],
      empty: 'No referrals recorded yet.'
    },
    placements: {
      label: 'Job Placements',
      description: 'Successful job placements recorded within the system.',
      columns: [
        { header: 'Job Position', accessor: item => item.jobTitle, csvAccessor: item => item.jobTitle || '' },
        { header: 'Employer', accessor: item => item.employer || '—', csvAccessor: item => item.employer || '' },
        { header: 'Employer Address', accessor: item => item.employerAddress || '—', csvAccessor: item => item.employerAddress || '' },
        { header: 'Employer Type', accessor: item => item.employerType || '—', csvAccessor: item => item.employerType || '' },
        { header: 'Jobseeker', accessor: item => item.jobseeker, csvAccessor: item => item.jobseeker || '' },
        { header: 'Jobseeker Gender', accessor: item => item.jobseekerGender || '—', csvAccessor: item => item.jobseekerGender || '' },
        { header: 'Status', accessor: item => item.status || 'Completed', csvAccessor: item => item.status || 'Completed' },
        { header: 'Date', accessor: item => item.appliedAt ? new Date(item.appliedAt).toLocaleDateString('en-CA') : '—', csvAccessor: item => item.appliedAt ? new Date(item.appliedAt).toISOString().split('T')[0] : '' }
      ],
      empty: 'No job placements recorded yet.'
    }
  };

  const filterRowsByDate = (rows, getDateValue, range) => {
    if (!rows.length) return rows;

    const fromTime = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
    const toTime = range.to ? new Date(`${range.to}T23:59:59`).getTime() : null;

    if (!fromTime && !toTime) return rows;

    return rows.filter((item) => {
      const dateValue = getDateValue(item);
      if (!dateValue) return false;
      const itemTime = new Date(dateValue).getTime();
      if (Number.isNaN(itemTime)) return false;
      if (fromTime && itemTime < fromTime) return false;
      if (toTime && itemTime > toTime) return false;
      return true;
    });
  };

  const getFilteredRows = () => {
    const rows = analyticsData[analyticsTab] || [];

    switch (analyticsTab) {
      case 'jobseekers':
        return filterRowsByDate(rows, (item) => item.registeredAt, jobseekerDateRange);
      case 'employers':
        return filterRowsByDate(rows, (item) => item.registeredAt, employerDateRange);
      case 'vacancies':
        return filterRowsByDate(rows, (item) => item.postedAt, employerDateRange);
      case 'referrals':
        return filterRowsByDate(rows, (item) => item.appliedAt, referralDateRange);
      case 'placements':
        return filterRowsByDate(rows, (item) => item.appliedAt, placementDateRange);
      default:
        return rows;
    }
  };

  const handleExportCsv = () => {
    const activeConfig = analyticsConfig[analyticsTab];
    if (!activeConfig) return;
    const rows = getFilteredRows();
    if (!rows.length) return;

    const headers = activeConfig.columns.map(col => col.header);
    const csvLines = [headers.join(',')];

    const escapeCsv = (value) => {
      if (value === null || value === undefined) return '';
      let stringValue = String(value).trim();
      stringValue = stringValue
        .replaceAll('\r\n', ' ')
        .replaceAll('\n', ' ')
        .replaceAll('\r', ' ');

      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replaceAll('"', '""')}"`;
      }
      return stringValue;
    };

    for (const row of rows) {
    const line = activeConfig.columns
        .map(col => escapeCsv(col.csvAccessor ? col.csvAccessor(row) : col.accessor(row)))
        .join(',');
      csvLines.push(line);
    }

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analyticsTab}-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const renderDateFilters = () => {
    let range = null;
    let setRange = null;

    switch (analyticsTab) {
      case 'jobseekers':
        range = jobseekerDateRange;
        setRange = setJobseekerDateRange;
        break;
      case 'employers':
      case 'vacancies':
        range = employerDateRange;
        setRange = setEmployerDateRange;
        break;
      case 'referrals':
        range = referralDateRange;
        setRange = setReferralDateRange;
        break;
      case 'placements':
        range = placementDateRange;
        setRange = setPlacementDateRange;
        break;
      default:
        return null;
    }

    const baseId = `${analyticsTab}-date`;
    const isRangeEmpty = !range.from && !range.to;

    return (
      <div className="analytics-filters">
        <div className="date-filter-group">
          <label htmlFor={`${baseId}-from`}>From</label>
          <input
            id={`${baseId}-from`}
            type="date"
            value={range.from}
            onChange={(e) => setRange(prev => ({ ...prev, from: e.target.value }))}
          />
        </div>
        <div className="date-filter-group">
          <label htmlFor={`${baseId}-to`}>To</label>
          <input
            id={`${baseId}-to`}
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => setRange(prev => ({ ...prev, to: e.target.value }))}
          />
        </div>
        <button
          type="button"
          className="analytics-export-btn"
          onClick={handleExportCsv}
        >
          ⬇️ Download CSV
        </button>
        <button
          type="button"
          className="analytics-reset-btn"
          onClick={() => setRange({ from: '', to: '' })}
          disabled={isRangeEmpty}
        >
          Reset
        </button>
      </div>
    );
  };

  const renderAnalyticsTable = () => {
    if (!isDataLoaded) {
      return (
        <div className="analytics-loading">
          <p>Loading analytics data...</p>
        </div>
      );
    }

    const activeConfig = analyticsConfig[analyticsTab];
    const rows = getFilteredRows();

    if (!rows.length) {
      return <div className="analytics-empty">{activeConfig.empty}</div>;
    }

    if (analyticsTab === 'analytics') {
      return (
        <div className="analytics-analytics-view">
          <div className="chart-period-filter">
            <label htmlFor="chart-period-select">Filter by Period:</label>
            <select
              id="chart-period-select"
              value={chartPeriod}
              onChange={(e) => setChartPeriod(e.target.value)}
              className="chart-period-select"
            >
              <option value="all">All Time</option>
              <option value="monthly">Monthly (Last 30 days)</option>
              <option value="quarterly">Quarterly (Last 90 days)</option>
              <option value="yearly">Yearly (Last 365 days)</option>
            </select>
          </div>
          <div className="analytics-charts">
            {barChartData && (
              <div className="chart-card">
                <div className="chart-card-header">
                  <h3>System Totals</h3>
                  <p>Current counts across major PESDO metrics.</p>
                </div>
                <div className="chart-canvas">
                  <Bar data={barChartData} options={barChartOptions} />
                </div>
              </div>
            )}
            {doughnutData && (
              <div className="chart-card">
                <div className="chart-card-header">
                  <h3>Engagement Snapshot</h3>
                  <p>Placements, referrals, and employer participation.</p>
                </div>
                <div className="chart-canvas">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
              </div>
            )}
            {topPreferredJobsChartData && topPreferredJobsChartData.labels.length > 0 && (
              <div className="chart-card">
                <div className="chart-card-header">
                  <h3>Top 10 Preferred Jobs</h3>
                  <p>Most popular job preferences from jobseekers.</p>
                </div>
                <div className="chart-canvas">
                  <Bar data={topPreferredJobsChartData} options={demographicsBarChartOptions} />
                </div>
              </div>
            )}
            {topJobPositionsChartData && topJobPositionsChartData.labels.length > 0 && (
              <div className="chart-card">
                <div className="chart-card-header">
                  <h3>Top 10 Job Positions</h3>
                  <p>Most posted job positions by employers.</p>
                </div>
                <div className="chart-canvas">
                  <Bar data={topJobPositionsChartData} options={demographicsBarChartOptions} />
                </div>
              </div>
            )}
          </div>

          <div className="jobseeker-demographics-section">
            <h2 className="demographics-section-title">Jobseeker Demographics</h2>
            <div className="demographics-charts-grid">
              {genderChartData && genderChartData.labels.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3>Gender Distribution</h3>
                    <p>Breakdown of jobseekers by gender.</p>
                  </div>
                  <div className="chart-canvas">
                    <Bar data={genderChartData} options={demographicsBarChartOptions} />
                  </div>
                </div>
              )}

              {civilStatusChartData && civilStatusChartData.labels.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3>Civil Status</h3>
                    <p>Distribution of jobseekers by civil status.</p>
                  </div>
                  <div className="chart-canvas">
                    <Bar data={civilStatusChartData} options={demographicsBarChartOptions} />
                  </div>
                </div>
              )}

              {ageGroupChartData && ageGroupChartData.labels.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3>Age Groups</h3>
                    <p>Jobseekers categorized by age ranges.</p>
                  </div>
                  <div className="chart-canvas">
                    <Bar data={ageGroupChartData} options={demographicsBarChartOptions} />
                  </div>
                </div>
              )}

              {employmentStatusChartData && employmentStatusChartData.labels.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3>Employment Status</h3>
                    <p>Current employment status of jobseekers.</p>
                  </div>
                  <div className="chart-canvas">
                    <Bar data={employmentStatusChartData} options={demographicsBarChartOptions} />
                  </div>
                </div>
              )}

              {educationChartData && educationChartData.labels.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3>Education Level</h3>
                    <p>Educational attainment of jobseekers.</p>
                  </div>
                  <div className="chart-canvas">
                    <Bar data={educationChartData} options={demographicsBarChartOptions} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="employer-demographics-section">
            <h2 className="demographics-section-title">Employer Demographics</h2>
            <div className="demographics-charts-grid">
              {lineOfBusinessChartData && lineOfBusinessChartData.labels.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3>Line of Business</h3>
                    <p>Distribution of employers by line of business.</p>
                  </div>
                  <div className="chart-canvas">
                    <Bar data={lineOfBusinessChartData} options={demographicsBarChartOptions} />
                  </div>
                </div>
              )}

              {establishmentTypeChartData && establishmentTypeChartData.labels.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3>Establishment Type</h3>
                    <p>Distribution of employers by establishment type.</p>
                  </div>
                  <div className="chart-canvas">
                    <Bar data={establishmentTypeChartData} options={demographicsBarChartOptions} />
                  </div>
                </div>
              )}

              {employerTypeChartData && employerTypeChartData.labels.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3>Employer Type</h3>
                    <p>Distribution of employers by type (Public/Private).</p>
                  </div>
                  <div className="chart-canvas">
                    <Bar data={employerTypeChartData} options={demographicsBarChartOptions} />
                  </div>
                </div>
              )}

              {totalWorkforceChartData && totalWorkforceChartData.labels.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3>Total Workforce</h3>
                    <p>Distribution of employers by workforce size.</p>
                  </div>
                  <div className="chart-canvas">
                    <Bar data={totalWorkforceChartData} options={demographicsBarChartOptions} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <table className="analytics-table">
        <thead>
          <tr>
            {activeConfig.columns.map(col => (
              <th key={col.header}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(item => (
            <tr key={item.id || JSON.stringify(item)}>
              {activeConfig.columns.map(col => (
                <td key={col.header}>{col.accessor(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊', exact: true },
    { path: '/admin/users', label: 'User Management', icon: '👥' },
    { path: '/admin/jobs', label: 'Manage Jobs', icon: '💼' },
    { path: '/admin/verification', label: 'Employer Verification', icon: '🔍' },
    { path: '/admin/analytics', label: 'Analytics', icon: '📈' },
  ];

  const superAdminNavItems = [
    { path: '/admin/logs', label: 'System Logs', icon: '📋' },
    { path: '/admin/settings', label: 'Admin Management', icon: '⚙️' },
  ];

  const isActive = (path, exact = false) => {
    const pathOnly = path.split('?')[0];
    if (exact) {
      return location.pathname === pathOnly;
    }
    if (pathOnly === '/admin/dashboard') {
      return location.pathname === pathOnly;
    }
    return location.pathname.startsWith(pathOnly);
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard admin-analytics-page">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>PESDO</h2>
        </div>
        <nav className="sidebar-nav">
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.path}>
                <button
                  className={`nav-item ${isActive(item.path, item.exact) ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              </li>
            ))}
            {adminRole === 'super_admin' && (
              <>
                <li className="nav-divider">
                  <span>Super Admin</span>
                </li>
                {superAdminNavItems.map((item) => (
                  <li key={item.path}>
                    <button
                      className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                      onClick={() => navigate(item.path)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <p className="user-email">{adminEmail}</p>
            <p className="user-role">{adminRole === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
          </div>
          <button onClick={handleLogout} className="sidebar-logout">
            <span className="nav-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-content-wrapper">
        <header className="admin-dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <h1>Analytics &amp; Reports</h1>
            </div>
            <div className="header-right">
              <button onClick={handleRefresh} className="refresh-btn">
                🔄 Refresh
              </button>
              <button
                onClick={() => navigate(dashboardPath)}
                className="analytics-back-btn"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <main className="admin-dashboard-main analytics-main">
        {error && (
          <div className="error-banner">
            <p>⚠️ {error}</p>
            <button onClick={handleRefresh} className="retry-btn">
              Try Again
            </button>
          </div>
        )}

        <section className="analytics-section">
          <h2>System Analytics</h2>
          <div className="analytics-tabs">
            {Object.keys(analyticsConfig).map(key => (
              <button
                key={key}
                type="button"
                className={`analytics-tab ${analyticsTab === key ? 'active' : ''}`}
                onClick={() => setAnalyticsTab(key)}
              >
                {analyticsConfig[key].label}
                {key !== 'analytics' && <span className="analytics-tab-count">{analyticsCounts[key]}</span>}
              </button>
            ))}
          </div>
          <div className="analytics-tab-description">
            {analyticsConfig[analyticsTab].description}
          </div>
          {renderDateFilters()}
          <div className="analytics-table-wrapper">
            <div className="analytics-table-container">
              {renderAnalyticsTable()}
            </div>
          </div>
        </section>
        </main>
      </div>
    </div>
  );
};

export default AdminAnalytics;

