import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeData } from '../../hooks/useRealtimeData';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import NotificationButton from '../../components/NotificationButton';
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
  
  // Refs to prevent duplicate fetches
  const isFetchingRef = useRef(false);
  const fetchTimeoutRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const checkAuthRunningRef = useRef(false);
  const lastAuthCheckRef = useRef({ authUserId: null, userType: null });
  const fallbackEmailSetRef = useRef(false); // Track if fallback email was set

  // Realtime notifications
  const {
    notifications: realtimeNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    requestNotificationPermission
  } = useRealtimeNotifications(authUser?.id, 'admin');

  // Separate useEffect for fallback email setting - ensures email is set immediately
  // This runs whenever authUser.email is available but adminEmail is not set
  useEffect(() => {
    if (authUser?.email && !adminEmail) {
      setAdminEmail(authUser.email);
      const cachedRole = localStorage.getItem('admin_role') || 'admin';
      if (!adminRole) {
        setAdminRole(cachedRole);
      }
      setLoading(false);
    }
  }, [authUser?.email]); // Only depend on email to prevent loops
  
  // Separate effect to clear loading when we have email
  useEffect(() => {
    if (authUser?.email && adminEmail === authUser.email && loading) {
      setLoading(false);
    }
  }, [authUser?.email, adminEmail, loading]);

  // Separate useEffect for checkAdminAuth (runs when auth state changes)
  useEffect(() => {
    // Prevent infinite loops by checking if auth state actually changed
    const currentAuthId = authUser?.id;
    const currentUserType = userData?.usertype || userData?.userType;
    const lastCheck = lastAuthCheckRef.current;
    
    // Skip if already checking or if nothing meaningful changed
    if (checkAuthRunningRef.current) {
      return;
    }
    
    // Skip if auth user ID and user type haven't changed
    if (currentAuthId === lastCheck.authUserId && currentUserType === lastCheck.userType) {
      return;
    }
    
    // Update last check values
    lastAuthCheckRef.current = {
      authUserId: currentAuthId,
      userType: currentUserType
    };
    
    checkAuthRunningRef.current = true;
    checkAdminAuth().finally(() => {
      checkAuthRunningRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, userData?.usertype, userData?.userType]); // Removed adminEmail to prevent loop

  // Request notification permission on mount
  useEffect(() => {
    if (authUser?.id) {
      requestNotificationPermission();
    }
  }, [authUser?.id, requestNotificationPermission]);

  // Fetch dashboard data when admin is authenticated
  // Don't wait for adminRole - use fallback if needed
  useEffect(() => {
    // Only fetch if we have both email and user, and haven't fetched recently
    if (!adminEmail || !authUser) {
      return;
    }
    
    // If adminRole is not set yet, use cached role or default to 'admin'
    const roleToUse = adminRole || localStorage.getItem('admin_role') || 'admin';
    if (!adminRole && roleToUse) {
      setAdminRole(roleToUse);
    }
    
    // Skip if already fetching
    if (isFetchingRef.current) {
      return;
    }
    
    // Debounce fetch to prevent rapid successive calls
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(() => {
      if (!isFetchingRef.current) {
        fetchDashboardData();
      }
    }, 500); // 500ms debounce
    
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEmail, authUser?.id]); // Only depend on email and user ID to prevent loops

  // Set up real-time data synchronization
  useRealtimeData(
    authUser?.id,
    adminRole || 'admin',
    {
      onJobsUpdate: (payload) => {
        console.log('🔄 Real-time job update received, refreshing dashboard...');
        // Debounce realtime updates to prevent rapid successive calls
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        fetchTimeoutRef.current = setTimeout(() => {
          if (adminEmail && authUser && !isFetchingRef.current) {
            fetchDashboardData();
          }
        }, 1000); // 1 second debounce for realtime updates
      },
      onJobStatusChange: (job, oldStatus, newStatus) => {
        console.log(`📊 Job status changed: ${oldStatus} → ${newStatus}`, job);
        // Debounce realtime updates
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        fetchTimeoutRef.current = setTimeout(() => {
          if (adminEmail && authUser && !isFetchingRef.current) {
            fetchDashboardData();
          }
        }, 1000);
      },
      onNewJob: (job) => {
        console.log('🆕 New job pending approval, refreshing dashboard...', job);
        // Debounce realtime updates
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        fetchTimeoutRef.current = setTimeout(() => {
          if (adminEmail && authUser && !isFetchingRef.current) {
            fetchDashboardData();
          }
        }, 1000);
      }
    }
  );

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
    // Early return if already running (prevent concurrent calls)
    if (checkAuthRunningRef.current) {
      return;
    }
    
    // If we already have adminEmail, just verify/update role
    if (adminEmail && authUser?.email === adminEmail) {
      // Just verify role, don't set email again
      if (userData?.role && adminRole !== userData.role) {
        setAdminRole(userData.role);
      }
      if (loading) {
        setLoading(false);
      }
      return;
    }
    
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
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        navigate(host.startsWith('admin.') ? '/' : '/admin');
        return;
      }
    }

    // User is authenticated via AuthContext
    if (authUser && userData) {
      // Check if user is an admin
      const userType = userData.usertype || userData.userType;

      // Set adminEmail early so component can render even if userType is not yet available
      // Only update if changed (prevent unnecessary re-renders)
      if (authUser.email && adminEmail !== authUser.email) {
        setAdminEmail(authUser.email);
      }

      // If userType not yet available, try to use localStorage role as fallback
      // This prevents blank screen when navigating between admin pages
      if (!userType) {
        const cachedRole = localStorage.getItem('admin_role');
        if (cachedRole && authUser.email) {
          // We have cached role and email, allow rendering while waiting for userType
          // Only update if changed (prevent unnecessary re-renders)
          if (adminRole !== cachedRole) {
            setAdminRole(cachedRole);
          }
          if (adminEmail !== authUser.email) {
            setAdminEmail(authUser.email);
          }
          if (loading) {
            setLoading(false);
          }
          // Still return early, but component will render because adminEmail is set
          return;
        }
        // No cached data, wait for profile to load
        setLoading(true);
        return;
      }

      if (userType !== 'admin') {
        // Not an admin, redirect to login
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        navigate(host.startsWith('admin.') ? '/' : '/admin');
        return;
      }

      // Only update adminEmail if it changed (prevent unnecessary re-renders)
      if (adminEmail !== (authUser.email || '')) {
        setAdminEmail(authUser.email || '');
      }
      
      // Use userData.role immediately if available (from AuthContext cache)
      // This prevents delays and glitches
      if (userData.role) {
        const role = userData.role;
        console.log('✅ Using role from userData (cached):', role);
        // Only update if role changed (prevent unnecessary re-renders)
        if (adminRole !== role) {
          setAdminRole(role);
        }
        localStorage.setItem('admin_role', role);
        // Always set loading to false when we have a role
        setLoading(false);
        
        // Fetch role from database in background to verify (non-blocking)
        supabase
          .from('admin_profiles')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle()
          .then(({ data: adminProfile, error: profileError }) => {
            if (!profileError && adminProfile && adminProfile.role) {
              const dbRole = adminProfile.role;
              if (dbRole !== role) {
                console.log('🔄 Role mismatch detected, updating from database:', dbRole);
                setAdminRole(dbRole);
                localStorage.setItem('admin_role', dbRole);
              }
            }
          })
          .catch((error) => {
            console.warn('⚠️ Background role fetch failed (non-critical):', error);
          });
      } else {
        // Fallback: use cached role or default to 'admin', don't block rendering
        const cachedRole = localStorage.getItem('admin_role') || 'admin';
        console.log('✅ Using cached role from localStorage:', cachedRole);
        if (adminRole !== cachedRole) {
          setAdminRole(cachedRole);
        }
        localStorage.setItem('admin_role', cachedRole);
        // Always set loading to false - we have email and cached role
        setLoading(false);
        
        // Fetch role from database in background (non-blocking)
        supabase
          .from('admin_profiles')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle()
          .then(({ data: adminProfile, error: profileError }) => {
            if (!profileError && adminProfile && adminProfile.role) {
              const dbRole = adminProfile.role;
              if (dbRole !== cachedRole) {
                console.log('🔄 Role updated from database:', dbRole);
                setAdminRole(dbRole);
                localStorage.setItem('admin_role', dbRole);
              }
            }
          })
          .catch((error) => {
            console.warn('⚠️ Background role fetch failed (non-critical):', error);
          });
      }
      
      // Log role after state update (will be in next render)
      setTimeout(() => {
        console.log('🔐 Admin authentication successful. Email:', authUser.email);
      }, 100);
    } else if (authUser && !userData) {
      // User is authenticated but profile not loaded yet
      // Use cached data if available to prevent stuck loading
      const cachedRole = localStorage.getItem('admin_role') || 'admin';
      const cachedEmail = authUser.email;
      
      if (cachedEmail) {
        if (adminEmail !== cachedEmail) {
          setAdminEmail(cachedEmail);
        }
        if (adminRole !== cachedRole) {
          setAdminRole(cachedRole);
        }
        // Set loading to false so dashboard can render
        setLoading(false);
        console.log('⚠️ Using cached admin data while profile loads');
      } else {
        // No cached data, wait for profile
        setLoading(true);
      }
    } else {
      // No auth user, wait for auth to load
      setLoading(true);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('⏸️ Fetch already in progress, skipping...');
      return;
    }
    
    // Debounce rapid calls (within 2 seconds)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 2000) {
      console.log('⏸️ Debouncing rapid fetch call...');
      return;
    }
    lastFetchTimeRef.current = now;
    
    isFetchingRef.current = true;
    
    try {
      // Use current adminRole or fallback to prevent blocking
      const roleToUse = adminRole || localStorage.getItem('admin_role') || 'admin';
      setIsDataLoaded(false);
      setError('');
      
      // Check current user session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('❌ User error:', userError);
      }

      // Fetch user statistics with names - try to get all available fields
      const { data: jobseekerProfiles, error: jobseekerError } = await supabase
        .from('jobseeker_profiles')
        .select('id, first_name, last_name, suffix, email, created_at');

      if (jobseekerError) {
        console.error('❌ Jobseeker error:', jobseekerError);
      }

      const { data: employerProfiles, error: employerError } = await supabase
        .from('employer_profiles')
        .select('id, email, business_name, contact_person_name, created_at');

      if (employerError) {
        console.error('❌ Employer error:', employerError);
      }

      const { data: adminProfiles, error: adminError } = await supabase
        .from('admin_profiles')
        .select('id, first_name, last_name, username, email, created_at');

      if (adminError) {
        console.error('❌ Admin error:', adminError);
      }

      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id');

      if (jobsError) {
        console.error('❌ Jobs error:', jobsError);
      }

      const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select('id');

      if (applicationsError) {
        console.error('❌ Applications error:', applicationsError);
      }

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

      // Limit to exactly 5 most recent users
      const limitedUsers = allUsers.slice(0, 5);

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
    } finally {
      isFetchingRef.current = false;
    }
  }, [adminEmail, adminRole]);

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
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      navigate(host.startsWith('admin.') ? '/' : '/admin');
    } catch (error) {
      console.error('Error during admin logout:', error);
      // Still navigate even if there's an error
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      navigate(host.startsWith('admin.') ? '/' : '/admin');
    }
  };

  // Only show loading screen if we don't have any email available
  // Once we have adminEmail OR authUser.email, show the dashboard even if data is still loading
  // This prevents stuck loading when email is available but not yet set in state
  const hasEmail = adminEmail || authUser?.email;
  if (loading && !hasEmail) {
    return (
      <div className="admin-dashboard">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const base = window.location.hostname.startsWith('admin.') ? '' : '/admin';

  const navItems = [
    { path: `${base}/dashboard`, label: 'Dashboard', icon: '📊', exact: true },
    { path: `${base}/users`, label: 'User Management', icon: '👥' },
    { path: `${base}/jobs`, label: 'Manage Jobs', icon: '💼' },
    { path: `${base}/verification`, label: 'Employer Verification', icon: '🔍' },
    { path: `${base}/analytics`, label: 'Analytics', icon: '📈' },
  ];

  const superAdminNavItems = [
    { path: `${base}/logs`, label: 'System Logs', icon: '📋' },
    { path: `${base}/settings`, label: 'Admin Management', icon: '⚙️' },
  ];

  const isActive = (path, exact = false, query = null) => {
    const pathOnly = path.split('?')[0];
    if (exact) {
      return location.pathname === pathOnly && (!query || location.search.includes(query));
    }
    if (query) {
      return location.pathname === pathOnly && location.search.includes(query);
    }
    // For dashboard, match exactly based on base
    if (pathOnly === `${base}/dashboard`) {
      return location.pathname === `${base}/dashboard`;
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

