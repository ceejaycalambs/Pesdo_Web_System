import React from 'react';
import './TermsAndConditions.css';

const TermsAndConditions = ({ onClose }) => {
  return (
    <div className="terms-modal-overlay" onClick={onClose}>
      <div className="terms-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="terms-modal-header">
          <h2>Terms and Conditions</h2>
          <button className="terms-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="terms-modal-body">
          <div className="terms-content">
            <p className="terms-intro">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
            </p>
            
            <section>
              <h3>1. Acceptance of Terms</h3>
              <p>
                By accessing and using the PESDO (Public Employment Service Office) Web Portal, 
                you accept and agree to be bound by these Terms and Conditions. If you do not 
                agree to these terms, please do not use this platform.
              </p>
            </section>

            <section>
              <h3>2. Account Registration</h3>
              <p>
                To use the PESDO platform, you must create an account by providing accurate, 
                current, and complete information. You are responsible for:
              </p>
              <ul>
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying PESDO immediately of any unauthorized use</li>
                <li>Ensuring your information remains accurate and up-to-date</li>
              </ul>
            </section>

            <section>
              <h3>3. User Responsibilities</h3>
              <h4>For Jobseekers:</h4>
              <ul>
                <li>Provide accurate personal and professional information</li>
                <li>Submit genuine job applications</li>
                <li>Maintain professional conduct in all interactions</li>
                <li>Respect employer privacy and confidentiality</li>
                <li>Withdraw applications if no longer interested</li>
              </ul>
              
              <h4>For Employers:</h4>
              <ul>
                <li>Provide accurate business information and required documents (BIR, Business Permit)</li>
                <li>Post legitimate job vacancies with accurate descriptions</li>
                <li>Review applications in a timely and professional manner</li>
                <li>Maintain confidentiality of jobseeker information</li>
                <li>Comply with employment laws and regulations</li>
                <li>Complete employer verification process before posting jobs</li>
              </ul>
            </section>

            <section>
              <h3>4. Employer Verification</h3>
              <p>
                Employers must complete the verification process before posting job vacancies:
              </p>
              <ul>
                <li>Upload required documents (BIR Certificate and Business Permit)</li>
                <li>Wait for admin review and approval</li>
                <li>Maintain verified status to continue posting jobs</li>
                <li>Re-upload documents if verification is rejected</li>
              </ul>
              <p>
                PESDO reserves the right to suspend or revoke employer accounts that violate 
                these terms or fail to maintain proper verification.
              </p>
            </section>

            <section>
              <h3>5. Job Posting and Application Process</h3>
              <ul>
                <li>All job postings are subject to admin review and approval</li>
                <li>Jobseekers can apply to approved job vacancies</li>
                <li>Employers can accept, reject, or refer applications</li>
                <li>Admins may refer jobseekers to suitable positions</li>
                <li>All parties must maintain professional communication</li>
              </ul>
            </section>

            <section>
              <h3>6. Prohibited Activities</h3>
              <p>You agree NOT to:</p>
              <ul>
                <li>Post false, misleading, or fraudulent information</li>
                <li>Use the platform for any illegal activities</li>
                <li>Harass, abuse, or discriminate against other users</li>
                <li>Share account credentials with others</li>
                <li>Attempt to bypass security measures</li>
                <li>Post jobs that violate employment laws</li>
                <li>Spam or send unsolicited communications</li>
                <li>Impersonate another person or entity</li>
              </ul>
            </section>

            <section>
              <h3>7. Account Suspension and Termination</h3>
              <p>
                PESDO reserves the right to suspend or terminate accounts that:
              </p>
              <ul>
                <li>Violate these Terms and Conditions</li>
                <li>Engage in fraudulent or illegal activities</li>
                <li>Fail to maintain required verification documents (for employers)</li>
                <li>Demonstrate unprofessional conduct</li>
                <li>Repeatedly violate platform policies</li>
              </ul>
            </section>

            <section>
              <h3>8. Intellectual Property</h3>
              <p>
                All content on the PESDO platform, including logos, text, graphics, and software, 
                is the property of PESDO or its licensors and is protected by copyright and 
                trademark laws.
              </p>
            </section>

            <section>
              <h3>9. Limitation of Liability</h3>
              <p>
                PESDO provides the platform "as is" and does not guarantee:
              </p>
              <ul>
                <li>Uninterrupted or error-free service</li>
                <li>Accuracy of job postings or applications</li>
                <li>Successful job placements</li>
                <li>Compatibility with all devices or browsers</li>
              </ul>
              <p>
                PESDO is not responsible for disputes between jobseekers and employers, 
                employment decisions, or outcomes of job applications.
              </p>
            </section>

            <section>
              <h3>10. Privacy and Data Protection</h3>
              <p>
                Your use of the platform is also governed by our Privacy Policy. By using 
                the platform, you consent to the collection, use, and sharing of your 
                information as described in the Privacy Policy.
              </p>
            </section>

            <section>
              <h3>11. Modifications to Terms</h3>
              <p>
                PESDO reserves the right to modify these Terms and Conditions at any time. 
                Continued use of the platform after changes constitutes acceptance of the 
                modified terms.
              </p>
            </section>

            <section>
              <h3>12. Contact Information</h3>
              <p>
                For questions about these Terms and Conditions, please contact PESDO Surigao 
                through the official channels provided on the platform.
              </p>
            </section>

            <section>
              <h3>13. Governing Law</h3>
              <p>
                These Terms and Conditions are governed by the laws of the Philippines and 
                the jurisdiction of Surigao City.
              </p>
            </section>
          </div>
        </div>
        <div className="terms-modal-footer">
          <button className="terms-modal-btn" onClick={onClose}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;

