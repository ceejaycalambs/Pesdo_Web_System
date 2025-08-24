import React, { useEffect, useState } from 'react';
import './LandingPage.css';
import Pesdo_Office from '../assets/Pesdo_Office.png';
import Logo_pesdo from '../assets/Logo_pesdo.png';
import { Link } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { getStats, firebaseDB } from '../services/firebaseService';

const LandingPage = () => {
    const [showScroll, setShowScroll] = useState(false);
    const [footerVisible, setFooterVisible] = useState(false);
    const [headerScrolled, setHeaderScrolled] = useState(false);
    const [stats, setStats] = useState({ jobseekers: 0, employers: 0, openJobs: 0 });
    const [recentJobs, setRecentJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        AOS.init({
            duration: prefersReducedMotion ? 0 : 1000,
            once: false,
            mirror: true,
            disable: prefersReducedMotion
        });

        const handleScroll = () => {
            setShowScroll(window.scrollY > 300);
            setHeaderScrolled(window.scrollY > 10);

            // Update footer visibility hint (kept for fade effect if needed)
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 50) {
                setFooterVisible(true);
            } else {
                setFooterVisible(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Fetch data from Firebase
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [statsData, jobsData] = await Promise.all([
                    getStats(),
                    firebaseDB.jobs.getRecentJobs(3)
                ]);
                
                setStats(statsData);
                setRecentJobs(jobsData);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch data:', err);
                setError('Failed to load data. Please try again later.');
                // Fallback to static data
                setStats({ jobseekers: 8500, employers: 120, openJobs: 300 });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const scrollTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="landing-page">
            <a href="#main" className="skip-link">Skip to main content</a>
            {/* Fixed Navigation */}
            <header className={`header ${headerScrolled ? 'scrolled' : ''}`} role="banner" aria-label="Primary header">
                <div className="header-brand">
                    <img src={Logo_pesdo} alt="PESDO Logo" className="header-logo" />
                    <h1>PESDO Web Portal</h1>
                </div>
                <nav aria-label="Primary navigation">
                    <Link className="btn" to="/register">Register</Link>
                    <Link className="btn btn-outline" to="/login">Login</Link>
                </nav>
            </header>

            <main id="main">
                {/* Hero Section */}
                <section
                    className="hero"
                    style={{
                        backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${Pesdo_Office})`
                    }}
                    aria-label="Hero"
                >
                    <div className="hero-content" data-aos="fade-up">
                        <h2>Your Gateway to Employment in Surigao City</h2>
                        <p>Connecting job seekers with the right opportunities.</p>
                        <div className="hero-cta">
                            <Link className="btn btn-accent" to="/register" aria-label="Register as a new user">Get Started</Link>
                            <Link className="btn btn-light" to="/login" aria-label="Login to your account">I already have an account</Link>
                        </div>
                    </div>
                    <a className="scroll-down" href="#how-it-works" aria-label="Scroll to How it works">↓</a>
                </section>

                {/* How It Works */}
                <section id="how-it-works" className="how-it-works" aria-label="How it works" data-aos="fade-up">
                    <h3>How It Works</h3>
                    <div className="steps">
                        <div className="step" data-aos="fade-up">
                            <h4>1. Create your profile</h4>
                            <p>Register and complete your details to be visible to employers.</p>
                        </div>
                        <div className="step" data-aos="fade-up" data-aos-delay="100">
                            <h4>2. Explore job listings</h4>
                            <p>Browse curated vacancies matched to your skills and interests.</p>
                        </div>
                        <div className="step" data-aos="fade-up" data-aos-delay="200">
                            <h4>3. Get referred and hired</h4>
                            <p>We facilitate referrals and job matching to accelerate hiring.</p>
                        </div>
                    </div>
                </section>

                {/* Partners */}
                <section className="partners" aria-label="Partner organizations" data-aos="fade-up">
                    <div className="partners-inner">
                        <span className="partners-label">Trusted by</span>
                        <ul className="partner-logos">
                            <li className="partner">PESDO</li>
                            <li className="partner">LGU Surigao</li>
                            <li className="partner">DOLE</li>
                            <li className="partner">TESDA</li>
                        </ul>
                    </div>
                </section>

                {/* Features Section */}
                <section className="features" data-aos="fade-up" aria-label="Services">
                    <h3>Our Services</h3>
                    <ul className="feature-cards">
                        <li className="card" data-aos="fade-up">
                            <div className="card-icon" aria-hidden="true">📝</div>
                            <h4 className="card-title">Jobseekers Registration</h4>
                            <p className="card-desc">Sign up and create your profile to start applying for jobs.</p>
                        </li>
                        <li className="card" data-aos="fade-up" data-aos-delay="100">
                            <div className="card-icon" aria-hidden="true">🔎</div>
                            <h4 className="card-title">Job Vacancies Listing</h4>
                            <p className="card-desc">Browse verified, up-to-date postings tailored to your skills.</p>
                        </li>
                        <li className="card" data-aos="fade-up" data-aos-delay="200">
                            <div className="card-icon" aria-hidden="true">🤝</div>
                            <h4 className="card-title">Referrals & Matching</h4>
                            <p className="card-desc">Get matched with roles and referred by our PESDO network.</p>
                        </li>
                        <li className="card" data-aos="fade-up" data-aos-delay="300">
                            <div className="card-icon" aria-hidden="true">📊</div>
                            <h4 className="card-title">Employment Reports</h4>
                            <p className="card-desc">Access employment trends and reports for informed decisions.</p>
                        </li>
                    </ul>
                </section>

                {/* Recent Jobs Preview */}
                {recentJobs.length > 0 && (
                    <section className="recent-jobs" aria-label="Recent job opportunities" data-aos="fade-up">
                        <h3>Latest Opportunities</h3>
                        <div className="jobs-preview">
                            {recentJobs.map((job) => (
                                <div key={job.id} className="job-preview-card" data-aos="fade-up">
                                    <h4>{job.title}</h4>
                                    <p className="company">{job.company_name}</p>
                                    <p className="location">{job.location}</p>
                                    <p className="salary">{job.salary_range}</p>
                                </div>
                            ))}
                        </div>
                        <Link to="/jobseeker" className="btn btn-accent">View All Jobs</Link>
                    </section>
                )}

                {/* Key Stats */}
                <section className="stats" aria-label="Key statistics" data-aos="fade-up">
                    {loading ? (
                        <div className="stats-loading">Loading statistics...</div>
                    ) : error ? (
                        <div className="stats-error">{error}</div>
                    ) : (
                        <>
                            <div className="stat" aria-label="Registered jobseekers">
                                <strong>{stats.jobseekers.toLocaleString()}+</strong>
                                <span>Jobseekers</span>
                            </div>
                            <div className="stat" aria-label="Active employers">
                                <strong>{stats.employers.toLocaleString()}+</strong>
                                <span>Employers</span>
                            </div>
                            <div className="stat" aria-label="Open job postings">
                                <strong>{stats.openJobs.toLocaleString()}+</strong>
                                <span>Open Jobs</span>
                            </div>
                        </>
                    )}
                </section>

                {/* Final CTA */}
                <section className="final-cta" aria-label="Get started" data-aos="fade-up">
                    <h3>Ready to take the next step?</h3>
                    <p>Create your account or log in to continue.</p>
                    <div className="final-cta-actions">
                        <Link className="btn btn-accent" to="/register">Create free account</Link>
                        <Link className="btn btn-outline-dark" to="/login">Login</Link>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer
                className={`footer ${footerVisible ? 'fade-in' : 'fade-out'}`}
                data-aos="fade-up"
            >
                <p>© 2025 PESDO Surigao City | Contact: peso_surigao@yahoo.com</p>
            </footer>

            {/* Scroll-to-Top Button */}
            {showScroll && (
                <button className="scroll-top" onClick={scrollTop} aria-label="Scroll back to top">
                    ↑
                </button>
            )}
        </div>
    );
};

export default LandingPage;
