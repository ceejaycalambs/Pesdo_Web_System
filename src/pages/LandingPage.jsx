import React, { useEffect, useState, useRef, useMemo } from 'react';
import './LandingPage.css';
import Logo_pesdo from '../assets/Logo_pesdo.png';
import Pesdo_Office from '../assets/Pesdo_Office.png';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

const LandingPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const auth = useAuth();
    const { currentUser, userData, loading: authLoading, profileLoaded } = auth || {};
    const [headerScrolled, setHeaderScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [stats, setStats] = useState({
        jobseekers: 0,
        employers: 0,
        vacancies: 0,
        referrals: 0,
        placements: 0
    });
    const [loading, setLoading] = useState(true);
    const [employers, setEmployers] = useState([]);
    const [loadingEmployers, setLoadingEmployers] = useState(true);
    const hasRedirected = useRef(false);
    
    // Memoize userType to get stable reference
    const userType = useMemo(() => userData?.userType || null, [userData?.userType]);
    
    // Helper function to perform redirect - defined outside effect to avoid recreation
    const performRedirect = React.useCallback((userTypeValue) => {
        if (hasRedirected.current) return;
        
        console.log('🔍 Landing page - User is logged in, redirecting to dashboard...');
        console.log('User type:', userTypeValue);
        
        hasRedirected.current = true;
        
        if (userTypeValue === 'employer') {
            navigate('/employer', { replace: true });
        } else if (userTypeValue === 'jobseeker') {
            navigate('/jobseeker', { replace: true });
        } else if (userTypeValue === 'admin') {
            const currentHost = window.location.hostname;
            if (currentHost.startsWith('admin.')) {
                navigate('/dashboard', { replace: true });
            } else {
                const baseDomain = currentHost.replace(/^(www\.|admin\.)/, '');
                const adminHost = `admin.${baseDomain}`;
                window.location.href = `https://${adminHost}/dashboard`;
            }
        }
    }, [navigate]);
    
    // Effect 1: Reset redirect flag when pathname changes away from '/'
    useEffect(() => {
        if (location.pathname !== '/') {
            hasRedirected.current = false;
        }
    }, [location.pathname]);
    
    // Effect 2: Check auth and redirect - only runs when auth state actually changes
    useEffect(() => {
        // Only check on landing page
        if (location.pathname !== '/') return;
        
        // Prevent multiple redirects
        if (hasRedirected.current) return;
        
        // Wait for auth to finish loading
        if (authLoading) return;
        if (!profileLoaded) return;
        if (!currentUser) return;
        if (!userType) return;
        
        // Perform redirect
        performRedirect(userType);
    // Use stable primitive values only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, profileLoaded, currentUser?.id, userType, location.pathname]);

    // Show loading screen while checking authentication or redirecting
    const shouldShowLoading = authLoading || (currentUser && profileLoaded && userData?.userType && !hasRedirected.current);
    
    if (shouldShowLoading) {
        return (
            <div className="landing-page-loading">
                <div className="landing-page-loading-content">
                    <div className="landing-page-spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    useEffect(() => {
        const handleScroll = () => {
            setHeaderScrolled(window.scrollY > 10);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu when clicking outside and prevent body scroll
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (mobileMenuOpen && !event.target.closest('.header') && !event.target.closest('.mobile-nav')) {
                setMobileMenuOpen(false);
            }
        };

        if (mobileMenuOpen) {
            document.addEventListener('click', handleClickOutside);
            // Prevent body scroll when menu is open
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.body.style.overflow = '';
        };
    }, [mobileMenuOpen]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                
                // Try using RPC function first (if it exists)
                const { data: rpcData, error: rpcError } = await supabase
                    .rpc('get_public_stats');
                
                if (!rpcError && rpcData) {
                    console.log('Stats from RPC function:', rpcData);
                    setStats({
                        jobseekers: rpcData.jobseekers || 0,
                        employers: rpcData.employers || 0,
                        vacancies: rpcData.vacancies || 0,
                        referrals: rpcData.referrals || 0,
                        placements: rpcData.placements || 0
                    });
                    setLoading(false);
                    return;
                }
                
                // Fallback: Try direct queries (may fail due to RLS)
                console.log('RPC function not available, trying direct queries...');
                
                // Fetch jobseekers
                const { data: jobseekerProfiles, error: jobseekerError } = await supabase
                    .from('jobseeker_profiles')
                    .select('id');
                
                console.log('Jobseekers query result:', { 
                    count: jobseekerProfiles?.length || 0, 
                    error: jobseekerError 
                });
                
                // Fetch employers
                const { data: employerProfiles, error: employerError } = await supabase
                    .from('employer_profiles')
                    .select('id');
                
                console.log('Employers query result:', { 
                    count: employerProfiles?.length || 0, 
                    error: employerError 
                });
                
                // Fetch approved jobs (Vacancies Solicited) with employer info
                // Only count jobs from existing employers (filter out deleted employers)
                const { data: jobs, error: jobsError } = await supabase
                    .from('jobs')
                    .select('id, employer_id, employer_profiles(id)')
                    .eq('status', 'approved');
                
                // Filter out jobs from deleted employers
                const validJobs = (jobs || []).filter(job => {
                    if (!job.employer_id) {
                        console.log(`Skipping job ${job.id} - no employer_id`);
                        return false;
                    }
                    if (!job.employer_profiles) {
                        console.log(`Skipping job ${job.id} - employer ${job.employer_id} has been deleted`);
                        return false;
                    }
                    return true;
                });
                
                console.log('Jobs query result:', { 
                    total: jobs?.length || 0,
                    valid: validJobs.length,
                    error: jobsError 
                });
                
                // Fetch applications for referrals and placements
                const { data: applications, error: applicationsError } = await supabase
                    .from('applications')
                    .select('id, status');
                
                console.log('Applications query result:', { 
                    count: applications?.length || 0, 
                    error: applicationsError 
                });
                
                // Calculate referrals (status = 'referred')
                const referralStatuses = new Set(['referred']);
                const referralsCount = (applications || []).filter(app => 
                    referralStatuses.has((app.status || '').toLowerCase())
                ).length;
                
                // Calculate placements (status = 'accepted', 'hired', or 'placed')
                const placementStatuses = new Set(['accepted', 'hired', 'placed']);
                const placementsCount = (applications || []).filter(app => 
                    placementStatuses.has((app.status || '').toLowerCase())
                ).length;
                
                const statsData = {
                    jobseekers: jobseekerProfiles?.length || 0,
                    employers: employerProfiles?.length || 0,
                    vacancies: validJobs.length || 0,
                    referrals: referralsCount,
                    placements: placementsCount
                };
                
                console.log('Final stats data:', statsData);
                
                setStats(statsData);
            } catch (error) {
                console.error('Error fetching statistics:', error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchStats();
    }, []);

    useEffect(() => {
        const fetchEmployers = async () => {
            try {
                setLoadingEmployers(true);
                
                // Try using RPC function first (if it exists)
                const { data: rpcData, error: rpcError } = await supabase
                    .rpc('get_public_employers');
                
                if (!rpcError && rpcData) {
                    console.log('Employers from RPC function:', rpcData?.length || 0, rpcData);
                    setEmployers(rpcData || []);
                    setLoadingEmployers(false);
                    return;
                }
                
                // Fallback to direct query
                console.log('RPC function not available, using direct query');
                const { data, error } = await supabase
                    .from('employer_profiles')
                    .select('id, business_name, company_logo_url, acronym')
                    .eq('verification_status', 'approved')
                    .order('business_name', { ascending: true })
                    .limit(50);
                
                if (error) {
                    console.error('Error fetching employers:', error);
                    console.error('Error details:', error);
                } else {
                    console.log('Fetched employers:', data?.length || 0, data);
                    setEmployers(data || []);
                }
                setLoadingEmployers(false);
            } catch (error) {
                console.error('Error fetching employers:', error);
                setLoadingEmployers(false);
            }
        };
        
        fetchEmployers();
    }, []);

    return (
        <div className="landing-page">
            {/* Fixed Navigation */}
            <header className={`header ${headerScrolled ? 'scrolled' : ''}`} role="banner" aria-label="Primary header">
                <div className="header-brand">
                    <img src={Logo_pesdo} alt="PESDO Logo" className="header-logo" />
                    <h1>PESDO Web Portal</h1>
                </div>
                <button 
                    className="mobile-menu-toggle" 
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Toggle mobile menu"
                    aria-expanded={mobileMenuOpen}
                >
                    {mobileMenuOpen ? '✕' : '☰'}
                </button>
                <nav aria-label="Primary navigation">
                    <Link className="btn" to="/register">Register</Link>
                    <div className="login-dropdown">
                        <button className="btn btn-outline login-dropdown-btn">Login</button>
                        <div className="login-dropdown-content">
                            <Link to="/login/jobseeker" className="login-option" onClick={() => setMobileMenuOpen(false)}>
                                <span className="login-icon">👤</span>
                                <span className="login-text">
                                    <strong>Jobseeker Login</strong>
                                    <small>Find your dream job</small>
                                </span>
                            </Link>
                            <Link to="/login/employer" className="login-option" onClick={() => setMobileMenuOpen(false)}>
                                <span className="login-icon">🏢</span>
                                <span className="login-text">
                                    <strong>Employer Login</strong>
                                    <small>Manage your business</small>
                                </span>
                            </Link>
                            {/* Admin login removed from public site; use admin subdomain */}
                        </div>
                    </div>
                </nav>
            </header>
            
            {/* Mobile Navigation */}
            <div className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
                <Link className="btn" to="/register" onClick={() => setMobileMenuOpen(false)}>Register</Link>
                <div className="login-dropdown">
                    <button className="btn btn-outline login-dropdown-btn">Login</button>
                    <div className="login-dropdown-content">
                        <Link to="/login/jobseeker" className="login-option" onClick={() => setMobileMenuOpen(false)}>
                            <span className="login-icon">👤</span>
                            <span className="login-text">
                                <strong>Jobseeker Login</strong>
                                <small>Find your dream job</small>
                            </span>
                        </Link>
                        <Link to="/login/employer" className="login-option" onClick={() => setMobileMenuOpen(false)}>
                            <span className="login-icon">🏢</span>
                            <span className="login-text">
                                <strong>Employer Login</strong>
                                <small>Manage your business</small>
                            </span>
                        </Link>
                        {/* Admin login removed from public site; use admin subdomain */}
                    </div>
                </div>
            </div>

            {/* Your new design content goes here */}
            <main 
                id="main" 
                className="main-content"
                style={{
                    paddingTop: 0
                }}
            >
                {/* Welcome Section */}
                <section className="welcome-section">
                    <div 
                        className="welcome-section-background"
                        style={{
                            backgroundImage: `url(${Pesdo_Office})`
                        }}
                    ></div>
                    <div className="welcome-content">
                        <h2>Welcome to PESDO</h2>
                        <p>Your gateway to employment opportunities in Surigao City. Connect jobseekers with employers and build your career or grow your business.</p>
                    </div>
                </section>

                {/* Statistics Section */}
                <section className="stats-section">
                    <div className="stats-container">
                        <h2 className="stats-section-title">Job Portal Statistics</h2>
                        <div className="stats-cards">
                            <div className="stat-card stat-card-1">
                                <span className="stat-icon">👥</span>
                                <div className="stat-content">
                                    <div className="stat-label">Registered Jobseekers</div>
                                    <div className="stat-number">
                                        {loading ? '...' : stats.jobseekers}
                                    </div>
                                </div>
                            </div>
                            <div className="stat-card stat-card-2">
                                <span className="stat-icon">🏢</span>
                                <div className="stat-content">
                                    <div className="stat-label">Registered Employers</div>
                                    <div className="stat-number">
                                        {loading ? '...' : stats.employers}
                                    </div>
                                </div>
                            </div>
                            <div className="stat-card stat-card-3">
                                <span className="stat-icon">💼</span>
                                <div className="stat-content">
                                    <div className="stat-label">Vacancies Solicited</div>
                                    <div className="stat-number">
                                        {loading ? '...' : stats.vacancies}
                                    </div>
                                </div>
                            </div>
                            <div className="stat-card stat-card-4">
                                <span className="stat-icon">📋</span>
                                <div className="stat-content">
                                    <div className="stat-label">Referrals</div>
                                    <div className="stat-number">
                                        {loading ? '...' : stats.referrals}
                                    </div>
                                </div>
                            </div>
                            <div className="stat-card stat-card-5 stat-card-active">
                                <span className="stat-icon">✅</span>
                                <div className="stat-content">
                                    <div className="stat-label">Job Placements</div>
                                    <div className="stat-number">
                                        {loading ? '...' : stats.placements}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Registered Employers Section */}
                <section className="employers-section">
                    <div className="employers-container">
                        <h2 className="employers-section-title">REGISTERED EMPLOYERS</h2>
                        {loadingEmployers ? (
                            <div className="employers-loading">Loading employers...</div>
                        ) : employers.length > 0 ? (
                            <div className="employers-grid">
                                {employers.map((employer) => (
                                    <div key={employer.id} className="employer-logo-card">
                                        {employer.company_logo_url ? (
                                            <img 
                                                src={employer.company_logo_url} 
                                                alt={employer.business_name || employer.acronym || 'Company Logo'}
                                                className="employer-logo"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div 
                                            className="employer-logo-placeholder"
                                            style={{ display: employer.company_logo_url ? 'none' : 'flex' }}
                                        >
                                            {employer.acronym || (employer.business_name ? employer.business_name.substring(0, 2).toUpperCase() : 'CO')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="employers-empty">No registered employers yet.</div>
                        )}
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3>PESDO Web Portal</h3>
                        <p>Connecting jobseekers with employers in Surigao City</p>
                    </div>
                    <div className="footer-section">
                        <h4>Quick Links</h4>
                        <ul>
                            <li><Link to="/">Home</Link></li>
                            <li><Link to="/jobseeker/login">Jobseeker Login</Link></li>
                            <li><Link to="/employer/login">Employer Login</Link></li>
                            {/* Admin login removed from public site; use admin subdomain */}
                        </ul>
                    </div>
                    <div className="footer-section">
                        <h4>Contact</h4>
                        <p>Public Employment Service Office</p>
                        <p>Surigao City, Philippines</p>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} PESDO Web Portal. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
