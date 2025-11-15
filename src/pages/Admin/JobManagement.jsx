import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { logActivity } from '../../utils/activityLogger';
import { useAuth } from '../../contexts/AuthContext';
import './JobManagement.css';

const JobManagement = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingJobs, setPendingJobs] = useState([]);
  const [approvedJobs, setApprovedJobs] = useState([]);
  const [rejectedJobs, setRejectedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [adminRole, setAdminRole] = useState(null);

  useEffect(() => {
    fetchJobs();
    fetchAdminRole();
  }, []);

  const fetchAdminRole = async () => {
    if (currentUser?.id) {
      try {
        const { data: adminProfile, error } = await supabase
          .from('admin_profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single();
        
        if (!error && adminProfile) {
          setAdminRole(adminProfile.role || 'admin');
        } else {
          setAdminRole('admin');
        }
      } catch (error) {
        console.error('Error fetching admin role:', error);
        setAdminRole('admin');
      }
    }
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
          .select('id, business_name')
          .in('id', Array.from(employerIds));

        if (employerError) {
          console.error('Error fetching employer data:', employerError);
        } else {
          employerMap = Object.fromEntries(
            (employerData || []).map((emp) => [emp.id, emp.business_name])
          );
        }
      }

      const pendingList = [];
      const rejectedList = [];

      for (const job of pendingRows) {
        const status = (job.status || 'pending').toLowerCase();
        const enrichedJob = {
          ...job,
          business_name: employerMap[job.employer_id] || 'Company Name Not Provided'
        };

        if (status === 'rejected' || status === 'expired') {
          rejectedList.push(enrichedJob);
        } else if (status === 'approved') {
          // approved jobs will be handled from the jobs table
          continue;
        } else {
          pendingList.push(enrichedJob);
        }
      }

      const approvedList = approvedRows
        .filter((job) => {
          const status = (job.status || '').toLowerCase();
          return status === 'approved' || status === 'active';
        })
        .map((job) => ({
          ...job,
          business_name: employerMap[job.employer_id] || 'Company Name Not Provided'
        }));

      setPendingJobs(pendingList);
      setApprovedJobs(approvedList);
      setRejectedJobs(rejectedList);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError(err.message);
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
      const cleaned = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
        .filter(Boolean);
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

  const handleApproveJob = async (jobId) => {
    try {
      const { data: pendingJob, error: fetchError } = await supabase
        .from('jobvacancypending')
        .select('*')
        .eq('id', jobId)
        .single();

      if (fetchError) throw fetchError;

      const pwdTypes = sanitizeArray(pendingJob.pwd_types);
      const postingDate =
        pendingJob.posting_date ||
        (pendingJob.created_at
          ? new Date(pendingJob.created_at).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10));

      const approvedPayload = {
        id: pendingJob.id,
        employer_id: pendingJob.employer_id,
        posted_by: pendingJob.employer_id,
        salary_range: sanitizeText(pendingJob.salary_range),
        status: 'approved',
        nature_of_work: sanitizeText(pendingJob.nature_of_work),
        vacancy_count: sanitizeNumber(pendingJob.vacancy_count),
        work_experience_months: sanitizeNumber(pendingJob.work_experience_months),
        other_qualifications: sanitizeText(pendingJob.other_qualifications),
        educational_level: sanitizeText(pendingJob.educational_level),
        course_shs_strand: sanitizeText(pendingJob.course_shs_strand),
        license: sanitizeText(pendingJob.license),
        eligibility: sanitizeText(pendingJob.eligibility),
        certification: sanitizeText(pendingJob.certification),
        language_dialect: sanitizeText(pendingJob.language_dialect),
        accepts_pwd: sanitizeText(pendingJob.accepts_pwd),
        pwd_types: pwdTypes,
        pwd_others_specify: sanitizeText(pendingJob.pwd_others_specify),
        accepts_ofw: sanitizeText(pendingJob.accepts_ofw),
        posting_date: postingDate,
        valid_until: pendingJob.valid_until || null,
        position_title: sanitizeText(pendingJob.position_title),
        job_description: sanitizeText(pendingJob.job_description),
        place_of_work: sanitizeText(pendingJob.place_of_work || pendingJob.job_location),
        created_at: pendingJob.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: insertedJob, error: insertError } = await supabase
        .from('jobs')
        .upsert([approvedPayload], { onConflict: 'id' })
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('jobvacancypending')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert([
        {
          employer_id: pendingJob.employer_id,
          job_id: insertedJob?.id,
          type: 'job_approved',
          title: 'Job Vacancy Approved! 🎉',
          message: `Your job vacancy for "${pendingJob.position_title}" has been approved and is now live on the platform.`
        }
      ]);

      fetchJobs();
    } catch (err) {
      console.error('Error approving job:', err);
      setError(err.message);
    }
  };

  const handleRejectJob = async (jobId, customReason = null) => {
    try {
      const { data: pendingJob, error: fetchError } = await supabase
        .from('jobvacancypending')
        .select('*')
        .eq('id', jobId)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from('jobvacancypending')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert([
        {
          employer_id: pendingJob.employer_id,
          job_id: pendingJob.id,
          type: 'job_rejected',
          title: 'Job Vacancy Rejected ❌',
          message: customReason
            ? `Your job vacancy for "${pendingJob.position_title}" has been rejected. Reason: ${customReason}`
            : `Your job vacancy for "${pendingJob.position_title}" has been rejected. Please review the requirements and submit again.`
        }
      ]);

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

        await logActivity({
          userId: currentUser.id,
          userType: adminRole === 'super_admin' ? 'super_admin' : 'admin',
          actionType: 'job_rejected',
          actionDescription: `${adminName} rejected job vacancy: ${pendingJob.position_title}`,
          entityType: 'job',
          entityId: pendingJob.id,
          metadata: {
            adminName: adminName,
            jobTitle: pendingJob.position_title,
            employerId: pendingJob.employer_id,
            rejectionReason: customReason
          }
        });
      }

      fetchJobs();
    } catch (err) {
      console.error('Error rejecting job:', err);
      setError(err.message);
    }
  };

  const handleDeleteApprovedJob = async (job) => {
    try {
      const { error: deleteError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', job.id);

      if (deleteError) throw deleteError;

      if (job.employer_id && job.position_title) {
        let updateQuery = supabase
          .from('jobvacancypending')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('employer_id', job.employer_id)
          .eq('position_title', job.position_title);

        if (job.posting_date) {
          updateQuery = updateQuery.eq('posting_date', job.posting_date);
        }

        await updateQuery;
      }

      fetchJobs();
    } catch (err) {
      console.error('Error deleting job:', err);
      setError(err.message);
    }
  };

  const handleViewJob = (job, jobType = 'pending') => {
    console.log('👁️ Viewing job details:', job);
    console.log('🏢 Business name in job data:', job.business_name);
    console.log('📋 Job type:', jobType);
    setSelectedJob({ ...job, jobType });
    setShowJobModal(true);
  };

  const handleCloseJobModal = () => {
    setSelectedJob(null);
    setShowJobModal(false);
  };

  const handleRejectClick = (job) => {
    setJobToReject(job);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleCloseRejectModal = () => {
    setShowRejectModal(false);
    setJobToReject(null);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!jobToReject) return;
    
    try {
      await handleRejectJob(jobToReject.id, rejectionReason);
      handleCloseRejectModal();
    } catch (error) {
      console.error('Error rejecting job:', error);
    }
  };

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

  const renderPendingJobs = () => (
    <div className="jobs-section">
      <div className="section-header">
        <h3>Pending Job Vacancies</h3>
        <span className="count-badge">{pendingJobs.length}</span>
      </div>
      
      {pendingJobs.length === 0 ? (
        <div className="no-data-message">
          <p>No pending job vacancies</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {pendingJobs.map((job) => (
            <div key={job.id} className="job-card">
              <div className="job-header">
                <h4>{job.business_name || 'Company Name Not Provided'}</h4>
                <span className="status-badge pending">Pending</span>
                <div className="detail-item">
                  <span>Position</span>
                  <span>{job.position_title || 'Untitled role'}</span>
                </div>
                <div className="detail-item">
                  <span>Location</span>
                  <span>{job.place_of_work || job.job_location || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span>Type</span>
                  <span>{job.nature_of_work || job.employment_type || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span>Vacancies</span>
                  <span>{job.vacancy_count || job.total_positions || 'Not specified'}</span>
                </div>
              </div>
              
              <div className="job-details">
                <div className="detail-item">
                  <span className="label">Salary:</span>
                  <span className="value">₱{job.salary_range || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Posted:</span>
                  <span className="value">{formatDate(job.posting_date || job.created_at)}</span>
                </div>
              </div>

              <div className="job-description">
                <p>{job.job_description}</p>
              </div>

              <div className="job-actions">
                <button 
                  className="btn-view"
                  onClick={() => handleViewJob(job, 'pending')}
                >
                  👁️ View Details
                </button>
                <button 
                  className="btn-approve"
                  onClick={() => handleApproveJob(job.id)}
                >
                  Approve
                </button>
                <button 
                  className="btn-reject"
                  onClick={() => handleRejectClick(job)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderApprovedJobs = () => (
    <div className="jobs-section">
      <div className="section-header">
        <h3>Approved Job Vacancies</h3>
        <span className="count-badge">{approvedJobs.length}</span>
      </div>
      
      {approvedJobs.length === 0 ? (
        <div className="no-data-message">
          <p>No approved job vacancies</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {approvedJobs.map((job) => (
            <div key={job.id} className="job-card approved">
              <div className="job-header">
                <h4>{job.position_title || 'Untitled role'}</h4>
                <span className="company-name">{job.business_name || 'Company Name Not Provided'}</span>
                <span className="status-badge approved">Approved</span>
              </div>
              
              <div className="job-details">
                <div className="detail-item">
                  <span className="label">Location:</span>
                  <span className="value">{job.place_of_work || job.job_location || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Salary:</span>
                  <span className="value">₱{job.salary_range || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Nature:</span>
                  <span className="value">{job.nature_of_work || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Vacancies:</span>
                  <span className="value">{job.vacancy_count || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Experience:</span>
                  <span className="value">{job.work_experience_months ? `${job.work_experience_months} months` : 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Education:</span>
                  <span className="value">{job.educational_level || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Posted:</span>
                  <span className="value">{formatDate(job.posting_date || job.created_at)}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Approved:</span>
                  <span className="value">{formatDate(job.updated_at)}</span>
                </div>
              </div>

              <div className="job-description">
                <p>{job.job_description || 'No description provided'}</p>
              </div>

              <div className="job-actions">
                <button 
                  className="btn-delete"
                  onClick={() => handleDeleteApprovedJob(job)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRejectedJobs = () => (
    <div className="jobs-section">
      <div className="section-header">
        <h3>Rejected Job Vacancies</h3>
        <span className="count-badge">{rejectedJobs.length}</span>
      </div>
      
      {rejectedJobs.length === 0 ? (
        <div className="no-data-message">
          <p>No rejected job vacancies</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {rejectedJobs.map((job) => (
            <div key={job.id} className="job-card rejected">
              <div className="job-header">
                <h4>{job.business_name || 'Company Name Not Provided'}</h4>
                <span className="job-title">{job.position_title || 'Job Title Not Provided'}</span>
                <span className="status-badge rejected">Rejected</span>
              </div>
              
              <div className="job-details">
                <div className="detail-item">
                  <span className="label">Location:</span>
                  <span className="value">{job.place_of_work || job.job_location || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Salary:</span>
                  <span className="value">₱{job.salary_range || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Rejected:</span>
                  <span className="value">{formatDate(job.updated_at)}</span>
                </div>
              </div>

              <div className="job-description">
                <p>{job.job_description || 'No description provided'}</p>
              </div>

              <div className="job-actions">
                <button 
                  className="btn-view"
                  onClick={() => handleViewJob(job, 'rejected')}
                >
                  👁️ View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReferJobseeker = () => (
    <div className="jobs-section">
      <div className="section-header">
        <h3>Refer Jobseeker</h3>
        <p className="section-description">Match jobseekers with available job positions</p>
      </div>
      
      <div className="refer-section">
        <div className="refer-info">
          <h4>Jobseeker Referral System</h4>
          <p>This feature allows you to match qualified jobseekers with approved job vacancies based on their skills, experience, and preferences.</p>
          
          <div className="refer-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h5>Review Jobseekers</h5>
                <p>Browse through registered jobseekers and their profiles</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h5>Match Skills</h5>
                <p>Compare jobseeker skills with job requirements</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h5>Send Referral</h5>
                <p>Notify jobseekers about relevant job opportunities</p>
              </div>
            </div>
          </div>

          <div className="refer-actions">
            <button 
              className="btn-primary"
              onClick={() => navigate('/admin/users')}
            >
              View Jobseekers
            </button>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/admin/dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="job-management">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading job data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="job-management">
      {/* Header */}
      <header className="job-management-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Job Management</h1>
            <p>Manage job vacancies and referrals</p>
          </div>
          <div className="header-right">
            <button 
              className="back-button"
              onClick={() => navigate('/admin/dashboard')}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Job Vacancy
          {pendingJobs.length > 0 && (
            <span className="tab-badge">{pendingJobs.length}</span>
          )}
        </button>
        <button 
          className={`tab-button ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          Approved Job Vacancy
          {approvedJobs.length > 0 && (
            <span className="tab-badge">{approvedJobs.length}</span>
          )}
        </button>
        <button 
          className={`tab-button ${activeTab === 'rejected' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejected')}
        >
          Rejected Job Vacancy
          {rejectedJobs.length > 0 && (
            <span className="tab-badge">{rejectedJobs.length}</span>
          )}
        </button>
        <button 
          className={`tab-button ${activeTab === 'refer' ? 'active' : ''}`}
          onClick={() => setActiveTab('refer')}
        >
          Refer Jobseeker
        </button>
      </div>

      <div className="tab-content">
        {error && (
          <div className="error-message">
            <p>Error: {error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {activeTab === 'pending' && renderPendingJobs()}
        {activeTab === 'approved' && renderApprovedJobs()}
        {activeTab === 'rejected' && renderRejectedJobs()}
        {activeTab === 'refer' && renderReferJobseeker()}
      </div>

      {/* Job Details Modal */}
      {showJobModal && selectedJob && (
        <div className="modal-overlay" onClick={handleCloseJobModal}>
          <div className="modal-content job-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Job Details</h2>
            </div>
            
            <div className="modal-body">
              <div className="job-details-content">
                <div className="details-section">
                  <div className="section-header-with-status">
                    <h4>📋 Basic Information</h4>
                    <span className={`status-badge ${selectedJob.status || 'pending'}`}>
                      {selectedJob.status === 'approved' ? '✅ Approved' : 
                       selectedJob.status === 'rejected' ? '❌ Rejected' : 
                       '⏳ Pending'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Job Title:</label>
                    <span>{selectedJob.position_title || selectedJob.job_title || selectedJob.title}</span>
                  </div>
                  <div className="detail-item">
                    <label>Company:</label>
                    <span>{selectedJob.business_name || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Location:</label>
                    <span>{selectedJob.place_of_work || selectedJob.job_location || selectedJob.location}</span>
                  </div>
                  <div className="detail-item">
                    <label>Salary Range:</label>
                    <span>₱{selectedJob.salary_range || selectedJob.salary || 'Not specified'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Nature of Work:</label>
                    <span>{selectedJob.nature_of_work || selectedJob.employment_type || selectedJob.type}</span>
                  </div>
                  <div className="detail-item">
                    <label>Vacancy Count:</label>
                    <span>{selectedJob.vacancy_count || 'Not specified'}</span>
                  </div>
                </div>

                <div className="details-section">
                  <h4>📝 Job Description</h4>
                  <div className="detail-item full-width">
                    <p className="job-description-text">
                      {selectedJob.job_description || selectedJob.description || 'Not provided'}
                    </p>
                  </div>
                </div>

                <div className="details-section">
                  <h4>🎓 Requirements</h4>
                  <div className="detail-item">
                    <label>Education Level:</label>
                    <span>{selectedJob.educational_level || selectedJob.education_level || 'Not specified'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Work Experience:</label>
                    <span>
                      {selectedJob.work_experience_months 
                        ? `${selectedJob.work_experience_months} months` 
                        : 'Not specified'
                      }
                    </span>
                  </div>
                  {selectedJob.other_qualifications && (
                    <div className="detail-item full-width">
                      <label>Other Qualifications:</label>
                      <p className="job-description-text">{selectedJob.other_qualifications}</p>
                    </div>
                  )}
                  {selectedJob.course_shs_strand && (
                    <div className="detail-item">
                      <label>Course/SHS Strand:</label>
                      <span>{selectedJob.course_shs_strand}</span>
                    </div>
                  )}
                  {selectedJob.license && (
                    <div className="detail-item">
                      <label>License Required:</label>
                      <span>{selectedJob.license}</span>
                    </div>
                  )}
                  {selectedJob.eligibility && (
                    <div className="detail-item">
                      <label>Eligibility:</label>
                      <span>{selectedJob.eligibility}</span>
                    </div>
                  )}
                  {selectedJob.certification && (
                    <div className="detail-item">
                      <label>Certification:</label>
                      <span>{selectedJob.certification}</span>
                    </div>
                  )}
                  {selectedJob.language_dialect && (
                    <div className="detail-item">
                      <label>Language/Dialect:</label>
                      <span>{selectedJob.language_dialect}</span>
                    </div>
                  )}
                </div>

                <div className="details-section">
                  <h4>♿ Special Considerations</h4>
                  <div className="detail-item">
                    <label>Accepts PWD:</label>
                    <span>{selectedJob.accepts_pwd === 'Yes' ? '✅ Yes' : selectedJob.accepts_pwd === 'No' ? '❌ No' : 'Not specified'}</span>
                  </div>
                  {selectedJob.accepts_pwd === 'Yes' && selectedJob.pwd_types && selectedJob.pwd_types.length > 0 && (
                    <div className="detail-item">
                      <label>PWD Types Accepted:</label>
                      <span>{selectedJob.pwd_types.join(', ')}</span>
                    </div>
                  )}
                  {selectedJob.pwd_others_specify && (
                    <div className="detail-item">
                      <label>Other PWD Types:</label>
                      <span>{selectedJob.pwd_others_specify}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <label>Accepts OFW:</label>
                    <span>{selectedJob.accepts_ofw === 'Yes' ? '✅ Yes' : selectedJob.accepts_ofw === 'No' ? '❌ No' : 'Not specified'}</span>
                  </div>
                </div>

                <div className="details-section">
                  <h4>📅 Timeline</h4>
                  <div className="detail-item">
                    <label>Posted Date:</label>
                    <span>
                      {new Date(selectedJob.posting_date || selectedJob.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  {selectedJob.valid_until && (
                    <div className="detail-item">
                      <label>Valid Until:</label>
                      <span>
                        {new Date(selectedJob.valid_until).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  {selectedJob.approved_at && (
                    <div className="detail-item">
                      <label>Approved Date:</label>
                      <span>
                        {new Date(selectedJob.approved_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  {selectedJob.rejected_at && (
                    <div className="detail-item">
                      <label>Rejected Date:</label>
                      <span>
                        {new Date(selectedJob.rejected_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {selectedJob.rejection_reason && (
                  <div className="details-section">
                    <h4>📊 Rejection Details</h4>
                    <div className="detail-item full-width">
                      <label>Rejection Reason:</label>
                      <p className="rejection-reason">{selectedJob.rejection_reason}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              {selectedJob.jobType === 'pending' && (
                <>
                  <button 
                    className="btn-approve"
                    onClick={() => {
                      handleApproveJob(selectedJob.id);
                      handleCloseJobModal();
                    }}
                  >
                    ✅ Approve Job
                  </button>
                  <button 
                    className="btn-reject"
                    onClick={() => {
                      handleCloseJobModal();
                      handleRejectClick(selectedJob);
                    }}
                  >
                    ❌ Reject Job
                  </button>
                </>
              )}
              <button 
                className="btn-secondary"
                onClick={handleCloseJobModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectModal && jobToReject && (
        <div className="modal-overlay" onClick={handleCloseRejectModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>❌ Reject Job Vacancy</h2>
              <button className="close-btn" onClick={handleCloseRejectModal}>
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="rejection-modal-content">
                <div className="job-info">
                  <h3>Job Details:</h3>
                  <p><strong>Company:</strong> {jobToReject.business_name || 'Company Name Not Provided'}</p>
                  <p><strong>Position:</strong> {jobToReject.position_title || 'Job Title Not Provided'}</p>
                  <p><strong>Location:</strong> {jobToReject.place_of_work || 'Not specified'}</p>
                </div>
                
                <div className="rejection-reason-section">
                  <label htmlFor="rejection-reason">
                    <strong>Rejection Reason:</strong>
                  </label>
                  <textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a specific reason for rejecting this job vacancy..."
                    rows={4}
                    className="rejection-reason-input"
                  />
                  <p className="help-text">
                    This reason will be sent to the employer in the notification.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={handleCloseRejectModal}
              >
                Cancel
              </button>
              <button 
                className="btn-reject"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobManagement;
