import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { supabaseService } from '../../supabase';
import './JobseekerDashboard.css';

const JobseekerDashboard = () => {
  const { currentUser, userData, logout } = useAuth();
  const jobseekerId = currentUser?.uid;
  
  const [activeTab, setActiveTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [likedJobs, setLikedJobs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    // Personal Information
    first_name: '',
    last_name: '',
    middle_name: '',
    suffix: '',
    age: '',
    email: '',
    contact_no: '',
    address: '',
    gender: '',
    birthdate: '',
    civil_status: '',
    
    // Professional Information
    work_year_experience: '',
    employment_status: '',
    preferred_job_1: '',
    preferred_job_2: '',
    education_attainment: '',
    skills_education: '',
    work_experience: '',
    
    // Files
    profile_picture: null,
    resume: null
  });

  // File upload states
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [resumePreview, setResumePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting', 'connected', 'error'

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setDbStatus('connecting');
      
      if (!jobseekerId) {
        throw new Error('User not authenticated');
      }
      
      const [jobsData, profileData, likedJobsData] = await Promise.all([
        supabaseService.database.jobs.getAll(),
        supabaseService.database.jobseekerProfiles.get(jobseekerId),
        supabaseService.database.jobLikes.getLikedJobs(jobseekerId)
      ]);
      
      setJobs(jobsData);
      setProfile(profileData);
      setLikedJobs(likedJobsData);
      setDbStatus('connected');
      
      // Set profile form data
      if (profileData) {
        setProfileForm({
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          middle_name: profileData.middle_name || '',
          suffix: profileData.suffix || '',
          age: profileData.age || '',
          email: profileData.email || '',
          contact_no: profileData.contact_no || '',
          address: profileData.address || '',
          gender: profileData.gender || '',
          birthdate: profileData.birthdate || '',
          civil_status: profileData.civil_status || '',
          work_year_experience: profileData.work_year_experience || '',
          employment_status: profileData.employment_status || '',
          preferred_job_1: profileData.preferred_job_1 || '',
          preferred_job_2: profileData.preferred_job_2 || '',
          education_attainment: profileData.education_attainment || '',
          skills_education: profileData.skills_education || '',
          work_experience: profileData.work_experience || '',
          profile_picture: null,
          resume: null
        });
        
        // Set file previews if they exist
        if (profileData.profile_picture_url) {
          setProfilePicturePreview(profileData.profile_picture_url);
        }
        if (profileData.resume_url) {
          setResumePreview(profileData.resume_url);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setDbStatus('error');
      setError('Failed to load data from database.');
    } finally {
      setLoading(false);
    }
  };

  const handleLikeJob = async (jobId) => {
    try {
      if (!jobseekerId) {
        throw new Error('User not authenticated');
      }
      
      const isLiked = likedJobs.some(job => job.id === jobId);
      
      if (isLiked) {
        // Unlike the job
        await supabaseService.database.jobLikes.unlike(jobId, jobseekerId);
        setLikedJobs(likedJobs.filter(job => job.id !== jobId));
      } else {
        // Like the job
        await supabaseService.database.jobLikes.like(jobId, jobseekerId);
        const jobToLike = jobs.find(job => job.id === jobId);
        if (jobToLike) {
          setLikedJobs([{ ...jobToLike, liked_at: new Date().toISOString() }, ...likedJobs]);
        }
      }
    } catch (err) {
      console.error('Error toggling job like:', err);
    }
  };

  // File upload handlers
  const handleFileUpload = async (file, type) => {
    if (!file) return null;
    
    try {
      const fileName = `${jobseekerId}_${type}_${Date.now()}_${file.name}`;
      const filePath = `${type}/${fileName}`;
      const url = await supabaseService.storage.uploadFile(file, filePath);
      return url;
    } catch (err) {
      console.error(`Error uploading ${type}:`, err);
      throw err;
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Profile picture must be less than 5MB');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }
      
      setProfileForm(prev => ({ ...prev, profile_picture: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setProfilePicturePreview(e.target.result);
      reader.readAsDataURL(file);
      
      // Clear the input to allow selecting the same file again
      e.target.value = '';
    }
  };

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert('Resume must be less than 10MB');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['.pdf', '.doc', '.docx'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        alert('Please select a valid document file (PDF, DOC, or DOCX)');
        return;
      }
      
      setProfileForm(prev => ({ ...prev, resume: file }));
      
      // Create preview
      setResumePreview(file.name);
      
      // Clear the input to allow selecting the same file again
      e.target.value = '';
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      if (!jobseekerId) {
        throw new Error('User not authenticated');
      }
      
      setUploading(true);
      
      // Keep existing file URLs (file uploads temporarily disabled)
      let profilePictureUrl = profile?.profile_picture_url || null;
      let resumeUrl = profile?.resume_url || null;
      
      // Prepare profile data for update
      const profileData = {
        ...profileForm,
        profile_picture_url: profilePictureUrl,
        resume_url: resumeUrl,
        full_name: `${profileForm.first_name} ${profileForm.last_name}`.trim(),
        updated_at: new Date().toISOString()
      };
      
      // Remove file objects before saving to Firestore
      delete profileData.profile_picture;
      delete profileData.resume;
      
      // Create or update profile in Firebase
      let updateResult;
      try {
        // Try to update first
        updateResult = await supabaseService.database.jobseekerProfiles.upsert(jobseekerId, profileData);
        console.log('Profile updated successfully:', updateResult);
      } catch (error) {
        if (error.code === 'not-found' || error.message.includes('No document to update')) {
          // Document doesn't exist, create it instead
          console.log('Profile document not found, creating new one...');
          updateResult = await firebaseDB.jobseekerProfiles.create(jobseekerId, profileData);
          console.log('Profile created successfully:', updateResult);
        } else {
          // Re-throw other errors
          throw error;
        }
      }
      
      // Update local state
      setProfile({ ...profile, ...profileData });
      
      // Clear form and exit edit mode
      setIsEditingProfile(false);
      
      // Show success message
      alert('Profile updated successfully!');
      
    } catch (err) {
      console.error('Profile update error:', err);
      alert('Failed to update profile: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || job.job_type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div style={{ textAlign: 'center' }}>
            <div className="loading-icon">⏳</div>
            <div>Loading your dashboard...</div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              {!currentUser ? 'Checking authentication...' : 'Fetching your data...'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-message">
          <div style={{ textAlign: 'center' }}>
            <div className="error-icon">⚠️</div>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Something went wrong</div>
            <div>{error}</div>
            <button 
              onClick={() => window.location.reload()} 
              className="retry-btn"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2>Jobseeker</h2>
          <p>Dashboard</p>
          <div className="db-status" style={{ 
            fontSize: '0.8rem', 
            marginTop: '10px',
            padding: '4px 8px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: dbStatus === 'connected' ? 'rgba(34, 197, 94, 0.2)' : 
                           dbStatus === 'error' ? 'rgba(239, 68, 68, 0.2)' : 
                           'rgba(245, 158, 11, 0.2)',
            color: dbStatus === 'connected' ? '#22c55e' : 
                   dbStatus === 'error' ? '#ef4444' : 
                   '#f59e0b'
          }}>
            <span className="status-indicator">
              {dbStatus === 'connected' ? '●' : dbStatus === 'error' ? '●' : '●'}
            </span>
            <span>{dbStatus === 'connected' ? 'DB Connected' : dbStatus === 'error' ? 'DB Error' : 'Connecting...'}</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`sidebar-nav-btn ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            <span className="nav-icon">📋</span>
            Browse Jobs
          </button>
          
          <button 
            className={`sidebar-nav-btn ${activeTab === 'liked' ? 'active' : ''}`}
            onClick={() => setActiveTab('liked')}
          >
            <span className="nav-icon">❤️</span>
            Liked Jobs
            <span className="badge">{likedJobs.length}</span>
          </button>
          
          <button 
            className={`sidebar-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="nav-icon">👤</span>
            My Profile
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {profilePicturePreview ? (
                <img src={profilePicturePreview} alt="Profile" />
              ) : (
                <span className="avatar-placeholder">👤</span>
              )}
            </div>
            <div className="user-details">
              <div className="user-name">
                {profile?.full_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || userData?.username || 'User'}
              </div>
              <div className="user-email">{userData?.email || 'user@email.com'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-logout-btn">
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="main-header">
          <h1>
            {activeTab === 'jobs' && 'Available Jobs'}
            {activeTab === 'liked' && 'Your Liked Jobs'}
            {activeTab === 'profile' && 'My Profile'}
          </h1>
          {activeTab === 'jobs' && (
            <div className="search-filters">
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
          )}
        </div>

        <div className="main-content">
          {activeTab === 'jobs' && (
            <div className="jobs-grid">
              {filteredJobs.map(job => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  isLiked={likedJobs.some(likedJob => likedJob.id === job.id)}
                  onLike={() => handleLikeJob(job.id)}
                />
              ))}
            </div>
          )}

          {activeTab === 'liked' && (
            <div className="jobs-grid">
              {likedJobs.map(job => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  isLiked={true}
                  onLike={() => handleLikeJob(job.id)}
                />
              ))}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="profile-section">
              <div className="profile-header">
                <h2>Profile Information</h2>
                <button 
                  className="edit-btn"
                  onClick={() => {
                    if (isEditingProfile) {
                      // Cancel editing - reset form to original values
                      setProfileForm({
                        first_name: profile?.first_name || '',
                        last_name: profile?.last_name || '',
                        middle_name: profile?.middle_name || '',
                        suffix: profile?.suffix || '',
                        age: profile?.age || '',
                        email: profile?.email || '',
                        contact_no: profile?.contact_no || '',
                        address: profile?.address || '',
                        gender: profile?.gender || '',
                        birthdate: profile?.birthdate || '',
                        civil_status: profile?.civil_status || '',
                        work_year_experience: profile?.work_year_experience || '',
                        employment_status: profile?.employment_status || '',
                        preferred_job_1: profile?.preferred_job_1 || '',
                        preferred_job_2: profile?.preferred_job_2 || '',
                        education_attainment: profile?.education_attainment || '',
                        skills_education: profile?.skills_education || '',
                        work_experience: profile?.work_experience || '',
                        profile_picture: null,
                        resume: null
                      });
                      setProfilePicturePreview(profile?.profile_picture_url || null);
                      setResumePreview(profile?.resume_url ? profile.resume_url.split('/').pop() : null);
                    }
                    setIsEditingProfile(!isEditingProfile);
                  }}
                >
                  {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>
              


              {isEditingProfile ? (
                <form onSubmit={handleProfileUpdate} className="profile-form">
                  {/* Personal Information */}
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={profileForm.first_name}
                      onChange={(e) => setProfileForm({...profileForm, first_name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={profileForm.last_name}
                      onChange={(e) => setProfileForm({...profileForm, last_name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input
                      type="text"
                      value={profileForm.middle_name}
                      onChange={(e) => setProfileForm({...profileForm, middle_name: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Suffix</label>
                    <input
                      type="text"
                      value={profileForm.suffix}
                      onChange={(e) => setProfileForm({...profileForm, suffix: e.target.value})}
                      placeholder="e.g., Jr., Sr., III"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Age</label>
                    <input
                      type="number"
                      value={profileForm.age}
                      onChange={(e) => setProfileForm({...profileForm, age: e.target.value})}
                      min="16"
                      max="100"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Contact Number</label>
                    <input
                      type="tel"
                      value={profileForm.contact_no}
                      onChange={(e) => setProfileForm({...profileForm, contact_no: e.target.value})}
                      placeholder="e.g., 09123456789"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Address</label>
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                      placeholder="Complete address"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Gender</label>
                    <select
                      value={profileForm.gender}
                      onChange={(e) => setProfileForm({...profileForm, gender: e.target.value})}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Birthdate</label>
                    <input
                      type="date"
                      value={profileForm.birthdate}
                      onChange={(e) => setProfileForm({...profileForm, birthdate: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Civil Status</label>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      {['Single', 'Married', 'Separated', 'Widowed'].map(status => (
                        <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <input
                            type="radio"
                            name="civil_status"
                            value={status}
                            checked={profileForm.civil_status === status}
                            onChange={(e) => setProfileForm({...profileForm, civil_status: e.target.value})}
                          />
                          {status}
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Work Year Experience</label>
                    <input
                      type="number"
                      value={profileForm.work_year_experience}
                      onChange={(e) => setProfileForm({...profileForm, work_year_experience: e.target.value})}
                      min="0"
                      placeholder="Number of years"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Employment Status</label>
                    <select
                      value={profileForm.employment_status}
                      onChange={(e) => setProfileForm({...profileForm, employment_status: e.target.value})}
                    >
                      <option value="">Select Status</option>
                      <option value="Unemployed">Unemployed</option>
                      <option value="Employed">Employed</option>
                      <option value="Self-employed">Self-employed</option>
                      <option value="Student">Student</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Preferred Job 1</label>
                    <input
                      type="text"
                      value={profileForm.preferred_job_1}
                      onChange={(e) => setProfileForm({...profileForm, preferred_job_1: e.target.value})}
                      placeholder="e.g., Web Developer"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Preferred Job 2</label>
                    <input
                      type="text"
                      value={profileForm.preferred_job_2}
                      onChange={(e) => setProfileForm({...profileForm, preferred_job_2: e.target.value})}
                      placeholder="e.g., UI/UX Designer"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Education Attainment</label>
                    <select
                      value={profileForm.education_attainment}
                      onChange={(e) => setProfileForm({...profileForm, education_attainment: e.target.value})}
                    >
                      <option value="">Select Education</option>
                      <option value="Elementary">Elementary</option>
                      <option value="High School Graduate">High School Graduate</option>
                      <option value="Some College">Some College</option>
                      <option value="College Graduate">College Graduate</option>
                      <option value="Post Graduate">Post Graduate</option>
                    </select>
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Skills/Education</label>
                    <textarea
                      value={profileForm.skills_education}
                      onChange={(e) => setProfileForm({...profileForm, skills_education: e.target.value})}
                      placeholder="List your skills, certifications, and educational background"
                      rows="4"
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Work Experience</label>
                    <textarea
                      value={profileForm.work_experience}
                      onChange={(e) => setProfileForm({...profileForm, work_experience: e.target.value})}
                      placeholder="Describe your work experience, previous jobs, and responsibilities"
                      rows="4"
                    />
                  </div>
                  
                  {/* File Uploads - Temporarily Disabled */}
                  <div className="form-group upload-group">
                    <div className="profile-picture-section">
                      <label>Profile Picture</label>
                      <div className="upload-area-disabled">
                        <div className="upload-icon">📷</div>
                        <div className="upload-text">
                          File uploads temporarily disabled
                        </div>
                        <div className="upload-hint">Firebase Storage upgrade required</div>
                        <div className="upload-note">
                          You can still edit and save your profile information below
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <label>Resume/CV</label>
                      <div className="upload-area-disabled">
                        <div className="upload-icon">📄</div>
                        <div className="upload-text">
                          File uploads temporarily disabled
                        </div>
                        <div className="upload-hint">Firebase Storage upgrade required</div>
                        <div className="upload-note">
                          You can still edit and save your profile information below
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button type="submit" className="save-btn" disabled={uploading}>
                    {uploading ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              ) : (
                <div className="profile-info">
                  <div className="profile-field">
                    <label>Full Name:</label>
                    <span>{profile?.full_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Email:</label>
                    <span>{profile?.email || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Contact Number:</label>
                    <span>{profile?.contact_no || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Address:</label>
                    <span>{profile?.address || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Age:</label>
                    <span>{profile?.age || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Gender:</label>
                    <span>{profile?.gender || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Civil Status:</label>
                    <span>{profile?.civil_status || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Employment Status:</label>
                    <span>{profile?.employment_status || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Work Experience:</label>
                    <span>{profile?.work_year_experience ? `${profile.work_year_experience} years` : 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Preferred Jobs:</label>
                    <span>
                      {[profile?.preferred_job_1, profile?.preferred_job_2]
                        .filter(Boolean)
                        .join(', ') || 'Not provided'}
                    </span>
                  </div>
                  
                  <div className="profile-field">
                    <label>Education Attainment:</label>
                    <span>{profile?.education_attainment || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field full-width">
                    <label>Skills/Education:</label>
                    <span>{profile?.skills_education || 'Not provided'}</span>
                  </div>
                  
                  <div className="profile-field full-width">
                    <label>Work Experience:</label>
                    <span>{profile?.work_experience || 'Not provided'}</span>
                  </div>
                  
                  {profile?.profile_picture_url && (
                    <div className="profile-field">
                      <label>Profile Picture:</label>
                      <span>✅ Uploaded</span>
                    </div>
                  )}
                  
                  {profile?.resume_url && (
                    <div className="profile-field">
                      <label>Resume:</label>
                      <span>✅ Uploaded</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty states */}
          {activeTab === 'jobs' && filteredJobs.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No jobs found</h3>
              <p>Try adjusting your search criteria or filters.</p>
            </div>
          )}

          {activeTab === 'liked' && likedJobs.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">❤️</div>
              <h3>No liked jobs yet</h3>
              <p>Start browsing jobs and like the ones you're interested in!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Job Card Component
const JobCard = ({ job, isLiked, onLike }) => {
  return (
    <div className="job-card">
      <div className="job-header">
        <h3>{job.title}</h3>
        <button 
          className={`like-btn ${isLiked ? 'liked' : ''}`}
          onClick={onLike}
          aria-label={isLiked ? 'Unlike job' : 'Like job'}
        >
          {isLiked ? '❤️' : '🤍'}
        </button>
      </div>
      
      <div className="job-company">
        <strong>{job.company_name}</strong>
      </div>
      
      <div className="job-details">
        <span className="job-type">{job.job_type}</span>
        <span className="job-location">📍 {job.location}</span>
        <span className="job-salary">💰 {job.salary_range}</span>
      </div>
      
      <div className="job-description">
        <p>{job.description}</p>
      </div>
      
      {job.requirements && (
        <div className="job-requirements">
          <strong>Requirements:</strong>
          <p>{job.requirements}</p>
        </div>
      )}
      
      <div className="job-footer">
        <span className="job-date">
          Posted: {job.created_at ? 
            (job.created_at.toDate ? 
              job.created_at.toDate().toLocaleDateString() : 
              new Date(job.created_at).toLocaleDateString()
            ) : 'Recently'
          }
        </span>
        <button className="apply-btn">Apply Now</button>
      </div>
    </div>
  );
};

export default JobseekerDashboard;