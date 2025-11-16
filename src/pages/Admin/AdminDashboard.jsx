import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabase.js';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser: authUser, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    jobseekers: 0,
    employers: 0,
    totalJobs: 0,
    totalApplications: 0
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [adminRole, setAdminRole] = useState(null); // 'admin' or 'super_admin'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkAdminAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, userData]);

  // Fetch dashboard data only when admin is authenticated AND role is known
  useEffect(() => {
    if (adminEmail && authUser && adminRole) {
      fetchDashboardData();
    }
  }, [adminEmail, authUser, adminRole]);

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

    const container = document.querySelector('.admin-dashboard');
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
        navigate('/admin');
        return;
      }
    }

    // User is authenticated via AuthContext
    if (authUser && userData) {
      // Check if user is an admin
      const userType = userData.usertype || userData.userType;

      // If userType not yet available, wait for profile to load instead of redirecting
      if (!userType) {
        setLoading(true);
        return;
      }

      if (userType !== 'admin') {
        // Not an admin, redirect to login
        navigate('/admin');
        return;
      }

      setAdminEmail(authUser.email || '');
      
      // Always fetch role from database to ensure it's correct for the current user
      // Don't trust localStorage as it might be stale or from a different user
      try {
        // Use maybeSingle to avoid 406 when RLS hides a row (no row visible)
        const { data: adminProfile, error: profileError } = await supabase
          .from('admin_profiles')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle();
        
        if (!profileError && adminProfile) {
          const role = adminProfile.role || 'admin';
          console.log('✅ Admin role fetched from database:', role);
          setAdminRole(role);
          // Only update localStorage if it matches the current user's actual role
          localStorage.setItem('admin_role', role);
        } else {
          // Fallback to userData.role if database fetch fails
          const role = userData.role || 'admin';
          console.log('⚠️ Using fallback role from userData:', role);
          setAdminRole(role);
          localStorage.setItem('admin_role', role);
        }
      } catch (error) {
        console.error('❌ Error fetching admin role:', error);
        // Fallback to userData.role
        const role = userData.role || 'admin';
        console.log('⚠️ Using fallback role after error:', role);
        setAdminRole(role);
        localStorage.setItem('admin_role', role);
      }
      
      setLoading(false);
      
      // Log role after state update (will be in next render)
      setTimeout(() => {
        console.log('🔐 Admin authentication successful. Email:', authUser.email);
      }, 100);
    } else {
      // Wait for auth to load
      setLoading(true);
    }
  };

  const fetchDashboardData = async () => {
    try {
      console.log('🔍 Fetching dashboard data...');
      console.log('👤 Admin Email:', adminEmail);
      console.log('🔐 Admin Role:', adminRole);
      setIsDataLoaded(false);
      setError('');
      
      // Check current user session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 Current user:', user);
      console.log('❌ User error:', userError);

      // Fetch user statistics with names - try to get all available fields
      console.log('📊 Fetching jobseeker profiles...');
      const { data: jobseekerProfiles, error: jobseekerError } = await supabase
        .from('jobseeker_profiles')
        .select('id, first_name, last_name, suffix, email, created_at');

      console.log('👤 Jobseeker profiles:', jobseekerProfiles);
      console.log('❌ Jobseeker error:', jobseekerError);

      console.log('🏢 Fetching employer profiles...');
      const { data: employerProfiles, error: employerError } = await supabase
        .from('employer_profiles')
        .select('id, email, business_name, contact_person_name, created_at');

      console.log('🏢 Employer profiles:', employerProfiles);
      console.log('❌ Employer error:', employerError);

      console.log('👑 Fetching admin profiles...');
      const { data: adminProfiles, error: adminError } = await supabase
        .from('admin_profiles')
        .select('id, first_name, last_name, username, email, created_at');

      console.log('👑 Admin profiles:', adminProfiles);
      console.log('❌ Admin error:', adminError);

      console.log('💼 Fetching jobs...');
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id');

      console.log('💼 Jobs:', jobs);
      console.log('❌ Jobs error:', jobsError);

      console.log('📝 Fetching applications...');
      const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select('id');

      console.log('📝 Applications:', applications);
      console.log('❌ Applications error:', applicationsError);

      // Get recent users (last 5) - exclude admin users
      const allUsers = [
        ...(jobseekerProfiles || [])
          .filter(user => user.first_name || user.last_name)
          .map(user => {
            const parts = [];
            if (user.first_name) parts.push(user.first_name);
            if (user.last_name) parts.push(user.last_name);
            let name = parts.join(' ');
            const suffixValue = user.suffix ? user.suffix.trim() : '';
            if (suffixValue) {
              name = name ? `${name}, ${suffixValue}` : suffixValue;
            }
            return {
              ...user,
              type: 'jobseeker',
              displayName: name || user.email || 'Jobseeker'
            };
          }),
        ...(employerProfiles || [])
          .filter(user => user.business_name || user.contact_person_name)
          .map(user => ({ 
            ...user, 
            type: 'employer',
            displayName: user.business_name || user.contact_person_name || user.email || 'Employer'
          }))
        // Exclude admin profiles from Recent Users display
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      console.log('👥 All users:', allUsers);
      console.log('📊 Setting stats with totalUsers:', allUsers.length);
      
      // Limit to exactly 5 most recent users
      const limitedUsers = allUsers.slice(0, 5);
      console.log('👥 Setting recent users:', limitedUsers);

      setStats({
        totalUsers: allUsers.length, // Use the actual displayed users count
        jobseekers: jobseekerProfiles?.length || 0,
        employers: employerProfiles?.length || 0,
        totalJobs: jobs?.length || 0,
        totalApplications: applications?.length || 0
      });

      setRecentUsers(limitedUsers);
      setError(''); // Clear any previous errors
      setIsDataLoaded(true);
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setError(`Failed to load data: ${error.message}`);
      setIsDataLoaded(false);
    }
  };

  const renderRecentUsers = () => {
    if (!isDataLoaded) {
      return (
        <div className="loading-message">
          <p>🔄 Loading users...</p>
        </div>
      );
    }

    if (recentUsers.length > 0) {
      return (
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user, index) => (
                <tr key={user.id}>
                  <td>
                    <span className={`user-type-badge ${user.type}`}>
                      {user.type}
                    </span>
                  </td>
                  <td>{user.displayName}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="no-users-message">
        <p>📝 No users have completed their profiles yet. Users will appear here once they add their basic information.</p>
      </div>
    );
  };

  const handleLogout = async () => {
    try {
      // Clear admin-specific localStorage
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_login_time');
      localStorage.removeItem('admin_email');
      localStorage.removeItem('admin_role');
      
      // Clear Supabase session to prevent authentication conflicts
      await supabase.auth.signOut();
      
      // Clear state
      setAdminEmail('');
      setAdminRole(null);
      
      console.log('Admin logout completed - Supabase session cleared');
      navigate('/admin');
    } catch (error) {
      console.error('Error during admin logout:', error);
      // Still navigate even if there's an error
      navigate('/admin');
    }
  };

  // Only show loading screen if we're still checking authentication
  // Once we have adminEmail, show the dashboard even if data is still loading
  if (loading && !adminEmail) {
    return (
      <div className="admin-dashboard">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

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

  const isActive = (path, exact = false, query = null) => {
    const pathOnly = path.split('?')[0];
    if (exact) {
      return location.pathname === pathOnly && (!query || location.search.includes(query));
    }
    if (query) {
      return location.pathname === pathOnly && location.search.includes(query);
    }
    // For dashboard, match exactly
    if (pathOnly === '/admin/dashboard') {
      return location.pathname === '/admin/dashboard';
    }
    return location.pathname.startsWith(pathOnly);
  };

  return (
    <div className="admin-dashboard">
      {/* Mobile Menu Overlay */}
      <div 
        className={`admin-sidebar-overlay ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      ></div>
      
      {/* Sidebar */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button 
            className="admin-mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close mobile menu"
          >
            ✕
          </button>
        </div>
        <nav className="sidebar-nav">
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.path}>
                <button
                  className={`nav-item ${isActive(item.path, item.exact, item.query) ? 'active' : ''}`}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
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
                      onClick={() => {
                        navigate(item.path);
                        setMobileMenuOpen(false);
                      }}
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
        {/* Header */}
        <header className="admin-dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <button 
                className="admin-mobile-menu-toggle"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open mobile menu"
              >
                ☰
              </button>
              <div>
                <h1>Admin Dashboard</h1>
              </div>
            </div>
            <div className="header-right">
              <button onClick={fetchDashboardData} className="refresh-btn">
                🔄 Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="admin-dashboard-main">
        {/* Error Message */}
        {error && (
          <div className="error-banner">
            <p>⚠️ {error}</p>
            <button onClick={fetchDashboardData} className="retry-btn">
              Try Again
            </button>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="stats-section">
          <h2>System Overview</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <h3>{stats.totalUsers}</h3>
                <p>Total Users</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👤</div>
              <div className="stat-content">
                <h3>{stats.jobseekers}</h3>
                <p>Jobseekers</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <h3>{stats.employers}</h3>
                <p>Employers</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💼</div>
              <div className="stat-content">
                <h3>{stats.totalJobs}</h3>
                <p>Total Jobs</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📝</div>
              <div className="stat-content">
                <h3>{stats.totalApplications}</h3>
                <p>Applications</p>
              </div>
          </div>
          </div>
          </div>

                {/* Recent Users */}
                <div className="recent-users-section">
                  <h2>Recent Users</h2>
                  {renderRecentUsers()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;

