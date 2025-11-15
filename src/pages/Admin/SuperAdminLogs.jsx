import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import './SuperAdminLogs.css';

const SuperAdminLogs = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('activity'); // 'activity' or 'login'
  const [activityLogs, setActivityLogs] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState(null);
  const [filters, setFilters] = useState({
    userType: 'all',
    actionType: 'all',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  useEffect(() => {
    if (adminRole === 'super_admin') {
      if (activeTab === 'activity') {
        fetchActivityLogs();
      } else {
        fetchLoginLogs();
      }
    }
  }, [activeTab, adminRole, filters]);

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

    const container = document.querySelector('.super-admin-logs');
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

  const checkSuperAdmin = async () => {
    // Always verify role from database, don't trust localStorage
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: adminProfile, error } = await supabase
        .from('admin_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (!error && adminProfile) {
        const role = adminProfile.role || 'admin';
        if (role === 'super_admin') {
          setAdminRole('super_admin');
          // Only update localStorage if it matches the current user's actual role
          localStorage.setItem('admin_role', 'super_admin');
        } else {
          // Not super_admin, redirect to dashboard
          navigate('/admin/dashboard');
        }
      } else {
        // Error fetching profile or not an admin
        navigate('/admin/dashboard');
      }
    } else {
      // No user, redirect to login
      navigate('/admin');
    }
  };

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      // Apply filters
      if (filters.userType !== 'all') {
        query = query.eq('user_type', filters.userType);
      }
      if (filters.actionType !== 'all') {
        query = query.eq('action_type', filters.actionType);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoginLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('login_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      // Apply filters
      if (filters.userType !== 'all') {
        query = query.eq('user_type', filters.userType);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLoginLogs(data || []);
    } catch (error) {
      console.error('Error fetching login logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionTypeLabel = (actionType) => {
    const labels = {
      'job_approved': 'Job Approved',
      'job_rejected': 'Job Rejected',
      'jobseeker_referred': 'Jobseeker Referred',
      'profile_updated': 'Profile Updated',
      'job_applied': 'Job Applied',
      'application_accepted': 'Application Accepted',
      'application_rejected': 'Application Rejected',
      'employer_verified': 'Employer Verified',
      'employer_rejected': 'Employer Rejected',
      'employer_verification_updated': 'Employer Verification Updated',
      'account_created': 'Account Created'
    };
    return labels[actionType] || actionType;
  };

  if (adminRole !== 'super_admin') {
    return (
      <div className="super-admin-logs">
        <div className="loading-screen">
          <p>Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="super-admin-logs">
      <header className="logs-header">
        <div className="header-content">
          <div className="header-left">
            <h1>System Logs</h1>
            <p>Activity and Login Logs</p>
          </div>
          <div className="header-right">
            <button onClick={() => navigate('/admin/dashboard')} className="back-btn">
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="logs-main">
        <div className="logs-tabs">
          <button
            className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            📋 Activity Logs
          </button>
          <button
            className={`tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            🔐 Login Logs
          </button>
        </div>

        <div className="logs-filters">
          <div className="filter-group">
            <label>User Type</label>
            <select
              value={filters.userType}
              onChange={(e) => setFilters({ ...filters, userType: e.target.value })}
            >
              <option value="all">All Users</option>
              <option value="jobseeker">Jobseekers</option>
              <option value="employer">Employers</option>
              <option value="admin">Admins</option>
              <option value="super_admin">Super Admins</option>
            </select>
          </div>

          {activeTab === 'activity' && (
            <div className="filter-group">
              <label>Action Type</label>
              <select
                value={filters.actionType}
                onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
              >
                <option value="all">All Actions</option>
                <option value="account_created">Account Created</option>
                <option value="job_approved">Job Approved</option>
                <option value="job_rejected">Job Rejected</option>
                <option value="jobseeker_referred">Jobseeker Referred</option>
                <option value="profile_updated">Profile Updated</option>
                <option value="job_applied">Job Applied</option>
                <option value="application_accepted">Application Accepted</option>
                <option value="application_rejected">Application Rejected</option>
                <option value="employer_verified">Employer Verified</option>
                <option value="employer_rejected">Employer Rejected</option>
                <option value="employer_verification_updated">Employer Verification Updated</option>
              </select>
            </div>
          )}

          <div className="filter-group">
            <label>From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>

          <div className="filter-group">
            <label>To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>

          <button
            className="reset-filters-btn"
            onClick={() => setFilters({ userType: 'all', actionType: 'all', dateFrom: '', dateTo: '' })}
          >
            Reset Filters
          </button>
        </div>

        <div className="logs-content">
          {loading ? (
            <div className="loading">Loading logs...</div>
          ) : activeTab === 'activity' ? (
            <div className="logs-table-container">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>User Type</th>
                    <th>Action</th>
                    <th>Description</th>
                    <th>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data">No activity logs found</td>
                    </tr>
                  ) : (
                    activityLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.created_at)}</td>
                        <td>
                          <span className={`user-type-badge ${log.user_type}`}>
                            {log.user_type}
                          </span>
                        </td>
                        <td>{getActionTypeLabel(log.action_type)}</td>
                        <td>{log.action_description || '—'}</td>
                        <td>
                          {log.entity_type && log.entity_id
                            ? `${log.entity_type} (${log.entity_id.slice(0, 8)}...)`
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="logs-table-container">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>User Type</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Failure Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {loginLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data">No login logs found</td>
                    </tr>
                  ) : (
                    loginLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.created_at)}</td>
                        <td>
                          <span className={`user-type-badge ${log.user_type}`}>
                            {log.user_type}
                          </span>
                        </td>
                        <td>{log.email}</td>
                        <td>
                          <span className={`login-status-badge ${log.login_status}`}>
                            {log.login_status}
                          </span>
                        </td>
                        <td>{log.failure_reason || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SuperAdminLogs;

