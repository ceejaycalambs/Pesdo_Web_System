import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import NotificationButton from '../../components/NotificationButton';
import { useNavigate } from 'react-router-dom';
import './UserManagement.css';

const UserManagement = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('jobseekers');
  const [jobseekers, setJobseekers] = useState([]);
  const [employers, setEmployers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, userId: null, userType: null, userName: null });
  const [deleteStatus, setDeleteStatus] = useState({ show: false, type: 'success', message: '', details: '', showCancel: false, onConfirm: null, onCancel: null });

  // Realtime notifications
  const {
    notifications: realtimeNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    requestNotificationPermission
  } = useRealtimeNotifications(currentUser?.id, 'admin');

  // Request notification permission on mount
  useEffect(() => {
    if (currentUser?.id) {
      requestNotificationPermission();
    }
  }, [currentUser?.id, requestNotificationPermission]);

  useEffect(() => {
    // Check URL parameter for tab
    const tabParam = searchParams.get('tab');
    if (tabParam === 'employers') {
      setActiveTab('employers');
    }
    fetchUsers();
  }, [searchParams]);

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

    const container = document.querySelector('.user-management');
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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch jobseekers
      const { data: jobseekerData, error: jobseekerError } = await supabase
        .from('jobseeker_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (jobseekerError) {
        console.error('Error fetching jobseekers:', jobseekerError);
        throw jobseekerError;
      }

      // Fetch employers
      const { data: employerData, error: employerError } = await supabase
        .from('employer_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (employerError) {
        console.error('Error fetching employers:', employerError);
        throw employerError;
      }

      setJobseekers(jobseekerData || []);
      setEmployers(employerData || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(`Failed to load users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = (user, userType) => {
    setSelectedUser({ ...user, userType });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  const handleDeleteClick = (userId, userType, userName) => {
    setDeleteConfirm({ show: true, userId, userType, userName });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, userId: null, userType: null, userName: null });
  };

  const handleDeleteConfirm = async () => {
    const { userId, userType } = deleteConfirm;
    setDeleteConfirm({ show: false, userId: null, userType: null, userName: null });

    try {
      // IMPORTANT: Delete auth user FIRST, then delete profile
      // This ensures the user cannot log in even if profile deletion fails
      let authDeleted = false;
      let authError = null;
      
      // Try to delete auth user using RPC function
      // This requires the SQL script to be run in Supabase
      try {
        console.log('🔧 Attempting to delete auth user via RPC function...');
        const { data: rpcResult, error: rpcError } = await supabase.rpc('delete_auth_user', { user_id: userId });
        
        if (rpcError) {
          console.error('❌ RPC function failed:', rpcError);
          authError = rpcError;
          
          // Check if the function doesn't exist (SQL script not run)
          if (rpcError.message?.includes('function') || rpcError.code === '42883') {
            authError = new Error('The delete_auth_user function does not exist. Please run the SQL script: database/delete_auth_user.sql in Supabase SQL Editor.');
          }
        } else if (rpcResult === true) {
          authDeleted = true;
          console.log('✅ Auth user deleted successfully via RPC function');
        } else if (rpcResult === false) {
          // Function returned false - user may not exist or deletion failed
          console.warn('⚠️ RPC function returned false - checking if user exists...');
          // Check if user still exists
          const { data: userCheck } = await supabase.auth.getUser(userId);
          if (userCheck?.user) {
            authError = new Error('Auth user still exists after deletion attempt. The RPC function may not have proper permissions.');
          } else {
            // User doesn't exist, consider it deleted
            authDeleted = true;
            console.log('✅ Auth user does not exist (already deleted or never existed)');
          }
        }
      } catch (authErr) {
        console.error('❌ Auth deletion error:', authErr);
        authError = authErr;
      }

      // If auth deletion failed, warn but continue with profile deletion
      if (!authDeleted && authError) {
        const shouldContinue = window.confirm(
          `⚠️ Warning: Could not delete the authentication account.\n\n` +
          `Error: ${authError.message}\n\n` +
          `The profile will be deleted, but the user may still be able to log in.\n\n` +
          `Please make sure you have run the SQL script in Supabase:\n` +
          `database/delete_auth_user.sql\n\n` +
          `Continue with profile deletion anyway?`
        );
        
        if (!shouldContinue) {
          return;
        }
      }

      // Delete from the appropriate profile table
      const tableName = userType === 'jobseeker' ? 'jobseeker_profiles' : 'employer_profiles';
      const { error: profileError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', userId);

      if (profileError) {
        throw profileError;
      }

      console.log('✅ Profile deleted successfully');

      // Refresh the user list
      await fetchUsers();
      
      // Show success/warning message
      if (authDeleted) {
        setDeleteStatus({
          show: true,
          type: 'success',
          message: 'User Deleted Successfully',
          details: `The ${userType} account and authentication credentials have been permanently removed. The user will not be able to log in.`,
          showCancel: false,
          onConfirm: () => setDeleteStatus({ show: false, type: 'success', message: '', details: '', showCancel: false, onConfirm: null, onCancel: null }),
          onCancel: null
        });
      } else {
        setDeleteStatus({
          show: true,
          type: 'warning',
          message: 'Profile Deleted with Warning',
          details: `The ${userType} profile has been deleted, but the authentication account deletion failed.\n\nError: ${authError?.message || 'Unknown error'}\n\nThe user may still be able to log in.\n\nTo fix this:\n1. Run the SQL script: database/delete_auth_user.sql in Supabase SQL Editor\n2. Or delete the user manually from Supabase Dashboard > Authentication > Users\n3. Or contact a system administrator.`,
          showCancel: false,
          onConfirm: () => setDeleteStatus({ show: false, type: 'success', message: '', details: '', showCancel: false, onConfirm: null, onCancel: null }),
          onCancel: null
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setDeleteStatus({
        show: true,
        type: 'error',
        message: 'Deletion Failed',
        details: error.message,
        showCancel: false,
        onConfirm: () => setDeleteStatus({ show: false, type: 'success', message: '', details: '', showCancel: false, onConfirm: null, onCancel: null }),
        onCancel: null
      });
    }
  };


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const buildJobseekerName = (user) => {
    const parts = [];
    if (user.first_name) parts.push(user.first_name);
    if (user.last_name) parts.push(user.last_name);
    let name = parts.join(' ');
    const suffix = user.suffix ? user.suffix.trim() : '';
    if (suffix) {
      name = name ? `${name}, ${suffix}` : suffix;
    }
    return name;
  };

  const getDisplayName = (user, type) => {
    if (type === 'jobseeker') {
      const name = buildJobseekerName(user);
      return name || user.email?.split('@')[0] || 'Unknown User';
    }
    return user.business_name || user.contact_person_name || user.email?.split('@')[0] || 'Unknown Business';
  };

  // Filter and search functions
  const filterUsers = (users, userType) => {
    let filtered = users;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user => {
        const searchLower = searchTerm.toLowerCase();
    const name = getDisplayName(user, userType).toLowerCase();
    const email = user.email.toLowerCase();
        const location = (user.address || user.location || '').toLowerCase();
        const businessName = (user.business_name || '').toLowerCase();
        const contactPerson = (user.contact_person_name || '').toLowerCase();
        
        return name.includes(searchLower) || 
           email.includes(searchLower) || 
               location.includes(searchLower) ||
               businessName.includes(searchLower) ||
               contactPerson.includes(searchLower);
      });
    }

    // Apply type filter
    if (filterType !== 'all') {
      if (userType === 'jobseeker') {
        if (filterType === 'employed') {
          filtered = filtered.filter(user => user.status === true);
        } else if (filterType === 'unemployed') {
          filtered = filtered.filter(user => user.status === false || user.status === null);
        } else if (filterType === 'with-resume') {
          filtered = filtered.filter(user => user.resume_url);
        } else if (filterType === 'with-profile-pic') {
          filtered = filtered.filter(user => user.profile_picture_url);
        } else if (filterType === 'complete-profile') {
          filtered = filtered.filter(user => user.first_name && user.last_name && user.bio && user.phone && user.address);
        }
      } else {
        if (filterType === 'with-logo') {
          filtered = filtered.filter(user => user.company_logo_url);
        } else if (filterType === 'complete-profile') {
          filtered = filtered.filter(user => user.business_name && user.contact_person_name);
        } else if (filterType === 'verified') {
          filtered = filtered.filter(user => user.verification_status === 'approved');
        } else if (filterType === 'pending') {
          filtered = filtered.filter(user => user.verification_status === 'pending' || user.verification_status === null);
        } else if (filterType === 'rejected') {
          filtered = filtered.filter(user => user.verification_status === 'rejected');
        }
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'name-asc':
          return getDisplayName(a, userType).localeCompare(getDisplayName(b, userType));
        case 'name-desc':
          return getDisplayName(b, userType).localeCompare(getDisplayName(a, userType));
        case 'email-asc':
          return a.email.localeCompare(b.email);
        case 'email-desc':
          return b.email.localeCompare(a.email);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setSortBy('newest');
  };

  if (loading) {
    return (
      <div className="user-management">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      {/* Header */}
      <header className="user-management-header">
        <div className="header-content">
          <div className="header-left">
            <h1>User Management</h1>
            <p>Manage jobseekers and employers</p>
          </div>
          <div className="header-right">
            <NotificationButton
              notifications={realtimeNotifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onNotificationClick={(notification) => {
                // Navigate to job management page when notification is clicked
                const base = window.location.hostname.startsWith('admin.') ? '' : '/admin';
                navigate(`${base}/jobs`);
              }}
            />
            <button onClick={() => window.history.back()} className="back-btn">
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <p>⚠️ {error}</p>
          <button onClick={fetchUsers} className="retry-btn">
            Try Again
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'jobseekers' ? 'active' : ''}`}
          onClick={() => setActiveTab('jobseekers')}
        >
          👤 Jobseekers ({jobseekers.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'employers' ? 'active' : ''}`}
          onClick={() => setActiveTab('employers')}
        >
          🏢 Employers ({employers.length})
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="search-filter-section">
        <div className="search-filter-container">
          <div className="search-box">
            <div className="search-input-container">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="clear-search-btn"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="filter-controls">
            <div className="filter-group">
              <label htmlFor="filter-type">Filter:</label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Users</option>
                {activeTab === 'jobseekers' ? (
                  <>
                    <option value="employed">Employed</option>
                    <option value="unemployed">Unemployed</option>
                    <option value="complete-profile">Complete Profiles</option>
                    <option value="with-resume">With Resume</option>
                    <option value="with-profile-pic">With Profile Picture</option>
                  </>
                ) : (
                  <>
                    <option value="complete-profile">Complete Profiles</option>
                    <option value="with-logo">With Company Logo</option>
                    <option value="verified">✅ Verified</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="rejected">❌ Rejected</option>
                  </>
                )}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="sort-by">Sort by:</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="email-asc">Email A-Z</option>
                <option value="email-desc">Email Z-A</option>
              </select>
            </div>

            <button 
              onClick={clearFilters}
              className="clear-filters-btn"
              title="Clear all filters"
            >
              🗑️ Clear Filters
            </button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="results-summary">
          <span className="results-count">
            Showing {filterUsers(activeTab === 'jobseekers' ? jobseekers : employers, activeTab).length} of {activeTab === 'jobseekers' ? jobseekers.length : employers.length} {activeTab}
          </span>
          {(searchTerm || filterType !== 'all' || sortBy !== 'newest') && (
            <span className="active-filters">
              {searchTerm && <span className="filter-tag">Search: "{searchTerm}"</span>}
              {filterType !== 'all' && <span className="filter-tag">Filter: {filterType.replace('-', ' ')}</span>}
              {sortBy !== 'newest' && <span className="filter-tag">Sort: {sortBy.replace('-', ' ')}</span>}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="user-management-main">
        {activeTab === 'jobseekers' && (
          <div className="users-section">
            <h2>Jobseekers</h2>
            {jobseekers.length > 0 ? (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterUsers(jobseekers, 'jobseeker').map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-info">
                            <div className="user-avatar">
                              {user.profile_picture_url ? (
                                <img src={user.profile_picture_url} alt="Profile" />
                              ) : (
                                <span>👤</span>
                              )}
                            </div>
                            <span className="user-name">{getDisplayName(user, 'jobseeker')}</span>
                          </div>
                        </td>
                        <td>{user.email}</td>
        <td>{user.phone || '-'}</td>
                        <td>{user.address || user.location || '-'}</td>
                        <td>{formatDate(user.created_at)}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="view-btn"
                              onClick={() => handleViewUser(user, 'jobseeker')}
                            >
                              👁️ View
                            </button>
                            <button 
                              className="delete-btn"
                              onClick={() => handleDeleteClick(user.id, 'jobseeker', buildJobseekerName(user))}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-users-message">
                <p>📝 No jobseekers found.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'employers' && (
          <div className="users-section">
            <h2>Employers</h2>
            {employers.length > 0 ? (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Business/Name</th>
                      <th>Email</th>
                      <th>Contact Person</th>
                      <th>Business Type</th>
                      <th>Verification Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterUsers(employers, 'employer').map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-info">
                            <div className="user-avatar">
                              {user.company_logo_url ? (
                                <img src={user.company_logo_url} alt="Logo" />
                              ) : (
                                <span>🏢</span>
                              )}
                            </div>
                            <span className="user-name">{getDisplayName(user, 'employer')}</span>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td>{user.contact_person_name || '-'}</td>
                        <td>{user.establishment_type || '-'}</td>
                        <td>
                          <span className={`verification-badge ${user.verification_status || 'pending'}`}>
                            {user.verification_status === 'approved' ? '✅ Verified' : 
                             user.verification_status === 'rejected' ? '❌ Rejected' : 
                             '⏳ Pending'}
                          </span>
                        </td>
                        <td>{formatDate(user.created_at)}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="view-btn"
                              onClick={() => handleViewUser(user, 'employer')}
                            >
                              👁️ View
                            </button>
                            <button 
                              className="delete-btn"
                              onClick={() => handleDeleteClick(user.id, 'employer', user.business_name || user.email)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-users-message">
                <p>📝 No employers found.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* User Details Modal */}
      {showModal && selectedUser && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {selectedUser.userType === 'jobseeker' ? '👤' : '🏢'} 
                {selectedUser.userType === 'jobseeker' ? 'Jobseeker' : 'Employer'} Profile
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="profile-section">
                <div className="profile-header">
                  <div className="profile-avatar">
                    {selectedUser.profile_picture_url || selectedUser.company_logo_url ? (
                      <img 
                        src={selectedUser.profile_picture_url || selectedUser.company_logo_url} 
                        alt="Profile" 
                      />
                    ) : (
                      <span>{selectedUser.userType === 'jobseeker' ? '👤' : '🏢'}</span>
                    )}
                  </div>
                  <div className="profile-info">
                    <h3>{getDisplayName(selectedUser, selectedUser.userType)}</h3>
                    <p className="user-type-badge">{selectedUser.userType}</p>
                  </div>
                </div>
              </div>

              <div className="details-grid">
                {selectedUser.userType === 'jobseeker' ? (
                  <>
                    {/* Basic Information Section */}
                    <div className="details-section">
                      <h4>👤 Basic Information</h4>
                      <div className="detail-item">
                        <label>Full Name</label>
                        <span>{buildJobseekerName(selectedUser) || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Email</label>
                        <span>{selectedUser.email}</span>
                      </div>
                      <div className="detail-item">
                        <label>Phone</label>
                        <span>{selectedUser.phone || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Address</label>
                        <span>{selectedUser.address || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Gender</label>
                        <span>{selectedUser.gender || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Age</label>
                        <span>{selectedUser.age ? `${selectedUser.age} years old` : 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Civil Status</label>
                        <span>{selectedUser.civil_status || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Joined</label>
                        <span>{formatDate(selectedUser.created_at)}</span>
                      </div>
                    </div>

                    {/* Professional Information Section */}
                    <div className="details-section">
                      <h4>💼 Professional Information</h4>
                      <div className="detail-item">
                        <label>Educational Level</label>
                        <span>{selectedUser.education || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Employment Status</label>
                        <span className={`employment-status ${selectedUser.status ? 'employed' : 'unemployed'}`}>
                          {selectedUser.status === true
                            ? '✅ Employed'
                            : selectedUser.status === false
                              ? '❌ Unemployed'
                              : selectedUser.employment_status || 'Not provided'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <label>Preferred Jobs</label>
                        <span>
                          {Array.isArray(selectedUser.preferred_jobs) && selectedUser.preferred_jobs.length
                            ? selectedUser.preferred_jobs.filter(Boolean).join(', ')
                            : 'Not provided'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <label>Short Bio</label>
                        <span>{selectedUser.bio || 'Not provided'}</span>
                      </div>
                    </div>

                    {/* Resume Section */}
                    {selectedUser.resume_url && (
                      <div className="details-section">
                        <h4>📄 Resume</h4>
                        <div className="detail-item">
                          <label>Resume File</label>
                          <div className="resume-actions">
                            <a 
                              href={selectedUser.resume_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="resume-btn"
                            >
                              📄 View Resume
                            </a>
                            <a 
                              href={selectedUser.resume_url} 
                              download
                              className="download-btn"
                            >
                              ⬇️ Download
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Basic Information Section */}
                    <div className="details-section">
                      <h4>📋 Basic Information</h4>
                      <div className="detail-item">
                        <label>Email</label>
                        <span>{selectedUser.email}</span>
                      </div>
                      <div className="detail-item">
                        <label>Joined</label>
                        <span>{formatDate(selectedUser.created_at)}</span>
                      </div>
                    </div>

                    {/* Establishment Details Section */}
                    <div className="details-section">
                      <h4>🏢 Establishment Details</h4>
                      <div className="detail-item">
                        <label>Business Name</label>
                        <span>{selectedUser.business_name || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Acronym</label>
                        <span>{selectedUser.acronym || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Establishment Type</label>
                        <span>{selectedUser.establishment_type || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>TIN</label>
                        <span>{selectedUser.tin || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Employer Type</label>
                        <span>{selectedUser.employer_type || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Total Workforce</label>
                        <span>{selectedUser.total_workforce || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Line of Business</label>
                        <span>{selectedUser.line_of_business || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Full Address</label>
                        <span>{selectedUser.full_address || 'Not provided'}</span>
                      </div>
                    </div>

                    {/* Establishment Contact Details Section */}
                    <div className="details-section">
                      <h4>📞 Establishment Contact Details</h4>
                      <div className="detail-item">
                        <label>Owner/President</label>
                        <span>{selectedUser.owner_president_name || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Contact Person</label>
                        <span>{selectedUser.contact_person_name || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Contact Position</label>
                        <span>{selectedUser.contact_position || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Telephone</label>
                        <span>{selectedUser.telephone_number || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Mobile</label>
                        <span>{selectedUser.mobile_number || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Fax</label>
                        <span>{selectedUser.fax_number || 'Not provided'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Contact Email</label>
                        <span>{selectedUser.contact_email || 'Not provided'}</span>
                      </div>
                    </div>

                    {/* BIR Document Section */}
                    <div className="details-section">
                      <h4>📄 BIR Document</h4>
                      {selectedUser.bir_document_url ? (
                        <div className="document-section">
                          <div className="document-info">
                            <div className="document-icon">📄</div>
                            <div className="document-details">
                              <p className="document-name">BIR Registration Document</p>
                              <p className="document-status">✅ Document uploaded</p>
                            </div>
                          </div>
                          <div className="document-actions">
                            <a 
                              href={selectedUser.bir_document_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              👁️ View Document
                            </a>
                            <a 
                              href={selectedUser.bir_document_url} 
                              download
                              className="download-document-btn"
                            >
                              ⬇️ Download
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="no-document">
                          <div className="no-document-icon">📄</div>
                          <p>No BIR document uploaded</p>
                        </div>
                      )}
                    </div>

                    {/* Business Permit Section */}
                    <div className="details-section">
                      <h4>📋 Business Permit</h4>
                      {selectedUser.business_permit_url ? (
                        <div className="document-section">
                          <div className="document-info">
                            <div className="document-icon">📋</div>
                            <div className="document-details">
                              <p className="document-name">Business Permit Document</p>
                              <p className="document-status">✅ Document uploaded</p>
                            </div>
                          </div>
                          <div className="document-actions">
                            <a 
                              href={selectedUser.business_permit_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              👁️ View Document
                            </a>
                            <a 
                              href={selectedUser.business_permit_url} 
                              download
                              className="download-document-btn"
                            >
                              ⬇️ Download
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="no-document">
                          <div className="no-document-icon">📋</div>
                          <p>No Business Permit uploaded</p>
                        </div>
                      )}
                    </div>

                    {/* Verification Status Section */}
                    <div className="details-section">
                      <h4>🔍 Account Verification Status</h4>
                      <div className="verification-status-section">
                        <div className="verification-badge-large">
                          <span className={`status-pill ${selectedUser.verification_status || 'pending'}`}>
                            {selectedUser.verification_status === 'approved' ? 'Verified' : 
                             selectedUser.verification_status === 'rejected' ? 'Rejected' : 
                             'Pending Verification'}
                          </span>
                        </div>
                        {selectedUser.verification_notes && (
                          <div className="verification-notes">
                            <label>Verification Notes:</label>
                            <p>{selectedUser.verification_notes}</p>
                          </div>
                        )}
                        {selectedUser.verified_at && (
                          <div className="verification-date">
                            <label>Verified On:</label>
                            <span>{formatDate(selectedUser.verified_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="close-modal-btn" onClick={handleCloseModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="delete-confirm-overlay" onClick={handleDeleteCancel}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <div className="delete-confirm-icon">⚠️</div>
              <h3>Confirm Deletion</h3>
            </div>
            <div className="delete-confirm-body">
              <p className="delete-confirm-message">
                Are you sure you want to delete this <strong>{deleteConfirm.userType}</strong>?
              </p>
              {deleteConfirm.userName && (
                <p className="delete-confirm-name">
                  <strong>{deleteConfirm.userName}</strong>
                </p>
              )}
              <div className="delete-confirm-warning">
                <p>⚠️ This action cannot be undone.</p>
                <p>This will permanently delete their account and they will not be able to log in.</p>
              </div>
            </div>
            <div className="delete-confirm-footer">
              <button className="delete-confirm-cancel" onClick={handleDeleteCancel}>
                Cancel
              </button>
              <button className="delete-confirm-delete" onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Status Modal */}
      {deleteStatus.show && (
        <div className="delete-status-overlay" onClick={() => !deleteStatus.showCancel && deleteStatus.onConfirm && deleteStatus.onConfirm()}>
          <div className="delete-status-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`delete-status-header ${deleteStatus.type}`}>
              <div className="delete-status-icon">
                {deleteStatus.type === 'success' && '✅'}
                {deleteStatus.type === 'warning' && '⚠️'}
                {deleteStatus.type === 'error' && '❌'}
              </div>
              <h3>{deleteStatus.message}</h3>
            </div>
            <div className="delete-status-body">
              <p className="delete-status-details">{deleteStatus.details}</p>
            </div>
            <div className="delete-status-footer">
              {deleteStatus.showCancel && deleteStatus.onCancel && (
                <button 
                  className="delete-status-button cancel"
                  onClick={() => deleteStatus.onCancel && deleteStatus.onCancel()}
                >
                  Cancel
                </button>
              )}
              <button 
                className={`delete-status-button ${deleteStatus.type}`}
                onClick={() => deleteStatus.onConfirm && deleteStatus.onConfirm()}
              >
                {deleteStatus.showCancel ? 'Continue' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
