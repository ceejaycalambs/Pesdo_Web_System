import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import NotificationButton from '../../components/NotificationButton';
import './AdminManagement.css';

const AdminManagement = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [adminRole, setAdminRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Get correct paths based on host
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isAdminHost = host.startsWith('admin.');
  const loginPath = isAdminHost ? '/' : '/admin';
  const dashboardPath = isAdminHost ? '/dashboard' : '/admin/dashboard';

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
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    role: 'admin'
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  useEffect(() => {
    if (adminRole === 'super_admin') {
      fetchAdmins();
    }
  }, [adminRole]);

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

    const container = document.querySelector('.admin-management');
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
          setLoading(false);
        } else {
          // Not super_admin, redirect to dashboard
          navigate(dashboardPath);
        }
      } else {
        // Error fetching profile or not an admin
        navigate(dashboardPath);
      }
    } else {
      // No user, redirect to login
      navigate(loginPath);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('id, email, first_name, last_name, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
      setError('Failed to load admin accounts');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsCreating(true);

      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          email_redirect_to: window.location.origin,
          data: {
            userType: 'admin'
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('This email is already registered. Please use a different email.');
        } else {
          setError(`Failed to create account: ${authError.message}`);
        }
        setIsCreating(false);
        return;
      }

      if (!authData.user) {
        setError('Failed to create user account');
        setIsCreating(false);
        return;
      }

      // Step 2: Create admin profile
      const { error: profileError } = await supabase
        .from('admin_profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          usertype: 'admin', // lowercase to match database column
          username: null, // Explicitly set to null as per schema
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          role: formData.role || 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        // Note: Auth user deletion requires service role key
        // If profile creation fails, you may need to delete the auth user manually
        // from Supabase Dashboard > Authentication > Users
        setError(`Failed to create admin profile: ${profileError.message}`);
        setIsCreating(false);
        return;
      }

      // Step 3: Try to auto-confirm the user via RPC function
      let emailConfirmed = false;
      try {
        const { error: confirmError } = await supabase.rpc('auto_confirm_admin_user', {
          user_id: authData.user.id
        });
        if (!confirmError) {
          emailConfirmed = true;
        } else {
          console.warn('Could not auto-confirm user:', confirmError);
        }
      } catch (rpcError) {
        console.warn('RPC function not available:', rpcError);
      }

      if (emailConfirmed) {
        setSuccess(`✅ Admin account created successfully! Email: ${formData.email}. The admin can now log in immediately.`);
      } else {
        setSuccess(`✅ Admin account created successfully! Email: ${formData.email}.`);
      }
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        first_name: '',
        last_name: '',
        role: 'admin'
      });
      setShowCreateModal(false);
      fetchAdmins();
    } catch (error) {
      console.error('Error creating admin:', error);
      setError(`Failed to create admin account: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAdmin = async (adminId, email) => {
    if (!window.confirm(`Are you sure you want to delete admin account: ${email}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete from admin_profiles
      const { error: profileError } = await supabase
        .from('admin_profiles')
        .delete()
        .eq('id', adminId);

      if (profileError) throw profileError;

      // Note: Auth user deletion requires service role key
      // The profile is deleted, but you may need to delete the auth user manually
      // from Supabase Dashboard > Authentication > Users
      
      setSuccess(`✅ Admin account deleted successfully. Note: You may need to delete the auth user manually from Supabase Dashboard if it still exists.`);
      fetchAdmins();
    } catch (error) {
      console.error('Error deleting admin:', error);
      setError(`Failed to delete admin account: ${error.message}`);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="admin-management">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading admin management...</p>
        </div>
      </div>
    );
  }

  if (adminRole !== 'super_admin') {
    return (
      <div className="admin-management">
        <div className="loading-screen">
          <p>Access denied. Super Admin only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-management">
      <header className="admin-management-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Admin Account Management</h1>
            <p>Create and manage admin accounts</p>
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
            <button
              onClick={() => navigate(dashboardPath)}
              className="back-btn"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="admin-management-main">
        {error && (
          <div className="alert alert-error">
            <span>❌ {error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span>{success}</span>
            <button onClick={() => setSuccess('')}>×</button>
          </div>
        )}

        <div className="admin-management-actions">
          <button
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            ➕ Create New Admin Account
          </button>
        </div>

        <div className="admins-table-container">
          <table className="admins-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-data">No admin accounts found</td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id}>
                    <td>
                      {admin.first_name} {admin.last_name}
                    </td>
                    <td>{admin.email}</td>
                    <td>
                      <span className={`role-badge ${admin.role}`}>
                        {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td>{formatDate(admin.created_at)}</td>
                    <td>
                      {admin.role !== 'super_admin' && (
                        <button
                          className="btn-danger-small"
                          onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                          title="Delete admin account"
                        >
                          🗑️ Delete
                        </button>
                      )}
                      {admin.role === 'super_admin' && (
                        <span className="protected-badge">Protected</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Admin Account</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    email: '',
                    password: '',
                    confirmPassword: '',
                    first_name: '',
                    last_name: '',
                    role: 'admin'
                  });
                  setError('');
                  setSuccess('');
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="admin-form" autoComplete="off">
              <div className="form-group">
                <label>
                  First Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter first name"
                />
              </div>

              <div className="form-group">
                <label>
                  Last Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter last name"
                />
              </div>

              <div className="form-group">
                <label>
                  Email <span className="required">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter admin email address"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="email"
                />
              </div>

              <div className="form-group">
                <label>
                  Password <span className="required">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  placeholder="Enter a strong password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              <div className="form-group">
                <label>
                  Confirm Password <span className="required">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              <div className="form-group">
                <label>
                  Role <span className="required">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {error && <div className="form-error">{error}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      email: '',
                      password: '',
                      confirmPassword: '',
                      first_name: '',
                      last_name: '',
                      role: 'admin'
                    });
                    setError('');
                    setSuccess('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Admin Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;

